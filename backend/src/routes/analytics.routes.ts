/**
 * Analytics Routes
 *
 * Endpoints for aggregated analytics data across all stores
 * Protected by JWT authentication with role-based access
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { db } from "../db/client.js";
import {
  stores,
  storeAccounts,
  tiktokUserDaily,
  tiktokVideoDaily,
  syncLogs,
  PERMISSIONS,
} from "../db/schema.js";
import { eq, and, sql, desc, gte, count, sum, inArray } from "drizzle-orm";
import { logger } from "../utils/logger.js";
import { errorResponse } from "../utils/http.js";
import {
  verifyAccessToken,
  getAccessibleStores,
  type JWTPayload,
} from "../services/auth.service.js";
import { adminRateLimiter } from "../middleware/rateLimiter.js";

const analytics = new Hono();

// Apply rate limiting
analytics.use("*", adminRateLimiter());

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

analytics.use("*", async (c, next) => {
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
      // Check if user has dashboard permission
      const hasDashboardAccess =
        payload.permissions.includes(PERMISSIONS.VIEW_DASHBOARD_ALL) ||
        payload.permissions.includes(PERMISSIONS.VIEW_DASHBOARD_OWN);

      if (!hasDashboardAccess) {
        return errorResponse(c, 403, "FORBIDDEN", "No analytics access");
      }

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

function canAccessAllStores(c: Context): boolean {
  const authMethod = c.get("authMethod");
  if (authMethod === "api_key") return true;

  const user = c.get("user") as JWTPayload | null;
  if (!user) return false;

  return (
    user.permissions.includes(PERMISSIONS.VIEW_DASHBOARD_ALL) ||
    user.roles.includes("Admin") ||
    user.roles.includes("Ops")
  );
}

function getStoreFilter(c: Context): string[] | null {
  // Check for optional storeCode query parameter (Admin/Ops can filter by specific store)
  const storeCodeParam = c.req.query("storeCode");
  if (storeCodeParam && canAccessAllStores(c)) {
    return [storeCodeParam];
  }

  if (canAccessAllStores(c)) return null;

  const accessibleStores = c.get("accessibleStores") as string[] | null;
  return accessibleStores || [];
}

// Helper to build store filter condition
function buildStoreCondition(storeFilter: string[] | null, storeCodeColumn: any) {
  if (storeFilter === null) return undefined;
  if (storeFilter.length === 0) return sql`1 = 0`; // No access
  return inArray(storeCodeColumn, storeFilter);
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /analytics/overview
 * Get overall statistics summary
 */
analytics.get("/overview", async (c) => {
  try {
    const storeFilter = getStoreFilter(c);
    const storeCondition = buildStoreCondition(storeFilter, stores.storeCode);
    const today = new Date().toISOString().split("T")[0];

    // Count stores
    const storeCountResult = storeCondition
      ? await db.select({ count: count() }).from(stores).where(storeCondition)
      : await db.select({ count: count() }).from(stores);
    const storeCount = storeCountResult[0]?.count || 0;

    // Count connected accounts
    const accountCondition = storeFilter !== null
      ? and(eq(storeAccounts.status, "CONNECTED"), inArray(storeAccounts.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"]))
      : eq(storeAccounts.status, "CONNECTED");

    const connectedResult = await db
      .select({ count: count() })
      .from(storeAccounts)
      .where(accountCondition);
    const connectedCount = connectedResult[0]?.count || 0;

    // Get latest user stats (today)
    const userStatsCondition = storeFilter !== null
      ? and(eq(tiktokUserDaily.snapshotDate, today), inArray(tiktokUserDaily.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"]))
      : eq(tiktokUserDaily.snapshotDate, today);

    const userStatsResult = await db
      .select({
        totalFollowers: sum(tiktokUserDaily.followerCount),
        totalLikes: sum(tiktokUserDaily.likesCount),
        totalVideos: sum(tiktokUserDaily.videoCount),
      })
      .from(tiktokUserDaily)
      .where(userStatsCondition);
    const userStats = userStatsResult[0];

    // Get total video engagement from latest snapshot
    const videoStatsCondition = storeFilter !== null
      ? and(eq(tiktokVideoDaily.snapshotDate, today), inArray(tiktokVideoDaily.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"]))
      : eq(tiktokVideoDaily.snapshotDate, today);

    const videoStatsResult = await db
      .select({
        totalViews: sum(tiktokVideoDaily.viewCount),
        totalVideoLikes: sum(tiktokVideoDaily.likeCount),
        totalComments: sum(tiktokVideoDaily.commentCount),
        totalShares: sum(tiktokVideoDaily.shareCount),
      })
      .from(tiktokVideoDaily)
      .where(videoStatsCondition);
    const videoStats = videoStatsResult[0];

    return c.json({
      success: true,
      data: {
        stores: {
          total: Number(storeCount),
          connected: Number(connectedCount),
        },
        followers: {
          total: Number(userStats?.totalFollowers || 0),
        },
        videos: {
          total: Number(userStats?.totalVideos || 0),
          totalViews: Number(videoStats?.totalViews || 0),
          totalLikes: Number(videoStats?.totalVideoLikes || 0),
          totalComments: Number(videoStats?.totalComments || 0),
          totalShares: Number(videoStats?.totalShares || 0),
        },
        snapshotDate: today,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get analytics overview");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get analytics");
  }
});

/**
 * GET /analytics/followers-trend
 * Get follower trend over time (aggregated across all stores)
 */
analytics.get("/followers-trend", async (c) => {
  const daysParam = c.req.query("days");
  const days = Math.min(Math.max(parseInt(daysParam || "30", 10), 7), 90);

  try {
    const storeFilter = getStoreFilter(c);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    const condition = storeFilter !== null
      ? and(gte(tiktokUserDaily.snapshotDate, cutoffDateStr), inArray(tiktokUserDaily.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"]))
      : gte(tiktokUserDaily.snapshotDate, cutoffDateStr);

    const trend = await db
      .select({
        snapshotDate: tiktokUserDaily.snapshotDate,
        totalFollowers: sum(tiktokUserDaily.followerCount),
        totalLikes: sum(tiktokUserDaily.likesCount),
        storeCount: count(),
      })
      .from(tiktokUserDaily)
      .where(condition)
      .groupBy(tiktokUserDaily.snapshotDate)
      .orderBy(tiktokUserDaily.snapshotDate);

    return c.json({
      success: true,
      data: trend.map((row) => ({
        date: row.snapshotDate,
        followers: Number(row.totalFollowers || 0),
        likes: Number(row.totalLikes || 0),
        stores: Number(row.storeCount || 0),
      })),
    });
  } catch (error) {
    logger.error({ error }, "Failed to get followers trend");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get trend data");
  }
});

/**
 * GET /analytics/video-performance
 * Get video performance metrics over time
 */
analytics.get("/video-performance", async (c) => {
  const daysParam = c.req.query("days");
  const days = Math.min(Math.max(parseInt(daysParam || "30", 10), 7), 90);

  try {
    const storeFilter = getStoreFilter(c);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    const condition = storeFilter !== null
      ? and(gte(tiktokVideoDaily.snapshotDate, cutoffDateStr), inArray(tiktokVideoDaily.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"]))
      : gte(tiktokVideoDaily.snapshotDate, cutoffDateStr);

    const trend = await db
      .select({
        snapshotDate: tiktokVideoDaily.snapshotDate,
        totalViews: sum(tiktokVideoDaily.viewCount),
        totalLikes: sum(tiktokVideoDaily.likeCount),
        totalComments: sum(tiktokVideoDaily.commentCount),
        totalShares: sum(tiktokVideoDaily.shareCount),
        videoCount: count(),
      })
      .from(tiktokVideoDaily)
      .where(condition)
      .groupBy(tiktokVideoDaily.snapshotDate)
      .orderBy(tiktokVideoDaily.snapshotDate);

    return c.json({
      success: true,
      data: trend.map((row) => ({
        date: row.snapshotDate,
        views: Number(row.totalViews || 0),
        likes: Number(row.totalLikes || 0),
        comments: Number(row.totalComments || 0),
        shares: Number(row.totalShares || 0),
        videos: Number(row.videoCount || 0),
      })),
    });
  } catch (error) {
    logger.error({ error }, "Failed to get video performance");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get video data");
  }
});

/**
 * GET /analytics/top-stores
 * Get top performing stores by followers or engagement
 */
analytics.get("/top-stores", async (c) => {
  const sortBy = c.req.query("sort") || "followers"; // followers, views, engagement
  const limitParam = c.req.query("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "10", 10), 1), 50);

  try {
    const storeFilter = getStoreFilter(c);
    const today = new Date().toISOString().split("T")[0];

    // Get latest user stats per store
    const userCondition = storeFilter !== null
      ? and(eq(tiktokUserDaily.snapshotDate, today), inArray(tiktokUserDaily.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"]))
      : eq(tiktokUserDaily.snapshotDate, today);

    const userStats = await db
      .select({
        storeCode: tiktokUserDaily.storeCode,
        displayName: tiktokUserDaily.displayName,
        avatarUrl: tiktokUserDaily.avatarUrl,
        followers: tiktokUserDaily.followerCount,
        likes: tiktokUserDaily.likesCount,
        videos: tiktokUserDaily.videoCount,
      })
      .from(tiktokUserDaily)
      .where(userCondition);

    // Get video engagement per store for today
    const videoCondition = storeFilter !== null
      ? and(eq(tiktokVideoDaily.snapshotDate, today), inArray(tiktokVideoDaily.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"]))
      : eq(tiktokVideoDaily.snapshotDate, today);

    const videoStats = await db
      .select({
        storeCode: tiktokVideoDaily.storeCode,
        totalViews: sum(tiktokVideoDaily.viewCount),
        totalLikes: sum(tiktokVideoDaily.likeCount),
        totalComments: sum(tiktokVideoDaily.commentCount),
        totalShares: sum(tiktokVideoDaily.shareCount),
      })
      .from(tiktokVideoDaily)
      .where(videoCondition)
      .groupBy(tiktokVideoDaily.storeCode);

    const videoStatsMap = new Map(videoStats.map((v) => [v.storeCode, v]));

    // Get store names
    const storeCondition = storeFilter !== null
      ? inArray(stores.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"])
      : undefined;

    const storeNames = storeCondition
      ? await db.select({ storeCode: stores.storeCode, storeName: stores.storeName }).from(stores).where(storeCondition)
      : await db.select({ storeCode: stores.storeCode, storeName: stores.storeName }).from(stores);

    const storeNamesMap = new Map(storeNames.map((s) => [s.storeCode, s.storeName]));

    // Combine data
    const combined = userStats.map((user) => {
      const video = videoStatsMap.get(user.storeCode);
      const engagement =
        Number(video?.totalViews || 0) +
        Number(video?.totalLikes || 0) * 2 +
        Number(video?.totalComments || 0) * 3 +
        Number(video?.totalShares || 0) * 4;

      return {
        storeCode: user.storeCode,
        storeName: storeNamesMap.get(user.storeCode) || user.storeCode,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        followers: user.followers,
        profileLikes: user.likes,
        videoCount: user.videos,
        totalViews: Number(video?.totalViews || 0),
        totalVideoLikes: Number(video?.totalLikes || 0),
        totalComments: Number(video?.totalComments || 0),
        totalShares: Number(video?.totalShares || 0),
        engagementScore: engagement,
      };
    });

    // Sort by requested metric
    combined.sort((a, b) => {
      switch (sortBy) {
        case "views":
          return b.totalViews - a.totalViews;
        case "engagement":
          return b.engagementScore - a.engagementScore;
        case "followers":
        default:
          return b.followers - a.followers;
      }
    });

    return c.json({
      success: true,
      data: combined.slice(0, limit),
      sortBy,
      snapshotDate: today,
    });
  } catch (error) {
    logger.error({ error }, "Failed to get top stores");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get top stores");
  }
});

/**
 * GET /analytics/top-videos
 * Get top performing videos across all stores
 */
analytics.get("/top-videos", async (c) => {
  const sortBy = c.req.query("sort") || "views"; // views, likes, comments, shares
  const limitParam = c.req.query("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "10", 10), 1), 50);

  try {
    const storeFilter = getStoreFilter(c);
    const today = new Date().toISOString().split("T")[0];

    let orderByColumn;
    switch (sortBy) {
      case "likes":
        orderByColumn = tiktokVideoDaily.likeCount;
        break;
      case "comments":
        orderByColumn = tiktokVideoDaily.commentCount;
        break;
      case "shares":
        orderByColumn = tiktokVideoDaily.shareCount;
        break;
      case "views":
      default:
        orderByColumn = tiktokVideoDaily.viewCount;
    }

    const condition = storeFilter !== null
      ? and(eq(tiktokVideoDaily.snapshotDate, today), inArray(tiktokVideoDaily.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"]))
      : eq(tiktokVideoDaily.snapshotDate, today);

    const videos = await db
      .select({
        storeCode: tiktokVideoDaily.storeCode,
        videoId: tiktokVideoDaily.videoId,
        description: tiktokVideoDaily.description,
        coverImageUrl: tiktokVideoDaily.coverImageUrl,
        shareUrl: tiktokVideoDaily.shareUrl,
        createTime: tiktokVideoDaily.createTime,
        views: tiktokVideoDaily.viewCount,
        likes: tiktokVideoDaily.likeCount,
        comments: tiktokVideoDaily.commentCount,
        shares: tiktokVideoDaily.shareCount,
      })
      .from(tiktokVideoDaily)
      .where(condition)
      .orderBy(desc(orderByColumn))
      .limit(limit);

    // Get store names
    const storeCodes = [...new Set(videos.map((v) => v.storeCode))];
    const storeNames = storeCodes.length > 0
      ? await db
          .select({ storeCode: stores.storeCode, storeName: stores.storeName })
          .from(stores)
          .where(inArray(stores.storeCode, storeCodes))
      : [];

    const storeNamesMap = new Map(storeNames.map((s) => [s.storeCode, s.storeName]));

    return c.json({
      success: true,
      data: videos.map((video) => ({
        ...video,
        storeName: storeNamesMap.get(video.storeCode) || video.storeCode,
      })),
      sortBy,
      snapshotDate: today,
    });
  } catch (error) {
    logger.error({ error }, "Failed to get top videos");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get top videos");
  }
});

/**
 * GET /analytics/sync-health
 * Get sync health status across all stores
 */
analytics.get("/sync-health", async (c) => {
  try {
    const storeFilter = getStoreFilter(c);

    // Get recent sync logs (last 24 hours)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24);

    const logsCondition = storeFilter !== null
      ? and(gte(syncLogs.runTime, cutoffTime), inArray(syncLogs.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"]))
      : gte(syncLogs.runTime, cutoffTime);

    const statusCounts = await db
      .select({
        status: syncLogs.status,
        count: count(),
      })
      .from(syncLogs)
      .where(logsCondition)
      .groupBy(syncLogs.status);

    // Get accounts needing reconnection
    const reconnectCondition = storeFilter !== null
      ? and(eq(storeAccounts.status, "NEED_RECONNECT"), inArray(storeAccounts.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"]))
      : eq(storeAccounts.status, "NEED_RECONNECT");

    const needReconnectResult = await db
      .select({ count: count() })
      .from(storeAccounts)
      .where(reconnectCondition);

    // Get stores with errors
    const errorCondition = storeFilter !== null
      ? and(eq(storeAccounts.status, "ERROR"), inArray(storeAccounts.storeCode, storeFilter.length > 0 ? storeFilter : ["__none__"]))
      : eq(storeAccounts.status, "ERROR");

    const hasErrorResult = await db
      .select({ count: count() })
      .from(storeAccounts)
      .where(errorCondition);

    const statusMap = Object.fromEntries(
      statusCounts.map((s) => [s.status, Number(s.count)])
    );

    return c.json({
      success: true,
      data: {
        last24Hours: {
          success: statusMap["SUCCESS"] || 0,
          failed: statusMap["FAILED"] || 0,
          skipped: statusMap["SKIPPED"] || 0,
          running: statusMap["RUNNING"] || 0,
        },
        accountStatus: {
          needReconnect: Number(needReconnectResult[0]?.count || 0),
          hasError: Number(hasErrorResult[0]?.count || 0),
        },
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get sync health");
    return errorResponse(c, 500, "INTERNAL_ERROR", "Failed to get sync health");
  }
});

export default analytics;
