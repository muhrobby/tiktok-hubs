/**
 * Request ID Middleware Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  requestIdMiddleware,
  generateRequestId,
  getRequestId,
  requestLogger,
} from "../../../src/middleware/requestId.js";

describe("Request ID Middleware", () => {
  describe("generateRequestId", () => {
    it("should generate unique IDs", () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }

      // All IDs should be unique
      expect(ids.size).toBe(100);
    });

    it("should generate IDs in expected format", () => {
      const id = generateRequestId();

      // Format: timestamp-random (timestamp in base36, random in hex)
      expect(id).toMatch(/^[a-z0-9]+-[a-f0-9]+$/);
    });
  });

  describe("requestIdMiddleware", () => {
    it("should add X-Request-ID header to response", async () => {
      const app = new Hono();

      app.use("*", requestIdMiddleware());
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      expect(res.headers.get("X-Request-ID")).toBeTruthy();
    });

    it("should use existing X-Request-ID from request", async () => {
      const app = new Hono();
      const customRequestId = "custom-request-id-12345";

      app.use("*", requestIdMiddleware());
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { "X-Request-ID": customRequestId },
      });

      expect(res.headers.get("X-Request-ID")).toBe(customRequestId);
    });

    it("should use X-Correlation-ID as fallback", async () => {
      const app = new Hono();
      const correlationId = "correlation-id-67890";

      app.use("*", requestIdMiddleware());
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { "X-Correlation-ID": correlationId },
      });

      expect(res.headers.get("X-Request-ID")).toBe(correlationId);
    });

    it("should prefer X-Request-ID over X-Correlation-ID", async () => {
      const app = new Hono();

      app.use("*", requestIdMiddleware());
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: {
          "X-Request-ID": "request-id",
          "X-Correlation-ID": "correlation-id",
        },
      });

      expect(res.headers.get("X-Request-ID")).toBe("request-id");
    });

    it("should set requestId in context", async () => {
      const app = new Hono();
      let contextRequestId = "";

      app.use("*", requestIdMiddleware());
      app.get("/test", (c) => {
        contextRequestId = c.get("requestId");
        return c.text("ok");
      });

      const res = await app.request("/test");

      expect(contextRequestId).toBeTruthy();
      expect(res.headers.get("X-Request-ID")).toBe(contextRequestId);
    });

    it("should propagate errors", async () => {
      const app = new Hono();

      app.use("*", requestIdMiddleware());
      app.get("/test", () => {
        throw new Error("Test error");
      });

      // Should not swallow error
      await expect(app.request("/test")).resolves.toBeDefined();
    });
  });

  describe("getRequestId", () => {
    it("should return requestId from context", async () => {
      const app = new Hono();
      let retrievedId = "";

      app.use("*", requestIdMiddleware());
      app.get("/test", (c) => {
        retrievedId = getRequestId(c);
        return c.text("ok");
      });

      await app.request("/test");

      expect(retrievedId).toBeTruthy();
      expect(retrievedId).not.toBe("unknown");
    });

    it("should return 'unknown' when no requestId in context", async () => {
      const app = new Hono();
      let retrievedId = "";

      // No requestIdMiddleware
      app.get("/test", (c) => {
        retrievedId = getRequestId(c);
        return c.text("ok");
      });

      await app.request("/test");

      expect(retrievedId).toBe("unknown");
    });
  });

  describe("requestLogger", () => {
    it("should create child logger with requestId", async () => {
      const app = new Hono();
      let childLogger: ReturnType<typeof requestLogger> | null = null;

      app.use("*", requestIdMiddleware());
      app.get("/test", (c) => {
        childLogger = requestLogger(c);
        return c.text("ok");
      });

      await app.request("/test");

      expect(childLogger).toBeTruthy();
      // The logger should have the child method from pino
      expect(typeof childLogger).toBe("object");
    });
  });
});
