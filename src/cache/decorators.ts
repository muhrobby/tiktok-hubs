/**
 * Cache Decorators
 *
 * TypeScript decorators for caching function results and automatic cache invalidation.
 * Note: These work with classes and methods due to TypeScript decorator limitations.
 */

import { get, set, del, delPattern, CacheKeys } from "./cache.service.js";
import { logger } from "../utils/logger.js";

// ============================================
// TYPES
// ============================================

export interface CacheOptions {
  /**
   * TTL in seconds (optional, uses default from config)
   */
  ttl?: number;

  /**
   * Cache key prefix (optional, auto-generated from class/method name if not provided)
   */
  keyPrefix?: string;

  /**
   * Function to generate cache key from arguments
   */
  keyGenerator?: (...args: unknown[]) => string;

  /**
   * Whether to cache null/undefined results
   */
  cacheNull?: boolean;
}

export interface CacheInvalidateOptions {
  /**
   * Cache key pattern to invalidate
   */
  pattern?: string;

  /**
   * Cache keys to invalidate
   */
  keys?: string[];

  /**
   * Function to generate keys to invalidate from arguments
   */
  keyGenerator?: (...args: unknown[]) => string | string[];
}

// ============================================
// DECORATORS
// ============================================

/**
 * Cache decorator - caches method results
 *
 * @example
 * ```typescript
 * class MyService {
 *   @Cacheable({ ttl: 300, keyPrefix: 'user' })
 *   async getUser(id: number) {
 *     return db.query.users.findFirst({ where: eq(users.id, id) });
 *   }
 * }
 * ```
 */
export function Cacheable(options: CacheOptions = {}) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // Generate cache key
      const cacheKey = options.keyGenerator
        ? options.keyGenerator(...args)
        : generateKey(
            options.keyPrefix ||
              `${target?.constructor?.name || "unknown"}:${propertyKey}`,
            args
          );

      try {
        // Define cache fetch function
        const fetchValue = async () => {
          const value = await originalMethod.apply(this, args);

          // Don't cache null/undefined unless configured
          if (value === null || value === undefined) {
            if (!options.cacheNull) {
              return value;
            }
          }

          return value;
        };

        // Get from cache or execute
        return await get(cacheKey, fetchValue, options.ttl);
      } catch (error) {
        logger.error(
          { error, cacheKey },
          "Cache decorator error, executing original method"
        );
        // On error, execute original method
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * Cache invalidate decorator - clears cache after method execution
 *
 * @example
 * ```typescript
 * class MyService {
 *   @CacheInvalidate({ keys: ['user:list'] })
 *   async createUser(data: CreateUserInput) {
 *     return db.insert(users).values(data);
 *   }
 * }
 * ```
 */
export function CacheInvalidate(options: CacheInvalidateOptions = {}) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const result = await originalMethod.apply(this, args);

      // Invalidate cache after successful execution
      try {
        if (options.keyGenerator) {
          const keys = options.keyGenerator(...args);
          if (Array.isArray(keys)) {
            await Promise.all(keys.map((k) => del(k)));
          } else {
            await del(keys);
          }
        }

        if (options.keys) {
          await Promise.all(options.keys.map((k) => del(k)));
        }

        if (options.pattern) {
          await delPattern(options.pattern);
        }

        logger.debug({ keys: options.keys, pattern: options.pattern }, "Cache invalidated");
      } catch (error) {
        logger.error({ error }, "Cache invalidation error");
      }

      return result;
    };

    return descriptor;
  };
}

// ============================================
// KEY GENERATORS
// ============================================

/**
 * Standard cache key generators for common patterns
 */
export const KeyGenerators = {
  /**
   * Generate cache key for single store
   */
  store: (storeCode: string) => CacheKeys.store(storeCode),

  /**
   * Generate cache key for store list
   */
  storeList: () => CacheKeys.storeList(),

  /**
   * Generate cache key for user stats
   */
  userStats: (storeCode: string, days: number) =>
    CacheKeys.userStats(storeCode, days),

  /**
   * Generate cache key for video stats
   */
  videoStats: (storeCode: string, days: number) =>
    CacheKeys.videoStats(storeCode, days),

  /**
   * Generate cache key for user roles
   */
  userRoles: (userId: number) => CacheKeys.userRoles(userId),

  /**
   * Generate cache key for single user
   */
  user: (userId: number) => CacheKeys.user(userId),
};

// ============================================
// HELPERS
// ============================================

/**
 * Generate cache key from prefix and arguments
 */
function generateKey(prefix: string, args: unknown[]): string {
  const argString = args
    .map((arg) => {
      if (arg === null || arg === undefined) {
        return "nil";
      }
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg);
        } catch {
          return "[object]";
        }
      }
      return String(arg);
    })
    .join(":");

  return argString ? `${prefix}:${argString}` : prefix;
}

/**
 * Create a hash from a string (for long cache keys)
 */
function hashString(str: string): string {
  if (!str) return "nil";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Memoization helper - caches function results in memory
 * Useful for simple cases where Redis is overkill
 */
export function memoize<Args extends unknown[], Return>(
  fn: (...args: Args) => Return,
  keyGenerator?: (...args: Args) => string
): (...args: Args) => Return {
  const cache = new Map<string, Return>();

  return function (...args: Args): Return {
    const key = keyGenerator
      ? keyGenerator(...args)
      : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);

    // Simple cache size limit
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value as string | undefined;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }

    return result;
  };
}
