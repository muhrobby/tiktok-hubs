# 📚 Learning Guide Part 4: API Integration & Services

## 🎯 Tujuan Pembelajaran

Memahami integration dengan external APIs, rate limiting, retry strategies, error handling, dan data synchronization patterns.

---

## 1. API Integration Architecture

### 1.1 Service Layer Pattern

**Kenapa perlu Services?**

```
❌ Without Services (routes call APIs directly):
routes/admin.routes.ts → TikTok API
routes/sync.routes.ts → TikTok API
jobs/syncDaily.job.ts → TikTok API

Problems:
- Code duplication
- Hard to test
- No centralized error handling
- Inconsistent retry logic

✅ With Services:
routes → services/tiktokApi.service.ts → TikTok API
jobs → services/tiktokApi.service.ts → TikTok API

Benefits:
- Reusable code
- Single source of truth
- Testable
- Consistent behavior
```

### 1.2 Separation of Concerns

```
src/services/
├── tiktokAuth.service.ts    → OAuth flow (authorization)
├── tiktokApi.service.ts     → API calls (data fetching)
├── token.service.ts         → Token management (storage)
└── sync.service.ts          → Business logic (orchestration)
```

**Responsibilities:**

1. **tiktokAuth.service** - Authentication only

   - Build OAuth URLs
   - Exchange codes for tokens
   - Refresh tokens

2. **tiktokApi.service** - External API calls only

   - Fetch user info
   - Fetch videos
   - Handle API errors

3. **token.service** - Token persistence only

   - Save/load tokens
   - Encryption/decryption
   - Token validation

4. **sync.service** - Business logic
   - Orchestrate sync process
   - Transform data
   - Database operations

---

## 2. TikTok Display API - `src/services/tiktokApi.service.ts`

### 2.1 API Configuration

```typescript
const TIKTOK_API_BASE = "https://open.tiktokapis.com";

const USER_INFO_URL = `${TIKTOK_API_BASE}/v2/user/info/`;
const VIDEO_LIST_URL = `${TIKTOK_API_BASE}/v2/video/list/`;

const USER_INFO_FIELDS = [
  "open_id",
  "display_name",
  "avatar_url",
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
];

const VIDEO_FIELDS = [
  "id",
  "create_time",
  "cover_image_url",
  "share_url",
  "video_description",
  "duration",
  "like_count",
  "comment_count",
  "share_count",
  "view_count",
];
```

**Why specify fields?**

```
❌ Without fields (request all):
- Slower response (more data)
- Higher bandwidth cost
- May include deprecated/unused fields

✅ With fields (request only needed):
- Faster response
- Lower bandwidth
- Clear data contract
- Forward compatible (new fields won't break)
```

### 2.2 Rate Limiting

```typescript
import { createRateLimiter } from "../utils/backoff.js";

// TikTok allows ~100 requests/minute per user token
// Being conservative with 1 request per second
const rateLimiter = createRateLimiter(1);
```

**Rate Limiter Implementation - `src/utils/backoff.ts`:**

```typescript
export function createRateLimiter(requestsPerSecond: number) {
  const minInterval = 1000 / requestsPerSecond; // ms between requests
  let lastCallTime = 0;

  return async function rateLimiter(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall < minInterval) {
      const delay = minInterval - timeSinceLastCall;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    lastCallTime = Date.now();
  };
}
```

**How it works:**

```
Request 1: 0ms  → Execute immediately
Request 2: 500ms → Wait 500ms (minInterval = 1000ms)
Request 3: 1500ms → Execute immediately (>1000ms passed)
```

**Math:**

```typescript
requestsPerSecond = 1
minInterval = 1000ms / 1 = 1000ms

requestsPerSecond = 2
minInterval = 1000ms / 2 = 500ms

requestsPerSecond = 10
minInterval = 1000ms / 10 = 100ms
```

**Why rate limit ourselves?**

1. **Prevent 429 errors** - Hit rate limit → request fails
2. **Be good API citizen** - Don't abuse TikTok's resources
3. **Predictable performance** - Consistent request timing
4. **Cost control** - Some APIs charge per request

### 2.3 Error Handling

```typescript
export class TikTokApiError extends Error {
  public code: string;
  public logId: string;
  public statusCode?: number;

  constructor(
    message: string,
    code: string,
    logId: string,
    statusCode?: number
  ) {
    super(message);
    this.name = "TikTokApiError";
    this.code = code;
    this.logId = logId;
    this.statusCode = statusCode;
  }

  isAuthError(): boolean {
    return (
      this.code === "access_token_invalid" ||
      this.code === "access_token_expired" ||
      this.code === "invalid_token" ||
      this.statusCode === 401
    );
  }

  isRateLimitError(): boolean {
    return this.code === "rate_limit_exceeded" || this.statusCode === 429;
  }
}
```

**Custom Error Class benefits:**

1. **Type safety** - TypeScript knows error structure
2. **Error classification** - `.isAuthError()`, `.isRateLimitError()`
3. **Debugging info** - Include log_id from TikTok
4. **Error handling** - Different actions for different errors

**Usage:**

```typescript
try {
  await fetchUserInfo(token);
} catch (error) {
  if (error instanceof TikTokApiError) {
    if (error.isAuthError()) {
      // Token invalid → mark account for reconnect
      await markNeedReconnect(storeCode);
    } else if (error.isRateLimitError()) {
      // Rate limited → retry with backoff
      await retryLater();
    }
  }
}
```

### 2.4 Retry Logic with Exponential Backoff

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  operationName?: string
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    retryableErrors,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if not retryable
      if (retryableErrors && !retryableErrors(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(factor, attempt),
        maxDelay
      );

      logger.warn(
        {
          attempt: attempt + 1,
          maxRetries,
          delay,
          operationName,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Retrying after error"
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
```

**Exponential Backoff Math:**

```
delay = initialDelay * (factor ^ attempt)

Attempt 0: 1000 * (2^0) = 1000ms   (1 second)
Attempt 1: 1000 * (2^1) = 2000ms   (2 seconds)
Attempt 2: 1000 * (2^2) = 4000ms   (4 seconds)
Attempt 3: 1000 * (2^3) = 8000ms   (8 seconds)
```

**Why exponential?**

```
❌ Fixed delay (1s, 1s, 1s):
- If server is overwhelmed, still bombarding
- Doesn't give server time to recover

✅ Exponential (1s, 2s, 4s, 8s):
- Progressively longer waits
- Gives server time to recover
- Reduces load during issues
```

**maxDelay cap:**

```typescript
delay = Math.min(calculated, maxDelay);
```

- Prevent infinite delays
- Fail fast if server is really down

**Retryable errors:**

```typescript
retryableErrors: (err) => {
  if (err instanceof TikTokApiError) {
    return err.isRateLimitError() || err.statusCode >= 500;
  }
  return false;
};
```

Only retry:

- ✅ 429 Rate Limit - Temporary, will succeed later
- ✅ 500-599 Server Errors - TikTok server issues
- ❌ 401 Auth Error - Will never succeed (token invalid)
- ❌ 400 Bad Request - Our fault, fix code not retry

### 2.5 Fetch User Info

```typescript
export async function getUserInfo(accessToken: string): Promise<UserStats> {
  await rateLimiter(); // Wait if needed

  const url = new URL(USER_INFO_URL);
  url.searchParams.set("fields", USER_INFO_FIELDS.join(","));

  logger.debug("Fetching user info from TikTok API");

  const response = await withRetry(
    async () => {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = (await res.json()) as TikTokUserInfoResponse;

      // Check for API errors
      if (data.error?.code && data.error.code !== "ok") {
        throw new TikTokApiError(
          data.error.message || "Unknown TikTok API error",
          data.error.code,
          data.error.log_id,
          res.status
        );
      }

      if (!res.ok) {
        throw new TikTokApiError(
          `HTTP error ${res.status}`,
          "http_error",
          "",
          res.status
        );
      }

      return data;
    },
    {
      maxRetries: 3,
      retryableErrors: (err): boolean => {
        if (err instanceof TikTokApiError) {
          return (
            err.isRateLimitError() ||
            Boolean(err.statusCode && err.statusCode >= 500)
          );
        }
        return false;
      },
    },
    "getUserInfo"
  );

  const user = response.data.user;

  return {
    openId: user.open_id,
    displayName: user.display_name || "",
    avatarUrl: user.avatar_url || "",
    followerCount: user.follower_count ?? 0,
    followingCount: user.following_count ?? 0,
    likesCount: user.likes_count ?? 0,
    videoCount: user.video_count ?? 0,
  };
}
```

**Flow diagram:**

```
1. Rate limit check → Wait if needed
2. Build URL with query params
3. Retry wrapper (up to 3 attempts)
   ├─ Fetch API call
   ├─ Parse JSON response
   ├─ Check for API errors
   └─ Return or throw
4. Transform response → UserStats
5. Return to caller
```

**Nullish coalescing (`??`):**

```typescript
followerCount: user.follower_count ?? 0;
```

- If `follower_count` is `null` or `undefined` → use `0`
- Different from `||`:
  - `0 || 5` → `5` (wrong!)
  - `0 ?? 5` → `0` (correct!)

### 2.6 Fetch Videos with Pagination

```typescript
export async function listVideos(
  accessToken: string,
  options: {
    cursor?: number;
    maxCount?: number;
  } = {}
): Promise<{
  videos: VideoStats[];
  cursor: number;
  hasMore: boolean;
}> {
  await rateLimiter();

  const { cursor = 0, maxCount = 20 } = options;

  // Build URL with fields as query parameter
  const url = new URL(VIDEO_LIST_URL);
  url.searchParams.set("fields", VIDEO_FIELDS.join(","));

  logger.debug({ cursor, maxCount }, "Fetching video list from TikTok API");

  const response = await withRetry(
    async () => {
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cursor,
          max_count: Math.min(maxCount, 20), // TikTok max is 20
        }),
      });

      const data = (await res.json()) as TikTokVideoListResponse;

      if (data.error?.code && data.error.code !== "ok") {
        throw new TikTokApiError(
          data.error.message,
          data.error.code,
          data.error.log_id,
          res.status
        );
      }

      return data;
    },
    { maxRetries: 3 },
    "listVideos"
  );

  const videos = (response.data.videos || []).map((video) => ({
    videoId: video.id,
    description: video.video_description || "",
    createTime: new Date(video.create_time * 1000),
    viewCount: video.view_count ?? 0,
    likeCount: video.like_count ?? 0,
    commentCount: video.comment_count ?? 0,
    shareCount: video.share_count ?? 0,
    coverImageUrl: video.cover_image_url || "",
    shareUrl: video.share_url || "",
  }));

  return {
    videos,
    cursor: response.data.cursor,
    hasMore: response.data.has_more,
  };
}
```

**Pagination explained:**

```
Page 1: cursor=0,  hasMore=true,  cursor_next=20
Page 2: cursor=20, hasMore=true,  cursor_next=40
Page 3: cursor=40, hasMore=false, cursor_next=40
```

**Why pagination?**

1. **Performance** - Don't load all data at once
2. **Memory** - Server can't return 10000 videos in one response
3. **Network** - Smaller payloads, faster response
4. **UX** - Progressive loading

**Fetch all videos:**

```typescript
export async function fetchAllVideos(
  accessToken: string
): Promise<VideoStats[]> {
  const allVideos: VideoStats[] = [];
  let cursor = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await listVideos(accessToken, { cursor });

    allVideos.push(...result.videos);

    cursor = result.cursor;
    hasMore = result.hasMore;

    logger.debug(
      {
        totalFetched: allVideos.length,
        hasMore,
      },
      "Fetched video page"
    );
  }

  return allVideos;
}
```

**Considerations:**

- Rate limiting applies per request
- Large accounts (1000+ videos) → many API calls
- Consider caching or incremental sync

---

## 3. Data Synchronization - `src/services/sync.service.ts`

### 3.1 Sync Strategy

**Snapshot-based sync:**

```
Daily snapshots = Historical data points

Day 1: followers=100
Day 2: followers=150  (+50)
Day 3: followers=200  (+50)
```

**Benefits:**

- Track growth over time
- Calculate trends
- Generate reports
- Audit trail

**Alternative (not used):**

```
Current state only:
followers=200

Problems:
- No history
- Can't calculate growth
- Can't track changes
```

### 3.2 Sync User Daily Stats

```typescript
export async function syncUserDaily(storeCode: string): Promise<void> {
  const log = storeLogger(storeCode);
  log.info("Starting user daily sync");

  // Get valid token
  const accessToken = await tokenService.getValidAccessToken(storeCode);
  if (!accessToken) {
    throw new Error("No valid access token");
  }

  // Fetch from TikTok
  const userInfo = await tiktokApi.getUserInfo(accessToken);

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  // Upsert into database
  await db
    .insert(tiktokUserDaily)
    .values({
      storeCode,
      openId: userInfo.openId,
      snapshotDate: today,
      displayName: userInfo.displayName,
      avatarUrl: userInfo.avatarUrl,
      followerCount: userInfo.followerCount,
      followingCount: userInfo.followingCount,
      likesCount: userInfo.likesCount,
      videoCount: userInfo.videoCount,
    })
    .onConflictDoUpdate({
      target: [
        tiktokUserDaily.storeCode,
        tiktokUserDaily.openId,
        tiktokUserDaily.snapshotDate,
      ],
      set: {
        displayName: userInfo.displayName,
        avatarUrl: userInfo.avatarUrl,
        followerCount: userInfo.followerCount,
        followingCount: userInfo.followingCount,
        likesCount: userInfo.likesCount,
        videoCount: userInfo.videoCount,
      },
    });

  log.info({ stats: userInfo }, "User daily sync completed");
}
```

**Idempotency:**

```typescript
.onConflictDoUpdate({
  target: [...unique constraint...],
  set: {...new values...},
})
```

**What is idempotency?**

```
Operation is idempotent if:
f(x) = f(f(x)) = f(f(f(x)))

Same input → Same result (regardless of how many times called)
```

**Example:**

```typescript
// Idempotent ✅
SET followerCount = 100

// NOT idempotent ❌
INCREMENT followerCount by 1
```

**Why important?**

1. **Safe retries** - Network fails → retry without side effects
2. **Cron overlap** - If job runs twice → no duplicates
3. **Manual re-run** - Can re-sync without corruption

### 3.3 Sync Video Daily Stats

```typescript
export async function syncVideoDaily(storeCode: string): Promise<void> {
  const log = storeLogger(storeCode);
  log.info("Starting video daily sync");

  const accessToken = await tokenService.getValidAccessToken(storeCode);
  if (!accessToken) {
    throw new Error("No valid access token");
  }

  // Fetch all videos (handles pagination internally)
  const videos = await tiktokApi.fetchAllVideos(accessToken);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Batch insert/update
  for (const video of videos) {
    await db
      .insert(tiktokVideoDaily)
      .values({
        storeCode,
        videoId: video.videoId,
        snapshotDate: today,
        description: video.description,
        coverImageUrl: video.coverImageUrl,
        shareUrl: video.shareUrl,
        createTime: video.createTime,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        shareCount: video.shareCount,
      })
      .onConflictDoUpdate({
        target: [
          tiktokVideoDaily.storeCode,
          tiktokVideoDaily.videoId,
          tiktokVideoDaily.snapshotDate,
        ],
        set: {
          description: video.description,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          shareCount: video.shareCount,
        },
      });
  }

  log.info({ videoCount: videos.length }, "Video daily sync completed");
}
```

**Performance optimization:**

Current: One query per video

```typescript
for (const video of videos) {
  await db.insert(...) // N queries for N videos
}
```

**Better: Batch insert**

```typescript
await db
  .insert(tiktokVideoDaily)
  .values(videos.map(video => ({...}))) // 1 query for N videos
  .onConflictDoUpdate({...});
```

**Why not implemented?**

- Drizzle's `onConflictDoUpdate` complex dengan batch
- Simpler code more important untuk learning
- Performance acceptable untuk <1000 videos

### 3.4 Sync Logging

```typescript
async function logSyncStart(
  storeCode: string,
  jobType: string
): Promise<number> {
  const [log] = await db
    .insert(syncLogs)
    .values({
      storeCode,
      jobType,
      status: "RUNNING",
      startedAt: new Date(),
    })
    .returning({ id: syncLogs.id });

  return log.id;
}

async function logSyncSuccess(
  logId: number,
  recordsProcessed: number
): Promise<void> {
  await db
    .update(syncLogs)
    .set({
      status: "SUCCESS",
      recordsProcessed,
      completedAt: new Date(),
    })
    .where(eq(syncLogs.id, logId));
}

async function logSyncError(logId: number, error: Error): Promise<void> {
  await db
    .update(syncLogs)
    .set({
      status: "FAILED",
      message: error.message,
      errorDetails: error.stack,
      completedAt: new Date(),
    })
    .where(eq(syncLogs.id, logId));
}
```

**Usage pattern:**

```typescript
export async function syncUserDaily(storeCode: string): Promise<void> {
  const logId = await logSyncStart(storeCode, "user_daily");

  try {
    // ... sync logic ...

    await logSyncSuccess(logId, 1);
  } catch (error) {
    await logSyncError(logId, error as Error);
    throw error;
  }
}
```

**Benefits:**

1. **Visibility** - See sync history
2. **Debugging** - Error details + stack trace
3. **Monitoring** - Success/failure rates
4. **Alerting** - Notify on repeated failures

---

## 4. Distributed Locking - `src/utils/locks.ts`

### 4.1 Why Need Locks?

**Problem: Concurrent sync**

```
Job 1 (Server A): Start sync at 02:00
Job 2 (Server B): Start sync at 02:01 (Job 1 still running)

Results:
- Duplicate API calls
- Race conditions in database
- Wasted resources
```

**Solution: Distributed Lock**

```
Job 1: Acquire lock → Sync → Release lock
Job 2: Try acquire → Lock held → Skip/wait
```

### 4.2 Lock Implementation

```typescript
export async function acquireLock(
  lockKey: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  try {
    // Clean expired locks first
    await db.delete(syncLocks).where(lt(syncLocks.expiresAt, new Date()));

    // Try to acquire
    await db.insert(syncLocks).values({
      lockKey,
      acquiredAt: new Date(),
      expiresAt,
    });

    return true; // Lock acquired
  } catch (error) {
    // Unique constraint violation = lock already held
    return false;
  }
}

export async function releaseLock(lockKey: string): Promise<void> {
  await db.delete(syncLocks).where(eq(syncLocks.lockKey, lockKey));
}
```

**How it works:**

1. **Unique constraint** on `lock_key`

   - Database enforces: only one lock per key
   - Atomic operation (no race condition)

2. **TTL (Time To Live)**

   - Auto-expire after N seconds
   - Prevent deadlock if process crashes

3. **Clean expired locks**
   - Housekeeping before acquire
   - Free up stale locks

**Usage:**

```typescript
export async function syncWithLock(storeCode: string): Promise<void> {
  const lockKey = `sync:${storeCode}`;

  // Try acquire lock
  const acquired = await acquireLock(lockKey, 300); // 5 minutes

  if (!acquired) {
    logger.info({ lockKey }, "Lock already held, skipping sync");
    return;
  }

  try {
    // Do sync work
    await syncUserDaily(storeCode);
    await syncVideoDaily(storeCode);
  } finally {
    // Always release lock
    await releaseLock(lockKey);
  }
}
```

**Alternative implementations:**

1. **Redis locks** (more robust)

   - Distributed across multiple databases
   - Built-in expiry
   - Atomic operations

2. **Database advisory locks**
   - PostgreSQL has native locking
   - Session-based (auto-release on disconnect)

**Our choice: Database table**

- Simple (no additional infrastructure)
- Good enough for single database
- Educational (understand lock concepts)

---

## 🎓 Kesimpulan Part 4

Anda telah belajar:

✅ **Service layer architecture**

- Separation of concerns
- Reusable code patterns
- Testability

✅ **API integration**

- Rate limiting
- Retry with exponential backoff
- Error handling & classification
- Pagination

✅ **Data synchronization**

- Snapshot-based approach
- Idempotent operations
- Upsert patterns
- Sync logging

✅ **Distributed systems**

- Locking mechanisms
- Concurrent job handling
- TTL and cleanup

---

## 📚 Next Steps

Lanjut ke **Part 5: Background Jobs & Production Architecture** untuk belajar:

- Cron scheduling
- Job orchestration
- Graceful shutdown
- Production deployment strategies
- Monitoring & observability

Happy learning! 🚀
