/**
 * Redis Client
 *
 * Manages Redis connection with connection pooling, health checks,
 * and graceful shutdown handling.
 */

import { Redis } from "ioredis";
import { logger } from "../utils/logger.js";

// ============================================
// TYPES
// ============================================

export interface RedisConfig {
  url: string;
  enabled: boolean;
  maxRetriesPerRequest: number;
  retryStrategy: (times: number) => number | void;
  enableReadyCheck: boolean;
  enableOfflineQueue: boolean;
}

// ============================================
// SINGLETON CLIENT
// ============================================

let redisClient: Redis | null = null;
let isShuttingDown = false;

/**
 * Get Redis configuration from environment variables
 */
export function getRedisConfig(): RedisConfig {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const enabled = process.env.REDIS_ENABLED === "true" || process.env.ENABLE_REDIS === "true";

  return {
    url,
    enabled,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    enableReadyCheck: true,
    enableOfflineQueue: true,
  };
}

/**
 * Get singleton Redis client instance
 */
export function getRedisClient(): Redis | null {
  if (isShuttingDown) {
    logger.warn("Redis client is shutting down, refusing to create new connection");
    return null;
  }

  const config = getRedisConfig();

  if (!config.enabled) {
    logger.debug("Redis is disabled, returning null client");
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis(config.url, {
        maxRetriesPerRequest: config.maxRetriesPerRequest,
        retryStrategy: config.retryStrategy,
        enableReadyCheck: config.enableReadyCheck,
        enableOfflineQueue: config.enableOfflineQueue,
        // Connection name for easier debugging
        name: "tiktok-hubs",
        // Lazy connect - don't connect until first command
        lazyConnect: false,
      });

      // Event handlers
      redisClient.on("connect", () => {
        logger.info("Redis client connecting...");
      });

      redisClient.on("ready", () => {
        logger.info("Redis client ready and connected");
      });

      redisClient.on("error", (err: Error) => {
        logger.error({ err }, "Redis client error");
      });

      redisClient.on("close", () => {
        logger.warn("Redis connection closed");
      });

      redisClient.on("reconnecting", () => {
        logger.info("Redis client reconnecting...");
      });

      redisClient.on("end", () => {
        logger.info("Redis connection ended");
        redisClient = null;
      });

      logger.info({ url: sanitizeUrl(config.url) }, "Redis client created");
    } catch (error) {
      logger.error({ error }, "Failed to create Redis client");
      return null;
    }
  }

  return redisClient;
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) {
      // Redis is disabled - treat as healthy
      return true;
    }

    const result = await client.ping();
    return result === "PONG";
  } catch (error) {
    logger.error({ error }, "Redis health check failed");
    return false;
  }
}

/**
 * Get Redis connection info for debugging
 */
export async function getRedisInfo(): Promise<{
  connected: boolean;
  info: string | null;
}> {
  const client = getRedisClient();

  if (!client) {
    return { connected: false, info: null };
  }

  try {
    const info = await client.info();
    return { connected: true, info };
  } catch (error) {
    return { connected: false, info: null };
  }
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisClient(): Promise<void> {
  isShuttingDown = true;

  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info("Redis client closed gracefully");
    } catch (error) {
      logger.error({ error }, "Error closing Redis client");
      // Force close if graceful shutdown fails
      try {
        redisClient.disconnect();
        logger.info("Redis client disconnected forcefully");
      } catch (disconnectError) {
        logger.error({ error: disconnectError }, "Error force-disconnecting Redis client");
      }
    }
    redisClient = null;
  }
}

/**
 * Flush all Redis data (use with caution!)
 * Only works in non-production environments
 */
export async function flushRedis(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot flush Redis in production environment");
  }

  const client = getRedisClient();
  if (!client) {
    logger.warn("Cannot flush Redis - client is not connected");
    return;
  }

  await client.flushdb();
  logger.warn("Redis database flushed");
}

// ============================================
// HELPERS
// ============================================

/**
 * Sanitize Redis URL for logging (hide password)
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      return `${parsed.protocol}//${parsed.username}:****@${parsed.host}`;
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Get cache TTL from environment variables
 */
export function getCacheTTL(type: "default" | "short" | "long" | "api" = "default"): number {
  switch (type) {
    case "short":
      return parseInt(process.env.CACHE_TTL_SHORT || "60", 10);
    case "long":
      return parseInt(process.env.CACHE_TTL_LONG || "3600", 10);
    case "api":
      return parseInt(process.env.CACHE_TTL_API || "300", 10);
    case "default":
    default:
      return parseInt(process.env.CACHE_TTL_DEFAULT || "300", 10);
  }
}

/**
 * Check if caching is enabled
 */
export function isCacheEnabled(): boolean {
  const config = getRedisConfig();
  return config.enabled;
}
