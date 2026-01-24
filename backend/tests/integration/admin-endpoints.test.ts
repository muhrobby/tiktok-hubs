/**
 * Integration Test - Admin Endpoints
 *
 * Tests untuk memastikan semua admin endpoints bekerja dengan benar
 * dan konsisten antara frontend dan backend
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestServer, resetDatabase } from "./test-utils.js";

let API_URL = "";
const API_KEY = "test-api-key";

const headers = {
  "Content-Type": "application/json",
  "X-API-KEY": API_KEY,
};

describe("Admin Endpoints Integration Tests", () => {
  let testStoreCode: string;

  const createStore = async (storeCode: string) => {
    await fetch(`${API_URL}/admin/stores`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        store_code: storeCode,
        store_name: "Test Store",
        pic_name: "Test PIC",
        pic_contact: "test@example.com",
      }),
    });
  };

  let closeServer: () => Promise<void>;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.CRON_ENABLED = "false";
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/tiktok_hubs";
    process.env.TOKEN_ENC_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.ADMIN_API_KEY = API_KEY;

    const server = await startTestServer();
    API_URL = server.baseUrl;
    closeServer = server.close;

    testStoreCode = `test_store_${Date.now()}`;
  });

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe("Store Management", () => {
    it("should list all stores - GET /admin/stores", async () => {
      const response = await fetch(`${API_URL}/admin/stores`, {
        method: "GET",
        headers,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should create a new store - POST /admin/stores", async () => {
      const response = await fetch(`${API_URL}/admin/stores`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          store_code: testStoreCode,
          store_name: "Test Store",
          pic_name: "Test PIC",
          pic_contact: "test@example.com",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.storeCode).toBe(testStoreCode);
    });

    it("should get single store details - GET /admin/stores/:store_code", async () => {
      await createStore(testStoreCode);
      const response = await fetch(`${API_URL}/admin/stores/${testStoreCode}`, {
        method: "GET",
        headers,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.storeCode).toBe(testStoreCode);
    });

    it("should return 404 for non-existent store", async () => {
      const response = await fetch(
        `${API_URL}/admin/stores/non_existent_store`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error?.code).toBe("STORE_NOT_FOUND");
    });
  });

  describe("Store Accounts", () => {
    it("should get store accounts - GET /admin/stores/:store_code/accounts", async () => {
      await createStore(testStoreCode);
      const response = await fetch(
        `${API_URL}/admin/stores/${testStoreCode}/accounts`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.count).toBeDefined();
    });

    it("should return 404 for non-existent store accounts", async () => {
      const response = await fetch(
        `${API_URL}/admin/stores/non_existent_store/accounts`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe("User Stats", () => {
    it("should get user stats - GET /admin/stores/:store_code/user-stats", async () => {
      await createStore(testStoreCode);
      const response = await fetch(
        `${API_URL}/admin/stores/${testStoreCode}/user-stats`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.count).toBeDefined();
    });

    it("should get user stats with days parameter", async () => {
      await createStore(testStoreCode);
      const response = await fetch(
        `${API_URL}/admin/stores/${testStoreCode}/user-stats?days=7`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should return 404 for non-existent store user stats", async () => {
      const response = await fetch(
        `${API_URL}/admin/stores/non_existent_store/user-stats`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe("Video Stats", () => {
    it("should get video stats - GET /admin/stores/:store_code/video-stats", async () => {
      await createStore(testStoreCode);
      const response = await fetch(
        `${API_URL}/admin/stores/${testStoreCode}/video-stats`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.count).toBeDefined();
    });

    it("should get video stats with days parameter", async () => {
      await createStore(testStoreCode);
      const response = await fetch(
        `${API_URL}/admin/stores/${testStoreCode}/video-stats?days=14`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should return 404 for non-existent store video stats", async () => {
      const response = await fetch(
        `${API_URL}/admin/stores/non_existent_store/video-stats`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe("Sync Logs", () => {
    it("should get sync logs - GET /admin/stores/:store_code/sync-logs", async () => {
      await createStore(testStoreCode);
      const response = await fetch(
        `${API_URL}/admin/stores/${testStoreCode}/sync-logs`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.count).toBeDefined();
    });

    it("should get sync logs with limit parameter", async () => {
      await createStore(testStoreCode);
      const response = await fetch(
        `${API_URL}/admin/stores/${testStoreCode}/sync-logs?limit=10`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(10);
    });

    it("should return 404 for non-existent store sync logs", async () => {
      const response = await fetch(
        `${API_URL}/admin/stores/non_existent_store/sync-logs`,
        {
          method: "GET",
          headers,
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe("Sync Operations", () => {
    it("should trigger manual sync - POST /admin/sync/run", async () => {
      await createStore(testStoreCode);
      const response = await fetch(`${API_URL}/admin/sync/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          store_code: testStoreCode,
          job: "all",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBeDefined();
    });

    it("should get sync status - GET /admin/sync/status", async () => {
      const response = await fetch(`${API_URL}/admin/sync/status`, {
        method: "GET",
        headers,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it("should get all sync logs - GET /admin/sync/logs", async () => {
      const response = await fetch(`${API_URL}/admin/sync/logs`, {
        method: "GET",
        headers,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should return 401 for missing API key", async () => {
      const response = await fetch(`${API_URL}/admin/stores`, {
        method: "GET",
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error?.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for invalid API key", async () => {
      const response = await fetch(`${API_URL}/admin/stores`, {
        method: "GET",
        headers: {
          "X-API-KEY": "invalid-key",
        },
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error?.code).toBe("UNAUTHORIZED");
    });

    it("should return 400 for invalid store creation data", async () => {
      const response = await fetch(`${API_URL}/admin/stores`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          store_code: "",
          store_name: "",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error?.code).toBe("INVALID_REQUEST");
    });
  });
});
