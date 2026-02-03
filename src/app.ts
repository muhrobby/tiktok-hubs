/**
 * Hono Application Setup
 *
 * Main application configuration with middleware and routes
 * Implements OWASP security best practices
 */

// Import type augmentations first
import "./types.js";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { timing } from "hono/timing";
import { logger } from "./utils/logger.js";
import { errorResponse } from "./utils/http.js";
import { checkDbHealth } from "./db/client.js";
import { validateEncryptionSetup } from "./utils/crypto.js";
import { checkRedisHealth, getCacheStats, isCacheEnabled } from "./cache/index.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import userAuthRoutes from "./routes/userAuth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import exportImportRoutes from "./routes/exportImport.routes.js";
import auditLogsRoutes from "./routes/auditLogs.routes.js";
import { getSchedulerStatus } from "./jobs/scheduler.js";
import { createDocsApp } from "./docs/index.js";
import { auditMiddleware } from "./middleware/auditLogger.js";

// Import security middleware
import {
  requestIdMiddleware,
  enhancedSecurityHeaders,
  customSecurityHeaders,
  httpsRedirect,
  validateCorsConfig,
  getCorsOrigins,
  adminRateLimiter,
  oauthRateLimiter,
  auditLogMiddleware,
  getRequestId,
} from "./middleware/index.js";

// ============================================
// CONFIGURATION VALIDATION
// ============================================

/**
 * Validate security configuration at startup
 * Throws if critical security settings are missing in production
 */
export function validateSecurityConfig(): void {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // Validate CORS
    validateCorsConfig();

    // Validate required secrets
    const requiredSecrets = [
      "ADMIN_API_KEY",
      "TOKEN_ENC_KEY",
      "TIKTOK_CLIENT_SECRET",
    ];

    for (const secret of requiredSecrets) {
      if (!process.env[secret]) {
        throw new Error(`Missing required secret: ${secret}`);
      }

      // Check for weak/default values
      const value = process.env[secret]!;
      if (value.length < 32) {
        throw new Error(
          `${secret} is too short. Use at least 32 characters for security.`
        );
      }
    }

    logger.info("Security configuration validated");
  }
}

// ============================================
// APP SETUP
// ============================================

export function createApp() {
  const app = new Hono();

  // ============================================
  // SECURITY MIDDLEWARE (ORDER MATTERS!)
  // ============================================

  // 1. HTTPS redirect (must be first in production)
  if (process.env.NODE_ENV === "production") {
    app.use("*", httpsRedirect());
  }

  // 2. Request ID tracking (for all requests)
  app.use("*", requestIdMiddleware());

  // 3. Enhanced security headers
  app.use(
    "*",
    enhancedSecurityHeaders({
      isDevelopment: process.env.NODE_ENV === "development",
    })
  );

  // 4. Custom security headers
  app.use("*", customSecurityHeaders());

  // 5. CORS configuration
  app.use(
    "*",
    cors({
      origin: getCorsOrigins(),
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-API-KEY",
        "X-Request-ID",
      ],
      exposeHeaders: [
        "X-Request-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Retry-After",
      ],
      credentials: true,
      maxAge: 86400, // 24 hours
    })
  );

  // 6. Request timing
  app.use("*", timing());

  // 7. Request logging (development only - production uses structured logging)
  if (process.env.NODE_ENV === "development") {
    app.use("*", honoLogger());
  }

  // 8. Audit logging middleware (tracks all operations)
  app.use("*", auditMiddleware());

  // 9. Rate limiting for specific routes
  app.use("/admin/*", adminRateLimiter());
  app.use("/connect/*", oauthRateLimiter());
  app.use("/auth/*", oauthRateLimiter());
  app.use("/user-auth/*", oauthRateLimiter()); // Use same rate limit for login attempts

  // 10. Old audit logging for admin routes (backward compatibility)
  app.use("/admin/*", auditLogMiddleware());

  // ============================================
  // ERROR HANDLING
  // ============================================

  app.onError((err, c) => {
    const requestId = getRequestId(c);

    logger.error(
      {
        requestId,
        error: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        path: c.req.path,
        method: c.req.method,
      },
      "Unhandled error"
    );

    // Don't leak error details in production
    const message =
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error";

    // Set error code for audit logging
    c.set("errorCode", "INTERNAL_ERROR");

    return errorResponse(c, 500, "INTERNAL_ERROR", message);
  });

  // 404 handler
  app.notFound((c) => {
    const requestId = getRequestId(c);

    logger.debug(
      {
        requestId,
        path: c.req.path,
        method: c.req.method,
      },
      "Route not found"
    );

    return errorResponse(c, 404, "NOT_FOUND", "Not found", {
      path: c.req.path,
    });
  });

  // ============================================
  // ROUTES
  // ============================================

  // Health check (no auth required)
  app.get("/health", async (c) => {
    const startTime = Date.now();
    const requestId = getRequestId(c);

    const dbHealthy = await checkDbHealth();
    const encryptionValid = validateEncryptionSetup();
    const scheduler = getSchedulerStatus();
    const redisHealthy = isCacheEnabled() ? await checkRedisHealth() : null;

    const status = dbHealthy && encryptionValid && (redisHealthy === null || redisHealthy) ? "healthy" : "unhealthy";
    const statusCode = status === "healthy" ? 200 : 503;

    const checks: any = {
      database: dbHealthy ? "ok" : "fail",
      encryption: encryptionValid ? "ok" : "fail",
      scheduler: scheduler.enabled ? "enabled" : "disabled",
    };

    if (isCacheEnabled()) {
      checks.redis = redisHealthy ? "ok" : "fail";
      checks.caching = "enabled";
    } else {
      checks.caching = "disabled";
    }

    return c.json(
      {
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "1.0.0",
        requestId,
        checks,
        responseTime: Date.now() - startTime,
      },
      statusCode
    );
  });

  // Cache statistics endpoint (admin only)
  app.get("/admin/cache/stats", async (c) => {
    const apiKey = c.req.header("X-API-KEY");
    const expectedKey = process.env.ADMIN_API_KEY;

    // Simple API key check for cache stats
    if (apiKey !== expectedKey) {
      return errorResponse(c, 401, "UNAUTHORIZED", "Invalid API key");
    }

    const stats = getCacheStats();
    const cacheEnabled = isCacheEnabled();
    const redisHealthy = cacheEnabled ? await checkRedisHealth() : null;

    // Calculate hit rate
    const totalRequests = stats.hits + stats.misses;
    const hitRate = totalRequests > 0 ? (stats.hits / totalRequests) * 100 : 0;

    return c.json({
      success: true,
      data: {
        enabled: cacheEnabled,
        redisHealthy,
        stats: {
          ...stats,
          totalRequests,
          hitRate: parseFloat(hitRate.toFixed(2)),
        },
      },
    });
  });

  // Auth routes (TikTok OAuth)
  app.route("/", authRoutes);

  // User authentication routes (login, logout, etc.)
  app.route("/user-auth", userAuthRoutes);

  // Admin routes
  app.route("/admin", adminRoutes);

  // User management routes (admin only)
  app.route("/admin/users", usersRoutes);

  // Analytics routes
  app.route("/admin/analytics", analyticsRoutes);

  // Export/Import routes
  app.route("/admin", exportImportRoutes);

  // Audit Logs routes (Admin only)
  app.route("/admin/audit-logs", auditLogsRoutes);

  // API Documentation (Swagger UI)
  const docsApp = createDocsApp();
  app.route("/", docsApp);

  // Root endpoint - API info
  app.get("/", (c) => {
    return c.json({
      name: "TikTok Content Reporting Hub",
      version: "1.0.0",
      documentation: "/api/docs",
      swagger: "/api/docs",
      openapi: "/api/openapi.json",
      endpoints: {
        health: "GET /health",
        connect: "GET /connect/tiktok?store_code=xxx",
        authUrl: "GET /auth/url?store_code=xxx",
        userAuth: {
          login: "POST /user-auth/login",
          logout: "POST /user-auth/logout",
          logoutAll: "POST /user-auth/logout-all",
          refresh: "POST /user-auth/refresh",
          me: "GET /user-auth/me",
          password: "PUT /user-auth/password",
          profile: "PUT /user-auth/profile",
        },
        admin: {
          stores: "GET/POST /admin/stores",
          storeDetail: "GET /admin/stores/:store_code",
          accounts: "GET /admin/stores/:store_code/accounts",
          userStats: "GET /admin/stores/:store_code/user-stats",
          videoStats: "GET /admin/stores/:store_code/video-stats",
          sync: "POST /admin/sync/run",
          syncStatus: "GET /admin/sync/status",
          logs: "GET /admin/sync/logs",
          users: {
            list: "GET /admin/users",
            roles: "GET /admin/users/roles",
            get: "GET /admin/users/:id",
            create: "POST /admin/users",
            update: "PUT /admin/users/:id",
            delete: "DELETE /admin/users/:id",
            assignRole: "POST /admin/users/:id/roles",
            removeRole: "DELETE /admin/users/:id/roles/:roleName",
          },
          analytics: {
            overview: "GET /admin/analytics/overview",
            followersTrend: "GET /admin/analytics/followers-trend",
            videoPerformance: "GET /admin/analytics/video-performance",
            topStores: "GET /admin/analytics/top-stores",
            topVideos: "GET /admin/analytics/top-videos",
            syncHealth: "GET /admin/analytics/sync-health",
          },
          export: {
            stores: "GET /admin/export/stores?format=xlsx|csv",
            userStats: "GET /admin/export/user-stats?format=xlsx|csv&start_date=&end_date=",
            videoStats: "GET /admin/export/video-stats?format=xlsx|csv&start_date=&end_date=",
            syncLogs: "GET /admin/export/sync-logs?format=xlsx|csv",
            storesTemplate: "GET /admin/export/template/stores",
          },
          import: {
            validateStores: "POST /admin/import/stores/validate",
            stores: "POST /admin/import/stores",
          },
          auditLogs: {
            list: "GET /admin/audit-logs",
            summary: "GET /admin/audit-logs/summary",
            resources: "GET /admin/audit-logs/resources",
            get: "GET /admin/audit-logs/:id",
            userLogs: "GET /admin/audit-logs/user/:userId",
          },
        },
      },
      security: {
        authentication: "JWT cookie + API Key for /admin/* endpoints",
        headers: "X-API-KEY for legacy, httpOnly cookies for session",
        rateLimit: "100 requests/minute for admin, 10 requests/minute for auth",
      },
    });
  });

  return app;
}

// Export types for testing
export type App = ReturnType<typeof createApp>;

export default createApp;
