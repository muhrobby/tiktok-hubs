/**
 * Token Service
 *
 * Manages encrypted token storage and refresh
 */

import { db } from "../db/client.js";
import {
  storeAccounts,
  type StoreAccount,
  type AccountStatus,
} from "../db/schema.js";
import { eq, lt, and } from "drizzle-orm";
import { encrypt, decrypt } from "../utils/crypto.js";
import { logger, storeLogger } from "../utils/logger.js";
import * as tiktokAuth from "./tiktokAuth.service.js";

// ============================================
// TYPES
// ============================================

export interface DecryptedToken {
  accessToken: string;
  refreshToken: string;
}

export interface TokenInfo {
  storeCode: string;
  openId: string;
  status: AccountStatus;
  expiresAt: Date;
  refreshExpiresAt: Date | null;
  lastSyncTime: Date | null;
}

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * Store encrypted tokens for a store account
 */
export async function storeTokens(
  storeCode: string,
  tokenResult: tiktokAuth.TikTokTokenResult
): Promise<void> {
  const log = storeLogger(storeCode);

  const accessTokenEnc = encrypt(tokenResult.accessToken);
  const refreshTokenEnc = encrypt(tokenResult.refreshToken);

  log.info({ openId: tokenResult.openId }, "Storing encrypted tokens");

  // Check if account exists
  const existing = await db
    .select()
    .from(storeAccounts)
    .where(eq(storeAccounts.storeCode, storeCode))
    .limit(1);

  if (existing.length > 0) {
    // Update existing account
    await db
      .update(storeAccounts)
      .set({
        openId: tokenResult.openId,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiredAt: tokenResult.expiresAt,
        refreshTokenExpiredAt: tokenResult.refreshExpiresAt,
        status: "CONNECTED",
        updatedAt: new Date(),
      })
      .where(eq(storeAccounts.storeCode, storeCode));
  } else {
    // Insert new account
    await db.insert(storeAccounts).values({
      storeCode,
      openId: tokenResult.openId,
      accessTokenEnc,
      refreshTokenEnc,
      tokenExpiredAt: tokenResult.expiresAt,
      refreshTokenExpiredAt: tokenResult.refreshExpiresAt,
      status: "CONNECTED",
      connectedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  log.info("Tokens stored successfully");
}

/**
 * Get decrypted tokens for a store
 */
export async function getTokens(
  storeCode: string
): Promise<DecryptedToken | null> {
  const log = storeLogger(storeCode);

  const [account] = await db
    .select()
    .from(storeAccounts)
    .where(eq(storeAccounts.storeCode, storeCode))
    .limit(1);

  if (!account) {
    log.warn("No account found for store");
    return null;
  }

  if (account.status === "DISABLED") {
    log.warn("Account is disabled");
    return null;
  }

  try {
    return {
      accessToken: decrypt(account.accessTokenEnc),
      refreshToken: decrypt(account.refreshTokenEnc),
    };
  } catch (error) {
    log.error({ error }, "Failed to decrypt tokens");
    await updateAccountStatus(storeCode, "ERROR");
    return null;
  }
}

/**
 * Get valid access token, refreshing if needed
 */
export async function getValidAccessToken(
  storeCode: string
): Promise<string | null> {
  const log = storeLogger(storeCode);

  const [account] = await db
    .select()
    .from(storeAccounts)
    .where(eq(storeAccounts.storeCode, storeCode))
    .limit(1);

  if (!account) {
    log.warn("No account found");
    return null;
  }

  if (account.status === "NEED_RECONNECT" || account.status === "DISABLED") {
    log.warn(
      { status: account.status },
      "Account needs reconnection or is disabled"
    );
    return null;
  }

  // Check if token is still valid (with 5 minute buffer)
  const bufferMs = 5 * 60 * 1000;
  const now = new Date();
  const isExpired = account.tokenExpiredAt.getTime() - bufferMs < now.getTime();

  if (!isExpired) {
    // Token is still valid
    try {
      return decrypt(account.accessTokenEnc);
    } catch (error) {
      log.error({ error }, "Failed to decrypt access token");
      await updateAccountStatus(storeCode, "ERROR");
      return null;
    }
  }

  // Token is expired, try to refresh
  log.info("Access token expired, attempting refresh");

  try {
    const refreshResult = await refreshStoreToken(storeCode);
    if (refreshResult) {
      return refreshResult.accessToken;
    }
  } catch (error) {
    log.error({ error }, "Token refresh failed");
  }

  return null;
}

/**
 * Refresh token for a store
 */
export async function refreshStoreToken(
  storeCode: string
): Promise<DecryptedToken | null> {
  const log = storeLogger(storeCode);

  const tokens = await getTokens(storeCode);
  if (!tokens) {
    return null;
  }

  try {
    log.info("Refreshing tokens");

    const newTokens = await tiktokAuth.refreshToken(tokens.refreshToken);

    await storeTokens(storeCode, newTokens);

    log.info("Tokens refreshed successfully");

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    };
  } catch (error) {
    log.error({ error }, "Token refresh failed");

    // Check if token is revoked
    if (tiktokAuth.isTokenRevokedError(error)) {
      await updateAccountStatus(storeCode, "NEED_RECONNECT");
      log.warn("Token revoked - store needs to reconnect");
    } else {
      await updateAccountStatus(storeCode, "ERROR");
    }

    return null;
  }
}

/**
 * Update account status
 */
export async function updateAccountStatus(
  storeCode: string,
  status: AccountStatus
): Promise<void> {
  await db
    .update(storeAccounts)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(storeAccounts.storeCode, storeCode));

  logger.info({ storeCode, status }, "Account status updated");
}

/**
 * Update last sync time
 */
export async function updateLastSyncTime(storeCode: string): Promise<void> {
  await db
    .update(storeAccounts)
    .set({
      lastSyncTime: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(storeAccounts.storeCode, storeCode));
}

/**
 * Get all accounts that need token refresh
 * Returns accounts where token expires within the specified hours
 */
export async function getAccountsNeedingRefresh(
  hoursBeforeExpiry: number = 24
): Promise<StoreAccount[]> {
  const threshold = new Date(Date.now() + hoursBeforeExpiry * 60 * 60 * 1000);

  return db
    .select()
    .from(storeAccounts)
    .where(
      and(
        eq(storeAccounts.status, "CONNECTED"),
        lt(storeAccounts.tokenExpiredAt, threshold)
      )
    );
}

/**
 * Get all connected accounts
 */
export async function getConnectedAccounts(): Promise<StoreAccount[]> {
  return db
    .select()
    .from(storeAccounts)
    .where(eq(storeAccounts.status, "CONNECTED"));
}

/**
 * Get account by store code
 */
export async function getAccount(
  storeCode: string
): Promise<StoreAccount | null> {
  const [account] = await db
    .select()
    .from(storeAccounts)
    .where(eq(storeAccounts.storeCode, storeCode))
    .limit(1);

  return account || null;
}

/**
 * Get token info for a store (without exposing actual tokens)
 */
export async function getTokenInfo(
  storeCode: string
): Promise<TokenInfo | null> {
  const account = await getAccount(storeCode);

  if (!account) {
    return null;
  }

  return {
    storeCode: account.storeCode,
    openId: account.openId,
    status: account.status as AccountStatus,
    expiresAt: account.tokenExpiredAt,
    refreshExpiresAt: account.refreshTokenExpiredAt,
    lastSyncTime: account.lastSyncTime,
  };
}
