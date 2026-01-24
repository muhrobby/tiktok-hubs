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

const getUserInfoMock = vi.fn();
const fetchAllVideosMock = vi.fn();

vi.mock("../../src/services/tiktokApi.service.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/services/tiktokApi.service.js")
  >("../../src/services/tiktokApi.service.js");

  return {
    ...actual,
    getUserInfo: (...args: any[]) => getUserInfoMock(...args),
    fetchAllVideos: (...args: any[]) => fetchAllVideosMock(...args),
  };
});

describe("Daily Sync Integration", () => {
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

  beforeEach(async () => {
    await resetDatabase();
    getUserInfoMock.mockReset();
    fetchAllVideosMock.mockReset();
  });

  it("upserts user_daily and video_daily on same date and logs sync", async () => {
    const { db } = await import("../../src/db/client.js");
    const schema = await import("../../src/db/schema.js");
    const { eq, and } = await import("drizzle-orm");
    const { encrypt } = await import("../../src/utils/crypto.js");

    const storeCode = `store_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    await db.insert(schema.stores).values({
      storeCode,
      storeName: "Test Store",
      picName: "Test PIC",
      createdAt: new Date(),
    });

    await db.insert(schema.storeAccounts).values({
      storeCode,
      openId: "open-123",
      accessTokenEnc: encrypt("access-token-123"),
      refreshTokenEnc: encrypt("refresh-token-123"),
      tokenExpiredAt: new Date(Date.now() + 3600 * 1000),
      refreshTokenExpiredAt: new Date(Date.now() + 7200 * 1000),
      status: "CONNECTED",
      connectedAt: new Date(),
      updatedAt: new Date(),
    });

    getUserInfoMock
      .mockResolvedValueOnce({
        openId: "open-123",
        displayName: "User A",
        avatarUrl: "https://example.com/avatar.png",
        followerCount: 10,
        followingCount: 1,
        likesCount: 5,
        videoCount: 2,
      })
      .mockResolvedValueOnce({
        openId: "open-123",
        displayName: "User A",
        avatarUrl: "https://example.com/avatar.png",
        followerCount: 12,
        followingCount: 2,
        likesCount: 7,
        videoCount: 3,
      });

    fetchAllVideosMock
      .mockResolvedValueOnce([
        {
          videoId: "vid-1",
          description: "Video 1",
          createTime: new Date(),
          viewCount: 100,
          likeCount: 10,
          commentCount: 2,
          shareCount: 1,
          coverImageUrl: "https://example.com/cover.png",
          shareUrl: "https://tiktok.com/v/vid-1",
        },
      ])
      .mockResolvedValueOnce([
        {
          videoId: "vid-1",
          description: "Video 1",
          createTime: new Date(),
          viewCount: 200,
          likeCount: 12,
          commentCount: 3,
          shareCount: 2,
          coverImageUrl: "https://example.com/cover.png",
          shareUrl: "https://tiktok.com/v/vid-1",
        },
      ]);

    const headers = {
      "Content-Type": "application/json",
      "X-API-KEY": "test-api-key",
    };

    const userSync1 = await fetch(`${baseUrl}/admin/sync/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ store_code: storeCode, job: "user" }),
    });
    expect(userSync1.status).toBe(200);

    const userSync2 = await fetch(`${baseUrl}/admin/sync/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ store_code: storeCode, job: "user" }),
    });
    expect(userSync2.status).toBe(200);

    const today = new Date().toISOString().split("T")[0];

    const userDaily = await db
      .select()
      .from(schema.tiktokUserDaily)
      .where(
        and(
          eq(schema.tiktokUserDaily.storeCode, storeCode),
          eq(schema.tiktokUserDaily.snapshotDate, today)
        )
      );

    expect(userDaily.length).toBe(1);
    expect(userDaily[0]?.followerCount).toBe(12);

    const videoSync1 = await fetch(`${baseUrl}/admin/sync/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ store_code: storeCode, job: "video" }),
    });
    expect(videoSync1.status).toBe(200);

    const videoSync2 = await fetch(`${baseUrl}/admin/sync/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ store_code: storeCode, job: "video" }),
    });
    expect(videoSync2.status).toBe(200);

    const videoDaily = await db
      .select()
      .from(schema.tiktokVideoDaily)
      .where(
        and(
          eq(schema.tiktokVideoDaily.storeCode, storeCode),
          eq(schema.tiktokVideoDaily.videoId, "vid-1"),
          eq(schema.tiktokVideoDaily.snapshotDate, today)
        )
      );

    expect(videoDaily.length).toBe(1);
    expect(videoDaily[0]?.viewCount).toBe(200);

    const logs = await db
      .select()
      .from(schema.syncLogs)
      .where(eq(schema.syncLogs.storeCode, storeCode));

    expect(logs.length).toBeGreaterThanOrEqual(2);
  });
});
