/**
 * Admin Routes Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";

// Mock rate limiters first before importing admin routes
vi.mock("../../../src/middleware/rateLimiter.js", () => ({
  adminRateLimiter: () => async (c: any, next: any) => await next(),
  authRateLimiter: () => async (c: any, next: any) => await next(),
  getClientIp: () => "127.0.0.1",
}));

// Mock audit log
vi.mock("../../../src/middleware/auditLog.js", () => ({
  auditLog: () => async (c: any, next: any) => await next(),
}));

// Mock the services
vi.mock("../../../src/services/sync.service.js", () => ({
  getStoresWithStatus: vi.fn(),
  storeExists: vi.fn(),
  createStore: vi.fn(),
  getAccountsByStore: vi.fn(),
  getUserStatsByStore: vi.fn(),
  getVideoStatsByStore: vi.fn(),
  getSyncLogs: vi.fn(),
  syncUserStatsWithLock: vi.fn(),
  syncVideoStatsWithLock: vi.fn(),
  runFullSync: vi.fn(),
}));

vi.mock("../../../src/jobs/refreshTokens.job.js", () => ({
  refreshTokensJob: vi.fn(),
}));

vi.mock("../../../src/jobs/syncUserDaily.job.js", () => ({
  syncUserDailyJob: vi.fn(),
}));

vi.mock("../../../src/jobs/syncVideoDaily.job.js", () => ({
  syncVideoDailyJob: vi.fn(),
}));

vi.mock("../../../src/jobs/scheduler.js", () => ({
  getSchedulerStatus: vi.fn(),
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
}));

describe("Admin Routes", () => {
  const VALID_API_KEY = "test-admin-api-key";
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv, ADMIN_API_KEY: VALID_API_KEY };
  });

  async function getAdminRoutes() {
    return (await import("../../../src/routes/admin.routes.js")).default;
  }

  describe("Authentication", () => {
    it("should return 401 when API key is missing", async () => {
      const adminRoutes = await getAdminRoutes();
      const app = new Hono().route("/admin", adminRoutes);

      const res = await app.request("/admin/stores");

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 when API key is invalid", async () => {
      const adminRoutes = await getAdminRoutes();
      const app = new Hono().route("/admin", adminRoutes);

      const res = await app.request("/admin/stores", {
        headers: { "X-API-KEY": "wrong-key" },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 500 when ADMIN_API_KEY is not configured", async () => {
      delete process.env.ADMIN_API_KEY;
      vi.resetModules();

      const adminRoutes = await getAdminRoutes();
      const app = new Hono().route("/admin", adminRoutes);

      const res = await app.request("/admin/stores", {
        headers: { "X-API-KEY": "any-key" },
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe("SERVER_MISCONFIG");
    });
  });

  describe("GET /admin/stores", () => {
    describe("Happy Flow", () => {
      it("should return list of stores", async () => {
        const { getStoresWithStatus } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getStoresWithStatus).mockResolvedValue([
          {
            storeCode: "store_001",
            storeName: "Store 1",
            status: "CONNECTED",
            picName: "John Doe",
            picContact: "john@example.com",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            storeCode: "store_002",
            storeName: "Store 2",
            status: "DISCONNECTED",
            picName: "Jane Doe",
            picContact: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(2);
        expect(body.count).toBe(2);
      });

      it("should return empty array when no stores", async () => {
        const { getStoresWithStatus } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getStoresWithStatus).mockResolvedValue([]);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(0);
        expect(body.count).toBe(0);
      });
    });

    describe("Error Flow", () => {
      it("should return 500 when service throws", async () => {
        const { getStoresWithStatus } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getStoresWithStatus).mockRejectedValue(
          new Error("Database error")
        );

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error.code).toBe("INTERNAL_ERROR");
      });
    });
  });

  describe("POST /admin/stores", () => {
    describe("Happy Flow", () => {
      it("should create a new store", async () => {
        const { storeExists, createStore } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(false);
        vi.mocked(createStore).mockResolvedValue({
          storeCode: "new_store",
          storeName: "New Store",
          picName: "John Doe",
          picContact: "john@example.com",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores", {
          method: "POST",
          headers: {
            "X-API-KEY": VALID_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            store_code: "new_store",
            store_name: "New Store",
            pic_name: "John Doe",
            pic_contact: "john@example.com",
          }),
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.message).toContain("created successfully");
      });
    });

    describe("Error Flow", () => {
      it("should return 400 when body is missing", async () => {
        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores", {
          method: "POST",
          headers: {
            "X-API-KEY": VALID_API_KEY,
            "Content-Type": "application/json",
          },
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_REQUEST");
      });

      it("should return 400 when store_code is invalid", async () => {
        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores", {
          method: "POST",
          headers: {
            "X-API-KEY": VALID_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            store_code: "invalid!@#code",
            store_name: "Store",
            pic_name: "John",
          }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_REQUEST");
      });

      it("should return 400 when store_name is missing", async () => {
        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores", {
          method: "POST",
          headers: {
            "X-API-KEY": VALID_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            store_code: "valid_code",
            pic_name: "John",
          }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_REQUEST");
      });

      it("should return 400 when pic_name is missing", async () => {
        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores", {
          method: "POST",
          headers: {
            "X-API-KEY": VALID_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            store_code: "valid_code",
            store_name: "Store Name",
          }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_REQUEST");
      });

      it("should return 409 when store already exists", async () => {
        const { storeExists } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(true);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores", {
          method: "POST",
          headers: {
            "X-API-KEY": VALID_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            store_code: "existing_store",
            store_name: "Store",
            pic_name: "John",
          }),
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("STORE_EXISTS");
      });
    });
  });

  describe("GET /admin/stores/:store_code", () => {
    describe("Happy Flow", () => {
      it("should return store details", async () => {
        const { getStoresWithStatus } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getStoresWithStatus).mockResolvedValue([
          {
            storeCode: "store_001",
            storeName: "Store 1",
            status: "CONNECTED",
            picName: "John Doe",
            picContact: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores/store_001", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.storeCode).toBe("store_001");
      });
    });

    describe("Error Flow", () => {
      it("should return 404 when store not found", async () => {
        const { getStoresWithStatus } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getStoresWithStatus).mockResolvedValue([]);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores/nonexistent", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("STORE_NOT_FOUND");
      });
    });
  });

  describe("GET /admin/stores/:store_code/accounts", () => {
    describe("Happy Flow", () => {
      it("should return store accounts", async () => {
        const { storeExists, getAccountsByStore } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(true);
        vi.mocked(getAccountsByStore).mockResolvedValue([
          {
            id: 1,
            storeCode: "store_001",
            openId: "open_id_123",
            status: "CONNECTED",
            lastSyncTime: new Date(),
            connectedAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores/store_001/accounts", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(1);
      });
    });

    describe("Error Flow", () => {
      it("should return 404 when store not found", async () => {
        const { storeExists } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(false);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores/nonexistent/accounts", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("STORE_NOT_FOUND");
      });
    });
  });

  describe("POST /admin/sync/run", () => {
    describe("Happy Flow", () => {
      it("should trigger sync for all stores", async () => {
        const { refreshTokensJob } = await import(
          "../../../src/jobs/refreshTokens.job.js"
        );
        const { syncUserDailyJob } = await import(
          "../../../src/jobs/syncUserDaily.job.js"
        );
        const { syncVideoDailyJob } = await import(
          "../../../src/jobs/syncVideoDaily.job.js"
        );

        vi.mocked(refreshTokensJob).mockResolvedValue({ refreshed: 2 });
        vi.mocked(syncUserDailyJob).mockResolvedValue({ synced: 2 });
        vi.mocked(syncVideoDailyJob).mockResolvedValue({ synced: 2 });

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/sync/run", {
          method: "POST",
          headers: {
            "X-API-KEY": VALID_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ job: "all" }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
      });

      it("should trigger sync for specific store", async () => {
        const { storeExists, runFullSync } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(true);
        vi.mocked(runFullSync).mockResolvedValue({
          success: true,
          message: "Sync completed",
        });

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/sync/run", {
          method: "POST",
          headers: {
            "X-API-KEY": VALID_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            store_code: "store_001",
            job: "all",
          }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(runFullSync).toHaveBeenCalledWith("store_001");
      });
    });

    describe("Error Flow", () => {
      it("should return 404 when store not found", async () => {
        const { storeExists } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(false);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/sync/run", {
          method: "POST",
          headers: {
            "X-API-KEY": VALID_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            store_code: "nonexistent",
          }),
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("STORE_NOT_FOUND");
      });
    });
  });

  describe("GET /admin/sync/status", () => {
    describe("Happy Flow", () => {
      it("should return scheduler status", async () => {
        const { getSchedulerStatus } = await import(
          "../../../src/jobs/scheduler.js"
        );

        vi.mocked(getSchedulerStatus).mockReturnValue({
          isRunning: true,
          jobs: [
            { name: "refreshTokens", nextRun: new Date().toISOString() },
            { name: "syncUserDaily", nextRun: new Date().toISOString() },
          ],
        });

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/sync/status", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.isRunning).toBe(true);
      });
    });
  });

  describe("GET /admin/sync/logs", () => {
    describe("Happy Flow", () => {
      it("should return sync logs", async () => {
        const { getSyncLogs } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getSyncLogs).mockResolvedValue([
          {
            id: 1,
            storeCode: "store_001",
            jobType: "user_sync",
            status: "success",
            startedAt: new Date(),
            completedAt: new Date(),
            message: null,
          },
        ]);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/sync/logs", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(1);
      });

      it("should respect limit parameter", async () => {
        const { getSyncLogs } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getSyncLogs).mockResolvedValue([]);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        await app.request("/admin/sync/logs?limit=10", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(getSyncLogs).toHaveBeenCalledWith(undefined, 10);
      });

      it("should filter by store_code", async () => {
        const { getSyncLogs } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(getSyncLogs).mockResolvedValue([]);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        await app.request("/admin/sync/logs?store_code=store_001", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(getSyncLogs).toHaveBeenCalledWith("store_001", 50);
      });
    });
  });

  describe("GET /admin/stores/:store_code/user-stats", () => {
    describe("Happy Flow", () => {
      it("should return user stats", async () => {
        const { storeExists, getUserStatsByStore } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(true);
        vi.mocked(getUserStatsByStore).mockResolvedValue([
          {
            id: 1,
            storeCode: "store_001",
            snapshotDate: new Date(),
            followerCount: 1000,
            followingCount: 100,
            likesCount: 5000,
          },
        ]);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores/store_001/user-stats", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(1);
      });
    });

    describe("Error Flow", () => {
      it("should return 404 when store not found", async () => {
        const { storeExists } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(false);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores/nonexistent/user-stats", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("STORE_NOT_FOUND");
      });
    });
  });

  describe("GET /admin/stores/:store_code/video-stats", () => {
    describe("Happy Flow", () => {
      it("should return video stats", async () => {
        const { storeExists, getVideoStatsByStore } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(true);
        vi.mocked(getVideoStatsByStore).mockResolvedValue([
          {
            id: 1,
            storeCode: "store_001",
            videoId: "video_123",
            snapshotDate: new Date(),
            viewCount: 1000,
            likeCount: 100,
            commentCount: 50,
            shareCount: 25,
          },
        ]);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores/store_001/video-stats", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(1);
      });
    });

    describe("Error Flow", () => {
      it("should return 404 when store not found", async () => {
        const { storeExists } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(false);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores/nonexistent/video-stats", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("STORE_NOT_FOUND");
      });
    });
  });

  describe("GET /admin/stores/:store_code/sync-logs", () => {
    describe("Happy Flow", () => {
      it("should return sync logs for store", async () => {
        const { storeExists, getSyncLogs } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(true);
        vi.mocked(getSyncLogs).mockResolvedValue([
          {
            id: 1,
            storeCode: "store_001",
            jobType: "user_sync",
            status: "success",
            startedAt: new Date(),
            completedAt: new Date(),
            message: null,
          },
        ]);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores/store_001/sync-logs", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toHaveLength(1);
      });
    });

    describe("Error Flow", () => {
      it("should return 404 when store not found", async () => {
        const { storeExists } = await import(
          "../../../src/services/sync.service.js"
        );

        vi.mocked(storeExists).mockResolvedValue(false);

        const adminRoutes = await getAdminRoutes();
        const app = new Hono().route("/admin", adminRoutes);

        const res = await app.request("/admin/stores/nonexistent/sync-logs", {
          headers: { "X-API-KEY": VALID_API_KEY },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("STORE_NOT_FOUND");
      });
    });
  });
});
