/**
 * Audit Log Middleware Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import {
  auditLogMiddleware,
  addAuditLog,
  getAuditBuffer,
  clearAuditBuffer,
  SecurityLogger,
  type AuditLogEntry,
} from "../../../src/middleware/auditLog.js";
import { requestIdMiddleware } from "../../../src/middleware/requestId.js";

// Import the actual logger to spy on it
import * as loggerModule from "../../../src/utils/logger.js";

describe("Audit Log Middleware", () => {
  beforeEach(() => {
    clearAuditBuffer();
    vi.clearAllMocks();
  });

  describe("auditLogMiddleware", () => {
    it("should log admin route requests", async () => {
      const app = new Hono();

      app.use("*", requestIdMiddleware());
      app.use("*", auditLogMiddleware());
      app.get("/admin/stores", (c) => c.json({ data: [] }));

      await app.request("/admin/stores", {
        headers: {
          "X-API-KEY": "test-api-key",
          "X-Forwarded-For": "192.168.1.100",
        },
      });

      const buffer = getAuditBuffer();
      expect(buffer.length).toBe(1);

      const entry = buffer[0];
      expect(entry.resource).toBe("stores");
      expect(entry.action).toBe("READ");
      expect(entry.method).toBe("GET");
      expect(entry.success).toBe(true);
      expect(entry.ipAddress).toBe("192.168.1.100");
    });

    it("should not log non-admin routes", async () => {
      const app = new Hono();

      app.use("*", requestIdMiddleware());
      app.use("*", auditLogMiddleware());
      app.get("/api/health", (c) => c.json({ status: "ok" }));

      await app.request("/api/health");

      const buffer = getAuditBuffer();
      expect(buffer.length).toBe(0);
    });

    it("should extract resource ID from path", async () => {
      const app = new Hono();

      app.use("*", requestIdMiddleware());
      app.use("*", auditLogMiddleware());
      app.get("/admin/stores/:id", (c) => c.json({ data: {} }));

      await app.request("/admin/stores/store_001");

      const buffer = getAuditBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].resourceId).toBe("store_001");
    });

    it("should map HTTP methods to actions correctly", async () => {
      const app = new Hono();

      app.use("*", requestIdMiddleware());
      app.use("*", auditLogMiddleware());
      app.post("/admin/stores", (c) => c.json({ data: {} }, 201));
      app.put("/admin/stores/:id", (c) => c.json({ data: {} }));
      app.delete("/admin/stores/:id", (c) => c.json({ success: true }));

      // POST -> CREATE
      await app.request("/admin/stores", { method: "POST" });
      expect(getAuditBuffer()[0].action).toBe("CREATE");

      clearAuditBuffer();

      // PUT -> UPDATE
      await app.request("/admin/stores/1", { method: "PUT" });
      expect(getAuditBuffer()[0].action).toBe("UPDATE");

      clearAuditBuffer();

      // DELETE -> DELETE
      await app.request("/admin/stores/1", { method: "DELETE" });
      expect(getAuditBuffer()[0].action).toBe("DELETE");
    });

    it("should track failed requests", async () => {
      const app = new Hono();

      app.use("*", requestIdMiddleware());
      app.use("*", auditLogMiddleware());
      app.get("/admin/stores/:id", (c) => c.json({ error: "not found" }, 404));

      await app.request("/admin/stores/nonexistent");

      const buffer = getAuditBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].success).toBe(false);
    });

    it("should hash API key in logs", async () => {
      const app = new Hono();

      app.use("*", requestIdMiddleware());
      app.use("*", auditLogMiddleware());
      app.get("/admin/stores", (c) => c.json({ data: [] }));

      await app.request("/admin/stores", {
        headers: { "X-API-KEY": "my-secret-api-key" },
      });

      const buffer = getAuditBuffer();
      expect(buffer[0].actor).not.toBe("my-secret-api-key");
      expect(buffer[0].actor).not.toContain("my-secret");
      // Should be a hash (16 chars)
      expect(buffer[0].actor.length).toBe(16);
    });

    it("should use 'anonymous' when no API key", async () => {
      const app = new Hono();

      app.use("*", requestIdMiddleware());
      app.use("*", auditLogMiddleware());
      app.get("/admin/stores", (c) => c.json({ data: [] }));

      await app.request("/admin/stores");

      const buffer = getAuditBuffer();
      expect(buffer[0].actor).toBe("anonymous");
    });

    it("should include duration in log entry", async () => {
      const app = new Hono();

      app.use("*", requestIdMiddleware());
      app.use("*", auditLogMiddleware());
      app.get("/admin/stores", async (c) => {
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 10));
        return c.json({ data: [] });
      });

      await app.request("/admin/stores");

      const buffer = getAuditBuffer();
      expect(buffer[0].duration).toBeGreaterThanOrEqual(10);
    });
  });

  describe("addAuditLog", () => {
    it("should add entries to buffer", () => {
      const entry: AuditLogEntry = {
        timestamp: new Date(),
        requestId: "test-123",
        actor: "test-actor",
        action: "READ",
        resource: "stores",
        resourceId: null,
        ipAddress: "192.168.1.1",
        userAgent: "test",
        method: "GET",
        path: "/admin/stores",
        success: true,
        errorCode: null,
        duration: 100,
        details: null,
      };

      addAuditLog(entry);

      const buffer = getAuditBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0]).toEqual(entry);
    });
  });

  describe("clearAuditBuffer", () => {
    it("should clear all entries from buffer", () => {
      const entry: AuditLogEntry = {
        timestamp: new Date(),
        requestId: "test-123",
        actor: "test-actor",
        action: "READ",
        resource: "stores",
        resourceId: null,
        ipAddress: "192.168.1.1",
        userAgent: "test",
        method: "GET",
        path: "/admin/stores",
        success: true,
        errorCode: null,
        duration: 100,
        details: null,
      };

      addAuditLog(entry);
      addAuditLog(entry);

      expect(getAuditBuffer().length).toBe(2);

      clearAuditBuffer();

      expect(getAuditBuffer().length).toBe(0);
    });
  });

  describe("SecurityLogger", () => {
    it("should log auth success events", () => {
      const infoSpy = vi.spyOn(loggerModule.logger, "info");

      SecurityLogger.authSuccess({
        actor: "test-actor",
        ip: "192.168.1.1",
        path: "/admin/stores",
      });

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "security.auth.success",
          severity: "info",
          actor: "test-actor",
        }),
        "Authentication successful"
      );
    });

    it("should log auth failure events", () => {
      const warnSpy = vi.spyOn(loggerModule.logger, "warn");

      SecurityLogger.authFailure({
        ip: "192.168.1.1",
        path: "/admin/stores",
        reason: "invalid api key",
        attempts: 3,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "security.auth.failure",
          severity: "high",
          reason: "invalid api key",
        }),
        "Authentication failed"
      );
    });

    it("should log rate limit exceeded events", () => {
      const warnSpy = vi.spyOn(loggerModule.logger, "warn");

      SecurityLogger.rateLimitExceeded({
        ip: "192.168.1.1",
        path: "/admin/stores",
        limit: 100,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "security.ratelimit",
          severity: "medium",
        }),
        "Rate limit exceeded"
      );
    });

    it("should log suspicious activity events", () => {
      const errorSpy = vi.spyOn(loggerModule.logger, "error");

      SecurityLogger.suspiciousActivity({
        ip: "192.168.1.1",
        path: "/admin/stores",
        reason: "SQL injection attempt",
        requestId: "req-123",
      });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "security.suspicious",
          severity: "high",
          reason: "SQL injection attempt",
        }),
        "Suspicious activity detected"
      );
    });

    it("should log data access events", () => {
      const infoSpy = vi.spyOn(loggerModule.logger, "info");

      SecurityLogger.dataAccess({
        actor: "admin-user",
        resource: "stores",
        resourceId: "store_001",
        action: "READ",
      });

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "security.data.access",
          severity: "info",
        }),
        "Data accessed"
      );
    });

    it("should log config change events", () => {
      const infoSpy = vi.spyOn(loggerModule.logger, "info");

      SecurityLogger.configChange({
        actor: "admin-user",
        setting: "rate_limit",
        oldValue: "100",
        newValue: "200",
      });

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "security.config.change",
          severity: "medium",
        }),
        "Configuration changed"
      );
    });
  });
});

// Re-export auditLog middleware alias
describe("auditLog export", () => {
  it("should export auditLogMiddleware as auditLog", async () => {
    // Import the module to check exports
    const auditModule = await import("../../../src/middleware/auditLog.js");

    // auditLogMiddleware should be available
    expect(typeof auditModule.auditLogMiddleware).toBe("function");
  });
});
