/**
 * Export/Import Routes
 *
 * Endpoints for exporting and importing data
 * Protected by JWT authentication with role-based access
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { logger } from "../utils/logger.js";
import { errorResponse } from "../utils/http.js";
import {
  verifyAccessToken,
  getAccessibleStores,
  type JWTPayload,
} from "../services/auth.service.js";
import { PERMISSIONS } from "../db/schema.js";
import { adminRateLimiter } from "../middleware/rateLimiter.js";
import * as exportService from "../services/export.service.js";
import * as importService from "../services/import.service.js";

const exportImport = new Hono();

// Apply rate limiting
exportImport.use("*", adminRateLimiter());

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

exportImport.use("*", async (c, next) => {
  const apiKey = c.req.header("X-API-KEY");
  const expectedKey = process.env.ADMIN_API_KEY;
  const jwtToken = getAccessToken(c);

  // API Key authentication
  if (apiKey) {
    if (!expectedKey) {
      return errorResponse(c, 500, "SERVER_MISCONFIG", "API key not configured");
    }
    if (apiKey === expectedKey) {
      c.set("user", null);
      c.set("accessibleStores", null);
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
      c.set("user", payload);
      c.set("accessibleStores", getAccessibleStores(payload));
      c.set("authMethod", "jwt");
      await next();
      return;
    }
    return errorResponse(c, 401, "TOKEN_INVALID", "Invalid or expired token");
  }

  return errorResponse(c, 401, "UNAUTHORIZED", "Authentication required");
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function canExportAllData(c: Context): boolean {
  const authMethod = c.get("authMethod");
  if (authMethod === "api_key") return true;

  const user = c.get("user") as JWTPayload | null;
  if (!user) return false;

  return (
    user.permissions.includes(PERMISSIONS.EXPORT_ALL_DATA) ||
    user.roles.includes("Admin") ||
    user.roles.includes("Ops")
  );
}

function canImportData(c: Context): boolean {
  const authMethod = c.get("authMethod");
  if (authMethod === "api_key") return true;

  const user = c.get("user") as JWTPayload | null;
  if (!user) return false;

  return (
    user.permissions.includes(PERMISSIONS.CREATE_STORE) ||
    user.roles.includes("Admin")
  );
}

function getStoreFilter(c: Context): string[] | null {
  if (canExportAllData(c)) return null;

  const accessibleStores = c.get("accessibleStores") as string[] | null;
  return accessibleStores || [];
}

// ============================================
// EXPORT ROUTES
// ============================================

/**
 * GET /export/stores
 * Export stores list
 */
exportImport.get("/export/stores", async (c) => {
  const format = (c.req.query("format") || "xlsx") as exportService.ExportFormat;

  if (!["csv", "xlsx"].includes(format)) {
    return errorResponse(c, 400, "INVALID_FORMAT", "Format must be csv or xlsx");
  }

  try {
    const storeFilter = getStoreFilter(c);
    const result = await exportService.exportStores({ format, storeFilter });

    // Set response headers and return binary data
    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": result.buffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to export stores");
    return errorResponse(c, 500, "EXPORT_FAILED", "Failed to export stores");
  }
});

/**
 * GET /export/user-stats
 * Export user stats
 */
exportImport.get("/export/user-stats", async (c) => {
  const format = (c.req.query("format") || "xlsx") as exportService.ExportFormat;
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  if (!["csv", "xlsx"].includes(format)) {
    return errorResponse(c, 400, "INVALID_FORMAT", "Format must be csv or xlsx");
  }

  try {
    const storeFilter = getStoreFilter(c);
    const result = await exportService.exportUserStats({
      format,
      storeFilter,
      startDate,
      endDate,
    });

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": result.buffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to export user stats");
    return errorResponse(c, 500, "EXPORT_FAILED", "Failed to export user stats");
  }
});

/**
 * GET /export/video-stats
 * Export video stats
 */
exportImport.get("/export/video-stats", async (c) => {
  const format = (c.req.query("format") || "xlsx") as exportService.ExportFormat;
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  if (!["csv", "xlsx"].includes(format)) {
    return errorResponse(c, 400, "INVALID_FORMAT", "Format must be csv or xlsx");
  }

  try {
    const storeFilter = getStoreFilter(c);
    const result = await exportService.exportVideoStats({
      format,
      storeFilter,
      startDate,
      endDate,
    });

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": result.buffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to export video stats");
    return errorResponse(c, 500, "EXPORT_FAILED", "Failed to export video stats");
  }
});

/**
 * GET /export/sync-logs
 * Export sync logs
 */
exportImport.get("/export/sync-logs", async (c) => {
  const format = (c.req.query("format") || "xlsx") as exportService.ExportFormat;

  if (!["csv", "xlsx"].includes(format)) {
    return errorResponse(c, 400, "INVALID_FORMAT", "Format must be csv or xlsx");
  }

  try {
    const storeFilter = getStoreFilter(c);
    const result = await exportService.exportSyncLogs({ format, storeFilter });

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": result.buffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to export sync logs");
    return errorResponse(c, 500, "EXPORT_FAILED", "Failed to export sync logs");
  }
});

/**
 * GET /export/template/stores
 * Get import template for stores
 */
exportImport.get("/export/template/stores", async (c) => {
  try {
    const result = await exportService.getStoresImportTemplate();

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": result.buffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to generate import template");
    return errorResponse(c, 500, "TEMPLATE_FAILED", "Failed to generate template");
  }
});

// ============================================
// IMPORT ROUTES
// ============================================

/**
 * POST /import/stores/validate
 * Validate import file without importing
 */
exportImport.post("/import/stores/validate", async (c) => {
  if (!canImportData(c)) {
    return errorResponse(c, 403, "FORBIDDEN", "You do not have permission to import data");
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return errorResponse(c, 400, "NO_FILE", "No file provided");
    }

    // Validate file type
    const filename = file.name.toLowerCase();
    if (!filename.endsWith(".xlsx") && !filename.endsWith(".csv")) {
      return errorResponse(c, 400, "INVALID_FILE_TYPE", "File must be .xlsx or .csv");
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return errorResponse(c, 400, "FILE_TOO_LARGE", "File size must be less than 5MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importService.validateImportFile(buffer, filename);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, "Failed to validate import file");
    return errorResponse(c, 500, "VALIDATION_FAILED", "Failed to validate file");
  }
});

/**
 * POST /import/stores
 * Import stores from Excel/CSV file
 */
exportImport.post("/import/stores", async (c) => {
  if (!canImportData(c)) {
    return errorResponse(c, 403, "FORBIDDEN", "You do not have permission to import data");
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const skipExisting = formData.get("skip_existing") !== "false";
    const updateExisting = formData.get("update_existing") === "true";

    if (!file) {
      return errorResponse(c, 400, "NO_FILE", "No file provided");
    }

    // Validate file type
    const filename = file.name.toLowerCase();
    if (!filename.endsWith(".xlsx") && !filename.endsWith(".csv")) {
      return errorResponse(c, 400, "INVALID_FILE_TYPE", "File must be .xlsx or .csv");
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return errorResponse(c, 400, "FILE_TOO_LARGE", "File size must be less than 5MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importService.importStores(buffer, filename, {
      skipExisting,
      updateExisting,
    });

    const user = c.get("user") as JWTPayload | null;
    logger.info(
      {
        userId: user?.userId,
        filename: file.name,
        result: {
          total: result.totalRows,
          success: result.successCount,
          errors: result.errorCount,
          skipped: result.skippedCount,
        },
      },
      "Stores import completed"
    );

    return c.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, "Failed to import stores");
    return errorResponse(c, 500, "IMPORT_FAILED", "Failed to import stores");
  }
});

export default exportImport;
