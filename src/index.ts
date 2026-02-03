/**
 * TikTok Content Reporting Hub
 *
 * Main entry point - starts the Hono server
 */

// Load environment variables FIRST
import dotenv from "dotenv";
dotenv.config();

import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";
import { initScheduler, stopScheduler } from "./jobs/scheduler.js";
import { closeDb, checkDbHealth } from "./db/client.js";
import { validateEncryptionSetup } from "./utils/crypto.js";
import { closeRedisClient, checkRedisHealth, isCacheEnabled } from "./cache/redis.client.js";

// ============================================
// CONFIGURATION
// ============================================

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

// ============================================
// STARTUP VALIDATION
// ============================================

async function validateEnvironment(): Promise<void> {
  const requiredEnvVars = [
    "DATABASE_URL",
    "TIKTOK_CLIENT_KEY",
    "TIKTOK_CLIENT_SECRET",
    "TIKTOK_REDIRECT_URI",
    "TOKEN_ENC_KEY",
    "ADMIN_API_KEY",
  ];

  const missing = requiredEnvVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    logger.error({ missing }, "Missing required environment variables");
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  // Validate encryption setup
  if (!validateEncryptionSetup()) {
    throw new Error("Encryption setup validation failed. Check TOKEN_ENC_KEY.");
  }

  // Check database connection
  const dbHealthy = await checkDbHealth();
  if (!dbHealthy) {
    throw new Error("Database connection failed. Check DATABASE_URL.");
  }

  // Check Redis connection (if enabled)
  if (isCacheEnabled()) {
    const redisHealthy = await checkRedisHealth();
    if (!redisHealthy) {
      logger.warn("Redis connection failed. Caching will be disabled.");
    } else {
      logger.info("Redis connection established");
    }
  } else {
    logger.info("Redis caching is disabled");
  }

  logger.info("Environment validation passed");
}

// ============================================
// SERVER STARTUP
// ============================================

async function main(): Promise<void> {
  try {
    logger.info("Starting TikTok Content Reporting Hub...");

    // Validate environment
    await validateEnvironment();

    // Create Hono app
    const app = createApp();

    // Initialize scheduler (background jobs)
    initScheduler();

    // Start HTTP server
    const server = serve({
      fetch: app.fetch,
      port: PORT,
      hostname: HOST,
    });

    logger.info({ port: PORT, host: HOST }, "🚀 Server started successfully");
    logger.info(`Health check: http://${HOST}:${PORT}/health`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, "Received shutdown signal");

      stopScheduler();
      await closeDb();
      await closeRedisClient();

      logger.info("Graceful shutdown complete");
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

// Run main
main();
