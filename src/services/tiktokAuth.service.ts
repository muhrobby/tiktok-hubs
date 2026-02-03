/**
 * TikTok Authentication Service
 *
 * Implements TikTok Login Kit OAuth 2.0 flow
 *
 * IMPORTANT: This implementation follows TikTok's official documentation.
 * Before deploying, verify endpoints and scopes at:
 * https://developers.tiktok.com/doc/login-kit-web
 *
 * Required scopes for this app:
 * - user.info.basic: Basic user info (display_name, avatar_url)
 * - user.info.profile: Profile info (bio, etc.) - optional
 * - user.info.stats: User statistics (follower_count, following_count, likes_count)
 * - video.list: List user's videos
 */

import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/backoff.js";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db } from "../db/client.js";
import { oauthState } from "../db/schema.js";
import { eq, lt } from "drizzle-orm";

// ============================================
// HMAC STATE VALIDATION
// ============================================

/**
 * Get the state secret for HMAC validation
 * Falls back to TOKEN_ENC_KEY if STATE_SECRET not set
 */
function getStateSecret(): string {
  const secret = process.env.STATE_SECRET || process.env.TOKEN_ENC_KEY;
  if (!secret) {
    throw new Error("STATE_SECRET or TOKEN_ENC_KEY is required for OAuth state validation");
  }
  return secret;
}

/**
 * Generate HMAC signature for state parameter
 */
function signState(storeCode: string, nonce: string): string {
  const data = `${storeCode}:${nonce}`;
  return createHmac("sha256", getStateSecret())
    .update(data)
    .digest("hex")
    .substring(0, 16); // Use first 16 chars for shorter URL
}

/**
 * Generate secure state parameter with HMAC signature
 * Format: storeCode_nonce_signature
 */
function generateSecureState(storeCode: string): string {
  const nonce = randomBytes(8).toString("hex");
  const signature = signState(storeCode, nonce);
  return `${storeCode}_${nonce}_${signature}`;
}

/**
 * Validate and parse state parameter
 * Returns storeCode if valid, null if invalid
 */
export function validateState(state: string): string | null {
  const parts = state.split("_");
  
  // Must have at least 3 parts: storeCode, nonce, signature
  // storeCode might contain underscores, so we need to handle that
  if (parts.length < 3) {
    logger.warn({ state: state.substring(0, 20) }, "Invalid state format - insufficient parts");
    return null;
  }

  // Last part is signature, second to last is nonce
  const signature = parts.pop()!;
  const nonce = parts.pop()!;
  const storeCode = parts.join("_"); // Rejoin in case storeCode had underscores

  if (!storeCode || !nonce || !signature) {
    logger.warn("Invalid state format - missing components");
    return null;
  }

  // Verify HMAC signature using timing-safe comparison
  const expectedSignature = signState(storeCode, nonce);
  
  try {
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    
    if (sigBuffer.length !== expectedBuffer.length) {
      logger.warn({ storeCode }, "State signature length mismatch");
      return null;
    }
    
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
      logger.warn({ storeCode }, "State signature verification failed");
      return null;
    }
  } catch (error) {
    logger.warn({ error }, "State signature verification error");
    return null;
  }

  logger.debug({ storeCode }, "State signature verified successfully");
  return storeCode;
}

// ============================================
// PKCE HELPERS
// ============================================

/**
 * Generate random code_verifier for PKCE
 */
function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generate code_challenge from code_verifier
 */
function generateCodeChallenge(codeVerifier: string): string {
  return createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Store code_verifier for later use in token exchange
 */
async function storeCodeVerifier(
  state: string,
  codeVerifier: string,
  storeCode: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(oauthState).values({
    state,
    codeVerifier,
    storeCode,
    expiresAt,
  });

  logger.debug({ state }, "Stored code_verifier for PKCE");
}

/**
 * Retrieve and delete code_verifier
 */
async function retrieveCodeVerifier(state: string): Promise<string | null> {
  // Clean up expired states first
  await db.delete(oauthState).where(lt(oauthState.expiresAt, new Date()));

  // Get the state
  const result = await db
    .select()
    .from(oauthState)
    .where(eq(oauthState.state, state))
    .limit(1);

  if (!result[0]) {
    logger.warn({ state }, "Code verifier not found or expired");
    return null;
  }

  const codeVerifier = result[0].codeVerifier;

  // Delete after retrieval (one-time use)
  await db.delete(oauthState).where(eq(oauthState.state, state));

  logger.debug({ state }, "Retrieved and deleted code_verifier");

  return codeVerifier;
}

// ============================================
// TYPES
// ============================================

export interface TikTokTokenResponse {
  access_token: string;
  expires_in: number; // seconds
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number; // seconds
  scope: string;
  token_type: string;
}

export interface TikTokTokenResult {
  accessToken: string;
  refreshToken: string;
  openId: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
  scope: string;
}

export interface TikTokErrorResponse {
  error: string;
  error_description: string;
}

// ============================================
// CONFIGURATION
// ============================================

// TikTok API endpoints (as of 2024)
// PLACEHOLDER: Verify these endpoints with official docs before production
const TIKTOK_AUTH_BASE = "https://www.tiktok.com";
const TIKTOK_API_BASE = "https://open.tiktokapis.com";

// OAuth endpoints
const AUTHORIZE_URL = `${TIKTOK_AUTH_BASE}/v2/auth/authorize/`;
const TOKEN_URL = `${TIKTOK_API_BASE}/v2/oauth/token/`;
const REVOKE_URL = `${TIKTOK_API_BASE}/v2/oauth/revoke/`;

// Required scopes for this application
// PLACEHOLDER: Adjust scopes based on your TikTok app permissions
const REQUIRED_SCOPES = ["user.info.basic", "user.info.stats", "video.list"];

function getClientKey(): string {
  const key = process.env.TIKTOK_CLIENT_KEY;
  if (!key) throw new Error("TIKTOK_CLIENT_KEY is required");
  return key;
}

function getClientSecret(): string {
  const secret = process.env.TIKTOK_CLIENT_SECRET;
  if (!secret) throw new Error("TIKTOK_CLIENT_SECRET is required");
  return secret;
}

function getRedirectUri(): string {
  const uri = process.env.TIKTOK_REDIRECT_URI;
  if (!uri) throw new Error("TIKTOK_REDIRECT_URI is required");
  return uri;
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Build TikTok OAuth authorization URL with PKCE
 * User will be redirected to this URL to authorize the app
 */
export async function buildAuthUrl(storeCode: string): Promise<string> {
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  // Generate secure state with HMAC signature
  const state = generateSecureState(storeCode);

  // Store code_verifier for later use
  await storeCodeVerifier(state, codeVerifier, storeCode);

  const params = new URLSearchParams({
    client_key: getClientKey(),
    scope: REQUIRED_SCOPES.join(","),
    response_type: "code",
    redirect_uri: getRedirectUri(),
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const url = `${AUTHORIZE_URL}?${params.toString()}`;

  logger.info(
    { storeCode, state: state.substring(0, 20) + "...", url: url.replace(getClientKey(), "[REDACTED]") },
    "Built auth URL with PKCE and HMAC state"
  );

  return url;
}

/**
 * Exchange authorization code for access token with PKCE
 */
export async function exchangeCodeForToken(
  code: string,
  state: string
): Promise<TikTokTokenResult> {
  logger.info({ state: state.substring(0, 20) + "..." }, "Exchanging authorization code for token");

  // Validate state HMAC signature first
  const storeCode = validateState(state);
  if (!storeCode) {
    throw new Error("Invalid OAuth state signature - possible CSRF attack");
  }

  // Retrieve code_verifier
  const codeVerifier = await retrieveCodeVerifier(state);
  if (!codeVerifier) {
    throw new Error("Invalid or expired OAuth state");
  }

  const response = await withRetry(
    async () => {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_key: getClientKey(),
          client_secret: getClientSecret(),
          code,
          grant_type: "authorization_code",
          redirect_uri: getRedirectUri(),
          code_verifier: codeVerifier,
        }).toString(),
      });

      if (!res.ok) {
        logger.error({ status: res.status }, "Token exchange failed");
        throw new Error(`Token exchange failed: ${res.status}`);
      }

      return res.json() as Promise<TikTokTokenResponse>;
    },
    { maxRetries: 2 },
    "exchangeCodeForToken"
  );

  const now = Date.now();

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    openId: response.open_id,
    expiresAt: new Date(now + response.expires_in * 1000),
    refreshExpiresAt: new Date(now + response.refresh_expires_in * 1000),
    scope: response.scope,
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshToken(
  currentRefreshToken: string
): Promise<TikTokTokenResult> {
  logger.info("Refreshing access token");

  const response = await withRetry(
    async () => {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_key: getClientKey(),
          client_secret: getClientSecret(),
          grant_type: "refresh_token",
          refresh_token: currentRefreshToken,
        }).toString(),
      });

      if (!res.ok) {
        // Check for specific error codes that indicate token is invalid/revoked
        if (res.status === 400 || res.status === 401) {
          const error = new Error(
            "Token refresh failed - token may be revoked"
          );
          (error as Error & { code: string }).code = "TOKEN_REVOKED";
          throw error;
        }

        throw new Error(`Token refresh failed: ${res.status}`);
      }

      return res.json() as Promise<TikTokTokenResponse>;
    },
    { maxRetries: 2 },
    "refreshToken"
  );

  const now = Date.now();

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    openId: response.open_id,
    expiresAt: new Date(now + response.expires_in * 1000),
    refreshExpiresAt: new Date(now + response.refresh_expires_in * 1000),
    scope: response.scope,
  };
}

/**
 * Revoke a token (optional - for disconnecting a store)
 */
export async function revokeToken(accessToken: string): Promise<boolean> {
  logger.info("Revoking access token");

  try {
    const res = await fetch(REVOKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: getClientKey(),
        client_secret: getClientSecret(),
        token: accessToken,
      }).toString(),
    });

    if (!res.ok) {
      logger.warn(
        { status: res.status },
        "Token revocation returned non-OK status"
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error }, "Token revocation failed");
    return false;
  }
}

/**
 * Check if a token error indicates the token is revoked or invalid
 */
export function isTokenRevokedError(error: unknown): boolean {
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: string };
    if (errorWithCode.code === "TOKEN_REVOKED") return true;

    const message = error.message.toLowerCase();
    return (
      message.includes("token") &&
      (message.includes("revoked") ||
        message.includes("invalid") ||
        message.includes("expired") ||
        message.includes("unauthorized"))
    );
  }
  return false;
}
