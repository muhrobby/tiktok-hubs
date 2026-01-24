/**
 * Sync Video Daily Job
 *
 * Syncs video statistics for all connected stores in parallel
 * Optimized for 300+ stores using batch processing
 * Runs daily to capture daily snapshots of video metrics
 */

import { jobLogger } from "../utils/logger.js";
import * as tokenService from "../services/token.service.js";
import * as syncService from "../services/sync.service.js";
import { withStoreLock } from "../utils/locks.js";
import { batchProcess } from "../utils/batch.js";

const log = jobLogger("sync_video_daily");

/**
 * Sync video stats for all connected stores in parallel
 * 
 * Performance for 300 stores:
 * - Old (sequential): ~35-50 minutes
 * - New (parallel, 20 concurrent): ~5-8 minutes
 */
export async function syncVideoDailyJob(): Promise<{
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  totalVideos: number;
}> {
  log.info("Starting video daily sync job (parallel mode)");

  const startTime = Date.now();
  const accounts = await tokenService.getConnectedAccounts();

  log.info({ accountsToSync: accounts.length }, "Found connected accounts");

  if (accounts.length === 0) {
    log.warn("No connected accounts to sync");
    return { total: 0, successful: 0, failed: 0, skipped: 0, totalVideos: 0 };
  }

  let successful = 0;
  let failed = 0;
  let skipped = 0;
  let totalVideos = 0;

  // Lower concurrency for video sync (more API calls per store)
  const concurrency = parseInt(process.env.VIDEO_SYNC_CONCURRENCY || "20", 10);

  // Process stores in parallel batches
  const result = await batchProcess(
    accounts,
    async (account) => {
      // Use lock to prevent concurrent syncs for the same store
      const lockResult = await withStoreLock(account.storeCode, async () => {
        return syncService.syncVideoStats(account.storeCode);
      });

      if (lockResult.skipped) {
        log.warn(
          { storeCode: account.storeCode },
          "Sync skipped - lock not acquired"
        );
        await syncService.createSyncLog({
          storeCode: account.storeCode,
          jobName: "sync_video_daily",
          status: "SKIPPED",
          message: "Sync skipped - another sync is already running",
        });
        return { status: "skipped" };
      } else if (lockResult.success && lockResult.result?.success) {
        return {
          status: "success",
          result: lockResult.result,
          videosProcessed: lockResult.result.recordsProcessed || 0,
        };
      } else {
        log.error(
          {
            storeCode: account.storeCode,
            error: lockResult.error?.message || lockResult.result?.error,
          },
          "Video stats sync failed"
        );
        return {
          status: "failed",
          error: lockResult.error || new Error(lockResult.result?.error),
        };
      }
    },
    {
      concurrency,
      onProgress: (processed, total) => {
        const percent = Math.round((processed / total) * 100);
        log.info({ processed, total, percent, totalVideos }, "Sync progress");
      },
      onSuccess: (account, result: any) => {
        successful++;
        if (result.videosProcessed) {
          totalVideos += result.videosProcessed;
        }
        log.debug(
          {
            storeCode: account.storeCode,
            videos: result.videosProcessed || 0,
          },
          "Store synced successfully"
        );
      },
      onError: (account, error) => {
        failed++;
        log.error({ storeCode: account.storeCode, error }, "Store sync failed");
      },
    }
  );

  // Count skipped from results
  skipped = result.results.filter(
    (r) => r.success && (r.result as any)?.status === "skipped"
  ).length;

  // Adjust successful count (exclude skipped)
  successful = result.successful - skipped;

  const duration = Date.now() - startTime;
  const avgTimePerStore = Math.round(duration / accounts.length);

  log.info(
    {
      total: accounts.length,
      successful,
      failed,
      skipped,
      totalVideos,
      durationMs: duration,
      avgTimePerStore,
      concurrency,
    },
    "Video daily sync job completed"
  );

  // Log the job execution
  await syncService.createSyncLog({
    storeCode: null,
    jobName: "sync_video_daily",
    status: failed === 0 ? "SUCCESS" : successful > 0 ? "SUCCESS" : "FAILED",
    message: `Synced ${successful}/${accounts.length} stores (${totalVideos} videos, ${concurrency} concurrent), ${failed} failed, ${skipped} skipped in ${Math.round(duration / 1000)}s`,
    durationMs: duration,
  });

  return {
    total: accounts.length,
    successful,
    failed,
    skipped,
    totalVideos,
  };
}

export default syncVideoDailyJob;
