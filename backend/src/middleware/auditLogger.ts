/**
 * Audit Logger Middleware
 * Tracks all API operations for security and compliance
 */

import type { Context, Next } from "hono";
import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";
import { logger } from "../utils/logger.js";
import { nanoid } from "nanoid";

// Actions that should be logged
const LOGGED_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "SYNC",
  "CONNECT",
  "DISCONNECT",
  "AUTHORIZE",
  "REFRESH_TOKEN",
  "EXPORT",
  "IMPORT",
  "BULK_DELETE",
] as const;

export type AuditAction = (typeof LOGGED_ACTIONS)[number];

// Skip audit logging for these paths
const SKIP_PATHS = [
  "/api/health",
  "/api/ping",
  "/api/audit-logs", // Don't log audit log reads
];

// Store audit context in request
export interface AuditContext {
  action?: AuditAction;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  skipAudit?: boolean;
}

/**
 * Middleware to add audit context to request
 */
export function auditMiddleware() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const requestId = nanoid(10);

    // Add request ID to response headers
    c.header("X-Request-ID", requestId);

    // Initialize audit context
    const auditContext: AuditContext = {};
    c.set("auditContext", auditContext);

    // Check if we should skip audit for this path
    const path = c.req.path;
    const shouldSkip = SKIP_PATHS.some((skipPath) => path.startsWith(skipPath));

    if (shouldSkip) {
      auditContext.skipAudit = true;
    }

    // Process request
    await next();

    // Log audit after response (don't block response)
    if (!auditContext.skipAudit && auditContext.action) {
      const duration = Date.now() - startTime;
      const user = c.get("user");
      const statusCode = c.res.status;
      const success = statusCode >= 200 && statusCode < 400;

      // Log asynchronously without blocking
      setImmediate(async () => {
        try {
          await db.insert(auditLogs).values({
            requestId,
            timestamp: new Date(),
            userId: user?.id || null,
            username: user?.username || null,
            action: auditContext.action!,
            resource: auditContext.resource || "unknown",
            resourceId: auditContext.resourceId || null,
            ipAddress: getClientIP(c),
            userAgent: c.req.header("user-agent") || null,
            method: c.req.method,
            path: c.req.path,
            success,
            errorCode: success ? null : String(statusCode),
            duration,
            details: auditContext.details || null,
          });

          logger.info({
            requestId,
            action: auditContext.action,
            resource: auditContext.resource,
            resourceId: auditContext.resourceId,
            username: user?.username,
            success,
            duration,
          }, "Audit log recorded");
        } catch (error) {
          logger.error({ error, requestId }, "Failed to write audit log");
        }
      });
    }
  };
}

/**
 * Helper function to set audit context
 */
export function setAuditContext(
  c: Context,
  action: AuditAction,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>
) {
  const auditContext = c.get("auditContext") as AuditContext;
  if (auditContext) {
    auditContext.action = action;
    auditContext.resource = resource;
    auditContext.resourceId = resourceId;
    auditContext.details = details;
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(c: Context): string {
  // Check X-Forwarded-For header (proxy/load balancer)
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // Check X-Real-IP header
  const realIP = c.req.header("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback to connection IP
  return c.req.header("cf-connecting-ip") || "unknown";
}

/**
 * Helper to create audit log entry directly (for special cases like login)
 */
export async function createAuditLog(data: {
  action: AuditAction;
  resource: string;
  resourceId?: string;
  userId?: number;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  success?: boolean;
  errorCode?: string;
  duration?: number;
  details?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogs).values({
      requestId: nanoid(10),
      timestamp: new Date(),
      userId: data.userId || null,
      username: data.username || null,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      method: data.method || null,
      path: data.path || null,
      success: data.success ?? true,
      errorCode: data.errorCode || null,
      duration: data.duration || null,
      details: data.details || null,
    });
  } catch (error) {
    logger.error({ error }, "Failed to create audit log");
  }
}
