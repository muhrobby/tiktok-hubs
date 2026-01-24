import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { startTestServer, resetDatabase } from "./test-utils.js";

vi.mock("../../src/services/tiktokAuth.service.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/services/tiktokAuth.service.js")
  >("../../src/services/tiktokAuth.service.js");

  return {
    ...actual,
    exchangeCodeForToken: vi.fn().mockResolvedValue({
      accessToken: "access-token-123",
      refreshToken: "refresh-token-123",
      openId: "open-123",
      expiresAt: new Date(Date.now() + 3600 * 1000),
      refreshExpiresAt: new Date(Date.now() + 7200 * 1000),
      scope: "user.info.stats",
    }),
  };
});

describe("OAuth Callback Integration", () => {
  let baseUrl = "";
  let closeServer: () => Promise<void>;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.CRON_ENABLED = "false";
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/tiktok_hubs";
    process.env.TOKEN_ENC_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.ADMIN_API_KEY = "test-api-key";
    process.env.TIKTOK_CLIENT_KEY = "test-client-key";
    process.env.TIKTOK_CLIENT_SECRET = "test-client-secret";
    process.env.TIKTOK_REDIRECT_URI =
      "http://localhost:3000/auth/tiktok/callback";

    const server = await startTestServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("stores encrypted tokens and marks account CONNECTED", async () => {
    const { db } = await import("../../src/db/client.js");
    const schema = await import("../../src/db/schema.js");
    const { eq } = await import("drizzle-orm");
    const { decrypt } = await import("../../src/utils/crypto.js");

    const storeCode = `store_${Date.now()}`;
    const state = `state_${Date.now()}`;

    await db.insert(schema.stores).values({
      storeCode,
      storeName: "Test Store",
      picName: "Test PIC",
      createdAt: new Date(),
    });

    await db.insert(schema.oauthState).values({
      state,
      codeVerifier: "test-code-verifier",
      storeCode,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const response = await fetch(
      `${baseUrl}/auth/tiktok/callback?code=abc123&state=${state}`
    );

    expect(response.status).toBe(200);

    const [account] = await db
      .select()
      .from(schema.storeAccounts)
      .where(eq(schema.storeAccounts.storeCode, storeCode));

    expect(account).toBeDefined();
    expect(account.status).toBe("CONNECTED");
    expect(account.accessTokenEnc).not.toBe("access-token-123");
    expect(account.refreshTokenEnc).not.toBe("refresh-token-123");

    const decryptedAccess = decrypt(account.accessTokenEnc);
    const decryptedRefresh = decrypt(account.refreshTokenEnc);

    expect(decryptedAccess).toBe("access-token-123");
    expect(decryptedRefresh).toBe("refresh-token-123");
  });
});
