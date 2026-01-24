/**
 * Admin Routes
 *
 * Protected admin endpoints for store and sync management
 * Supports both API Key auth (for external systems) and JWT auth (for web UI)
 */

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { logger } from "../utils/logger.js";
import { errorResponse } from "../utils/http.js";
import * as syncService from "../services/sync.service.js";
import { refreshTokensJob } from "../jobs/refreshTokens.job.js";
import { syncUserDailyJob } from "../jobs/syncUserDaily.job.js";
import { syncVideoDailyJob } from "../jobs/syncVideoDaily.job.js";
import { getSchedulerStatus } from "../jobs/scheduler.js";
import { authRateLimiter, adminRateLimiter } from "../middleware/rateLimiter.js";
import { auditLog } from "../middleware/auditLog.js";
import {
  verifyAccessToken,
  canAccessStore as canUserAccessStore,
  getAccessibleStores,
  type JWTPayload,
} from "../services/auth.service.js";
import { PERMISSIONS } from "../db/schema.js";

const admin = new Hono();

// ============================================
// RATE LIMITING
// ============================================

// Apply rate limiting to all admin routes
admin.use("*", adminRateLimiter());

// Apply authentication rate limiting (tracks failed auth attempts)
admin.use(
  "*",
  authRateLimiter({
    maxAttempts: 5, // 5 failed attempts
    windowMs: 15 * 60 * 1000, // 15 minute window
    blockDurationMs: 5 * 60 * 1000, // 5 minute block (reduced from 30 minutes)
  })
);

// ============================================
// VALIDATION HELPERS
// ============================================

function isValidStoreCode(code: string): boolean {
  return /^[a-zA-Z0-9_-]{1,50}$/.test(code);
}

interface CreateStoreBody {
  store_code: string;
  store_name: string;
  pic_name: string;
  pic_contact?: string;
}

interface SyncRunBody {
  store_code?: string;
  job?: "all" | "user" | "video" | "refresh_tokens";
}

function validateCreateStoreBody(
  body: unknown
): { valid: true; data: CreateStoreBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body is required" };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.store_code !== "string" || !isValidStoreCode(b.store_code)) {
    return {
      valid: false,
      error:
        "store_code must be 1-50 alphanumeric characters with underscores or hyphens",
    };
  }

  if (
    typeof b.store_name !== "string" ||
    b.store_name.length < 1 ||
    b.store_name.length > 255
  ) {
    return { valid: false, error: "store_name is required (1-255 characters)" };
  }

  if (
    typeof b.pic_name !== "string" ||
    b.pic_name.length < 1 ||
    b.pic_name.length > 255
  ) {
    return { valid: false, error: "pic_name is required (1-255 characters)" };
  }

  return {
    valid: true,
    data: {
      store_code: b.store_code,
      store_name: b.store_name,
      pic_name: b.pic_name,
      pic_contact:
        typeof b.pic_contact === "string" ? b.pic_contact : undefined,
    },
  };
}

function validateSyncRunBody(
  body: unknown
): { valid: true; data: SyncRunBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: true, data: { job: "all" } };
  }

  const b = body as Record<string, unknown>;
  const validJobs = ["all", "user", "video", "refresh_tokens"];

  return {
    valid: true,
    data: {
      store_code: typeof b.store_code === "string" ? b.store_code : undefined,
      job:
        typeof b.job === "string" && validJobs.includes(b.job)
          ? (b.job as SyncRunBody["job"])
          : "all",
    },
  };
}

// ============================================
// MIDDLEWARE - Combined API Key / JWT Authentication
// ============================================

/**
 * Get access token from cookie or Authorization header
 */
function getAccessToken(c: Context): string | null {
  // Try cookie first
  const cookieToken = getCookie(c, "access_token");
  if (cookieToken) {
    return cookieToken;
  }

  // Try Authorization header (for API clients)
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Combined authentication middleware
 * Accepts either:
 * 1. API Key via X-API-KEY header (for external systems/scripts)
 * 2. JWT via cookie or Bearer token (for web UI users)
 */
admin.use("*", async (c, next) => {
  const apiKey = c.req.header("X-API-KEY");
  const expectedKey = process.env.ADMIN_API_KEY;
  const jwtToken = getAccessToken(c);

  // Try API Key authentication first
  if (apiKey) {
    if (!expectedKey) {
      logger.warn("ADMIN_API_KEY not configured");
      c.set("authFailed", true);
      return errorResponse(
        c,
        500,
        "SERVER_MISCONFIG",
        "Server misconfiguration: API key not set"
      );
    }

    if (apiKey === expectedKey) {
      // API Key auth successful - set as admin with full access
      c.set("user", null);
      c.set("accessibleStores", null); // null = all stores
      c.set("authMethod", "api_key");
      await next();
      return;
    }

    // Invalid API key
    logger.warn({ hasKey: !!apiKey }, "Invalid API key");
    c.set("authFailed", true);
    return errorResponse(
      c,
      401,
      "UNAUTHORIZED",
      "Unauthorized: Invalid API key"
    );
  }

  // Try JWT authentication
  if (jwtToken) {
    const payload = verifyAccessToken(jwtToken);

    if (payload) {
      // Check if user has permission to access admin routes
      const hasAdminAccess =
        payload.permissions.includes(PERMISSIONS.VIEW_ALL_STORES) ||
        payload.permissions.includes(PERMISSIONS.VIEW_OWN_STORE) ||
        payload.roles.includes("Admin") ||
        payload.roles.includes("Ops");

      if (!hasAdminAccess) {
        logger.info(
          { userId: payload.userId, roles: payload.roles },
          "User lacks admin access"
        );
        return errorResponse(
          c,
          403,
          "FORBIDDEN",
          "You do not have permission to access admin routes"
        );
      }

      // JWT auth successful
      c.set("user", payload);
      c.set("accessibleStores", getAccessibleStores(payload));
      c.set("authMethod", "jwt");
      await next();
      return;
    }

    // Invalid JWT
    logger.debug({ path: c.req.path }, "Invalid or expired access token");
    c.set("authFailed", true);
    return errorResponse(
      c,
      401,
      "TOKEN_INVALID",
      "Invalid or expired token"
    );
  }

  // No authentication provided
  logger.warn({ path: c.req.path }, "No authentication provided");
  c.set("authFailed", true);
  return errorResponse(
    c,
    401,
    "UNAUTHORIZED",
    "Authentication required: Provide X-API-KEY header or valid JWT token"
  );
});

// ============================================
// RBAC HELPERS
// ============================================

/**
 * Check if current user can access a specific store
 */
function canAccessStore(c: Context, storeCode: string): boolean {
  const authMethod = c.get("authMethod");
  
  // API key has full access
  if (authMethod === "api_key") {
    return true;
  }

  const user = c.get("user");
  if (!user) {
    return false;
  }

  return canUserAccessStore(user, storeCode);
}

/**
 * Filter stores based on user's access
 */
function filterStoresByAccess<T extends { storeCode: string }>(
  c: Context,
  stores: T[]
): T[] {
  const accessibleStores = c.get("accessibleStores");
  
  // null means all stores (Admin/Ops/API Key)
  if (accessibleStores === null) {
    return stores;
  }

  return stores.filter((store) => accessibleStores.includes(store.storeCode));
}

/**
 * Check if user has permission to write/modify data
 */
function canWriteData(c: Context): boolean {
  const authMethod = c.get("authMethod");
  
  // API key has full access
  if (authMethod === "api_key") {
    return true;
  }

  const user = c.get("user");
  if (!user) {
    return false;
  }

  return (
    user.permissions.includes(PERMISSIONS.CREATE_STORE) ||
    user.permissions.includes(PERMISSIONS.TRIGGER_SYNC_ALL) ||
    user.roles.includes("Admin")
  );
}

// ============================================
// AUDIT LOGGING FOR WRITE OPERATIONS
// ============================================

// Apply audit logging to state-changing operations
admin.use("/stores", auditLog());
admin.use("/sync/run", auditLog());

// ============================================
// ROUTES
// ============================================

/**
 * GET /admin/stores
 * List all stores with their connection status
 * - API Key: returns all stores
 * - JWT Admin/Ops: returns all stores
 * - JWT Store role: returns only assigned stores
 */
admin.get("/stores", async (c) => {
  try {
    const allStores = await syncService.getStoresWithStatus();
    const stores = filterStoresByAccess(c, allStores);

    return c.json({
      success: true,
      data: stores,
      count: stores.length,
    });
  } catch (error) {
    logger.error({ error }, "Failed to list stores");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to list stores");
  }
});

/**
 * POST /admin/stores
 * Create a new store
 * Requires: Admin role or API Key
 */
admin.post("/stores", async (c) => {
  // Check write permission
  if (!canWriteData(c)) {
    return errorResponse(
      c,
      403,
      "FORBIDDEN",
      "You do not have permission to create stores"
    );
  }

  const body = await c.req.json().catch(() => null);
  const validation = validateCreateStoreBody(body);

  if (!validation.valid) {
    return errorResponse(c, 400, "INVALID_REQUEST", validation.error);
  }

  const data = validation.data;

  try {
    // Check if store already exists
    const exists = await syncService.storeExists(data.store_code);
    if (exists) {
      return errorResponse(
        c,
        409,
        "STORE_EXISTS",
        "Store with this code already exists"
      );
    }

    const store = await syncService.createStore({
      storeCode: data.store_code,
      storeName: data.store_name,
      picName: data.pic_name,
      picContact: data.pic_contact,
    });

    const user = c.get("user");
    logger.info(
      { storeCode: data.store_code, userId: user?.userId },
      "Store created"
    );

    return c.json(
      {
        success: true,
        data: store,
        message: "Store created successfully",
        next_step: `Connect TikTok account at: GET /connect/tiktok?store_code=${data.store_code}`,
      },
      201
    );
  } catch (error) {
    logger.error(
      { error, storeCode: data.store_code },
      "Failed to create store"
    );
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to create store");
  }
});

/**
 * POST /admin/sync/run
 * Trigger manual sync
 * Requires: Admin/Ops role or API Key for global sync
 * Store users can only sync their assigned stores
 */
admin.post("/sync/run", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const validation = validateSyncRunBody(body);

  if (!validation.valid) {
    return errorResponse(c, 400, "INVALID_REQUEST", validation.error);
  }

  const { store_code, job } = validation.data;

  try {
    // If store_code specified, sync single store
    if (store_code) {
      // Check store access
      if (!canAccessStore(c, store_code)) {
        return errorResponse(
          c,
          403,
          "FORBIDDEN",
          "You do not have access to this store"
        );
      }

      // Verify store exists
      const exists = await syncService.storeExists(store_code);
      if (!exists) {
        return errorResponse(c, 404, "STORE_NOT_FOUND", "Store not found");
      }

      const user = c.get("user");
      logger.info(
        { storeCode: store_code, job, userId: user?.userId },
        "Manual sync triggered for store"
      );

      let result;
      switch (job) {
        case "user":
          result = await syncService.syncUserStatsWithLock(store_code);
          break;
        case "video":
          result = await syncService.syncVideoStatsWithLock(store_code);
          break;
        case "all":
        default:
          result = await syncService.runFullSync(store_code);
      }

      return c.json({
        success: result.success,
        data: result,
      });
    }

    // No store_code - run for all stores or specific job
    // This requires Admin/Ops or API Key
    if (!canWriteData(c)) {
      return errorResponse(
        c,
        403,
        "FORBIDDEN",
        "You do not have permission to run global sync. Specify a store_code."
      );
    }

    const user = c.get("user");
    logger.info({ job, userId: user?.userId }, "Manual sync triggered for all stores");

    let result;
    switch (job) {
      case "refresh_tokens":
        result = await refreshTokensJob();
        break;
      case "user":
        result = await syncUserDailyJob();
        break;
      case "video":
        result = await syncVideoDailyJob();
        break;
      case "all":
      default:
        // Run all jobs in sequence
        const refreshResult = await refreshTokensJob();
        const userResult = await syncUserDailyJob();
        const videoResult = await syncVideoDailyJob();
        result = {
          refresh_tokens: refreshResult,
          user_sync: userResult,
          video_sync: videoResult,
        };
    }

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error, storeCode: store_code, job }, "Manual sync failed");
    return errorResponse(c, 500, "SYNC_FAILED", "Sync failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /admin/sync/logs
 * Get sync logs
 */
admin.get("/sync/logs", async (c) => {
  const storeCode = c.req.query("store_code");
  const limitParam = c.req.query("limit");
  const limit = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 500)
    : 50;

  try {
    const logs = await syncService.getSyncLogs(storeCode, limit);

    return c.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    logger.error({ error }, "Failed to get sync logs");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get sync logs");
  }
});

/**
 * GET /admin/sync/status
 * Get scheduler status and next run times
 */
admin.get("/sync/status", async (c) => {
  const status = getSchedulerStatus();

  return c.json({
    success: true,
    data: status,
  });
});

/**
 * GET /admin/stores/:store_code
 * Get single store details with latest stats
 */
admin.get("/stores/:store_code", async (c) => {
  const storeCode = c.req.param("store_code");

  // Check store access
  if (!canAccessStore(c, storeCode)) {
    return errorResponse(
      c,
      403,
      "FORBIDDEN",
      "You do not have access to this store"
    );
  }

  try {
    const stores = await syncService.getStoresWithStatus();
    const store = stores.find((s) => s.storeCode === storeCode);

    if (!store) {
      return errorResponse(c, 404, "STORE_NOT_FOUND", "Store not found");
    }

    return c.json({
      success: true,
      data: store,
    });
  } catch (error) {
    logger.error({ error, storeCode }, "Failed to get store");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get store");
  }
});

/**
 * GET /admin/stores/:store_code/accounts
 * Get accounts for a specific store
 */
admin.get("/stores/:store_code/accounts", async (c) => {
  const storeCode = c.req.param("store_code");

  // Check store access
  if (!canAccessStore(c, storeCode)) {
    return errorResponse(
      c,
      403,
      "FORBIDDEN",
      "You do not have access to this store"
    );
  }

  try {
    // Check if store exists
    const exists = await syncService.storeExists(storeCode);
    if (!exists) {
      return errorResponse(c, 404, "STORE_NOT_FOUND", "Store not found");
    }

    const accounts = await syncService.getAccountsByStore(storeCode);

    // Transform to match frontend StoreAccount interface
    const formattedAccounts = accounts.map((account) => ({
      id: account.id,
      storeCode: account.storeCode,
      platform: "tiktok" as const,
      hasValidToken: account.status === "CONNECTED",
      accountIdentifier: account.openId,
      lastSyncAt: account.lastSyncTime?.toISOString() ?? null,
      createdAt: account.connectedAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    }));

    return c.json({
      success: true,
      data: formattedAccounts,
      count: formattedAccounts.length,
    });
  } catch (error) {
    logger.error({ error, storeCode }, "Failed to get store accounts");
    return errorResponse(
      c,
      500,
      "INTERNAL_ERROR",
      "Failed to get store accounts"
    );
  }
});

/**
 * GET /admin/stores/:store_code/user-stats
 * Get user stats history for a specific store
 */
admin.get("/stores/:store_code/user-stats", async (c) => {
  const storeCode = c.req.param("store_code");
  const daysParam = c.req.query("days");
  const days = daysParam
    ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365)
    : 30;

  // Check store access
  if (!canAccessStore(c, storeCode)) {
    return errorResponse(
      c,
      403,
      "FORBIDDEN",
      "You do not have access to this store"
    );
  }

  try {
    // Check if store exists
    const exists = await syncService.storeExists(storeCode);
    if (!exists) {
      return errorResponse(c, 404, "STORE_NOT_FOUND", "Store not found");
    }

    const stats = await syncService.getUserStatsByStore(storeCode, days);

    return c.json({
      success: true,
      data: stats,
      count: stats.length,
    });
  } catch (error) {
    logger.error({ error, storeCode }, "Failed to get user stats");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get user stats");
  }
});

/**
 * GET /admin/stores/:store_code/video-stats
 * Get video stats for a specific store
 */
admin.get("/stores/:store_code/video-stats", async (c) => {
  const storeCode = c.req.param("store_code");
  const daysParam = c.req.query("days");
  const days = daysParam
    ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365)
    : 30;

  // Check store access
  if (!canAccessStore(c, storeCode)) {
    return errorResponse(
      c,
      403,
      "FORBIDDEN",
      "You do not have access to this store"
    );
  }

  try {
    // Check if store exists
    const exists = await syncService.storeExists(storeCode);
    if (!exists) {
      return errorResponse(c, 404, "STORE_NOT_FOUND", "Store not found");
    }

    const stats = await syncService.getVideoStatsByStore(storeCode, days);

    return c.json({
      success: true,
      data: stats,
      count: stats.length,
    });
  } catch (error) {
    logger.error({ error, storeCode }, "Failed to get video stats");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get video stats");
  }
});

/**
 * GET /admin/stores/:store_code/sync-logs
 * Get sync logs for a specific store
 */
admin.get("/stores/:store_code/sync-logs", async (c) => {
  const storeCode = c.req.param("store_code");
  const limitParam = c.req.query("limit");
  const limit = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 500)
    : 50;

  // Check store access
  if (!canAccessStore(c, storeCode)) {
    return errorResponse(
      c,
      403,
      "FORBIDDEN",
      "You do not have access to this store"
    );
  }

  try {
    // Check if store exists
    const exists = await syncService.storeExists(storeCode);
    if (!exists) {
      return errorResponse(c, 404, "STORE_NOT_FOUND", "Store not found");
    }

    const logs = await syncService.getSyncLogs(storeCode, limit);

    return c.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    logger.error({ error, storeCode }, "Failed to get sync logs");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get sync logs");
  }
});

// ============================================
// TIKTOK ACCOUNTS LIST (Admin/Ops)
// ============================================

/**
 * GET /admin/tiktok-accounts
 * Get comprehensive list of all TikTok accounts with metrics
 * Only accessible by Admin/Ops users
 */
admin.get("/tiktok-accounts", async (c) => {
  // Import required modules at the top if not already imported
  const { db } = await import("../db/client.js");
  const { stores, storeAccounts, tiktokUserDaily, tiktokVideoDaily } = await import("../db/schema.js");
  const { eq, and, or, like, desc, sql, count, sum, inArray } = await import("drizzle-orm");

  // Check if user is Admin or Ops
  const authMethod = c.get("authMethod");
  const user = c.get("user") as JWTPayload | null;
  
  const isAdminOrOps = authMethod === "api_key" || 
    (user && (user.roles.includes("Admin") || user.roles.includes("Ops")));

  if (!isAdminOrOps) {
    return errorResponse(c, 403, "FORBIDDEN", "This endpoint is only accessible by Admin and Ops users");
  }

  // Get query params
  const search = c.req.query("search") || "";
  const status = c.req.query("status") || "all";
  const page = Math.max(parseInt(c.req.query("page") || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10), 1), 100);
  const offset = (page - 1) * limit;

  try {
    const today = new Date().toISOString().split("T")[0];

    // Build search condition
    let searchCondition = undefined;
    if (search) {
      searchCondition = or(
        like(stores.storeCode, `%${search}%`),
        like(stores.storeName, `%${search}%`),
        like(tiktokUserDaily.displayName, `%${search}%`)
      );
    }

    // Build status condition
    let statusCondition = undefined;
    if (status !== "all") {
      statusCondition = eq(storeAccounts.status, status);
    }

    // Get store accounts with user stats
    const baseQuery = db
      .select({
        storeCode: stores.storeCode,
        storeName: stores.storeName,
        displayName: tiktokUserDaily.displayName,
        avatarUrl: tiktokUserDaily.avatarUrl,
        followers: tiktokUserDaily.followerCount,
        profileLikes: tiktokUserDaily.likesCount,
        videoCount: tiktokUserDaily.videoCount,
        status: storeAccounts.status,
      })
      .from(stores)
      .leftJoin(storeAccounts, eq(stores.storeCode, storeAccounts.storeCode))
      .leftJoin(
        tiktokUserDaily,
        and(
          eq(stores.storeCode, tiktokUserDaily.storeCode),
          eq(tiktokUserDaily.snapshotDate, today)
        )
      );

    // Apply conditions
    const conditions = [];
    if (searchCondition) conditions.push(searchCondition);
    if (statusCondition) conditions.push(statusCondition);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countQuery = db
      .select({ count: count() })
      .from(stores)
      .leftJoin(storeAccounts, eq(stores.storeCode, storeAccounts.storeCode))
      .leftJoin(
        tiktokUserDaily,
        and(
          eq(stores.storeCode, tiktokUserDaily.storeCode),
          eq(tiktokUserDaily.snapshotDate, today)
        )
      );

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const totalResult = await countQuery;
    const total = Number(totalResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    // Get paginated data
    let dataQuery = baseQuery;
    if (whereClause) {
      dataQuery = dataQuery.where(whereClause) as any;
    }

    const accountsData = await dataQuery
      .orderBy(desc(tiktokUserDaily.followerCount))
      .limit(limit)
      .offset(offset);

    // Get video stats for these stores
    const storeCodes = accountsData.map(a => a.storeCode);
    
    let videoStats: any[] = [];
    if (storeCodes.length > 0) {
      videoStats = await db
        .select({
          storeCode: tiktokVideoDaily.storeCode,
          totalViews: sum(tiktokVideoDaily.viewCount),
          totalLikes: sum(tiktokVideoDaily.likeCount),
          totalComments: sum(tiktokVideoDaily.commentCount),
          totalShares: sum(tiktokVideoDaily.shareCount),
        })
        .from(tiktokVideoDaily)
        .where(
          and(
            eq(tiktokVideoDaily.snapshotDate, today),
            inArray(tiktokVideoDaily.storeCode, storeCodes)
          )
        )
        .groupBy(tiktokVideoDaily.storeCode);
    }

    const videoStatsMap = new Map(
      videoStats.map(v => [v.storeCode, v])
    );

    // Combine data
    const result = accountsData.map(account => {
      const video = videoStatsMap.get(account.storeCode);
      const totalViews = Number(video?.totalViews || 0);
      const totalEngagement = Number(video?.totalLikes || 0) + 
                             Number(video?.totalComments || 0) + 
                             Number(video?.totalShares || 0);
      const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

      return {
        storeCode: account.storeCode,
        storeName: account.storeName,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        followers: account.followers || 0,
        profileLikes: account.profileLikes || 0,
        videoCount: account.videoCount || 0,
        totalViews: totalViews,
        totalVideoLikes: Number(video?.totalLikes || 0),
        totalComments: Number(video?.totalComments || 0),
        totalShares: Number(video?.totalShares || 0),
        engagementRate: parseFloat(engagementRate.toFixed(2)),
        status: account.status || "DISCONNECTED",
      };
    });

    return c.json({
      success: true,
      data: result,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get TikTok accounts");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get TikTok accounts");
  }
});

export default admin;
