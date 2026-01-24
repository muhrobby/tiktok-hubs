/**
 * Security Headers Middleware
 *
 * Enhanced security headers configuration for production
 */

import type { Context, Next } from "hono";
import { secureHeaders } from "hono/secure-headers";

// ============================================
// TYPES
// ============================================

interface SecurityHeadersOptions {
  isDevelopment?: boolean;
  allowedOrigins?: string[];
}

// ============================================
// SECURITY HEADERS CONFIGURATION
// ============================================

/**
 * Enhanced security headers middleware
 * Configures CSP, HSTS, and other security headers
 */
export function enhancedSecurityHeaders(options: SecurityHeadersOptions = {}) {
  const { isDevelopment = process.env.NODE_ENV === "development" } = options;

  return async (c: Context, next: Next) => {
    // Skip strict CSP for Swagger UI documentation routes
    const isSwaggerRoute =
      c.req.path.startsWith("/api/docs") ||
      c.req.path.startsWith("/docs") ||
      c.req.path.startsWith("/swagger") ||
      c.req.path === "/api/openapi.json";

    if (isSwaggerRoute) {
      // Relaxed CSP for Swagger UI (allows inline scripts)
      await secureHeaders({
        contentSecurityPolicy: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: "same-origin",
        crossOriginResourcePolicy: "same-origin",
        originAgentCluster: true,
        referrerPolicy: "strict-origin-when-cross-origin",
        strictTransportSecurity: isDevelopment
          ? false
          : "max-age=31536000; includeSubDomains; preload",
        xContentTypeOptions: "nosniff",
        xDnsPrefetchControl: "off",
        xDownloadOptions: "noopen",
        xFrameOptions: "DENY",
        xPermittedCrossDomainPolicies: "none",
        xXssProtection: "1; mode=block",
      })(c, next);
      return;
    }

    // Strict CSP for all other routes
    await secureHeaders({
      // Content Security Policy
      contentSecurityPolicy: isDevelopment
        ? undefined // Disable in development for easier debugging
        : {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"], // Strict - no inline scripts
            styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for dynamic styling
            imgSrc: ["'self'", "data:", "https:"], // Allow images from HTTPS sources
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: [],
          },

      // Cross-Origin headers
      // Use string values for overridableHeader types
      crossOriginEmbedderPolicy: false, // Disable if serving external images
      crossOriginOpenerPolicy: "same-origin",
      crossOriginResourcePolicy: "same-origin",

      // Other security headers
      originAgentCluster: true,
      referrerPolicy: "strict-origin-when-cross-origin",

      // HSTS - Strict Transport Security
      // Use string format: "max-age=31536000; includeSubDomains; preload"
      strictTransportSecurity: isDevelopment
        ? false
        : "max-age=31536000; includeSubDomains; preload",

      // XSS and content sniffing protection
      xContentTypeOptions: "nosniff",
      xDnsPrefetchControl: "off",
      xDownloadOptions: "noopen",
      xFrameOptions: "DENY",
      xPermittedCrossDomainPolicies: "none",
      xXssProtection: "1; mode=block",
    })(c, next);
  };
}

/**
 * Custom headers middleware for additional security
 */
export function customSecurityHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    // Remove potentially sensitive headers
    c.res.headers.delete("X-Powered-By");
    c.res.headers.delete("Server");

    // Add custom security headers
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "1; mode=block");

    // Permissions Policy (formerly Feature-Policy)
    c.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), interest-cohort=()"
    );

    // Cache control for API responses
    if (c.req.path.startsWith("/admin") || c.req.path.startsWith("/auth")) {
      c.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
      c.header("Pragma", "no-cache");
      c.header("Expires", "0");
    }
  };
}

// ============================================
// HTTPS ENFORCEMENT
// ============================================

/**
 * HTTPS redirect middleware
 * Redirects HTTP requests to HTTPS in production
 */
export function httpsRedirect() {
  return async (c: Context, next: Next) => {
    // Only enforce in production
    if (process.env.NODE_ENV !== "production") {
      await next();
      return;
    }

    // Check protocol from proxy headers
    const proto = c.req.header("x-forwarded-proto");
    const host = c.req.header("host");

    if (proto && proto !== "https" && host) {
      const url = `https://${host}${c.req.path}`;
      const query = c.req.query();

      // Preserve query string
      const queryString = new URLSearchParams(
        query as Record<string, string>
      ).toString();
      const redirectUrl = queryString ? `${url}?${queryString}` : url;

      return c.redirect(redirectUrl, 301);
    }

    await next();
  };
}

// ============================================
// CORS VALIDATION
// ============================================

/**
 * Validate CORS configuration
 * Throws error if CORS is misconfigured in production
 */
export function validateCorsConfig(): void {
  if (process.env.NODE_ENV === "production") {
    const corsOrigin = process.env.CORS_ORIGIN;

    if (!corsOrigin) {
      throw new Error(
        "CORS_ORIGIN environment variable must be set in production"
      );
    }

    if (corsOrigin === "*") {
      throw new Error(
        "CORS_ORIGIN cannot be '*' (wildcard) in production. " +
          "Please specify allowed domain(s) separated by commas."
      );
    }

    // Validate each origin
    const origins = corsOrigin.split(",").map((o) => o.trim());
    for (const origin of origins) {
      try {
        new URL(origin);
      } catch {
        throw new Error(
          `Invalid CORS origin: "${origin}". Must be a valid URL (e.g., https://example.com)`
        );
      }
    }
  }
}

/**
 * Get CORS origins from environment
 */
export function getCorsOrigins(): string | string[] {
  const corsOrigin = process.env.CORS_ORIGIN;

  if (!corsOrigin || corsOrigin === "*") {
    // In development, allow all origins
    if (process.env.NODE_ENV === "development") {
      return "*";
    }
    // In production, this should not happen due to validation
    return [];
  }

  const origins = corsOrigin.split(",").map((o) => o.trim());
  return origins.length === 1 ? origins[0] : origins;
}

// ============================================
// IP VALIDATION
// ============================================

// List of private IP ranges (for SSRF protection)
const PRIVATE_IP_PATTERNS = [
  /^127\./, // Localhost
  /^10\./, // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
  /^192\.168\./, // Private Class C
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^::1$/, // IPv6 localhost
  /^fe80:/i, // IPv6 link-local
  /^fc00:/i, // IPv6 unique local
  /^fd00:/i, // IPv6 unique local
];

/**
 * Check if an IP address is private/internal
 */
export function isPrivateIp(ip: string): boolean {
  if (!ip) return false;

  const hostname = ip.toLowerCase();

  // Check for localhost
  if (hostname === "localhost") return true;

  // Check against private IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(ip)) return true;
  }

  return false;
}

/**
 * Validate external URL (for SSRF protection)
 */
export function validateExternalUrl(url: string, allowedDomains: string[]): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Check against allowed domains
    if (!allowedDomains.includes(hostname)) {
      return false;
    }

    // Check for private IPs
    if (isPrivateIp(hostname)) {
      return false;
    }

    // Only allow HTTPS in production
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
