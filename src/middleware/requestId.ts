/**
 * Request ID Middleware
 *
 * Generates and tracks unique request IDs for tracing and debugging
 */

import type { Context, Next } from "hono";
import { randomBytes } from "node:crypto";
import { logger } from "../utils/logger.js";

// ============================================
// TYPES
// ============================================

interface RequestLogInfo {
  requestId: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  ip: string;
  userAgent: string | null;
  contentLength: number | null;
}

// ============================================
// REQUEST ID MIDDLEWARE
// ============================================

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString("hex");
  return `${timestamp}-${random}`;
}

/**
 * Request ID middleware
 * - Adds unique ID to each request
 * - Logs request/response with timing
 * - Exposes ID via response header
 */
export function requestIdMiddleware() {
  return async (c: Context, next: Next) => {
    // Use existing request ID from header or generate new one
    const requestId =
      c.req.header("X-Request-ID") ||
      c.req.header("X-Correlation-ID") ||
      generateRequestId();

    // Store in context for later use
    c.set("requestId", requestId);

    // Set response header
    c.header("X-Request-ID", requestId);

    const startTime = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0] ||
      c.req.header("x-real-ip") ||
      "unknown";

    // Log incoming request
    logger.debug(
      {
        requestId,
        method,
        path,
        ip,
        query: c.req.query(),
      },
      "Request received"
    );

    try {
      await next();
    } catch (error) {
      // Log error with request context
      logger.error(
        {
          requestId,
          method,
          path,
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Request error"
      );
      throw error;
    }

    const duration = Date.now() - startTime;
    const status = c.res.status;

    // Build log info
    const logInfo: RequestLogInfo = {
      requestId,
      method,
      path,
      status,
      duration,
      ip,
      userAgent: c.req.header("user-agent") || null,
      contentLength: parseInt(c.res.headers.get("content-length") || "0") || null,
    };

    // Log based on status
    if (status >= 500) {
      logger.error(logInfo, "Request completed with server error");
    } else if (status >= 400) {
      logger.warn(logInfo, "Request completed with client error");
    } else {
      logger.info(logInfo, "Request completed");
    }
  };
}

/**
 * Get request ID from context
 */
export function getRequestId(c: Context): string {
  return c.get("requestId") || "unknown";
}

/**
 * Create child logger with request context
 */
export function requestLogger(c: Context) {
  const requestId = getRequestId(c);
  return logger.child({ requestId });
}
