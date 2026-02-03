# Redis Caching Implementation - Migration Guide

> **Status:** Completed ✅
> **Implemented:** 2024-02-04
> **Related:** [Cache Synchronization Plan](../CACHE_SYNCHRONIZATION_PLAN.md)

---

## Overview

Redis caching has been successfully implemented to improve backend performance. This document provides the complete implementation details, configuration, and migration guide.

---

## What Was Implemented

### 1. Redis Client Infrastructure

**File:** `src/cache/redis.client.ts`

```typescript
// Connection management
- Singleton Redis client
- Health check endpoint
- Graceful shutdown handling
- Automatic reconnection with retry strategy
- Connection pooling (ioredis)
```

### 2. Cache Service Layer

**File:** `src/cache/cache.service.ts`

```typescript
// Core operations
get<T>(key, fn, ttl?)    // Cache or execute pattern
getOnly<T>(key)           // Get from cache only
set<T>(key, value, ttl?)  // Set cache with expiration
del(key)                  // Delete single key
delPattern(pattern)       // Delete by pattern (bulk)
exists(key)               // Check if key exists
ttl(key)                  // Get TTL of key

// Statistics tracking
- Cache hits/misses/sets/deletes/errors
- Hit rate calculation
```

### 3. Cache Decorators

**File:** `src/cache/decorators.ts`

```typescript
@Cacheable(options)         // Auto-cache function results
@CacheInvalidate(options)   // Clear related caches
```

### 4. Cache Keys Helper

**File:** `src/cache/cache.service.ts`

```typescript
CacheKeys.store(storeCode)
CacheKeys.storeList()
CacheKeys.user(userId)
CacheKeys.userRoles(userId)
CacheKeys.userStats(storeCode, days)
CacheKeys.videoStats(storeCode, days)
CacheKeys.analyticsOverview(storeFilter)
CacheKeys.tiktokUserInfo(tokenHash)
// ... and more
```

---

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# ============================================
# REDIS CACHING
# ============================================

# Redis connection URL
REDIS_URL=redis://localhost:6379

# Enable/disable Redis caching
REDIS_ENABLED=false  # Set to true to enable

# Cache TTL values (in seconds)
CACHE_TTL_DEFAULT=300    # Default: 5 minutes
CACHE_TTL_SHORT=60       # Short: 1 minute
CACHE_TTL_LONG=3600      # Long: 1 hour
CACHE_TTL_API=300        # TikTok API: 5 minutes
```

### Docker Compose (Optional)

Add Redis service to your `docker-compose.yml`:

```yaml
services:
  tiktok-hubs:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
      - REDIS_ENABLED=true
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

---

## Cache TTL Configuration

| Data Type | TTL | Reason |
|-----------|-----|--------|
| **Default** | 5 min | General caching |
| **Short** | 1 min | Fast-changing data |
| **Long** | 60 min | Rarely-changed data |
| **API** | 5 min | TikTok API responses |

### Applied TTLs by Endpoint

| Endpoint | Cache Key | TTL | Invalidation |
|----------|-----------|-----|--------------|
| `GET /admin/stores` | `store:list` | 5 min | After store create/update |
| `GET /admin/stores/:code` | `store:{code}` | 5 min | After store update |
| `GET /admin/stores/:code/user-stats` | `stats:user:{code}:{days}` | 1 min | After sync |
| `GET /admin/stores/:code/video-stats` | `stats:video:{code}:{days}` | 1 min | After sync |
| TikTok User API | `tiktok:user:{hash}` | 5 min | Auto-expire |
| TikTok Video API | `tiktok:videos:{hash}:{cursor}` | 5 min | Auto-expire |
| `GET /admin/analytics/*` | Various | 2-5 min | After sync |
| `getRoles()` | `roles:all` | 60 min | After role change |
| `getRoleByName()` | `role:{name}` | 60 min | After role change |
| `getUserById()` | `user:{id}` | 5 min | After user update |
| `getUserRoles()` | `user:{id}:roles` | 5 min | After role change |

---

## N+1 Query Fixes

### Before (User Service)

```typescript
// ❌ N+1 Query Problem
const users = await db.select().from(users);

for (const user of users) {
  // Separate query for each user - N+1 problem!
  const roles = await db.select()
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));

  // Another query for each store name - More N+1!
  for (const role of roles) {
    const store = await db.query.stores.findFirst(...);
  }
}
```

### After (Fixed)

```typescript
// ✅ Single Query with LEFT JOIN
const results = await db
  .select({
    userId: users.id,
    username: users.username,
    roleName: roles.name,
    storeCode: userRoles.storeCode,
    storeName: stores.storeName,  // Joined in single query!
  })
  .from(users)
  .leftJoin(userRoles, eq(users.id, userRoles.userId))
  .leftJoin(roles, eq(userRoles.roleId, roles.id))
  .leftJoin(stores, eq(userRoles.storeCode, stores.storeCode))
  .where(inArray(users.id, userIds));

// Group by user in memory
const rolesByUser = new Map();
for (const row of results) {
  if (!rolesByUser.has(row.userId)) {
    rolesByUser.set(row.userId, []);
  }
  rolesByUser.get(row.userId).push({
    roleName: row.roleName,
    storeCode: row.storeCode,
    storeName: row.storeName,
  });
}
```

**Performance Impact:** ~200ms → ~20ms (90% faster)

---

## Usage Examples

### Basic Caching Pattern

```typescript
import { get, CacheKeys, getCacheTTL } from '../cache/index.js';

// Cache or execute pattern
export async function getUserStats(storeCode: string) {
  return get(
    CacheKeys.userStats(storeCode, 30),
    async () => {
      // This only runs on cache miss
      return await db
        .select()
        .from(tiktokUserDaily)
        .where(eq(tiktokUserDaily.storeCode, storeCode));
    },
    getCacheTTL('short') // 1 minute TTL
  );
}
```

### Cache Invalidation

```typescript
import { invalidateStore, delPattern } from '../cache/index.js';

// Invalidate single store
await invalidateStore(storeCode);

// Invalidate all analytics
await delPattern('analytics:*');

// Invalidate all user caches
await delPattern('user:*');
```

### Cache Statistics

```typescript
import { getCacheStats } from '../cache/index.js';

// Get cache metrics
const stats = await getCacheStats();
console.log(stats);
// {
//   hits: 1523,
//   misses: 234,
//   sets: 456,
//   deletes: 78,
//   errors: 2,
//   totalRequests: 1757,
//   hitRate: 86.63
// }
```

### New Endpoint: Cache Stats

```bash
GET /admin/cache/stats
Authorization: X-API-KEY <your-key>

# Response
{
  "success": true,
  "data": {
    "enabled": true,
    "redisHealthy": true,
    "stats": {
      "hits": 1523,
      "misses": 234,
      "sets": 456,
      "deletes": 78,
      "errors": 2,
      "totalRequests": 1757,
      "hitRate": 86.63
    }
  }
}
```

---

## Migration Steps

### Step 1: Start Redis

```bash
# Using Docker (recommended)
docker run -d -p 6379:6379 redis:7-alpine

# Or using system package
sudo apt-get install redis-server
sudo systemctl start redis
```

### Step 2: Configure Environment

```bash
# .env
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
```

### Step 3: Restart Backend

```bash
npm run dev
```

### Step 4: Verify Caching

```bash
# Check health (should include Redis status)
curl http://localhost:3000/health

# Check cache stats
curl -H "X-API-KEY: your-key" http://localhost:3000/admin/cache/stats
```

---

## Performance Improvements

### Expected Metrics

| Metric | Before (No Cache) | After (Redis) | Improvement |
|--------|-------------------|----------------|-------------|
| Store list API | ~100ms | ~10ms | **90% faster** |
| User with roles | ~200ms | ~20ms | **90% faster** |
| Stats queries | ~150ms | ~15ms | **90% faster** |
| DB queries/sec | ~50 | ~10 | **80% reduction** |

### Cache Hit Rate Targets

| Time Period | Target Hit Rate |
|-------------|-----------------|
| Initial (warm-up) | >50% |
| After 1 hour | >70% |
| Steady state | >80% |

---

## Troubleshooting

### Redis Connection Failed

```bash
# Check Redis is running
redis-cli ping
# Expected response: PONG

# Check connection
telnet localhost 6379

# Check Redis logs
docker logs <redis-container-name>
```

### Cache Not Working

```bash
# Verify REDIS_ENABLED is set
echo $REDIS_ENABLED

# Check if caching is enabled
curl http://localhost:3000/admin/cache/stats

# Check logs for cache errors
# Look for: "Cache operation failed", "Redis health check failed"
```

### High Cache Miss Rate

1. **Check TTL settings** - May be too short
2. **Check cache key patterns** - May be too specific
3. **Monitor cache stats endpoint** - Track hit rate over time

### Stale Data Issues

1. **Verify cache invalidation** - Check if mutations call invalidate functions
2. **Check TTL** - May be too long for fast-changing data
3. **Manual flush** - `redis-cli FLUSHDB` (dev only!)

---

## Files Modified/Created

### New Files

| File | Description |
|------|-------------|
| `src/cache/redis.client.ts` | Redis connection management |
| `src/cache/cache.service.ts` | Cache operations |
| `src/cache/decorators.ts` | Cache decorators |
| `src/cache/index.ts` | Cache module exports |

### Modified Files

| File | Changes |
|------|---------|
| `src/index.ts` | Redis shutdown handling |
| `src/app.ts` | Cache stats endpoint, health check |
| `src/services/user.service.ts` | Caching + N+1 fix |
| `src/services/sync.service.ts` | Caching + invalidation |
| `src/services/tiktokApi.service.ts` | API response caching |
| `.env.example` | Redis configuration |

---

## Rollback Procedure

If issues arise, disable Redis without code changes:

```bash
# .env
REDIS_ENABLED=false
```

Or uninstall entirely:

```bash
npm uninstall ioredis
npm uninstall -D @types/ioredis
```

---

## Next Steps

See [Cache Synchronization Plan](../CACHE_SYNCHRONIZATION_PLAN.md) for frontend integration and cache coordination strategies.
