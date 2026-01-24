/**
 * Audit Log Middleware
 *
 * Logs all admin operations for security audit trail
 */

import type { Context, Next } from "hono";
import { logger } from "../utils/logger.js";
import { getClientIp } from "./rateLimiter.js";
import { getRequestId } from "./requestId.js";
import { createAuditLogsBatch, type AuditLogEntry } from "../services/audit.service.js";
import type { AuditAction } from "../db/schema.js";
import type { JWTPayload } from "../services/auth.service.js";

// ============================================
// TYPES
// ============================================

export interface AuditLogMiddlewareEntry {
  timestamp: Date;
  requestId: string;
  userId: number | null;
  username: string | null;
  action: AuditAction;
  resource: string;
  resourceId: string | null;
  ipAddress: string;
  userAgent: string | null;
  method: string;
  path: string;
  success: boolean;
  errorCode: string | null;
  duration: number;
  details: Record<string, unknown> | null;
}

// In-memory buffer for async logging
const auditBuffer: AuditLogMiddlewareEntry[] = [];
const BUFFER_FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_BUFFER_SIZE = 100;

// ============================================
// AUDIT LOGGING
// ============================================

/**
 * Extract resource info from path
 * e.g., /admin/stores/store_001 -> { resource: "stores", resourceId: "store_001" }
 */
function extractResourceInfo(path: string): { resource: string; resourceId: string | null } {
  const parts = path.split("/").filter(Boolean);

  // Skip "admin" prefix
  const relevantParts = parts[0] === "admin" ? parts.slice(1) : parts;

  return {
    resource: relevantParts[0] || "unknown",
    resourceId: relevantParts[1] || null,
  };
}

/**
 * Map HTTP method to action
 */
function methodToAction(method: string, path: string): AuditAction {
  // Special handling for specific paths
  if (path.includes("/export/")) {
    return "EXPORT";
  }
  if (path.includes("/import/")) {
    return "IMPORT";
  }
  if (path.includes("/sync/")) {
    return "SYNC";
  }
  if (path.includes("/login")) {
    return "LOGIN";
  }
  if (path.includes("/logout")) {
    return "LOGOUT";
  }

  const actionMap: Record<string, AuditAction> = {
    GET: "READ",
    POST: "CREATE",
    PUT: "UPDATE",
    PATCH: "UPDATE",
    DELETE: "DELETE",
  };
  return actionMap[method.toUpperCase()] || "READ";
}

/**
 * Flush audit buffer to database
 */
async function flushAuditBuffer(): Promise<void> {
  if (auditBuffer.length === 0) return;

  const entries = auditBuffer.splice(0, auditBuffer.length);

  try {
    // Convert to service format
    const auditEntries: AuditLogEntry[] = entries.map((entry) => ({
      userId: entry.userId,
      username: entry.username,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      method: entry.method,
      path: entry.path,
      requestId: entry.requestId,
      success: entry.success,
      errorCode: entry.errorCode,
      duration: entry.duration,
      details: entry.details,
    }));

    // Insert to database
    const insertedCount = await createAuditLogsBatch(auditEntries);

    if (insertedCount > 0) {
      logger.debug({ count: insertedCount }, "Flushed audit logs to database");
    }
  } catch (error) {
    logger.error({ error, entriesCount: entries.length }, "Failed to flush audit buffer");
    // Re-add entries to buffer for retry (with limit to prevent memory issues)
    if (auditBuffer.length < MAX_BUFFER_SIZE * 2) {
      auditBuffer.push(...entries);
    }
  }
}

// Start periodic flush
setInterval(flushAuditBuffer, BUFFER_FLUSH_INTERVAL);

// Flush on process exit
process.on("beforeExit", async () => {
  await flushAuditBuffer();
});

/**
 * Add entry to audit log buffer
 */
export function addAuditLog(entry: AuditLogMiddlewareEntry): void {
  auditBuffer.push(entry);

  // Flush if buffer is full
  if (auditBuffer.length >= MAX_BUFFER_SIZE) {
    flushAuditBuffer().catch((err) => {
      logger.error({ err }, "Failed to flush audit buffer");
    });
  }
}

/**
 * Audit log middleware for admin routes
 */
export function auditLogMiddleware() {
  return async (c: Context, next: Next) => {
    // Only audit admin routes
    if (!c.req.path.startsWith("/admin")) {
      await next();
      return;
    }

    // Skip health checks and docs
    if (c.req.path.includes("/health") || c.req.path.includes("/docs")) {
      await next();
      return;
    }

    const startTime = Date.now();
    const requestId = getRequestId(c);
    const { resource, resourceId } = extractResourceInfo(c.req.path);

    await next();

    const duration = Date.now() - startTime;
    const success = c.res.status < 400;

    // Get user info from context (set by auth middleware)
    const user = c.get("user") as JWTPayload | null;
    const authMethod = c.get("authMethod") as string | undefined;

    // Create audit entry
    const entry: AuditLogMiddlewareEntry = {
      timestamp: new Date(),
      requestId,
      userId: user?.userId ?? null,
      username: user?.username ?? (authMethod === "api_key" ? "API_KEY" : null),
      action: methodToAction(c.req.method, c.req.path),
      resource,
      resourceId,
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent") || null,
      method: c.req.method,
      path: c.req.path,
      success,
      errorCode: success ? null : c.get("errorCode") || null,
      duration,
      details: {
        status: c.res.status,
        query: c.req.query(),
      },
    };

    addAuditLog(entry);
  };
}

// ============================================
// SECURITY EVENT LOGGING
// ============================================

/**
 * Log security-relevant events
 */
export const SecurityLogger = {
  authSuccess: (details: { userId?: number; username?: string; ip: string; path: string }) => {
    logger.info(
      {
        type: "security.auth.success",
        severity: "info",
        ...details,
      },
      "Authentication successful"
    );
  },

  authFailure: (details: {
    ip: string;
    path: string;
    reason: string;
    attempts?: number;
  }) => {
    logger.warn(
      {
        type: "security.auth.failure",
        severity: "high",
        ...details,
      },
      "Authentication failed"
    );
  },

  rateLimitExceeded: (details: { ip: string; path: string; limit: number }) => {
    logger.warn(
      {
        type: "security.ratelimit",
        severity: "medium",
        ...details,
      },
      "Rate limit exceeded"
    );
  },

  suspiciousActivity: (details: {
    ip: string;
    path: string;
    reason: string;
    requestId?: string;
  }) => {
    logger.error(
      {
        type: "security.suspicious",
        severity: "high",
        ...details,
      },
      "Suspicious activity detected"
    );
  },

  dataAccess: (details: {
    actor: string;
    resource: string;
    resourceId?: string;
    action: string;
  }) => {
    logger.info(
      {
        type: "security.data.access",
        severity: "info",
        ...details,
      },
      "Data accessed"
    );
  },

  configChange: (details: { actor: string; setting: string; oldValue?: string; newValue?: string }) => {
    logger.info(
      {
        type: "security.config.change",
        severity: "medium",
        ...details,
      },
      "Configuration changed"
    );
  },
};

// ============================================
// TESTING UTILITIES
// ============================================

/**
 * Get audit buffer for testing
 */
export function getAuditBuffer(): AuditLogMiddlewareEntry[] {
  return [...auditBuffer];
}

/**
 * Clear audit buffer for testing
 */
export function clearAuditBuffer(): void {
  auditBuffer.length = 0;
}

/**
 * Force flush for testing
 */
export async function forceFlushAuditBuffer(): Promise<void> {
  await flushAuditBuffer();
}

/**
 * Alias for auditLogMiddleware (convenience export)
 */
export const auditLog = auditLogMiddleware;
