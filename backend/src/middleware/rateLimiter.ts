/**
 * Rate Limiter Middleware
 *
 * Implements sliding window rate limiting with per-IP tracking
 * and special handling for authentication endpoints
 */

import type { Context, Next } from "hono";
import { errorResponse } from "../utils/http.js";
import { logger } from "../utils/logger.js";

// ============================================
// TYPES
// ============================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitOptions {
  windowMs: number;
  limit: number;
  keyGenerator?: (c: Context) => string;
  skipFailedRequests?: boolean;
  onLimitReached?: (c: Context, key: string) => void;
}

interface AuthRateLimitOptions {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

// ============================================
// RATE LIMIT STORES
// ============================================

const rateLimitStore = new Map<string, RateLimitEntry>();
const authRateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }

  for (const [key, entry] of authRateLimitStore.entries()) {
    if (now > entry.resetTime) {
      authRateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Extract client IP from request
 */
export function getClientIp(c: Context): string {
  // Check X-Forwarded-For header (common for proxies/load balancers)
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    // Get the first IP in the chain (original client)
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  // Check X-Real-IP header (Nginx)
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;

  // Check CF-Connecting-IP (Cloudflare)
  const cfIp = c.req.header("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Fallback to unknown
  return "unknown";
}

/**
 * Default key generator using IP address
 */
function defaultKeyGenerator(c: Context): string {
  return `rate:${getClientIp(c)}`;
}

// ============================================
// GENERAL RATE LIMITER
// ============================================

/**
 * General purpose rate limiter middleware
 */
export function rateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    limit,
    keyGenerator = defaultKeyGenerator,
    skipFailedRequests = false,
    onLimitReached,
  } = options;

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Initialize or reset entry if window has passed
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
        firstRequest: now,
      };
    }

    // Check if limit exceeded
    if (entry.count >= limit) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

      c.header("X-RateLimit-Limit", limit.toString());
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString());
      c.header("Retry-After", retryAfter.toString());

      logger.warn(
        {
          key,
          ip: getClientIp(c),
          path: c.req.path,
          limit,
          retryAfter,
        },
        "Rate limit exceeded"
      );

      onLimitReached?.(c, key);

      return errorResponse(
        c,
        429,
        "RATE_LIMITED",
        `Too many requests. Please try again in ${retryAfter} seconds.`
      );
    }

    // Increment counter
    entry.count++;
    rateLimitStore.set(key, entry);

    // Set rate limit headers
    c.header("X-RateLimit-Limit", limit.toString());
    c.header("X-RateLimit-Remaining", Math.max(0, limit - entry.count).toString());
    c.header("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString());

    await next();

    // Optionally decrement on failed requests
    if (skipFailedRequests && c.res.status >= 400) {
      entry.count = Math.max(0, entry.count - 1);
      rateLimitStore.set(key, entry);
    }
  };
}

// ============================================
// AUTHENTICATION RATE LIMITER
// ============================================

/**
 * Rate limiter specifically for authentication endpoints
 * Tracks failed authentication attempts and blocks after threshold
 */
export function authRateLimiter(options: AuthRateLimitOptions) {
  const {
    maxAttempts,
    windowMs,
    blockDurationMs = windowMs * 2, // Default: 2x window for block duration
  } = options;

  return async (c: Context, next: Next) => {
    const clientIp = getClientIp(c);
    const key = `auth:${clientIp}`;
    const now = Date.now();

    const entry = authRateLimitStore.get(key);

    // Check if client is currently blocked
    if (entry && entry.count >= maxAttempts && now < entry.resetTime) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

      c.header("Retry-After", retryAfter.toString());

      logger.warn(
        {
          clientIp,
          path: c.req.path,
          attempts: entry.count,
          blockedUntil: new Date(entry.resetTime).toISOString(),
        },
        "Authentication blocked - too many failed attempts"
      );

      return errorResponse(
        c,
        429,
        "TOO_MANY_AUTH_ATTEMPTS",
        `Too many failed authentication attempts. Please try again in ${retryAfter} seconds.`
      );
    }

    await next();

    // Track failed authentication (check for auth failure flag set by auth middleware)
    const authFailed = c.get("authFailed");

    if (authFailed) {
      const currentEntry = authRateLimitStore.get(key);

      if (currentEntry && now < currentEntry.resetTime) {
        // Increment existing counter
        currentEntry.count++;

        // If max attempts reached, extend block duration
        if (currentEntry.count >= maxAttempts) {
          currentEntry.resetTime = now + blockDurationMs;
        }

        authRateLimitStore.set(key, currentEntry);
      } else {
        // Create new entry
        authRateLimitStore.set(key, {
          count: 1,
          resetTime: now + windowMs,
          firstRequest: now,
        });
      }

      logger.warn(
        {
          clientIp,
          path: c.req.path,
          attempts: authRateLimitStore.get(key)?.count || 1,
          maxAttempts,
        },
        "Failed authentication attempt recorded"
      );
    } else if (c.res.status < 400) {
      // Successful auth - reset counter
      authRateLimitStore.delete(key);
    }
  };
}

// ============================================
// SPECIALIZED RATE LIMITERS
// ============================================

/**
 * Rate limiter for admin API endpoints
 */
export function adminRateLimiter() {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    limit: 100, // 100 requests per minute
    keyGenerator: (c) => {
      // Use API key if available, otherwise IP
      const apiKey = c.req.header("X-API-KEY");
      if (apiKey) {
        // Hash API key for privacy in logs
        return `admin:key:${apiKey.substring(0, 8)}`;
      }
      return `admin:ip:${getClientIp(c)}`;
    },
  });
}

/**
 * Rate limiter for OAuth endpoints
 */
export function oauthRateLimiter() {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    limit: 10, // 10 requests per minute (OAuth shouldn't be spammed)
    keyGenerator: (c) => `oauth:${getClientIp(c)}`,
    onLimitReached: (c, key) => {
      logger.warn(
        {
          key,
          ip: getClientIp(c),
          path: c.req.path,
        },
        "OAuth rate limit reached - potential abuse"
      );
    },
  });
}

/**
 * Strict rate limiter for sensitive operations
 */
export function strictRateLimiter() {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    limit: 5, // Only 5 requests per minute
    keyGenerator: (c) => `strict:${getClientIp(c)}:${c.req.path}`,
  });
}

// ============================================
// TESTING UTILITIES
// ============================================

/**
 * Clear all rate limit stores (for testing)
 */
export function clearRateLimitStores(): void {
  rateLimitStore.clear();
  authRateLimitStore.clear();
}

/**
 * Get rate limit entry for testing
 */
export function getRateLimitEntry(key: string): RateLimitEntry | undefined {
  return rateLimitStore.get(key);
}

/**
 * Get auth rate limit entry for testing
 */
export function getAuthRateLimitEntry(key: string): RateLimitEntry | undefined {
  return authRateLimitStore.get(key);
}
