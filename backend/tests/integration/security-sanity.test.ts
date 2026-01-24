import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer } from "./test-utils.js";

describe("Security Sanity", () => {
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

    const server = await startTestServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }
  });

  it("returns consistent error JSON without secrets", async () => {
    const response = await fetch(`${baseUrl}/admin/stores`);
    expect(response.status).toBe(401);

    const bodyText = await response.text();
    const data = JSON.parse(bodyText);

    expect(data.error?.code).toBe("UNAUTHORIZED");
    expect(data.error?.message).toBeDefined();

    expect(bodyText.toLowerCase()).not.toContain("access_token");
    expect(bodyText.toLowerCase()).not.toContain("refresh_token");
    expect(bodyText.toLowerCase()).not.toContain("token_enc_key");
  });
});
