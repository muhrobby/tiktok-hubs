# Plan: Frontend-Backend Cache Synchronization

> **Status:** Draft
> **Priority:** High
> **Created:** 2024-02-04
> **Related:** [Redis Caching Implementation](./migration/REDIS_CACHE_IMPLEMENTATION.md)

---

## Context

Backend telah diimplementasikan **Redis caching** untuk meningkatkan performa. Frontend menggunakan **React Query** untuk data fetching. Keduanya memiliki mekanisme caching terpisah yang dapat menyebabkan **data inconsistency**.

### Current State

```
┌────────────────────────────────────────────────────────────────────┐
│                         CURRENT ARCHITECTURE                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Frontend (React Query)          Backend (Hono)        Redis      │
│   ┌─────────────────┐              ┌─────────┐        ┌───────┐   │
│   │ Query Cache     │ ───────────> │ API     │ ────> │ Cache │   │
│   │ - 5 min TTL     │              │ Handler │        │       │   │
│   │ - Auto refetch  │              └─────────┘        └───────┘   │
│   └─────────────────┘                    ▲                            │
│                                            │                         │
│                                    Invalidate│                         │
│                                        (Unknown to Frontend)         │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### Problem Statement

1. **Double Caching Layer**
   - Frontend cache (React Query): 5 menit stale time
   - Backend cache (Redis): 1-5 menit TTL (bervariasi)
   - Tidak ada koordinasi antara keduanya

2. **Stale Data Scenario**
   - User membuka dashboard → Frontend cache data
   - Admin trigger sync → Backend update & invalidate Redis
   - User refresh → Frontend masih pakai data lama (sampai 5 menit)

3. **No Cache Coordination**
   - Frontend tidak tahu kapan backend cache di-invalidate
   - Backend tidak memberi tahu frontend tentang perubahan data

---

## Current Cache Configuration

### Backend (Redis) Cache TTLs

| Data Type | TTL | Endpoint | File |
|-----------|-----|----------|------|
| Store list | 5 min | `GET /admin/stores` | `sync.service.ts` |
| Store detail | 5 min | `GET /admin/stores/:code` | `cache.service.ts` |
| User stats | 1 min | `GET /admin/stores/:code/user-stats` | `sync.service.ts` |
| Video stats | 1 min | `GET /admin/stores/:code/video-stats` | `sync.service.ts` |
| Analytics overview | Dynamic | `GET /admin/analytics/overview` | `analytics.routes.ts` |
| TikTok User API | 5 min | TikTok API | `tiktokApi.service.ts` |
| TikTok Video API | 5 min | TikTok API | `tiktokApi.service.ts` |
| User roles | 5 min | Internal | `user.service.ts` |
| All roles | 60 min | Internal | `user.service.ts` |

### Frontend (React Query) Configuration

```typescript
// providers/query-provider.tsx
staleTime: 5 * 60 * 1000,      // 5 minutes
gcTime: 10 * 60 * 1000,         // 10 minutes
```

---

## Proposed Solutions

### Option 1: HTTP Caching Headers (Recommended) ⭐

Backend mengirim cache headers yang React Query otomatis menghormati.

**Pros:**
- ✅ Standar HTTP, tidak perlu custom logic
- ✅ React Query sudah support built-in
- ✅ Browser juga bisa manfaatin cache headers
- ✅ Minimal code changes

**Cons:**
- ⚠️ React Query default masih akan pakai staleTime sendiri
- ⚠️ Perlu konfigurasi query-by-query

**Implementation:**

#### Backend Changes

```typescript
// src/utils/http-cache.ts
export interface CacheHeaders {
  'Cache-Control'?: string;
  'ETag'?: string;
  'Last-Modified'?: string;
}

export function createETag(data: unknown): string {
  const str = JSON.stringify(data);
  return crypto.createHash('md5').update(str).digest('hex');
}

export function getCacheHeaders(
  data: unknown,
  maxAge: number
): CacheHeaders {
  return {
    'Cache-Control': `max-age=${maxAge}, must-revalidate`,
    'ETag': createETag(data),
  };
}
```

```typescript
// src/routes/admin.routes.ts
import { getCacheHeaders, getCacheTTL } from '../cache/index.js';

admin.get('/stores', async (c) => {
  const stores = await syncService.getStoresWithStatus();

  return c.json(
    {
      success: true,
      data: stores,
      count: stores.length,
    },
    {
      headers: getCacheHeaders(stores, getCacheTTL('short')),
    }
  );
});
```

#### Frontend Changes

```typescript
// lib/api.ts - Add cache awareness
export const api = {
  stores: {
    list: () => axios.get('/admin/stores', {
      // Respect backend cache headers
      axiosOptions: {
        headers: { 'Cache-Control': 'no-cache' }, // Can override
      }
    }),
  },
};

// providers/query-provider.tsx - Configure for HTTP cache
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: false, // Use HTTP cache headers instead
      gcTime: 10 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
```

---

### Option 2: Cache Invalidation Endpoint

Backend menyediakan endpoint untuk invalidate cache secara eksplisit.

**Pros:**
- ✅ Frontend bisa trigger invalidate after mutations
- ✅ Granular control (pattern-based invalidation)
- ✅ Bisa di-integrate dengan React Query mutations

**Cons:**
- ⚠️ Perlu tambahan endpoint dan security
- ⚠️ Frontend harus memanggil secara eksplisit

**Implementation:**

#### Backend Changes

```typescript
// src/routes/admin.routes.ts
/**
 * POST /admin/cache/invalidate
 * Invalidate cache patterns (Admin only)
 */
admin.post('/cache/invalidate', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { patterns = [] } = body || {};

  if (!Array.isArray(patterns) || patterns.length === 0) {
    return errorResponse(c, 400, 'INVALID_REQUEST', 'patterns array required');
  }

  let totalInvalidated = 0;

  for (const pattern of patterns) {
    const deleted = await delPattern(pattern);
    totalInvalidated += deleted;
  }

  logger.info({ patterns, totalInvalidated }, 'Cache invalidated via API');

  return c.json({
    success: true,
    data: {
      patterns,
      totalInvalidated,
    },
  });
});

/**
 * GET /admin/cache/stats
 * Get cache statistics (already implemented)
 */
```

#### Frontend Changes

```typescript
// lib/api.ts
export const api = {
  cache: {
    invalidate: (patterns: string[]) =>
      axios.post('/admin/cache/invalidate', { patterns }),
    stats: () =>
      axios.get('/admin/cache/stats'),
  },
};

// hooks/useMutationWithInvalidation.ts
export function useMutationWithInvalidation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidatePatterns: string[]
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      // Invalidate backend cache
      await api.cache.invalidate(invalidatePatterns);

      // Invalidate frontend cache
      for (const pattern of invalidatePatterns) {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0] as string;
            return key === pattern || key.startsWith(pattern.split('*')[0]);
          },
        });
      }
    },
  });
}

// Usage example
export function useSyncStore() {
  return useMutationWithInvalidation(
    ({ store_code }) => api.admin.sync.run({ store_code }),
    ['stores:*', 'analytics:*'] // Invalidate these patterns
  );
}
```

---

### Option 3: TTL Synchronization

Samakan TTL frontend dengan backend secara konsisten.

**Pros:**
- ✅ Tidak perlu perubahan arsitektur
- ✅ Mudah diimplementasikan

**Cons:**
- ⚠️ Masih ada potensi stale window
- ⚠️ Tidak solve root problem (no coordination)

**Implementation:**

```typescript
// Frontend - per-query configuration
export const queryConfig = {
  // Match backend TTLs
  stores: {
    list: { staleTime: 5 * 60 * 1000 },           // 5 min
    detail: { staleTime: 5 * 60 * 1000 },          // 5 min
  },
  stats: {
    user: { staleTime: 1 * 60 * 1000 },            // 1 min
    video: { staleTime: 1 * 60 * 1000 },           // 1 min
  },
  analytics: {
    overview: { staleTime: 2 * 60 * 1000 },        // 2 min
    trend: { staleTime: 5 * 60 * 1000 },            // 5 min
  },
  tiktok: {
    api: { staleTime: 5 * 60 * 1000 },             // 5 min
  },
};

// Usage in components
const { data } = useQuery(
  ['stores', 'list'],
  () => api.stores.list(),
  queryConfig.stores.list
);
```

---

### Option 4: Optimistic Updates (Frontend)

Update UI immediately, revalidate setelah mutation sukses.

**Pros:**
- ✅ UX lebih responsif
- ✅ Tidak perlu koordinasi backend
- ✅ Standard React Query pattern

**Cons:**
- ⚠️ Perlu rollback logic untuk error case
- ⚠️ Complex state updates

**Implementation:**

```typescript
// hooks/useOptimisticSync.ts
export function useOptimisticSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storeCode: string) => {
      // Optimistic update
      queryClient.setQueryData(['stores', storeCode], (old: any) => ({
        ...old,
        lastSyncTime: new Date().toISOString(),
        syncStatus: 'SYNCING',
      }));

      // Call API
      const result = await api.admin.sync.run({ store_code: storeCode });

      // Invalidate to get fresh data
      await queryClient.invalidateQueries(['stores', storeCode]);
      await queryClient.invalidateQueries(['stats', storeCode]);

      return result;
    },
    onError: (error, variables) => {
      // Rollback on error
      queryClient.invalidateQueries(['stores', variables]);
      queryClient.invalidateQueries(['stats', variables]);
    },
  });
}
```

---

## Recommended Implementation Plan

### Phase 1: Quick Wins (1-2 days)

| Task | Backend | Frontend | Priority |
|------|---------|----------|----------|
| Add ETag headers to all GET endpoints | ✅ | - | P0 |
| Document cache TTLs in shared types | ✅ | ✅ | P0 |
| Create cache invalidation endpoint | ✅ | - | P1 |

### Phase 2: Frontend Coordination (2-3 days)

| Task | Backend | Frontend | Priority |
|------|---------|----------|----------|
| Implement cache invalidation hook | - | ✅ | P1 |
| Add optimistic updates for sync | - | ✅ | P1 |
| Update React Query configuration | - | ✅ | P1 |
| Add stale-while-revalidate indicator | - | ✅ | P2 |

### Phase 3: Advanced Features (3-5 days)

| Task | Backend | Frontend | Priority |
|------|---------|----------|----------|
| WebSocket for real-time updates | ✅ | ✅ | P2 |
| Cache metrics dashboard | ✅ | ✅ | P3 |
| Automatic cache warming | ✅ | - | P3 |

---

## File Changes Summary

### Backend Files to Modify

| File | Changes |
|------|---------|
| `src/utils/http-cache.ts` | **NEW** - Cache headers utilities |
| `src/routes/admin.routes.ts` | Add cache headers to responses |
| `src/routes/analytics.routes.ts` | Add cache headers to responses |
| `src/middleware/cacheHeaders.ts` | **NEW** - Middleware for cache headers |
| `docs/api/cache-strategy.md` | **NEW** - Cache strategy documentation |

### Frontend Files to Modify

| File | Changes |
|------|---------|
| `lib/api.ts` | Add cache invalidation endpoints |
| `providers/query-provider.tsx` | Update cache configuration |
| `hooks/useMutationWithInvalidation.ts` | **NEW** - Cache invalidation hook |
| `hooks/useOptimisticSync.ts` | **NEW** - Optimistic sync hook |
| `components/StaleIndicator.tsx` | **NEW** - Show stale data warning |

---

## Testing Strategy

### 1. Cache Consistency Tests

```typescript
// Test: Backend invalidates, frontend respects
test('cache invalidation propagates to frontend', async () => {
  // 1. Fetch initial data
  const { data: data1 } = await api.stores.list();

  // 2. Trigger sync (invalidates backend cache)
  await api.admin.sync.run({ store_code: 'TEST' });

  // 3. Invalidate frontend cache
  await api.cache.invalidate(['stores:*']);

  // 4. Fetch again - should get fresh data
  const { data: data2 } = await api.stores.list();
  expect(data2.timestamp).toBeGreaterThan(data1.timestamp);
});
```

### 2. Stale Data Detection

```typescript
// Test: Detect stale data after sync
test('shows stale indicator when data is old', async () => {
  const { result } = renderHook(() => useStores());

  // Trigger sync elsewhere
  await api.admin.sync.run({ store_code: 'TEST' });

  // Should show stale indicator
  expect(result.current.isStale).toBe(true);
});
```

### 3. ETag Validation

```typescript
// Test: ETag prevents unnecessary data transfer
test('ETag header reduces data transfer', async () => {
  const { data: data1, headers: headers1 } = await api.stores.list();
  const etag = headers1['etag'];

  // Request with ETag - should return 304
  const { status } = await api.stores.list({
    headers: { 'If-None-Match': etag }
  });

  expect(status).toBe(304);
});
```

---

## Rollback Plan

If cache synchronization causes issues:

1. **Disable Redis**: Set `REDIS_ENABLED=false`
2. **Remove Cache Headers**: Delete `http-cache.ts`
3. **Restore Frontend Defaults**: Reset `query-provider.tsx`
4. **Frontend Auto-Refresh**: Reduce stale time to 1 minute

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Stale data incidents | ~10/day | <2/day | 80% reduction |
| Unnecessary API calls | ~500/hour | ~100/hour | 80% reduction |
| Avg response time (cached) | N/A | <50ms | <50ms |
| Cache hit rate | 0% | >80% | >80% |

---

## Open Questions

1. [ ] Should we implement WebSocket for real-time updates?
2. [ ] What's the acceptable stale window for analytics data?
3. [ ] Do we need cache warming for frequently accessed data?
4. [ ] Should we implement cache versioning to handle schema changes?

---

## References

- [Redis Caching Implementation](./migration/REDIS_CACHE_IMPLEMENTATION.md)
- [API Documentation](./api/README.md)
- [React Query Documentation](https://tanstack.com/query/latest)
- [HTTP Caching (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
