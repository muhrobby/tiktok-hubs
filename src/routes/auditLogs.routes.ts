/**
 * Audit Logs Routes
 *
 * API endpoints for viewing audit logs
 * Protected by JWT authentication - Admin only
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { errorResponse, successResponse } from "../utils/http.js";
import {
  verifyAccessToken,
  type JWTPayload,
} from "../services/auth.service.js";
import { PERMISSIONS, type AuditAction } from "../db/schema.js";
import * as auditService from "../services/audit.service.js";

const auditLogs = new Hono();

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

function getAccessToken(c: Context): string | null {
  const cookieToken = getCookie(c, "access_token");
  if (cookieToken) return cookieToken;

  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

auditLogs.use("*", async (c, next) => {
  const apiKey = c.req.header("X-API-KEY");
  const expectedKey = process.env.ADMIN_API_KEY;
  const jwtToken = getAccessToken(c);

  // API Key authentication (full access)
  if (apiKey) {
    if (!expectedKey) {
      return errorResponse(c, 500, "SERVER_MISCONFIG", "API key not configured");
    }
    if (apiKey === expectedKey) {
      c.set("user", null);
      c.set("authMethod", "api_key");
      await next();
      return;
    }
    return errorResponse(c, 401, "UNAUTHORIZED", "Invalid API key");
  }

  // JWT authentication
  if (jwtToken) {
    const payload = verifyAccessToken(jwtToken);
    if (payload) {
      // Check for audit log permission (Admin only)
      if (!payload.permissions.includes(PERMISSIONS.VIEW_AUDIT_LOGS) && !payload.roles.includes("Admin")) {
        return errorResponse(c, 403, "FORBIDDEN", "You do not have permission to view audit logs");
      }
      c.set("user", payload);
      c.set("authMethod", "jwt");
      await next();
      return;
    }
    return errorResponse(c, 401, "TOKEN_INVALID", "Invalid or expired token");
  }

  return errorResponse(c, 401, "UNAUTHORIZED", "Authentication required");
});

// ============================================
// VALIDATION SCHEMAS
// ============================================

const auditLogFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.coerce.number().int().positive().optional(),
  username: z.string().optional(),
  action: z.enum(["CREATE", "READ", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "IMPORT", "SYNC"]).optional(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  success: z.enum(["true", "false"]).transform((val) => val === "true").optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().optional(),
});

// ============================================
// ROUTES
// ============================================

/**
 * GET /audit-logs
 * Get paginated audit logs with filters
 */
auditLogs.get("/", async (c) => {
  try {
    const query = c.req.query();
    const parsed = auditLogFiltersSchema.safeParse(query);

    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid query parameters", {
        errors: parsed.error.issues,
      });
    }

    const { page, limit, ...filters } = parsed.data;

    const result = await auditService.getAuditLogs(
      {
        userId: filters.userId,
        username: filters.username,
        action: filters.action as AuditAction | undefined,
        resource: filters.resource,
        resourceId: filters.resourceId,
        success: filters.success,
        startDate: filters.startDate,
        endDate: filters.endDate,
        search: filters.search,
      },
      page,
      limit
    );

    return successResponse(c, result.data, result.pagination);
  } catch (error) {
    logger.error({ error }, "Failed to get audit logs");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get audit logs");
  }
});

/**
 * GET /audit-logs/summary
 * Get audit log summary for dashboard
 */
auditLogs.get("/summary", async (c) => {
  try {
    const hours = parseInt(c.req.query("hours") || "24", 10);

    if (isNaN(hours) || hours < 1 || hours > 720) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Hours must be between 1 and 720");
    }

    const summary = await auditService.getAuditSummary(hours);

    return successResponse(c, summary);
  } catch (error) {
    logger.error({ error }, "Failed to get audit summary");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get audit summary");
  }
});

/**
 * GET /audit-logs/resources
 * Get distinct resources for filtering
 */
auditLogs.get("/resources", async (c) => {
  try {
    const resources = await auditService.getDistinctResources();
    return successResponse(c, resources);
  } catch (error) {
    logger.error({ error }, "Failed to get distinct resources");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get resources");
  }
});

/**
 * GET /audit-logs/:id
 * Get a single audit log by ID
 */
auditLogs.get("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);

    if (isNaN(id)) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid audit log ID");
    }

    const log = await auditService.getAuditLogById(id);

    if (!log) {
      return errorResponse(c, 404, "NOT_FOUND", "Audit log not found");
    }

    return successResponse(c, log);
  } catch (error) {
    logger.error({ error }, "Failed to get audit log");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get audit log");
  }
});

/**
 * GET /audit-logs/user/:userId
 * Get audit logs for a specific user
 */
auditLogs.get("/user/:userId", async (c) => {
  try {
    const userId = parseInt(c.req.param("userId"), 10);
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "50", 10);

    if (isNaN(userId)) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid user ID");
    }

    const result = await auditService.getUserAuditLogs(userId, page, limit);

    return successResponse(c, result.data, result.pagination);
  } catch (error) {
    logger.error({ error }, "Failed to get user audit logs");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get user audit logs");
  }
});

export default auditLogs;
