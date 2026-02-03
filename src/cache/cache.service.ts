/**
 * Cache Service
 *
 * High-level cache operations with automatic serialization,
 * error handling, and cache statistics.
 */

import { logger } from "../utils/logger.js";
import {
  getRedisClient,
  isCacheEnabled,
  getCacheTTL,
} from "./redis.client.js";

// ============================================
// TYPES
// ============================================

export interface CacheResult<T> {
  hit: boolean;
  value: T | null;
  fromCache: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

// ============================================
// CACHE STATISTICS
// ============================================

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
};

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  return { ...stats };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  stats.hits = 0;
  stats.misses = 0;
  stats.sets = 0;
  stats.deletes = 0;
  stats.errors = 0;
}

/**
 * Increment cache stat
 */
function incrementStat(stat: keyof CacheStats): void {
  stats[stat]++;
}

// ============================================
// CACHE OPERATIONS
// ============================================

/**
 * Get value from cache or execute function to get value
 *
 * This is the primary cache operation - it tries to get from cache first,
 * and if there's a miss, executes the function and caches the result.
 *
 * @param key - Cache key
 * @param fn - Function to execute if cache miss
 * @param ttl - Time to live in seconds (optional, uses default)
 * @returns Cached or freshly computed value
 */
export async function get<T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Check if cache is enabled
  if (!isCacheEnabled()) {
    return fn();
  }

  const client = getRedisClient();
  if (!client) {
    // Redis not available, execute function directly
    return fn();
  }

  try {
    // Try to get from cache
    const cached = await client.get(key);

    if (cached !== null) {
      incrementStat("hits");
      logger.trace({ key }, "Cache hit");

      // Deserialize and return
      return JSON.parse(cached) as T;
    }

    // Cache miss - execute function
    incrementStat("misses");
    logger.trace({ key }, "Cache miss");

    const value = await fn();

    // Cache the result
    const ttlSeconds = ttl ?? getCacheTTL("default");
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    incrementStat("sets");

    logger.debug({ key, ttl: ttlSeconds }, "Cached value");

    return value;
  } catch (error) {
    incrementStat("errors");
    logger.error({ error, key }, "Cache operation failed");

    // On error, execute function directly
    return fn();
  }
}

/**
 * Get value from cache without fallback
 *
 * @param key - Cache key
 * @returns Cached value or null if not found
 */
export async function getOnly<T>(key: string): Promise<T | null> {
  if (!isCacheEnabled()) {
    return null;
  }

  const client = getRedisClient();
  if (!client) {
    return null;
  }

  try {
    const cached = await client.get(key);

    if (cached !== null) {
      incrementStat("hits");
      logger.trace({ key }, "Cache hit (get only)");
      return JSON.parse(cached) as T;
    }

    incrementStat("misses");
    return null;
  } catch (error) {
    incrementStat("errors");
    logger.error({ error, key }, "Cache get failed");
    return null;
  }
}

/**
 * Set value in cache
 *
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttl - Time to live in seconds (optional)
 */
export async function set<T>(key: string, value: T, ttl?: number): Promise<void> {
  if (!isCacheEnabled()) {
    return;
  }

  const client = getRedisClient();
  if (!client) {
    return;
  }

  try {
    const ttlSeconds = ttl ?? getCacheTTL("default");
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    incrementStat("sets");

    logger.debug({ key, ttl: ttlSeconds }, "Cached value (set)");
  } catch (error) {
    incrementStat("errors");
    logger.error({ error, key }, "Cache set failed");
  }
}

/**
 * Delete value from cache
 *
 * @param key - Cache key to delete
 */
export async function del(key: string): Promise<void> {
  if (!isCacheEnabled()) {
    return;
  }

  const client = getRedisClient();
  if (!client) {
    return;
  }

  try {
    await client.del(key);
    incrementStat("deletes");

    logger.debug({ key }, "Cache key deleted");
  } catch (error) {
    incrementStat("errors");
    logger.error({ error, key }, "Cache delete failed");
  }
}

/**
 * Delete multiple cache keys by pattern
 *
 * WARNING: This uses KEYS command which can be slow on large datasets.
 * Consider using scan-based deletion for production.
 *
 * @param pattern - Glob pattern to match keys (e.g., "store:*", "user:123:*")
 */
export async function delPattern(pattern: string): Promise<number> {
  if (!isCacheEnabled()) {
    return 0;
  }

  const client = getRedisClient();
  if (!client) {
    return 0;
  }

  try {
    const keys = await client.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    // Delete in batches of 100 to avoid blocking
    let deleted = 0;
    const batchSize = 100;

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      deleted += await client.del(...batch);
    }

    incrementStat("deletes");
    logger.debug({ pattern, count: deleted }, "Cache pattern deleted");

    return deleted;
  } catch (error) {
    incrementStat("errors");
    logger.error({ error, pattern }, "Cache pattern delete failed");
    return 0;
  }
}

/**
 * Check if key exists in cache
 *
 * @param key - Cache key to check
 * @returns True if key exists
 */
export async function exists(key: string): Promise<boolean> {
  if (!isCacheEnabled()) {
    return false;
  }

  const client = getRedisClient();
  if (!client) {
    return false;
  }

  try {
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    logger.error({ error, key }, "Cache exists check failed");
    return false;
  }
}

/**
 * Get TTL of a cache key
 *
 * @param key - Cache key
 * @returns TTL in seconds, or -1 if key exists but has no expiry, -2 if key doesn't exist
 */
export async function ttl(key: string): Promise<number> {
  if (!isCacheEnabled()) {
    return -2;
  }

  const client = getRedisClient();
  if (!client) {
    return -2;
  }

  try {
    return await client.ttl(key);
  } catch (error) {
    logger.error({ error, key }, "Cache TTL check failed");
    return -2;
  }
}

// ============================================
// CACHE KEY BUILDERS
// ============================================

/**
 * Build standardized cache keys
 */
export const CacheKeys = {
  // Store keys
  store: (storeCode: string) => `store:${storeCode}`,
  storeList: () => `store:list`,
  storeStatus: (storeCode: string) => `store:${storeCode}:status`,

  // User keys
  user: (userId: number) => `user:${userId}`,
  userRoles: (userId: number) => `user:${userId}:roles`,
  userList: (filters: string) => `user:list:${filters}`,

  // Stats keys
  userStats: (storeCode: string, days: number) => `stats:user:${storeCode}:${days}`,
  videoStats: (storeCode: string, days: number) => `stats:video:${storeCode}:${days}`,

  // Analytics keys
  analyticsOverview: (storeFilter: string | null) => `analytics:overview:${storeFilter ?? "all"}`,
  followersTrend: (days: number, storeFilter: string | null) =>
    `analytics:followers:${days}:${storeFilter ?? "all"}`,
  videoPerformance: (days: number, storeFilter: string | null) =>
    `analytics:video:${days}:${storeFilter ?? "all"}`,
  topStores: (sortBy: string, limit: number, storeFilter: string | null) =>
    `analytics:top-stores:${sortBy}:${limit}:${storeFilter ?? "all"}`,
  topVideos: (sortBy: string, limit: number, storeFilter: string | null) =>
    `analytics:top-videos:${sortBy}:${limit}:${storeFilter ?? "all"}`,
  syncHealth: (storeFilter: string | null) => `analytics:sync-health:${storeFilter ?? "all"}`,

  // TikTok API keys
  tiktokUserInfo: (openId: string) => `tiktok:user:${openId}`,
  tiktokVideos: (openId: string, page: number) => `tiktok:videos:${openId}:${page}`,

  // Role/permission keys
  allRoles: () => `roles:all`,
  roleByName: (name: string) => `role:${name}`,
};

// ============================================
// CACHE INVALIDATION HELPERS
// ============================================

/**
 * Invalidate all caches related to a store
 */
export async function invalidateStore(storeCode: string): Promise<void> {
  await Promise.all([
    del(CacheKeys.store(storeCode)),
    del(CacheKeys.storeStatus(storeCode)),
    delPattern(`stats:user:${storeCode}:*`),
    delPattern(`stats:video:${storeCode}:*`),
  ]);
}

/**
 * Invalidate all caches related to a user
 */
export async function invalidateUser(userId: number): Promise<void> {
  await Promise.all([
    del(CacheKeys.user(userId)),
    del(CacheKeys.userRoles(userId)),
  ]);
}

/**
 * Invalidate all store-related caches (e.g., after sync)
 */
export async function invalidateStoreCaches(): Promise<void> {
  await Promise.all([
    del(CacheKeys.storeList()),
    delPattern("store:*"),
    delPattern("stats:*"),
    delPattern("analytics:*"),
  ]);
}

/**
 * Invalidate all analytics caches
 */
export async function invalidateAnalyticsCaches(): Promise<void> {
  await delPattern("analytics:*");
}
