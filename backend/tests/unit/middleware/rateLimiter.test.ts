/**
 * Rate Limiter Middleware Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import {
  rateLimiter,
  authRateLimiter,
  adminRateLimiter,
  oauthRateLimiter,
  strictRateLimiter,
  getClientIp,
  clearRateLimitStores,
  getRateLimitEntry,
  getAuthRateLimitEntry,
} from "../../../src/middleware/rateLimiter.js";

describe("Rate Limiter Middleware", () => {
  beforeEach(() => {
    clearRateLimitStores();
  });

  describe("getClientIp", () => {
    it("should extract IP from X-Forwarded-For header", async () => {
      const app = new Hono();
      let extractedIp = "";

      app.use("*", async (c, next) => {
        extractedIp = getClientIp(c);
        await next();
      });
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.100, 10.0.0.1" },
      });

      expect(res.status).toBe(200);
      expect(extractedIp).toBe("192.168.1.100");
    });

    it("should extract IP from X-Real-IP header", async () => {
      const app = new Hono();
      let extractedIp = "";

      app.use("*", async (c, next) => {
        extractedIp = getClientIp(c);
        await next();
      });
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { "X-Real-IP": "10.0.0.50" },
      });

      expect(res.status).toBe(200);
      expect(extractedIp).toBe("10.0.0.50");
    });

    it("should extract IP from CF-Connecting-IP header", async () => {
      const app = new Hono();
      let extractedIp = "";

      app.use("*", async (c, next) => {
        extractedIp = getClientIp(c);
        await next();
      });
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { "CF-Connecting-IP": "203.0.113.50" },
      });

      expect(res.status).toBe(200);
      expect(extractedIp).toBe("203.0.113.50");
    });

    it("should return 'unknown' when no IP headers present", async () => {
      const app = new Hono();
      let extractedIp = "";

      app.use("*", async (c, next) => {
        extractedIp = getClientIp(c);
        await next();
      });
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      expect(extractedIp).toBe("unknown");
    });
  });

  describe("rateLimiter", () => {
    it("should allow requests within limit", async () => {
      const app = new Hono();

      app.use(
        "*",
        rateLimiter({
          windowMs: 60000,
          limit: 5,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // Make 5 requests (all should succeed)
      for (let i = 0; i < 5; i++) {
        const res = await app.request("/test", {
          headers: { "X-Forwarded-For": "192.168.1.1" },
        });
        expect(res.status).toBe(200);
      }
    });

    it("should block requests exceeding limit", async () => {
      const app = new Hono();

      app.use(
        "*",
        rateLimiter({
          windowMs: 60000,
          limit: 3,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // Make 3 requests (all should succeed)
      for (let i = 0; i < 3; i++) {
        const res = await app.request("/test", {
          headers: { "X-Forwarded-For": "192.168.1.2" },
        });
        expect(res.status).toBe(200);
      }

      // 4th request should be rate limited
      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.2" },
      });

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error.code).toBe("RATE_LIMITED");
    });

    it("should set rate limit headers", async () => {
      const app = new Hono();

      app.use(
        "*",
        rateLimiter({
          windowMs: 60000,
          limit: 10,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.3" },
      });

      expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
      expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
    });

    it("should set Retry-After header when rate limited", async () => {
      const app = new Hono();

      app.use(
        "*",
        rateLimiter({
          windowMs: 60000,
          limit: 1,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // First request succeeds
      await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.4" },
      });

      // Second request is rate limited
      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.4" },
      });

      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });

    it("should use custom key generator", async () => {
      const app = new Hono();

      app.use(
        "*",
        rateLimiter({
          windowMs: 60000,
          limit: 2,
          keyGenerator: (c) => `custom:${c.req.header("X-API-KEY") || "anon"}`,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // Different API keys should have separate limits
      const res1 = await app.request("/test", {
        headers: { "X-API-KEY": "key1" },
      });
      const res2 = await app.request("/test", {
        headers: { "X-API-KEY": "key2" },
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Same API key should hit limit
      await app.request("/test", { headers: { "X-API-KEY": "key1" } });
      const res3 = await app.request("/test", {
        headers: { "X-API-KEY": "key1" },
      });

      expect(res3.status).toBe(429);
    });

    it("should call onLimitReached callback when limit exceeded", async () => {
      const onLimitReached = vi.fn();
      const app = new Hono();

      app.use(
        "*",
        rateLimiter({
          windowMs: 60000,
          limit: 1,
          onLimitReached,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.5" },
      });
      await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.5" },
      });

      expect(onLimitReached).toHaveBeenCalledTimes(1);
    });

    it("should track requests per IP separately", async () => {
      const app = new Hono();

      app.use(
        "*",
        rateLimiter({
          windowMs: 60000,
          limit: 2,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // IP 1: 2 requests
      await app.request("/test", {
        headers: { "X-Forwarded-For": "10.0.0.1" },
      });
      await app.request("/test", {
        headers: { "X-Forwarded-For": "10.0.0.1" },
      });

      // IP 2: 2 requests
      const res1 = await app.request("/test", {
        headers: { "X-Forwarded-For": "10.0.0.2" },
      });
      const res2 = await app.request("/test", {
        headers: { "X-Forwarded-For": "10.0.0.2" },
      });

      // Both IPs should be at their limit but not exceeded
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // IP 1 should now be rate limited
      const res3 = await app.request("/test", {
        headers: { "X-Forwarded-For": "10.0.0.1" },
      });
      expect(res3.status).toBe(429);
    });
  });

  describe("authRateLimiter", () => {
    it("should track failed authentication attempts", async () => {
      const app = new Hono();

      app.use(
        "*",
        authRateLimiter({
          maxAttempts: 3,
          windowMs: 60000,
        })
      );
      app.get("/test", (c) => {
        // Simulate auth failure
        c.set("authFailed", true);
        return c.json({ error: "unauthorized" }, 401);
      });

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await app.request("/test", {
          headers: { "X-Forwarded-For": "192.168.1.10" },
        });
      }

      // 4th attempt should be blocked
      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.10" },
      });

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error.code).toBe("TOO_MANY_AUTH_ATTEMPTS");
    });

    it("should reset counter on successful auth", async () => {
      const app = new Hono();
      let shouldFail = true;

      app.use(
        "*",
        authRateLimiter({
          maxAttempts: 3,
          windowMs: 60000,
        })
      );
      app.get("/test", (c) => {
        if (shouldFail) {
          c.set("authFailed", true);
          return c.json({ error: "unauthorized" }, 401);
        }
        return c.json({ success: true });
      });

      // Make 2 failed attempts
      await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.11" },
      });
      await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.11" },
      });

      // Successful auth
      shouldFail = false;
      await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.11" },
      });

      // Should be able to make more requests (counter reset)
      shouldFail = true;
      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.11" },
      });

      // Should not be blocked (counter was reset)
      expect(res.status).toBe(401);
    });

    it("should not count successful requests", async () => {
      const app = new Hono();

      app.use(
        "*",
        authRateLimiter({
          maxAttempts: 2,
          windowMs: 60000,
        })
      );
      app.get("/test", (c) => c.json({ success: true }));

      // Make many successful requests
      for (let i = 0; i < 10; i++) {
        const res = await app.request("/test", {
          headers: { "X-Forwarded-For": "192.168.1.12" },
        });
        expect(res.status).toBe(200);
      }
    });
  });

  describe("adminRateLimiter", () => {
    it("should use API key for rate limiting when available", async () => {
      const app = new Hono();

      app.use("*", adminRateLimiter());
      app.get("/test", (c) => c.text("ok"));

      // Make requests with API key
      const res = await app.request("/test", {
        headers: { "X-API-KEY": "test-api-key-12345" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
    });

    it("should fallback to IP when no API key", async () => {
      const app = new Hono();

      app.use("*", adminRateLimiter());
      app.get("/test", (c) => c.text("ok"));

      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.20" },
      });

      expect(res.status).toBe(200);
    });
  });

  describe("oauthRateLimiter", () => {
    it("should have stricter limits for OAuth endpoints", async () => {
      const app = new Hono();

      app.use("*", oauthRateLimiter());
      app.get("/test", (c) => c.text("ok"));

      // Make 10 requests (limit)
      for (let i = 0; i < 10; i++) {
        const res = await app.request("/test", {
          headers: { "X-Forwarded-For": "192.168.1.30" },
        });
        expect(res.status).toBe(200);
      }

      // 11th request should be rate limited
      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.30" },
      });

      expect(res.status).toBe(429);
    });
  });

  describe("strictRateLimiter", () => {
    it("should have very strict limits", async () => {
      const app = new Hono();

      app.use("*", strictRateLimiter());
      app.get("/test", (c) => c.text("ok"));

      // Make 5 requests (limit)
      for (let i = 0; i < 5; i++) {
        const res = await app.request("/test", {
          headers: { "X-Forwarded-For": "192.168.1.40" },
        });
        expect(res.status).toBe(200);
      }

      // 6th request should be rate limited
      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.40" },
      });

      expect(res.status).toBe(429);
    });

    it("should rate limit per path", async () => {
      const app = new Hono();

      app.use("*", strictRateLimiter());
      app.get("/path1", (c) => c.text("ok"));
      app.get("/path2", (c) => c.text("ok"));

      // Exhaust limit on path1
      for (let i = 0; i < 5; i++) {
        await app.request("/path1", {
          headers: { "X-Forwarded-For": "192.168.1.41" },
        });
      }

      // path2 should still work
      const res = await app.request("/path2", {
        headers: { "X-Forwarded-For": "192.168.1.41" },
      });

      expect(res.status).toBe(200);
    });
  });

  describe("clearRateLimitStores", () => {
    it("should clear all rate limit entries", async () => {
      const app = new Hono();

      app.use(
        "*",
        rateLimiter({
          windowMs: 60000,
          limit: 1,
        })
      );
      app.get("/test", (c) => c.text("ok"));

      // Hit the rate limit
      await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.50" },
      });
      const res1 = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.50" },
      });
      expect(res1.status).toBe(429);

      // Clear stores
      clearRateLimitStores();

      // Should be able to make requests again
      const res2 = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.50" },
      });
      expect(res2.status).toBe(200);
    });
  });
});
