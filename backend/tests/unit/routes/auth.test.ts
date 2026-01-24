/**
 * Auth Routes Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";

// Mock the services
vi.mock("../../../src/services/tiktokAuth.service.js", () => ({
  buildAuthUrl: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  validateState: vi.fn(),
}));

vi.mock("../../../src/services/token.service.js", () => ({
  storeTokens: vi.fn(),
}));

vi.mock("../../../src/services/sync.service.js", () => ({
  getStore: vi.fn(),
}));

vi.mock("../../../src/db/client.js", () => ({
  db: {
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

vi.mock("../../../src/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
  storeLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe("Auth Routes", () => {
  let authRoutes: typeof import("../../../src/routes/auth.routes.js").default;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    
    // Re-import to get fresh mocks
    authRoutes = (await import("../../../src/routes/auth.routes.js")).default;
  });

  describe("GET /connect/tiktok", () => {
    describe("Happy Flow", () => {
      it("should redirect to TikTok OAuth URL", async () => {
        const { buildAuthUrl } = await import(
          "../../../src/services/tiktokAuth.service.js"
        );
        const { getStore } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getStore).mockResolvedValue({
          storeCode: "store_001",
          storeName: "Test Store",
          picName: "John Doe",
          picContact: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        vi.mocked(buildAuthUrl).mockResolvedValue(
          "https://www.tiktok.com/v2/auth/authorize/?client_key=xxx&state=store_001_abc"
        );

        const app = new Hono().route("/", authRoutes);

        const res = await app.request("/connect/tiktok?store_code=store_001");

        expect(res.status).toBe(302);
        expect(res.headers.get("Location")).toContain("tiktok.com");
        expect(getStore).toHaveBeenCalledWith("store_001");
        expect(buildAuthUrl).toHaveBeenCalledWith("store_001");
      });
    });

    describe("Error Flow", () => {
      it("should return 400 when store_code is missing", async () => {
        const app = new Hono().route("/", authRoutes);

        const res = await app.request("/connect/tiktok");

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_STORE_CODE");
      });

      it("should return 400 when store_code is empty", async () => {
        const app = new Hono().route("/", authRoutes);

        const res = await app.request("/connect/tiktok?store_code=");

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_STORE_CODE");
      });

      it("should return 400 when store_code contains invalid characters", async () => {
        const app = new Hono().route("/", authRoutes);

        const res = await app.request(
          "/connect/tiktok?store_code=invalid!code@"
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_STORE_CODE");
      });

      it("should return 400 when store_code is too long", async () => {
        const app = new Hono().route("/", authRoutes);

        const longCode = "a".repeat(51);
        const res = await app.request(`/connect/tiktok?store_code=${longCode}`);

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_STORE_CODE");
      });

      it("should return 404 when store does not exist", async () => {
        const { getStore } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getStore).mockResolvedValue(null);

        const app = new Hono().route("/", authRoutes);

        const res = await app.request(
          "/connect/tiktok?store_code=nonexistent_store"
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("STORE_NOT_FOUND");
      });
    });
  });

  describe("GET /auth/tiktok/callback", () => {
    describe("Happy Flow", () => {
      it("should exchange code for tokens and return success HTML", async () => {
        const { exchangeCodeForToken } = await import(
          "../../../src/services/tiktokAuth.service.js"
        );
        const { storeTokens } = await import(
          "../../../src/services/token.service.js"
        );
        const { getStore } = await import(
          "../../../src/services/sync.service.js"
        );
        const { db } = await import("../../../src/db/client.js");

        // Mock oauth state lookup
        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  state: "store_001_abc123_signature",
                  codeVerifier: "code_verifier_123",
                  storeCode: "store_001",
                  expiresAt: new Date(Date.now() + 600000),
                },
              ]),
            }),
          }),
        } as any);

        vi.mocked(getStore).mockResolvedValue({
          storeCode: "store_001",
          storeName: "Test Store",
          picName: "John Doe",
          picContact: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        vi.mocked(exchangeCodeForToken).mockResolvedValue({
          accessToken: "access_token_123",
          refreshToken: "refresh_token_123",
          openId: "open_id_123",
          expiresAt: new Date(Date.now() + 86400000),
          refreshExpiresAt: new Date(Date.now() + 604800000),
          scope: "user.info.basic,user.info.stats,video.list",
        });

        vi.mocked(storeTokens).mockResolvedValue(undefined);

        const app = new Hono().route("/", authRoutes);

        const res = await app.request(
          "/auth/tiktok/callback?code=auth_code_123&state=store_001_abc123_signature"
        );

        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain("Connected Successfully");
        expect(html).toContain("store_001");
        expect(storeTokens).toHaveBeenCalledWith(
          "store_001",
          expect.objectContaining({
            accessToken: "access_token_123",
            openId: "open_id_123",
          })
        );
      });
    });

    describe("Error Flow", () => {
      it("should return 400 when OAuth error is present", async () => {
        const app = new Hono().route("/", authRoutes);

        const res = await app.request(
          "/auth/tiktok/callback?error=access_denied&error_description=User%20denied%20access"
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("OAUTH_ERROR");
        expect(body.error.message).toBe("User denied access");
      });

      it("should return 400 when code is missing", async () => {
        const app = new Hono().route("/", authRoutes);

        const res = await app.request(
          "/auth/tiktok/callback?state=store_001_abc"
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("OAUTH_MISSING_PARAMS");
      });

      it("should return 400 when state is missing", async () => {
        const app = new Hono().route("/", authRoutes);

        const res = await app.request(
          "/auth/tiktok/callback?code=auth_code_123"
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("OAUTH_MISSING_PARAMS");
      });

      it("should return 400 when state is not found in database", async () => {
        const { db } = await import("../../../src/db/client.js");

        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any);

        const app = new Hono().route("/", authRoutes);

        const res = await app.request(
          "/auth/tiktok/callback?code=auth_code&state=invalid_state"
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("OAUTH_STATE_INVALID");
      });

      it("should return 404 when store not found during callback", async () => {
        const { getStore } = await import(
          "../../../src/services/sync.service.js"
        );
        const { db } = await import("../../../src/db/client.js");

        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  state: "store_001_abc123",
                  codeVerifier: "verifier",
                  storeCode: "store_001",
                  expiresAt: new Date(Date.now() + 600000),
                },
              ]),
            }),
          }),
        } as any);

        vi.mocked(getStore).mockResolvedValue(null);

        const app = new Hono().route("/", authRoutes);

        const res = await app.request(
          "/auth/tiktok/callback?code=auth_code&state=store_001_abc123"
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("STORE_NOT_FOUND");
      });

      it("should return 500 when token exchange fails", async () => {
        const { exchangeCodeForToken } = await import(
          "../../../src/services/tiktokAuth.service.js"
        );
        const { getStore } = await import(
          "../../../src/services/sync.service.js"
        );
        const { db } = await import("../../../src/db/client.js");

        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  state: "store_001_abc123",
                  codeVerifier: "verifier",
                  storeCode: "store_001",
                  expiresAt: new Date(Date.now() + 600000),
                },
              ]),
            }),
          }),
        } as any);

        vi.mocked(getStore).mockResolvedValue({
          storeCode: "store_001",
          storeName: "Test Store",
          picName: "John Doe",
          picContact: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        vi.mocked(exchangeCodeForToken).mockRejectedValue(
          new Error("TikTok API error")
        );

        const app = new Hono().route("/", authRoutes);

        const res = await app.request(
          "/auth/tiktok/callback?code=auth_code&state=store_001_abc123"
        );

        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error.code).toBe("OAUTH_CALLBACK_FAILED");
      });
    });
  });

  describe("GET /auth/url", () => {
    describe("Happy Flow", () => {
      it("should return OAuth URL as JSON", async () => {
        const { buildAuthUrl } = await import(
          "../../../src/services/tiktokAuth.service.js"
        );
        const { getStore } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getStore).mockResolvedValue({
          storeCode: "store_001",
          storeName: "Test Store",
          picName: "John Doe",
          picContact: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        vi.mocked(buildAuthUrl).mockResolvedValue(
          "https://www.tiktok.com/v2/auth/authorize/?client_key=xxx&state=store_001_abc"
        );

        const app = new Hono().route("/", authRoutes);

        const res = await app.request("/auth/url?store_code=store_001");

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.authUrl).toContain("tiktok.com");
      });
    });

    describe("Error Flow", () => {
      it("should return 400 when store_code is missing", async () => {
        const app = new Hono().route("/", authRoutes);

        const res = await app.request("/auth/url");

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_STORE_CODE");
      });

      it("should return 400 when store_code is invalid", async () => {
        const app = new Hono().route("/", authRoutes);

        const res = await app.request("/auth/url?store_code=invalid!@#");

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_STORE_CODE");
      });

      it("should return 404 when store does not exist", async () => {
        const { getStore } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getStore).mockResolvedValue(null);

        const app = new Hono().route("/", authRoutes);

        const res = await app.request("/auth/url?store_code=nonexistent_store");

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("STORE_NOT_FOUND");
      });
    });
  });
});
