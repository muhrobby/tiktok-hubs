/**
 * Auth Routes
 *
 * Handles TikTok OAuth flow
 */

import { Hono } from "hono";
import { logger, storeLogger } from "../utils/logger.js";
import { errorResponse } from "../utils/http.js";
import * as tiktokAuth from "../services/tiktokAuth.service.js";
import * as tokenService from "../services/token.service.js";
import * as syncService from "../services/sync.service.js";
import { db } from "../db/client.js";
import { oauthState } from "../db/schema.js";
import { eq } from "drizzle-orm";

const auth = new Hono();

// ============================================
// VALIDATION HELPERS
// ============================================

function isValidStoreCode(code: string): boolean {
  return /^[a-zA-Z0-9_-]{1,50}$/.test(code);
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /connect/tiktok
 * Redirect user to TikTok OAuth authorization page
 */
auth.get("/connect/tiktok", async (c) => {
  const storeCode = c.req.query("store_code");

  if (!storeCode || !isValidStoreCode(storeCode)) {
    return errorResponse(
      c,
      400,
      "INVALID_STORE_CODE",
      "store_code must be 1-50 alphanumeric characters with underscores or hyphens",
    );
  }

  const log = storeLogger(storeCode);
  log.info("Initiating TikTok OAuth connection");

  // Check if store exists
  const store = await syncService.getStore(storeCode);
  if (!store) {
    log.warn("Store not found");
    return errorResponse(
      c,
      404,
      "STORE_NOT_FOUND",
      "Please create the store first via POST /admin/stores",
    );
  }

  // Build TikTok OAuth URL and redirect
  const authUrl = await tiktokAuth.buildAuthUrl(storeCode);

  log.info("Redirecting to TikTok OAuth");

  return c.redirect(authUrl);
});

/**
 * GET /auth/tiktok/callback
 * Handle TikTok OAuth callback after user authorization
 */
auth.get("/auth/tiktok/callback", async (c) => {
  const query = c.req.query();

  // Check for OAuth error
  if (query.error) {
    logger.error(
      { error: query.error, description: query.error_description },
      "TikTok OAuth error",
    );
    return errorResponse(
      c,
      400,
      "OAUTH_ERROR",
      query.error_description || "Authorization was denied or failed.",
    );
  }

  // Validate required params
  const code = query.code;
  const state = query.state;

  if (!code || !state) {
    logger.error(
      { code: !!code, state: !!state },
      "Missing OAuth callback params",
    );
    return errorResponse(
      c,
      400,
      "OAUTH_MISSING_PARAMS",
      "Missing required OAuth parameters",
    );
  }

  // Retrieve store_code from oauth_state table
  const [oauthRecord] = await db
    .select()
    .from(oauthState)
    .where(eq(oauthState.state, state))
    .limit(1);

  if (!oauthRecord) {
    logger.error({ state }, "OAuth state not found or expired");
    return errorResponse(
      c,
      400,
      "OAUTH_STATE_INVALID",
      "Invalid or expired OAuth state",
    );
  }

  const storeCode = oauthRecord.storeCode;
  const log = storeLogger(storeCode);

  log.info({ state, storeCode }, "Processing TikTok OAuth callback");

  try {
    // Verify store exists
    const store = await syncService.getStore(storeCode);
    if (!store) {
      log.warn("Store not found in callback");
      return errorResponse(c, 404, "STORE_NOT_FOUND", "Store not found");
    }

    // Exchange code for tokens with PKCE
    log.info("Exchanging authorization code for tokens");
    const tokenResult = await tiktokAuth.exchangeCodeForToken(code, state);

    // Store encrypted tokens
    await tokenService.storeTokens(storeCode, tokenResult);

    log.info(
      { openId: tokenResult.openId },
      "TikTok account connected successfully",
    );

    // Return success page
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connected Successfully</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .success { color: #059669; background: #ecfdf5; padding: 20px; border-radius: 8px; }
            .info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 20px; }
            code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>✅ Connected Successfully!</h1>
          <div class="success">
            <p>TikTok account has been connected to store: <strong>${storeCode}</strong></p>
          </div>
          <div class="info">
            <p><strong>What's next?</strong></p>
            <ul>
              <li>Data will be synced automatically every day</li>
              <li>You can trigger a manual sync via the API</li>
              <li>Check sync status at <code>GET /admin/stores</code></li>
            </ul>
          </div>
          <p>You can close this window now.</p>
        </body>
      </html>
    `);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error({ error }, "Failed to complete OAuth flow");
    return errorResponse(c, 500, "OAUTH_CALLBACK_FAILED", errorMessage);
  }
});

/**
 * GET /auth/url
 * Get TikTok OAuth URL without redirect (for copy link feature)
 */
auth.get("/auth/url", async (c) => {
  const storeCode = c.req.query("store_code");

  if (!storeCode || !isValidStoreCode(storeCode)) {
    return errorResponse(
      c,
      400,
      "INVALID_STORE_CODE",
      "store_code must be 1-50 alphanumeric characters with underscores or hyphens",
    );
  }

  const log = storeLogger(storeCode);
  log.info("Getting TikTok OAuth URL");

  // Check if store exists
  const store = await syncService.getStore(storeCode);
  if (!store) {
    log.warn("Store not found");
    return errorResponse(
      c,
      404,
      "STORE_NOT_FOUND",
      "Please create the store first via POST /admin/stores",
    );
  }

  // Build TikTok OAuth URL and return as JSON
  const authUrl = await tiktokAuth.buildAuthUrl(storeCode);

  return c.json({
    success: true,
    authUrl,
  });
});

export default auth;
