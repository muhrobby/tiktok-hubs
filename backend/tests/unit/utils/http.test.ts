/**
 * HTTP Utility Tests
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { buildError, errorResponse } from "../../../src/utils/http.js";

describe("HTTP Utilities", () => {
  describe("buildError", () => {
    it("should create error payload with code and message", () => {
      const result = buildError("TEST_ERROR", "Test error message");

      expect(result).toEqual({
        error: {
          code: "TEST_ERROR",
          message: "Test error message",
        },
      });
    });

    it("should handle empty strings", () => {
      const result = buildError("", "");

      expect(result).toEqual({
        error: {
          code: "",
          message: "",
        },
      });
    });

    it("should handle special characters", () => {
      const result = buildError(
        "ERROR_WITH_SPECIAL",
        "Error with special chars: <>&\"'"
      );

      expect(result.error.message).toBe("Error with special chars: <>&\"'");
    });
  });

  describe("errorResponse", () => {
    it("should return JSON error response with correct status", async () => {
      const app = new Hono();

      app.get("/test", (c) => {
        return errorResponse(c, 400, "BAD_REQUEST", "Invalid input");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error.code).toBe("BAD_REQUEST");
      expect(body.error.message).toBe("Invalid input");
    });

    it("should handle 401 Unauthorized status", async () => {
      const app = new Hono();

      app.get("/test", (c) => {
        return errorResponse(c, 401, "UNAUTHORIZED", "Invalid credentials");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should handle 403 Forbidden status", async () => {
      const app = new Hono();

      app.get("/test", (c) => {
        return errorResponse(c, 403, "FORBIDDEN", "Access denied");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should handle 404 Not Found status", async () => {
      const app = new Hono();

      app.get("/test", (c) => {
        return errorResponse(c, 404, "NOT_FOUND", "Resource not found");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("should handle 409 Conflict status", async () => {
      const app = new Hono();

      app.get("/test", (c) => {
        return errorResponse(c, 409, "CONFLICT", "Resource already exists");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.error.code).toBe("CONFLICT");
    });

    it("should handle 429 Too Many Requests status", async () => {
      const app = new Hono();

      app.get("/test", (c) => {
        return errorResponse(c, 429, "RATE_LIMITED", "Too many requests");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(429);

      const body = await res.json();
      expect(body.error.code).toBe("RATE_LIMITED");
    });

    it("should handle 500 Internal Server Error status", async () => {
      const app = new Hono();

      app.get("/test", (c) => {
        return errorResponse(c, 500, "INTERNAL_ERROR", "Something went wrong");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error.code).toBe("INTERNAL_ERROR");
    });

    it("should include extra data when provided", async () => {
      const app = new Hono();

      app.get("/test", (c) => {
        return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid fields", {
          fields: ["email", "name"],
          details: { email: "required", name: "too short" },
        });
      });

      const res = await app.request("/test");

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.fields).toEqual(["email", "name"]);
      expect(body.details).toEqual({ email: "required", name: "too short" });
    });

    it("should not include extra data when not provided", async () => {
      const app = new Hono();

      app.get("/test", (c) => {
        return errorResponse(c, 400, "ERROR", "Error message");
      });

      const res = await app.request("/test");

      const body = await res.json();

      // Should only have error property
      expect(Object.keys(body)).toEqual(["error"]);
    });

    it("should return correct content-type header", async () => {
      const app = new Hono();

      app.get("/test", (c) => {
        return errorResponse(c, 400, "ERROR", "Error message");
      });

      const res = await app.request("/test");

      expect(res.headers.get("content-type")).toContain("application/json");
    });
  });
});
