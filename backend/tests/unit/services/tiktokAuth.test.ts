/**
 * TikTok Auth Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the database
vi.mock("../../../src/db/client.js", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock the logger
vi.mock("../../../src/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("TikTok Auth Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.TIKTOK_CLIENT_KEY = "test_client_key";
    process.env.TIKTOK_CLIENT_SECRET = "test_client_secret";
    process.env.TIKTOK_REDIRECT_URI = "http://localhost:3000/auth/tiktok/callback";
    process.env.TOKEN_ENC_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.STATE_SECRET =
      "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("validateState", () => {
    it("should validate correctly signed state", async () => {
      const { validateState } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      // We need to generate a state using the same secret
      // The state format is: storeCode_nonce_signature
      const crypto = await import("crypto");

      const storeCode = "store_001";
      const nonce = crypto.randomBytes(8).toString("hex");

      // Generate signature using the same algorithm
      const data = `${storeCode}:${nonce}`;
      const signature = crypto
        .createHmac("sha256", process.env.STATE_SECRET!)
        .update(data)
        .digest("hex")
        .substring(0, 16);

      const state = `${storeCode}_${nonce}_${signature}`;

      const result = validateState(state);
      expect(result).toBe(storeCode);
    });

    it("should reject invalid state format - no parts", async () => {
      const { validateState } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const result = validateState("invalidstate");
      expect(result).toBeNull();
    });

    it("should reject invalid state format - only 2 parts", async () => {
      const { validateState } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const result = validateState("store_001_only");
      expect(result).toBeNull();
    });

    it("should reject state with tampered signature", async () => {
      const { validateState } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const crypto = await import("crypto");

      const storeCode = "store_001";
      const nonce = crypto.randomBytes(8).toString("hex");

      // Use wrong signature
      const fakeSignature = "0000000000000000";
      const state = `${storeCode}_${nonce}_${fakeSignature}`;

      const result = validateState(state);
      expect(result).toBeNull();
    });

    it("should reject state with tampered store code", async () => {
      const { validateState } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const crypto = await import("crypto");

      const originalStoreCode = "store_001";
      const nonce = crypto.randomBytes(8).toString("hex");

      // Generate signature for original store code
      const data = `${originalStoreCode}:${nonce}`;
      const signature = crypto
        .createHmac("sha256", process.env.STATE_SECRET!)
        .update(data)
        .digest("hex")
        .substring(0, 16);

      // Use different store code with original signature
      const state = `store_002_${nonce}_${signature}`;

      const result = validateState(state);
      expect(result).toBeNull();
    });

    it("should handle store codes with underscores", async () => {
      const { validateState } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const crypto = await import("crypto");

      const storeCode = "my_store_code";
      const nonce = crypto.randomBytes(8).toString("hex");

      const data = `${storeCode}:${nonce}`;
      const signature = crypto
        .createHmac("sha256", process.env.STATE_SECRET!)
        .update(data)
        .digest("hex")
        .substring(0, 16);

      const state = `${storeCode}_${nonce}_${signature}`;

      const result = validateState(state);
      expect(result).toBe(storeCode);
    });

    it("should use TOKEN_ENC_KEY as fallback when STATE_SECRET not set", async () => {
      delete process.env.STATE_SECRET;
      vi.resetModules();

      const { validateState } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const crypto = await import("crypto");

      const storeCode = "store_001";
      const nonce = crypto.randomBytes(8).toString("hex");

      // Generate signature using TOKEN_ENC_KEY
      const data = `${storeCode}:${nonce}`;
      const signature = crypto
        .createHmac("sha256", process.env.TOKEN_ENC_KEY!)
        .update(data)
        .digest("hex")
        .substring(0, 16);

      const state = `${storeCode}_${nonce}_${signature}`;

      const result = validateState(state);
      expect(result).toBe(storeCode);
    });
  });

  describe("buildAuthUrl", () => {
    it("should build valid OAuth URL", async () => {
      const { buildAuthUrl } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const url = await buildAuthUrl("store_001");

      expect(url).toContain("https://www.tiktok.com/v2/auth/authorize/");
      expect(url).toContain("client_key=test_client_key");
      expect(url).toContain("redirect_uri=");
      expect(url).toContain("response_type=code");
      expect(url).toContain("code_challenge=");
      expect(url).toContain("code_challenge_method=S256");
      expect(url).toContain("state=store_001_");
    });

    it("should include required scopes", async () => {
      const { buildAuthUrl } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const url = await buildAuthUrl("store_001");

      expect(url).toContain("user.info.basic");
      expect(url).toContain("user.info.stats");
      expect(url).toContain("video.list");
    });

    it("should generate unique state for each call", async () => {
      const { buildAuthUrl } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const url1 = await buildAuthUrl("store_001");
      const url2 = await buildAuthUrl("store_001");

      // Extract state from URLs
      const state1 = new URL(url1).searchParams.get("state");
      const state2 = new URL(url2).searchParams.get("state");

      expect(state1).not.toBe(state2);
    });

    it("should include store code in state", async () => {
      const { buildAuthUrl } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const url = await buildAuthUrl("my_store");

      const state = new URL(url).searchParams.get("state");
      expect(state).toContain("my_store");
    });

    it("should throw when TIKTOK_CLIENT_KEY is not set", async () => {
      delete process.env.TIKTOK_CLIENT_KEY;
      vi.resetModules();

      const { buildAuthUrl } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      await expect(buildAuthUrl("store_001")).rejects.toThrow(
        "TIKTOK_CLIENT_KEY is required"
      );
    });

    it("should throw when TIKTOK_REDIRECT_URI is not set", async () => {
      delete process.env.TIKTOK_REDIRECT_URI;
      vi.resetModules();

      const { buildAuthUrl } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      await expect(buildAuthUrl("store_001")).rejects.toThrow(
        "TIKTOK_REDIRECT_URI is required"
      );
    });
  });

  describe("isTokenRevokedError", () => {
    it("should detect TOKEN_REVOKED error code", async () => {
      const { isTokenRevokedError } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const error = new Error("Token refresh failed");
      (error as Error & { code: string }).code = "TOKEN_REVOKED";

      expect(isTokenRevokedError(error)).toBe(true);
    });

    it("should detect revoked keyword in message", async () => {
      const { isTokenRevokedError } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const error = new Error("Token has been revoked");

      expect(isTokenRevokedError(error)).toBe(true);
    });

    it("should detect invalid keyword in message", async () => {
      const { isTokenRevokedError } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const error = new Error("Token is invalid");

      expect(isTokenRevokedError(error)).toBe(true);
    });

    it("should detect expired keyword in message", async () => {
      const { isTokenRevokedError } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const error = new Error("Token has expired");

      expect(isTokenRevokedError(error)).toBe(true);
    });

    it("should detect unauthorized keyword in message", async () => {
      const { isTokenRevokedError } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const error = new Error("Token unauthorized");

      expect(isTokenRevokedError(error)).toBe(true);
    });

    it("should return false for non-token errors", async () => {
      const { isTokenRevokedError } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const error = new Error("Network error");

      expect(isTokenRevokedError(error)).toBe(false);
    });

    it("should return false for non-Error objects", async () => {
      const { isTokenRevokedError } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      expect(isTokenRevokedError("string error")).toBe(false);
      expect(isTokenRevokedError(null)).toBe(false);
      expect(isTokenRevokedError(undefined)).toBe(false);
      expect(isTokenRevokedError({ message: "error" })).toBe(false);
    });
  });

  describe("exchangeCodeForToken", () => {
    it("should throw on invalid state signature", async () => {
      const { exchangeCodeForToken } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      // Invalid state with wrong signature
      const invalidState = "store_001_abc123_wrongsignature";

      await expect(
        exchangeCodeForToken("auth_code", invalidState)
      ).rejects.toThrow("Invalid OAuth state signature");
    });

    it("should throw on expired or missing state", async () => {
      const { exchangeCodeForToken, validateState } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      const crypto = await import("crypto");

      const storeCode = "store_001";
      const nonce = crypto.randomBytes(8).toString("hex");

      const data = `${storeCode}:${nonce}`;
      const signature = crypto
        .createHmac("sha256", process.env.STATE_SECRET!)
        .update(data)
        .digest("hex")
        .substring(0, 16);

      const validState = `${storeCode}_${nonce}_${signature}`;

      // Mock db to return empty (state not found)
      const { db } = await import("../../../src/db/client.js");
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(
        exchangeCodeForToken("auth_code", validState)
      ).rejects.toThrow("Invalid or expired OAuth state");
    });
  });

  describe("refreshToken", () => {
    it("should throw when TIKTOK_CLIENT_SECRET is not set", async () => {
      delete process.env.TIKTOK_CLIENT_SECRET;
      vi.resetModules();

      const { refreshToken } = await import(
        "../../../src/services/tiktokAuth.service.js"
      );

      await expect(refreshToken("refresh_token_123")).rejects.toThrow(
        "TIKTOK_CLIENT_SECRET is required"
      );
    });
  });
});
