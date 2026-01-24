/**
 * Security Headers Middleware Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import {
  enhancedSecurityHeaders,
  customSecurityHeaders,
  httpsRedirect,
  validateCorsConfig,
  getCorsOrigins,
  isPrivateIp,
  validateExternalUrl,
} from "../../../src/middleware/security.js";

describe("Security Middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("enhancedSecurityHeaders", () => {
    it("should add security headers in production", async () => {
      const app = new Hono();

      app.use("*", enhancedSecurityHeaders({ isDevelopment: false }));
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      // Check some security headers are present
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("should disable CSP in development mode", async () => {
      const app = new Hono();

      app.use("*", enhancedSecurityHeaders({ isDevelopment: true }));
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      // CSP should not be set in development
      expect(res.headers.get("Content-Security-Policy")).toBeFalsy();
    });

    it("should add CSP in production mode", async () => {
      const app = new Hono();

      app.use("*", enhancedSecurityHeaders({ isDevelopment: false }));
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
    });
  });

  describe("customSecurityHeaders", () => {
    it("should add Permissions-Policy header", async () => {
      const app = new Hono();

      app.use("*", customSecurityHeaders());
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
      expect(res.headers.get("Permissions-Policy")).toContain("microphone=()");
    });

    it("should add no-cache headers for admin routes", async () => {
      const app = new Hono();

      app.use("*", customSecurityHeaders());
      app.get("/admin/test", (c) => c.text("ok"));

      const res = await app.request("/admin/test");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toContain("no-store");
      expect(res.headers.get("Pragma")).toBe("no-cache");
    });

    it("should add no-cache headers for auth routes", async () => {
      const app = new Hono();

      app.use("*", customSecurityHeaders());
      app.get("/auth/test", (c) => c.text("ok"));

      const res = await app.request("/auth/test");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toContain("no-store");
    });

    it("should not add no-cache headers for other routes", async () => {
      const app = new Hono();

      app.use("*", customSecurityHeaders());
      app.get("/api/test", (c) => c.text("ok"));

      const res = await app.request("/api/test");

      expect(res.status).toBe(200);
      // Should not have no-store in cache-control for non-sensitive routes
      const cacheControl = res.headers.get("Cache-Control");
      // Either no Cache-Control header or it doesn't contain no-store
      expect(cacheControl === null || !cacheControl.includes("no-store")).toBe(true);
    });
  });

  describe("httpsRedirect", () => {
    it("should not redirect in development", async () => {
      process.env.NODE_ENV = "development";

      const app = new Hono();

      app.use("*", httpsRedirect());
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: {
          "X-Forwarded-Proto": "http",
          Host: "example.com",
        },
      });

      expect(res.status).toBe(200);
    });

    it("should redirect HTTP to HTTPS in production", async () => {
      process.env.NODE_ENV = "production";

      const app = new Hono();

      app.use("*", httpsRedirect());
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: {
          "X-Forwarded-Proto": "http",
          Host: "example.com",
        },
      });

      expect(res.status).toBe(301);
      expect(res.headers.get("Location")).toBe("https://example.com/test");
    });

    it("should preserve query string on redirect", async () => {
      process.env.NODE_ENV = "production";

      const app = new Hono();

      app.use("*", httpsRedirect());
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test?foo=bar&baz=qux", {
        headers: {
          "X-Forwarded-Proto": "http",
          Host: "example.com",
        },
      });

      expect(res.status).toBe(301);
      expect(res.headers.get("Location")).toContain("foo=bar");
    });

    it("should not redirect HTTPS requests", async () => {
      process.env.NODE_ENV = "production";

      const app = new Hono();

      app.use("*", httpsRedirect());
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: {
          "X-Forwarded-Proto": "https",
          Host: "example.com",
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe("validateCorsConfig", () => {
    it("should throw error when CORS_ORIGIN not set in production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.CORS_ORIGIN;

      expect(() => validateCorsConfig()).toThrow(
        "CORS_ORIGIN environment variable must be set in production"
      );
    });

    it("should throw error when CORS_ORIGIN is wildcard in production", () => {
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGIN = "*";

      expect(() => validateCorsConfig()).toThrow(
        "CORS_ORIGIN cannot be '*' (wildcard) in production"
      );
    });

    it("should throw error for invalid URL in CORS_ORIGIN", () => {
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGIN = "not-a-valid-url";

      expect(() => validateCorsConfig()).toThrow("Invalid CORS origin");
    });

    it("should accept valid URLs in production", () => {
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGIN = "https://example.com";

      expect(() => validateCorsConfig()).not.toThrow();
    });

    it("should accept multiple valid URLs", () => {
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGIN = "https://example.com, https://api.example.com";

      expect(() => validateCorsConfig()).not.toThrow();
    });

    it("should not validate in development", () => {
      process.env.NODE_ENV = "development";
      delete process.env.CORS_ORIGIN;

      expect(() => validateCorsConfig()).not.toThrow();
    });
  });

  describe("getCorsOrigins", () => {
    it("should return wildcard in development", () => {
      process.env.NODE_ENV = "development";
      delete process.env.CORS_ORIGIN;

      expect(getCorsOrigins()).toBe("*");
    });

    it("should return single origin as string", () => {
      process.env.CORS_ORIGIN = "https://example.com";

      expect(getCorsOrigins()).toBe("https://example.com");
    });

    it("should return multiple origins as array", () => {
      process.env.CORS_ORIGIN = "https://example.com, https://api.example.com";

      const origins = getCorsOrigins();

      expect(Array.isArray(origins)).toBe(true);
      expect(origins).toContain("https://example.com");
      expect(origins).toContain("https://api.example.com");
    });
  });

  describe("isPrivateIp", () => {
    it("should detect localhost", () => {
      expect(isPrivateIp("localhost")).toBe(true);
    });

    it("should detect 127.x.x.x addresses", () => {
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("127.255.255.255")).toBe(true);
    });

    it("should detect 10.x.x.x addresses", () => {
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("10.255.255.255")).toBe(true);
    });

    it("should detect 172.16-31.x.x addresses", () => {
      expect(isPrivateIp("172.16.0.1")).toBe(true);
      expect(isPrivateIp("172.31.255.255")).toBe(true);
    });

    it("should not detect 172.15.x.x as private", () => {
      expect(isPrivateIp("172.15.0.1")).toBe(false);
    });

    it("should detect 192.168.x.x addresses", () => {
      expect(isPrivateIp("192.168.0.1")).toBe(true);
      expect(isPrivateIp("192.168.255.255")).toBe(true);
    });

    it("should detect link-local addresses", () => {
      expect(isPrivateIp("169.254.0.1")).toBe(true);
    });

    it("should detect IPv6 localhost", () => {
      expect(isPrivateIp("::1")).toBe(true);
    });

    it("should detect IPv6 link-local", () => {
      expect(isPrivateIp("fe80::1")).toBe(true);
    });

    it("should not detect public IPs as private", () => {
      expect(isPrivateIp("8.8.8.8")).toBe(false);
      expect(isPrivateIp("203.0.113.1")).toBe(false);
      expect(isPrivateIp("1.1.1.1")).toBe(false);
    });

    it("should handle empty/null input", () => {
      expect(isPrivateIp("")).toBe(false);
    });
  });

  describe("validateExternalUrl", () => {
    it("should accept URLs from allowed domains", () => {
      expect(
        validateExternalUrl("https://api.tiktok.com/v1/users", [
          "api.tiktok.com",
        ])
      ).toBe(true);
    });

    it("should reject URLs from non-allowed domains", () => {
      expect(
        validateExternalUrl("https://evil.com/steal-data", ["api.tiktok.com"])
      ).toBe(false);
    });

    it("should reject private IPs", () => {
      expect(
        validateExternalUrl("http://192.168.1.1/admin", ["192.168.1.1"])
      ).toBe(false);
      expect(validateExternalUrl("http://localhost/admin", ["localhost"])).toBe(
        false
      );
    });

    it("should reject HTTP in production", () => {
      process.env.NODE_ENV = "production";

      expect(
        validateExternalUrl("http://api.tiktok.com/v1/users", [
          "api.tiktok.com",
        ])
      ).toBe(false);
    });

    it("should allow HTTP in development", () => {
      process.env.NODE_ENV = "development";

      expect(
        validateExternalUrl("http://api.tiktok.com/v1/users", [
          "api.tiktok.com",
        ])
      ).toBe(true);
    });

    it("should handle invalid URLs", () => {
      expect(validateExternalUrl("not-a-url", ["api.tiktok.com"])).toBe(false);
    });
  });
});
