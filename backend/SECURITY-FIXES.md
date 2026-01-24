# 🔒 Security Fixes Implementation Guide

**Priority:** CRITICAL  
**Timeline:** Implement ASAP before production deployment  
**Estimated Time:** 2-4 hours

---

## 🚨 CRITICAL FIXES (Must Do Immediately)

### 1. Remove .env from Git History ❌ CRITICAL

**Risk:** Credentials exposed in git history

**Steps:**

```bash
#!/bin/bash
# run-critical-fixes.sh

echo "🔒 Starting Critical Security Fixes..."

# 1. Backup current .env
cp backend/.env backend/.env.backup

# 2. Remove .env from git history
echo "Removing .env from git history..."
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

# 3. Force push (WARNING: This rewrites history)
# git push origin --force --all
# git push origin --force --tags

# 4. Clean up
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "✅ .env removed from git history"
```

### 2. Update docker-compose.yml ❌ CRITICAL

**File:** `backend/docker-compose.yml`

Replace hardcoded credentials:

```yaml
# ❌ BEFORE (INSECURE)
services:
  postgres:
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres  # CRITICAL: Default password!
      POSTGRES_DB: tiktok_hubs

# ✅ AFTER (SECURE)
services:
  postgres:
    environment:
      POSTGRES_USER: ${DB_USER:-tiktok_user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?Database password required}
      POSTGRES_DB: ${DB_NAME:-tiktok_hubs}
```

### 3. Generate New Secrets ❌ CRITICAL

Run this script to generate new secrets:

```bash
#!/bin/bash
# generate-secrets.sh

echo "🔑 Generating New Secrets..."
echo ""
echo "Add these to your .env file:"
echo ""
echo "# Database"
echo "DB_USER=tiktok_user"
echo "DB_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
echo "DB_NAME=tiktok_hubs"
echo ""
echo "# Encryption"
echo "TOKEN_ENC_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
echo ""
echo "# Admin API"
echo "ADMIN_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
echo ""
echo "# OAuth State Secret (for HMAC)"
echo "STATE_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
echo ""
```

Make executable and run:

```bash
chmod +x generate-secrets.sh
./generate-secrets.sh > .env.new
# Review .env.new then merge with .env
```

### 4. Fix CORS Configuration ⚠️ HIGH

**File:** `backend/src/app.ts:67-76`

```typescript
// ❌ BEFORE (INSECURE in production)
cors({
  origin: process.env.CORS_ORIGIN || "*",
  // ...
})

// ✅ AFTER (SECURE)
// Validate CORS in production
if (process.env.NODE_ENV === "production") {
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*") {
    throw new Error("CORS_ORIGIN must be set to specific domain(s) in production");
  }
}

cors({
  origin: process.env.NODE_ENV === "production" 
    ? process.env.CORS_ORIGIN.split(",")
    : "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-KEY"],
  exposeHeaders: ["X-Request-Id"],
  credentials: true,
  maxAge: 86400,
})
```

---

## ⚠️ HIGH PRIORITY FIXES (Do Within 1 Week)

### 5. Add Rate Limiting for Authentication

**File:** Create `backend/src/middleware/authRateLimit.ts`

```typescript
import { Context } from "hono";
import { errorResponse } from "../utils/http.js";
import { logger } from "../utils/logger.js";

interface AuthAttempt {
  count: number;
  resetTime: number;
}

const authAttempts = new Map<string, AuthAttempt>();

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, attempt] of authAttempts.entries()) {
    if (now > attempt.resetTime) {
      authAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000);

export function authRateLimiter(options: {
  maxAttempts: number;
  windowMs: number;
}) {
  return async (c: Context, next: () => Promise<void>) => {
    const clientIp = 
      c.req.header("x-forwarded-for")?.split(",")[0] ||
      c.req.header("x-real-ip") ||
      "unknown";
    
    const attemptKey = `auth:${clientIp}`;
    const attempt = authAttempts.get(attemptKey);
    const now = Date.now();
    
    // Check if blocked
    if (attempt && attempt.count >= options.maxAttempts && now < attempt.resetTime) {
      const retryAfter = Math.ceil((attempt.resetTime - now) / 1000);
      c.header("Retry-After", retryAfter.toString());
      
      logger.warn({ 
        clientIp, 
        attempts: attempt.count,
        retryAfter 
      }, "Too many authentication attempts");
      
      return errorResponse(
        c, 
        429, 
        "TOO_MANY_ATTEMPTS", 
        `Too many failed attempts. Try again in ${retryAfter} seconds.`
      );
    }
    
    await next();
    
    // Track failed auth (called from auth middleware)
    if (c.get("authFailed")) {
      const resetTime = now + options.windowMs;
      authAttempts.set(attemptKey, {
        count: (attempt?.count || 0) + 1,
        resetTime: attempt?.resetTime || resetTime,
      });
      
      logger.warn({
        clientIp,
        attempts: authAttempts.get(attemptKey)?.count,
        path: c.req.path,
      }, "Failed authentication attempt");
    } else {
      // Successful auth, reset counter
      authAttempts.delete(attemptKey);
    }
  };
}
```

**Update:** `backend/src/routes/admin.routes.ts`

```typescript
import { authRateLimiter } from "../middleware/authRateLimit.js";

// Add before auth middleware
admin.use("*", authRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
}));

admin.use("*", async (c, next) => {
  const apiKey = c.req.header("X-API-KEY");
  const expectedKey = process.env.ADMIN_API_KEY;
  
  if (!apiKey || apiKey !== expectedKey) {
    c.set("authFailed", true); // Mark as failed for rate limiter
    return errorResponse(c, 401, "UNAUTHORIZED", "Invalid API key");
  }
  
  await next();
});
```

### 6. Add Request ID Tracking

**File:** Create `backend/src/middleware/requestId.ts`

```typescript
import { Context } from "hono";
import { randomBytes } from "crypto";
import { logger } from "../utils/logger.js";

export function requestIdMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    const requestId = c.req.header("X-Request-ID") || 
                      randomBytes(16).toString("hex");
    
    c.set("requestId", requestId);
    c.header("X-Request-ID", requestId);
    
    const startTime = Date.now();
    
    await next();
    
    const duration = Date.now() - startTime;
    
    logger.info({
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration,
      ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
    }, "Request completed");
  };
}
```

**Update:** `backend/src/app.ts`

```typescript
import { requestIdMiddleware } from "./middleware/requestId.js";

// Add after secure headers
app.use("*", requestIdMiddleware());
```

### 7. Enhanced Security Headers

**Update:** `backend/src/app.ts:64`

```typescript
import { secureHeaders } from "hono/secure-headers";

app.use("*", secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // Untuk HTML responses
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
  crossOriginEmbedderPolicy: false, // Disable if using external images
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  originAgentCluster: true,
  referrerPolicy: "strict-origin-when-cross-origin",
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  xContentTypeOptions: "nosniff",
  xDnsPrefetchControl: { allow: false },
  xDownloadOptions: "noopen",
  xFrameOptions: "DENY",
  xPermittedCrossDomainPolicies: "none",
  xXssProtection: "1; mode=block",
}));
```

### 8. Improve OAuth State Security

**File:** `backend/src/services/tiktokAuth.service.ts`

Add HMAC-based state validation:

```typescript
import { createHmac } from "crypto";

function getStateSecret(): string {
  const secret = process.env.STATE_SECRET;
  if (!secret) {
    throw new Error("STATE_SECRET environment variable is required");
  }
  return secret;
}

/**
 * Generate secure state with HMAC
 * Format: storeCode:timestamp:random:hmac
 */
export function generateSecureState(storeCode: string): string {
  const timestamp = Date.now().toString();
  const random = randomBytes(16).toString("hex");
  const data = `${storeCode}:${timestamp}:${random}`;
  
  const hmac = createHmac("sha256", getStateSecret())
    .update(data)
    .digest("hex");
  
  return `${data}:${hmac}`;
}

/**
 * Validate and parse secure state
 */
export function validateSecureState(state: string): {
  valid: boolean;
  storeCode?: string;
  error?: string;
} {
  const parts = state.split(":");
  
  if (parts.length !== 4) {
    return { valid: false, error: "Invalid state format" };
  }
  
  const [storeCode, timestamp, random, providedHmac] = parts;
  const data = `${storeCode}:${timestamp}:${random}`;
  
  // Verify HMAC
  const expectedHmac = createHmac("sha256", getStateSecret())
    .update(data)
    .digest("hex");
  
  if (providedHmac !== expectedHmac) {
    return { valid: false, error: "Invalid state signature" };
  }
  
  // Check timestamp (10 minutes expiry)
  const age = Date.now() - parseInt(timestamp);
  if (age > 10 * 60 * 1000) {
    return { valid: false, error: "State expired" };
  }
  
  if (age < 0) {
    return { valid: false, error: "Invalid timestamp" };
  }
  
  return { valid: true, storeCode };
}

// Update buildAuthUrl to use new function
export async function buildAuthUrl(storeCode: string): Promise<string> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateSecureState(storeCode); // Use new function
  
  // Store code_verifier with state
  await storeCodeVerifier(state, codeVerifier, storeCode);
  
  // ... rest of function
}
```

**Update:** `backend/src/routes/auth.routes.ts:109-125`

```typescript
// In callback handler
const state = query.state;
if (!state) {
  return errorResponse(c, 400, "OAUTH_MISSING_PARAMS", "Missing state");
}

// Validate state signature and expiry
const stateValidation = validateSecureState(state);
if (!stateValidation.valid) {
  logger.error({ state, error: stateValidation.error }, "State validation failed");
  return errorResponse(
    c, 
    400, 
    "OAUTH_STATE_INVALID", 
    stateValidation.error || "Invalid state"
  );
}

const storeCode = stateValidation.storeCode!;
```

---

## 📊 MEDIUM PRIORITY FIXES (Do Within 2 Weeks)

### 9. Setup External Logging

**File:** Create `backend/src/utils/externalLogger.ts`

Example with Datadog (or adapt for your logging service):

```typescript
import pino from "pino";

// For Datadog
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "production" ? {
    target: "pino-datadog",
    options: {
      apiKey: process.env.DATADOG_API_KEY,
      service: "tiktok-hubs-backend",
      hostname: process.env.HOSTNAME || "unknown",
      env: process.env.NODE_ENV,
      ddsource: "nodejs",
    },
  } : {
    target: "pino-pretty",
    options: { colorize: true },
  },
  // ... rest of config
});

// Alternative: For CloudWatch
// import { CloudWatchLogsClient, PutLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";

// Alternative: For Sentry
// import * as Sentry from "@sentry/node";
// Sentry.init({ dsn: process.env.SENTRY_DSN });
```

### 10. Add Audit Logging

**File:** Update `backend/src/db/schema.ts`

```typescript
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .defaultNow()
      .notNull(),
    actor: varchar("actor", { length: 255 }), // API key hash or user ID
    action: varchar("action", { length: 100 }).notNull(), // CREATE, UPDATE, DELETE, etc.
    resource: varchar("resource", { length: 255 }).notNull(), // store, account, etc.
    resourceId: varchar("resource_id", { length: 255 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    method: varchar("method", { length: 10 }),
    path: text("path"),
    success: boolean("success").notNull(),
    errorCode: varchar("error_code", { length: 50 }),
    details: jsonb("details"),
  },
  (table) => [
    index("audit_logs_timestamp_idx").on(table.timestamp),
    index("audit_logs_actor_idx").on(table.actor),
    index("audit_logs_resource_idx").on(table.resource),
  ]
);
```

**File:** Create `backend/src/middleware/auditLog.ts`

```typescript
import { Context } from "hono";
import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";
import { createHash } from "crypto";

export function auditLogMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    // Only audit admin routes
    if (!c.req.path.startsWith("/admin")) {
      await next();
      return;
    }
    
    const startTime = Date.now();
    const apiKey = c.req.header("X-API-KEY");
    const actorHash = apiKey 
      ? createHash("sha256").update(apiKey).digest("hex").substring(0, 16)
      : "anonymous";
    
    await next();
    
    const success = c.res.status < 400;
    
    // Extract resource from path (e.g., /admin/stores/store_001)
    const pathParts = c.req.path.split("/").filter(Boolean);
    const resource = pathParts[1] || "unknown";
    const resourceId = pathParts[2] || null;
    
    try {
      await db.insert(auditLogs).values({
        actor: actorHash,
        action: c.req.method,
        resource,
        resourceId,
        ipAddress: c.req.header("x-forwarded-for")?.split(",")[0] || 
                   c.req.header("x-real-ip") || 
                   "unknown",
        userAgent: c.req.header("user-agent") || null,
        method: c.req.method,
        path: c.req.path,
        success,
        errorCode: success ? null : c.get("errorCode"),
        details: {
          status: c.res.status,
          duration: Date.now() - startTime,
          requestId: c.get("requestId"),
        },
      });
    } catch (error) {
      // Don't fail request if audit logging fails
      console.error("Failed to write audit log:", error);
    }
  };
}
```

### 11. Add Security Monitoring Alerts

**File:** Create `backend/src/utils/alerting.ts`

```typescript
import { logger } from "./logger.js";

interface Alert {
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Send alert to monitoring service
 * Implement integration with your alerting system:
 * - Slack
 * - PagerDuty
 * - Email
 * - SMS
 */
export async function sendAlert(alert: Alert): Promise<void> {
  logger.warn({ alert }, "Security alert triggered");
  
  // Example: Send to Slack
  if (process.env.SLACK_WEBHOOK_URL && alert.severity === "critical") {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 ${alert.severity.toUpperCase()}: ${alert.title}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${alert.title}*\n${alert.message}`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Severity: ${alert.severity} | Time: ${new Date().toISOString()}`,
                },
              ],
            },
          ],
        }),
      });
    } catch (error) {
      logger.error({ error }, "Failed to send alert to Slack");
    }
  }
  
  // Example: Send to PagerDuty for critical alerts
  if (process.env.PAGERDUTY_INTEGRATION_KEY && alert.severity === "critical") {
    // Implement PagerDuty integration
  }
}

// Alert thresholds
let failedAuthCount = 0;
let suspiciousActivityCount = 0;

export function checkAndAlert() {
  // Alert on too many failed auth attempts
  if (failedAuthCount >= 10) {
    sendAlert({
      severity: "high",
      title: "Multiple Failed Authentication Attempts",
      message: `${failedAuthCount} failed authentication attempts detected in the last hour`,
      metadata: { count: failedAuthCount },
    });
    failedAuthCount = 0;
  }
  
  // Alert on suspicious activity
  if (suspiciousActivityCount >= 5) {
    sendAlert({
      severity: "medium",
      title: "Suspicious Activity Detected",
      message: `${suspiciousActivityCount} suspicious activities detected`,
      metadata: { count: suspiciousActivityCount },
    });
    suspiciousActivityCount = 0;
  }
}

// Run check every minute
setInterval(checkAndAlert, 60 * 1000);

export function recordFailedAuth() {
  failedAuthCount++;
}

export function recordSuspiciousActivity() {
  suspiciousActivityCount++;
}
```

### 12. Implement HTTPS Enforcement

**File:** Create `backend/src/middleware/httpsRedirect.ts`

```typescript
import { Context } from "hono";

export function httpsRedirect() {
  return async (c: Context, next: () => Promise<void>) => {
    // Only in production
    if (process.env.NODE_ENV !== "production") {
      await next();
      return;
    }
    
    const proto = c.req.header("x-forwarded-proto");
    
    if (proto && proto !== "https") {
      const host = c.req.header("host");
      const url = `https://${host}${c.req.path}`;
      
      return c.redirect(url, 301);
    }
    
    await next();
  };
}
```

**Update:** `backend/src/app.ts`

```typescript
import { httpsRedirect } from "./middleware/httpsRedirect.js";

// Add as first middleware in production
if (process.env.NODE_ENV === "production") {
  app.use("*", httpsRedirect());
}
```

---

## 📝 Implementation Checklist

### Immediate Actions (Today)

- [ ] Run `./run-critical-fixes.sh`
- [ ] Update `docker-compose.yml` with environment variables
- [ ] Generate new secrets with `./generate-secrets.sh`
- [ ] Update `.env` with new secrets
- [ ] Add CORS validation to `app.ts`
- [ ] Test all changes locally
- [ ] Commit changes with message: "security: implement critical security fixes"

### This Week

- [ ] Implement auth rate limiting middleware
- [ ] Add request ID tracking
- [ ] Enhance security headers
- [ ] Improve OAuth state validation
- [ ] Add `STATE_SECRET` to environment
- [ ] Test OAuth flow with new security
- [ ] Update documentation

### Next Week

- [ ] Setup external logging (Datadog/CloudWatch/Sentry)
- [ ] Add audit logging table and middleware
- [ ] Implement security alerting
- [ ] Add HTTPS enforcement middleware
- [ ] Setup monitoring dashboard
- [ ] Configure alerting rules
- [ ] Test alerting system

### Before Production

- [ ] Run full security audit: `npm audit`
- [ ] Run all tests: `npm test`
- [ ] Perform manual security testing
- [ ] Review all environment variables
- [ ] Setup database backups
- [ ] Configure firewall rules
- [ ] Enable monitoring and alerting
- [ ] Document incident response plan
- [ ] Train team on security procedures

---

## 🧪 Testing Security Fixes

### Test Auth Rate Limiting

```bash
# Should block after 5 attempts
for i in {1..10}; do
  curl -H "X-API-KEY: wrong_key" http://localhost:3000/admin/stores
  echo ""
done

# Should show 429 after 5th attempt
```

### Test OAuth State Security

```bash
# Test expired state (should fail)
curl "http://localhost:3000/auth/tiktok/callback?code=test&state=old_expired_state"

# Test invalid state signature (should fail)
curl "http://localhost:3000/auth/tiktok/callback?code=test&state=tampered:state:xxx:yyy"
```

### Test CORS

```bash
# Should block if origin not allowed (in production)
curl -H "Origin: https://evil.com" \
  -H "X-API-KEY: $ADMIN_API_KEY" \
  http://localhost:3000/admin/stores
```

### Test HTTPS Redirect

```bash
# Should redirect to HTTPS (in production)
curl -H "X-Forwarded-Proto: http" \
  http://localhost:3000/health
```

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/Top10/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Hono Security](https://hono.dev/docs/guides/middleware#secure-headers)
- [OAuth 2.0 Security](https://oauth.net/2/oauth-best-practice/)

---

**Status:** Ready for Implementation  
**Priority:** CRITICAL  
**Estimated Effort:** 2-4 hours for critical fixes, 1-2 days for all fixes
