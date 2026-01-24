/**
 * Sync Service
 *
 * Handles synchronization of TikTok data to database
 */

import { db } from "../db/client.js";
import {
  stores,
  storeAccounts,
  tiktokUserDaily,
  tiktokVideoDaily,
  syncLogs,
  type SyncStatus,
} from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { storeLogger, jobLogger } from "../utils/logger.js";
import { withStoreLock } from "../utils/locks.js";
import * as tokenService from "./token.service.js";
import * as tiktokApi from "./tiktokApi.service.js";

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
    .replace(/access[_-]?token\s*[:=]\s*[^\s]+/gi, "access_token=[REDACTED]")
    .replace(/refresh[_-]?token\s*[:=]\s*[^\s]+/gi, "refresh_token=[REDACTED]");
}

// ============================================
// TYPES
// ============================================

export interface SyncResult {
  success: boolean;
  storeCode: string;
  message: string;
  error?: string;
  duration?: number;
  recordsProcessed?: number;
}

export interface SyncLogEntry {
  storeCode: string | null;
  jobName: string;
  status: SyncStatus;
  message: string;
  rawError?: string;
  durationMs?: number;
}

// ============================================
// SYNC LOGGING
// ============================================

/**
 * Create a sync log entry
 */
export async function createSyncLog(entry: SyncLogEntry): Promise<void> {
  await db.insert(syncLogs).values({
    storeCode: entry.storeCode,
    jobName: entry.jobName,
    status: entry.status,
    message: entry.message,
    rawError: entry.rawError,
    durationMs: entry.durationMs,
    runTime: new Date(),
  });
}

/**
 * Get sync logs for a store
 */
export async function getSyncLogs(
  storeCode?: string,
  limit: number = 50
): Promise<(typeof syncLogs.$inferSelect)[]> {
  if (storeCode) {
    return db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.storeCode, storeCode))
      .orderBy(sql`${syncLogs.runTime} DESC`)
      .limit(limit);
  }

  return db
    .select()
    .from(syncLogs)
    .orderBy(sql`${syncLogs.runTime} DESC`)
    .limit(limit);
}

// ============================================
// USER STATS SYNC
// ============================================

/**
 * Sync user stats for a single store
 */
export async function syncUserStats(storeCode: string): Promise<SyncResult> {
  const log = storeLogger(storeCode);
  const startTime = Date.now();
  const jobName = "sync_user_stats";

  log.info("Starting user stats sync");

  // Get valid access token
  const accessToken = await tokenService.getValidAccessToken(storeCode);
  if (!accessToken) {
    const message = "No valid access token available";
    log.warn(message);

    await createSyncLog({
      storeCode,
      jobName,
      status: "FAILED",
      message,
      durationMs: Date.now() - startTime,
    });

    return { success: false, storeCode, message };
  }

  try {
    // Fetch user info from TikTok
    const userInfo = await tiktokApi.getUserInfo(accessToken);

    // Get today's date (snapshot date)
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Upsert user daily record
    await db
      .insert(tiktokUserDaily)
      .values({
        storeCode,
        snapshotDate: today,
        followerCount: userInfo.followerCount,
        followingCount: userInfo.followingCount,
        likesCount: userInfo.likesCount,
        videoCount: userInfo.videoCount,
        displayName: userInfo.displayName,
        avatarUrl: userInfo.avatarUrl,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [tiktokUserDaily.storeCode, tiktokUserDaily.snapshotDate],
        set: {
          followerCount: userInfo.followerCount,
          followingCount: userInfo.followingCount,
          likesCount: userInfo.likesCount,
          videoCount: userInfo.videoCount,
          displayName: userInfo.displayName,
          avatarUrl: userInfo.avatarUrl,
        },
      });

    // Update last sync time
    await tokenService.updateLastSyncTime(storeCode);

    const duration = Date.now() - startTime;
    const message = `User stats synced successfully: ${userInfo.followerCount} followers, ${userInfo.videoCount} videos`;

    log.info({ duration, userInfo }, message);

    await createSyncLog({
      storeCode,
      jobName,
      status: "SUCCESS",
      message,
      durationMs: duration,
    });

    return {
      success: true,
      storeCode,
      message,
      duration,
      recordsProcessed: 1,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const safeErrorMessage = sanitizeErrorMessage(errorMessage);

    log.error({ error, duration }, "User stats sync failed");

    // Check if token is invalid
    if (tiktokApi.needsTokenRefresh(error)) {
      await tokenService.updateAccountStatus(storeCode, "NEED_RECONNECT");
    }

    await createSyncLog({
      storeCode,
      jobName,
      status: "FAILED",
      message: tiktokApi.needsTokenRefresh(error)
        ? "User stats sync failed - token invalid or expired"
        : "User stats sync failed",
      rawError: safeErrorMessage,
      durationMs: duration,
    });

    return {
      success: false,
      storeCode,
      message: "User stats sync failed",
      error: safeErrorMessage,
      duration,
    };
  }
}

/**
 * Sync user stats with per-store lock
 */
export async function syncUserStatsWithLock(
  storeCode: string
): Promise<SyncResult> {
  const lockResult = await withStoreLock(storeCode, async () => {
    return syncUserStats(storeCode);
  });

  if (lockResult.skipped) {
    await createSyncLog({
      storeCode,
      jobName: "sync_user_stats",
      status: "SKIPPED",
      message: "Sync skipped - another sync is already running",
    });

    return {
      success: false,
      storeCode,
      message: "Sync skipped - another sync is already running",
    };
  }

  if (lockResult.error) {
    return {
      success: false,
      storeCode,
      message: lockResult.error.message,
      error: lockResult.error.message,
    };
  }

  return lockResult.result!;
}

// ============================================
// VIDEO STATS SYNC
// ============================================

/**
 * Sync video stats for a single store
 */
export async function syncVideoStats(storeCode: string): Promise<SyncResult> {
  const log = storeLogger(storeCode);
  const startTime = Date.now();
  const jobName = "sync_video_stats";

  log.info("Starting video stats sync");

  // Get valid access token
  const accessToken = await tokenService.getValidAccessToken(storeCode);
  if (!accessToken) {
    const message = "No valid access token available";
    log.warn(message);

    await createSyncLog({
      storeCode,
      jobName,
      status: "FAILED",
      message,
      durationMs: Date.now() - startTime,
    });

    return { success: false, storeCode, message };
  }

  try {
    // Fetch all videos from TikTok (with pagination)
    const videos = await tiktokApi.fetchAllVideos(accessToken, {
      maxVideos: 500, // Limit to prevent excessive API calls
      onProgress: (fetched) => {
        log.debug({ fetched }, "Fetching videos progress");
      },
    });

    // Get today's date (snapshot date)
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Upsert each video's daily stats
    let processedCount = 0;
    for (const video of videos) {
      await db
        .insert(tiktokVideoDaily)
        .values({
          storeCode,
          videoId: video.videoId,
          snapshotDate: today,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          shareCount: video.shareCount,
          createTime: video.createTime,
          description: video.description,
          coverImageUrl: video.coverImageUrl,
          shareUrl: video.shareUrl,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            tiktokVideoDaily.storeCode,
            tiktokVideoDaily.videoId,
            tiktokVideoDaily.snapshotDate,
          ],
          set: {
            viewCount: video.viewCount,
            likeCount: video.likeCount,
            commentCount: video.commentCount,
            shareCount: video.shareCount,
            description: video.description,
            coverImageUrl: video.coverImageUrl,
            shareUrl: video.shareUrl,
          },
        });

      processedCount++;
    }

    // Update last sync time
    await tokenService.updateLastSyncTime(storeCode);

    const duration = Date.now() - startTime;
    const message = `Video stats synced successfully: ${processedCount} videos processed`;

    log.info({ duration, videosProcessed: processedCount }, message);

    await createSyncLog({
      storeCode,
      jobName,
      status: "SUCCESS",
      message,
      durationMs: duration,
    });

    return {
      success: true,
      storeCode,
      message,
      duration,
      recordsProcessed: processedCount,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const safeErrorMessage = sanitizeErrorMessage(errorMessage);

    log.error({ error, duration }, "Video stats sync failed");

    // Check if token is invalid
    if (tiktokApi.needsTokenRefresh(error)) {
      await tokenService.updateAccountStatus(storeCode, "NEED_RECONNECT");
    }

    await createSyncLog({
      storeCode,
      jobName,
      status: "FAILED",
      message: tiktokApi.needsTokenRefresh(error)
        ? "Video stats sync failed - token invalid or expired"
        : "Video stats sync failed",
      rawError: safeErrorMessage,
      durationMs: duration,
    });

    return {
      success: false,
      storeCode,
      message: "Video stats sync failed",
      error: safeErrorMessage,
      duration,
    };
  }
}

/**
 * Sync video stats with per-store lock
 */
export async function syncVideoStatsWithLock(
  storeCode: string
): Promise<SyncResult> {
  const lockResult = await withStoreLock(storeCode, async () => {
    return syncVideoStats(storeCode);
  });

  if (lockResult.skipped) {
    await createSyncLog({
      storeCode,
      jobName: "sync_video_stats",
      status: "SKIPPED",
      message: "Sync skipped - another sync is already running",
    });

    return {
      success: false,
      storeCode,
      message: "Sync skipped - another sync is already running",
    };
  }

  if (lockResult.error) {
    return {
      success: false,
      storeCode,
      message: lockResult.error.message,
      error: lockResult.error.message,
    };
  }

  return lockResult.result!;
}

// ============================================
// FULL SYNC
// ============================================

/**
 * Run full sync for a store (user + videos) with lock
 */
export async function runFullSync(storeCode: string): Promise<SyncResult> {
  const log = storeLogger(storeCode);

  log.info("Starting full sync with lock");

  const result = await withStoreLock(storeCode, async () => {
    // Sync user stats first
    const userResult = await syncUserStats(storeCode);
    if (!userResult.success) {
      return userResult;
    }

    // Then sync video stats
    const videoResult = await syncVideoStats(storeCode);
    return videoResult;
  });

  if (result.skipped) {
    log.warn("Sync skipped - lock not acquired");
    await createSyncLog({
      storeCode,
      jobName: "sync_full",
      status: "SKIPPED",
      message: "Sync skipped - another sync is already running",
    });
    return {
      success: false,
      storeCode,
      message: "Sync skipped - another sync is already running",
    };
  }

  if (result.error) {
    return {
      success: false,
      storeCode,
      message: result.error.message,
      error: result.error.message,
    };
  }

  return result.result!;
}

/**
 * Run sync for all connected stores
 */
export async function runSyncForAllStores(): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: SyncResult[];
}> {
  const log = jobLogger("sync_all_stores");

  const connectedAccounts = await tokenService.getConnectedAccounts();

  log.info({ count: connectedAccounts.length }, "Starting sync for all stores");

  const results: SyncResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const account of connectedAccounts) {
    const result = await runFullSync(account.storeCode);
    results.push(result);

    if (result.success) {
      successful++;
    } else {
      failed++;
    }

    // Small delay between stores to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  log.info(
    { total: connectedAccounts.length, successful, failed },
    "Completed sync for all stores"
  );

  return {
    total: connectedAccounts.length,
    successful,
    failed,
    results,
  };
}

// ============================================
// STORE OPERATIONS
// ============================================

/**
 * Get all stores with their connection status
 */
export async function getStoresWithStatus(): Promise<
  Array<{
    storeCode: string;
    storeName: string;
    picName: string;
    picContact: string | null;
    status: string;
    lastSyncTime: Date | null;
    connectedAt: Date | null;
  }>
> {
  const storeList = await db.select().from(stores);

  const results = await Promise.all(
    storeList.map(async (store: typeof stores.$inferSelect) => {
      const [account] = await db
        .select()
        .from(storeAccounts)
        .where(eq(storeAccounts.storeCode, store.storeCode))
        .limit(1);

      return {
        storeCode: store.storeCode,
        storeName: store.storeName,
        picName: store.picName,
        picContact: store.picContact,
        status: account?.status || "NOT_CONNECTED",
        lastSyncTime: account?.lastSyncTime || null,
        connectedAt: account?.connectedAt || null,
      };
    })
  );

  return results;
}

/**
 * Create a new store
 */
export async function createStore(data: {
  storeCode: string;
  storeName: string;
  picName: string;
  picContact?: string;
}): Promise<typeof stores.$inferSelect> {
  const [store] = await db
    .insert(stores)
    .values({
      storeCode: data.storeCode,
      storeName: data.storeName,
      picName: data.picName,
      picContact: data.picContact,
      createdAt: new Date(),
    })
    .returning();

  return store;
}

/**
 * Get store by code
 */
export async function getStore(
  storeCode: string
): Promise<typeof stores.$inferSelect | null> {
  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.storeCode, storeCode))
    .limit(1);

  return store || null;
}

/**
 * Check if store exists
 */
export async function storeExists(storeCode: string): Promise<boolean> {
  const store = await getStore(storeCode);
  return store !== null;
}

/**
 * Get accounts for a specific store
 */
export async function getAccountsByStore(storeCode: string): Promise<
  Array<{
    id: number;
    storeCode: string;
    openId: string;
    status: string;
    lastSyncTime: Date | null;
    connectedAt: Date;
    updatedAt: Date;
  }>
> {
  const accounts = await db
    .select({
      id: storeAccounts.id,
      storeCode: storeAccounts.storeCode,
      openId: storeAccounts.openId,
      status: storeAccounts.status,
      lastSyncTime: storeAccounts.lastSyncTime,
      connectedAt: storeAccounts.connectedAt,
      updatedAt: storeAccounts.updatedAt,
    })
    .from(storeAccounts)
    .where(eq(storeAccounts.storeCode, storeCode));

  return accounts;
}

/**
 * Get user stats history for a specific store
 */
export async function getUserStatsByStore(
  storeCode: string,
  days: number = 30
): Promise<(typeof tiktokUserDaily.$inferSelect)[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

  const stats = await db
    .select()
    .from(tiktokUserDaily)
    .where(
      and(
        eq(tiktokUserDaily.storeCode, storeCode),
        sql`${tiktokUserDaily.snapshotDate} >= ${cutoffDateStr}`
      )
    )
    .orderBy(sql`${tiktokUserDaily.snapshotDate} DESC`);

  return stats;
}

/**
 * Get video stats for a specific store
 */
export async function getVideoStatsByStore(
  storeCode: string,
  days: number = 30
): Promise<(typeof tiktokVideoDaily.$inferSelect)[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

  const stats = await db
    .select()
    .from(tiktokVideoDaily)
    .where(
      and(
        eq(tiktokVideoDaily.storeCode, storeCode),
        sql`${tiktokVideoDaily.snapshotDate} >= ${cutoffDateStr}`
      )
    )
    .orderBy(sql`${tiktokVideoDaily.snapshotDate} DESC`);

  return stats;
}
