/**
 * Refresh Tokens Job
 *
 * Refreshes TikTok access tokens that are about to expire
 * Runs daily before the sync jobs to ensure valid tokens
 */

import { jobLogger } from "../utils/logger.js";
import * as tokenService from "../services/token.service.js";
import * as syncService from "../services/sync.service.js";

const log = jobLogger("refresh_tokens");

/**
 * Refresh tokens for all accounts that expire within 24 hours
 */
export async function refreshTokensJob(): Promise<{
  total: number;
  refreshed: number;
  failed: number;
}> {
  log.info("Starting token refresh job");

  const startTime = Date.now();
  const accounts = await tokenService.getAccountsNeedingRefresh(24);

  log.info(
    { accountsToRefresh: accounts.length },
    "Found accounts needing refresh"
  );

  let refreshed = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      const result = await tokenService.refreshStoreToken(account.storeCode);

      if (result) {
        refreshed++;
        log.info(
          { storeCode: account.storeCode },
          "Token refreshed successfully"
        );
      } else {
        failed++;
        log.warn(
          { storeCode: account.storeCode },
          "Token refresh returned null"
        );
      }
    } catch (error) {
      failed++;
      log.error(
        { storeCode: account.storeCode, error },
        "Failed to refresh token"
      );
    }

    // Small delay between refreshes
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const duration = Date.now() - startTime;

  log.info(
    { total: accounts.length, refreshed, failed, durationMs: duration },
    "Token refresh job completed"
  );

  // Log the job execution
  await syncService.createSyncLog({
    storeCode: null,
    jobName: "refresh_tokens",
    status: failed === 0 ? "SUCCESS" : refreshed > 0 ? "SUCCESS" : "FAILED",
    message: `Refreshed ${refreshed}/${accounts.length} tokens, ${failed} failed`,
    durationMs: duration,
  });

  return {
    total: accounts.length,
    refreshed,
    failed,
  };
}

export default refreshTokensJob;
