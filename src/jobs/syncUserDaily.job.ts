/**
 * Sync User Daily Job
 *
 * Syncs user statistics for all connected stores in parallel
 * Optimized for 300+ stores using batch processing
 * Runs daily to capture daily snapshots
 */

import { jobLogger } from "../utils/logger.js";
import * as tokenService from "../services/token.service.js";
import * as syncService from "../services/sync.service.js";
import { withStoreLock } from "../utils/locks.js";
import { batchProcess } from "../utils/batch.js";

const log = jobLogger("sync_user_daily");

/**
 * Sync user stats for all connected stores in parallel
 * 
 * Performance for 300 stores:
 * - Old (sequential): ~15-20 minutes
 * - New (parallel, 30 concurrent): ~2-3 minutes
 */
export async function syncUserDailyJob(): Promise<{
  total: number;
  successful: number;
  failed: number;
  skipped: number;
}> {
  log.info("Starting user daily sync job (parallel mode)");

  const startTime = Date.now();
  const accounts = await tokenService.getConnectedAccounts();

  log.info({ accountsToSync: accounts.length }, "Found connected accounts");

  if (accounts.length === 0) {
    log.warn("No connected accounts to sync");
    return { total: 0, successful: 0, failed: 0, skipped: 0 };
  }

  let successful = 0;
  let failed = 0;
  let skipped = 0;

  // Get concurrency setting from env, default 30 for 300+ stores
  const concurrency = parseInt(process.env.SYNC_CONCURRENCY || "30", 10);

  // Process stores in parallel batches
  const result = await batchProcess(
    accounts,
    async (account) => {
      // Use lock to prevent concurrent syncs for the same store
      const lockResult = await withStoreLock(account.storeCode, async () => {
        return syncService.syncUserStats(account.storeCode);
      });

      if (lockResult.skipped) {
        log.warn(
          { storeCode: account.storeCode },
          "Sync skipped - lock not acquired"
        );
        await syncService.createSyncLog({
          storeCode: account.storeCode,
          jobName: "sync_user_daily",
          status: "SKIPPED",
          message: "Sync skipped - another sync is already running",
        });
        return { status: "skipped" };
      } else if (lockResult.success && lockResult.result?.success) {
        return { status: "success", result: lockResult.result };
      } else {
        log.error(
          {
            storeCode: account.storeCode,
            error: lockResult.error?.message || lockResult.result?.error,
          },
          "User stats sync failed"
        );
        return { status: "failed", error: lockResult.error || new Error(lockResult.result?.error) };
      }
    },
    {
      concurrency,
      onProgress: (processed, total) => {
        const percent = Math.round((processed / total) * 100);
        log.info({ processed, total, percent }, "Sync progress");
      },
      onSuccess: (account) => {
        successful++;
        log.debug({ storeCode: account.storeCode }, "Store synced successfully");
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
      durationMs: duration,
      avgTimePerStore,
      concurrency,
    },
    "User daily sync job completed"
  );

  // Log the job execution
  await syncService.createSyncLog({
    storeCode: null,
    jobName: "sync_user_daily",
    status: failed === 0 ? "SUCCESS" : successful > 0 ? "SUCCESS" : "FAILED",
    message: `Synced ${successful}/${accounts.length} stores (${concurrency} concurrent), ${failed} failed, ${skipped} skipped in ${Math.round(duration / 1000)}s`,
    durationMs: duration,
  });

  return {
    total: accounts.length,
    successful,
    failed,
    skipped,
  };
}

export default syncUserDailyJob;
