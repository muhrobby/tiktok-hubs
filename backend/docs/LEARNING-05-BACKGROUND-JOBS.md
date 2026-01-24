# 📚 Learning Guide Part 5: Background Jobs & Production Architecture

## 🎯 Tujuan Pembelajaran

Memahami background job scheduling, application architecture patterns, graceful shutdown, production deployment, dan monitoring strategies.

---

## 1. Background Jobs dengan node-cron

### 1.1 Why Background Jobs?

**Use cases:**

```
❌ Synchronous (on user request):
User clicks "Refresh" → Wait 30s → Show data

Problems:
- Poor UX (user waits)
- Timeout errors
- Inconsistent data (last refresh time varies)

✅ Asynchronous (scheduled job):
Cron: Every day 02:00 → Sync all accounts
User: Opens dashboard → See latest data instantly

Benefits:
- Fast response time
- Consistent data freshness
- No user-facing timeouts
- Lower API costs (batch processing)
```

### 1.2 Cron Expression Syntax

**Format:**

```
┌────────────── second (optional, 0-59)
│ ┌──────────── minute (0-59)
│ │ ┌────────── hour (0-23)
│ │ │ ┌──────── day of month (1-31)
│ │ │ │ ┌────── month (1-12)
│ │ │ │ │ ┌──── day of week (0-7, 0 and 7 are Sunday)
│ │ │ │ │ │
│ │ │ │ │ │
* * * * * *
```

**Examples:**

```typescript
// Every minute
"* * * * *";

// Every 5 minutes
"*/5 * * * *";

// Every hour at minute 0
"0 * * * *";

// Every day at 2:00 AM
"0 2 * * *";

// Every Monday at 9:00 AM
"0 9 * * 1";

// Every 1st of month at midnight
"0 0 1 * *";

// Every weekday (Mon-Fri) at 8:00 AM
"0 8 * * 1-5";

// Multiple times: 9 AM, 12 PM, 6 PM
"0 9,12,18 * * *";
```

**Our implementation - `src/jobs/syncDaily.job.ts`:**

```typescript
import cron from "node-cron";

// Every day at 2 AM
const CRON_SCHEDULE = "0 2 * * *";

export function startDailySyncJob(): void {
  logger.info({ schedule: CRON_SCHEDULE }, "Scheduling daily sync job");

  cron.schedule(CRON_SCHEDULE, async () => {
    logger.info("Daily sync job triggered");
    await performDailySync();
  });
}
```

### 1.3 Job Execution Flow

```typescript
async function performDailySync(): Promise<void> {
  try {
    // 1. Find all connected accounts
    const accounts = await db
      .select({
        storeCode: storeAccounts.storeCode,
        platform: storeAccounts.platform,
        hasValidToken: storeAccounts.hasValidToken,
      })
      .from(storeAccounts)
      .where(
        and(
          eq(storeAccounts.platform, "tiktok"),
          eq(storeAccounts.hasValidToken, true)
        )
      );

    logger.info({ accountCount: accounts.length }, "Found accounts to sync");

    // 2. Sync each account
    for (const account of accounts) {
      await syncAccountWithLock(account.storeCode);
    }

    logger.info("Daily sync job completed successfully");
  } catch (error) {
    logger.error({ error }, "Daily sync job failed");
  }
}
```

**Sequential vs Parallel:**

```typescript
// Sequential (current) - One at a time
for (const account of accounts) {
  await syncAccountWithLock(account.storeCode);
}

// Parallel - All at once
await Promise.all(
  accounts.map((account) => syncAccountWithLock(account.storeCode))
);

// Parallel with concurrency limit - N at a time
const limit = pLimit(3); // Max 3 concurrent
await Promise.all(
  accounts.map((account) => limit(() => syncAccountWithLock(account.storeCode)))
);
```

**Trade-offs:**

| Strategy         | Pros                      | Cons                           |
| ---------------- | ------------------------- | ------------------------------ |
| Sequential       | Simple, predictable, safe | Slow for many accounts         |
| Parallel         | Fast                      | Risk of rate limits, high load |
| Limited Parallel | Balanced speed & safety   | More complex code              |

**Our choice: Sequential**

- Simple to understand
- Sufficient for small-medium scale
- Rate limiting per request still applies
- Can scale later if needed

### 1.4 Account Sync with Lock

```typescript
async function syncAccountWithLock(storeCode: string): Promise<void> {
  const log = storeLogger(storeCode);
  const lockKey = `sync:${storeCode}`;

  // 1. Try acquire lock
  const acquired = await acquireLock(lockKey, 600); // 10 minutes
  if (!acquired) {
    log.info("Sync already in progress, skipping");
    return;
  }

  try {
    log.info("Starting sync");

    // 2. Sync user stats
    await syncService.syncUserDaily(storeCode);

    // 3. Sync video stats
    await syncService.syncVideoDaily(storeCode);

    log.info("Sync completed successfully");
  } catch (error) {
    log.error({ error }, "Sync failed");

    // Don't throw - continue with other accounts
  } finally {
    // 4. Always release lock
    await releaseLock(lockKey);
  }
}
```

**Key patterns:**

1. **Lock acquisition**

   - Prevent concurrent syncs
   - TTL = max expected duration × 2
   - If lock held → skip (not error)

2. **Try-finally**

   - Always release lock
   - Even if error occurs
   - Prevent deadlocks

3. **Error isolation**
   - One account fails → others continue
   - Log error but don't throw
   - Partial success better than total failure

### 1.5 Job Registry - `src/jobs/index.ts`

```typescript
import { startDailySyncJob } from "./syncDaily.job.js";

export function startAllJobs(): void {
  logger.info("Starting all background jobs");

  // Start daily sync job
  startDailySyncJob();

  // Future jobs can be added here:
  // startHourlySyncJob();
  // startCleanupJob();
  // startReportJob();

  logger.info("All background jobs started");
}
```

**Benefits:**

1. **Single entry point** - `startAllJobs()`
2. **Easy to add jobs** - Just import and call
3. **Centralized logging** - See all jobs starting
4. **Testability** - Can start jobs individually

---

## 2. Application Architecture

### 2.1 Application Entry Point - `src/index.ts`

```typescript
import "dotenv/config"; // Load .env FIRST
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { startAllJobs } from "./jobs/index.js";
import logger from "./utils/logger.js";

const port = parseInt(process.env.PORT || "3000");

// Start HTTP server
serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    logger.info(
      { port: info.port, env: process.env.NODE_ENV },
      "Server started"
    );
  }
);

// Start background jobs
startAllJobs();
```

**Execution order:**

```
1. Load .env → Environment variables available
2. Import app.ts → Routes registered
3. Start HTTP server → Ready to accept requests
4. Start background jobs → Cron schedules registered
```

**Why this order?**

1. **dotenv first** - Before any imports that use env vars
2. **Server before jobs** - Health check endpoint available immediately
3. **Jobs last** - Server must be ready for manual sync endpoints

### 2.2 Application Configuration - `src/app.ts`

```typescript
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { cors } from "hono/cors";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import logger from "./utils/logger.js";

const app = new Hono();

// Global middleware
app.use("*", honoLogger());
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Health check
app.get("/", (c) => {
  return c.json({
    status: "ok",
    message: "TikTok Content Reporting Hub API",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.route("/auth", authRoutes);
app.route("/admin", adminRoutes);

// 404 handler
app.notFound((c) => {
  logger.warn({ path: c.req.path }, "Route not found");
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  logger.error({ error: err.message, stack: err.stack }, "Unhandled error");
  return c.json(
    {
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    },
    500
  );
});

export { app };
```

**Middleware order matters:**

```typescript
app.use("*", honoLogger()); // 1. Log all requests
app.use("*", cors()); // 2. Handle CORS
app.get("/", handler); // 3. Route handlers
app.notFound(handler); // 4. 404 for unmatched routes
app.onError(handler); // 5. Global error handler
```

**Request flow:**

```
Request → Logger → CORS → Route handler
                              ↓ (if not found)
                          notFound → 404
                              ↓ (if error)
                          onError → 500
```

### 2.3 Environment-based Configuration

```typescript
// Development
NODE_ENV=development
LOG_LEVEL=debug
FRONTEND_URL=http://localhost:5173

// Production
NODE_ENV=production
LOG_LEVEL=info
FRONTEND_URL=https://app.example.com
```

**Usage in code:**

```typescript
// Logger level
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

// CORS origin
cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
});

// Error details
return c.json({
  error: "Internal Server Error",
  message: process.env.NODE_ENV === "development" ? err.message : undefined,
});
```

**Why separate configs?**

1. **Security** - Don't leak error details in production
2. **Performance** - Less logging in production
3. **Debugging** - More info in development

---

## 3. Graceful Shutdown

### 3.1 Why Graceful Shutdown?

**Without graceful shutdown:**

```
SIGTERM → Process killed immediately
  - In-flight requests → 502 Bad Gateway
  - Database transactions → Rolled back
  - Locks not released → Deadlock
  - Logs not flushed → Lost data
```

**With graceful shutdown:**

```
SIGTERM → Start shutdown
  1. Stop accepting new requests
  2. Wait for in-flight requests to complete
  3. Cancel running jobs
  4. Close database connections
  5. Flush logs
  6. Exit cleanly
```

### 3.2 Implementation

```typescript
// src/index.ts
import { serve } from "@hono/node-server";

const port = parseInt(process.env.PORT || "3000");

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    logger.info({ port: info.port }, "Server started");
  }
);

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutdown signal received");

  try {
    // 1. Stop accepting new connections
    logger.info("Closing HTTP server...");
    server.close(() => {
      logger.info("HTTP server closed");
    });

    // 2. Wait for in-flight requests (with timeout)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 3. Close database connections
    logger.info("Closing database connections...");
    await db.$client.end();
    logger.info("Database connections closed");

    // 4. Flush logs
    await logger.flush();

    logger.info("Shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error({ error }, "Error during shutdown");
    process.exit(1);
  }
};

// Register signal handlers
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

**Signals explained:**

- **SIGTERM** - Graceful termination request

  - From: Kubernetes, Docker, systemd
  - Default: Sent before forceful kill
  - Should: Clean up and exit

- **SIGINT** - Interrupt (Ctrl+C)

  - From: User terminal
  - Should: Same as SIGTERM

- **SIGKILL** - Forceful kill
  - Cannot be caught
  - Process killed immediately
  - Last resort

**Timeout pattern:**

```typescript
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

const timeoutId = setTimeout(() => {
  logger.warn("Shutdown timeout, forcing exit");
  process.exit(1);
}, SHUTDOWN_TIMEOUT);

await performShutdown();

clearTimeout(timeoutId);
process.exit(0);
```

---

## 4. Production Deployment

### 4.1 Environment Setup

**Development:**

```bash
# Local PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/tiktok_hub_dev

# Local OAuth callback
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/callback

# Debug logging
LOG_LEVEL=debug
```

**Production:**

```bash
# Managed database (SSL required)
DATABASE_URL=postgresql://user:pass@prod-db.aws.com:5432/tiktok_hub?ssl=true

# Production domain
TIKTOK_REDIRECT_URI=https://api.example.com/auth/callback

# Production logging
LOG_LEVEL=info
NODE_ENV=production
```

### 4.2 Database Migrations

**Development workflow:**

```bash
# 1. Make schema changes
# Edit src/db/schema.ts

# 2. Generate migration
npm run db:generate

# 3. Review migration
# Check drizzle/migrations/*.sql

# 4. Apply migration
npm run db:migrate
```

**Production workflow:**

```bash
# 1. Test migration on staging
DATABASE_URL=$STAGING_DB npm run db:migrate

# 2. Backup production database
pg_dump $PROD_DB > backup.sql

# 3. Apply migration
DATABASE_URL=$PROD_DB npm run db:migrate

# 4. Verify
psql $PROD_DB -c "\dt"
```

**Migration best practices:**

1. **Always backup** before migration
2. **Test on staging** first
3. **Rollback plan** ready
4. **Zero-downtime** strategies:
   - Add columns as nullable first
   - Remove columns in separate release
   - Use database views for gradual migration

### 4.3 Process Management

**Option 1: PM2 (Node.js process manager)**

```bash
# Install
npm install -g pm2

# Start
pm2 start dist/index.js --name tiktok-hub

# Monitor
pm2 status
pm2 logs tiktok-hub
pm2 monit

# Restart
pm2 restart tiktok-hub

# Stop
pm2 stop tiktok-hub
```

**PM2 ecosystem file - `ecosystem.config.js`:**

```javascript
module.exports = {
  apps: [
    {
      name: "tiktok-hub",
      script: "./dist/index.js",
      instances: 2, // Cluster mode
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      max_memory_restart: "500M",
    },
  ],
};
```

**Option 2: Docker**

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**docker-compose.yml:**

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - TIKTOK_CLIENT_KEY=${TIKTOK_CLIENT_KEY}
      - TIKTOK_CLIENT_SECRET=${TIKTOK_CLIENT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    restart: unless-stopped
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=tiktok_hub
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

**Option 3: Kubernetes**

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiktok-hub
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tiktok-hub
  template:
    metadata:
      labels:
        app: tiktok-hub
    spec:
      containers:
        - name: app
          image: your-registry/tiktok-hub:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: tiktok-hub-secrets
                  key: database-url
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

### 4.4 Monitoring & Observability

**1. Health Checks**

```typescript
// Basic health check
app.get("/health", async (c) => {
  try {
    // Check database connection
    await db.execute(sql`SELECT 1`);

    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    return c.json(
      {
        status: "unhealthy",
        error: error.message,
      },
      503
    );
  }
});

// Detailed health check
app.get("/health/detailed", async (c) => {
  const checks = {
    database: false,
    memory: false,
  };

  // Database
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch (error) {
    logger.error({ error }, "Database health check failed");
  }

  // Memory
  const memUsage = process.memoryUsage();
  checks.memory = memUsage.heapUsed < memUsage.heapTotal * 0.9;

  const allHealthy = Object.values(checks).every((v) => v);

  return c.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      checks,
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + " MB",
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + " MB",
      },
      uptime: Math.round(process.uptime()) + " seconds",
    },
    allHealthy ? 200 : 503
  );
});
```

**2. Metrics**

```typescript
// Prometheus-style metrics
import { Registry, Counter, Histogram } from "prom-client";

const register = new Registry();

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration",
  labelNames: ["method", "route"],
  registers: [register],
});

// Middleware
app.use("*", async (c, next) => {
  const start = Date.now();

  await next();

  const duration = (Date.now() - start) / 1000;
  const route = c.req.routePath;
  const method = c.req.method;
  const status = c.res.status;

  httpRequestsTotal.inc({ method, route, status });
  httpRequestDuration.observe({ method, route }, duration);
});

// Metrics endpoint
app.get("/metrics", async (c) => {
  return c.text(await register.metrics());
});
```

**3. Structured Logging**

```typescript
// Already implemented with Pino
import logger from "./utils/logger.js";

// Request logging
app.use("*", async (c, next) => {
  const start = Date.now();

  await next();

  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration: Date.now() - start,
    },
    "HTTP request"
  );
});

// Error logging with context
try {
  await syncUserDaily(storeCode);
} catch (error) {
  logger.error(
    {
      storeCode,
      error: error.message,
      stack: error.stack,
      context: { userId, videoId },
    },
    "Sync failed"
  );
}
```

**4. Alerting**

Integration dengan external services:

```typescript
// Send alert to Slack/Discord/Email
async function sendAlert(
  severity: "info" | "warning" | "critical",
  message: string,
  details?: Record<string, any>
): Promise<void> {
  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook) return;

  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      severity,
      message,
      details,
      timestamp: new Date().toISOString(),
    }),
  });
}

// Usage
if (failedSyncs > 5) {
  await sendAlert("critical", "Multiple sync failures detected", {
    storeCode,
    failCount: failedSyncs,
  });
}
```

---

## 5. Security Considerations

### 5.1 Environment Variables

**❌ Never commit secrets:**

```typescript
// BAD
const CLIENT_SECRET = "abc123xyz";

// GOOD
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
```

**Store secrets securely:**

1. **Development** - `.env` file (gitignored)
2. **Production** - Secrets manager
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets

### 5.2 Input Validation

```typescript
import { z } from "zod";

// Define schema
const createStoreSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().regex(/^[a-z0-9-]+$/),
});

// Validate input
app.post("/admin/stores", async (c) => {
  try {
    const body = await c.req.json();
    const validated = createStoreSchema.parse(body);

    // Use validated data
    await createStore(validated);

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ errors: error.errors }, 400);
    }
    throw error;
  }
});
```

### 5.3 SQL Injection Prevention

**Drizzle ORM automatically prevents SQL injection:**

```typescript
// ✅ Safe - Parameterized query
await db.select().from(users).where(eq(users.email, userInput));

// ❌ Dangerous - String concatenation
await db.execute(sql`SELECT * FROM users WHERE email = '${userInput}'`);

// ✅ Safe with sql template
await db.execute(sql`SELECT * FROM users WHERE email = ${userInput}`);
```

### 5.4 Rate Limiting

```typescript
import { rateLimiter } from "hono-rate-limiter";

// Global rate limit
app.use(
  "*",
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // 100 requests per window
    standardHeaders: "draft-6",
    keyGenerator: (c) => c.req.header("x-forwarded-for") || "unknown",
  })
);

// Route-specific limit
app.post(
  "/auth/login",
  rateLimiter({
    windowMs: 60 * 1000,
    limit: 5, // 5 login attempts per minute
  }),
  async (c) => {
    // Login logic
  }
);
```

---

## 6. Testing Strategies

### 6.1 Unit Tests

```typescript
// src/utils/crypto.test.ts
import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./crypto.js";

describe("Crypto Utils", () => {
  it("should encrypt and decrypt correctly", () => {
    const plaintext = "secret data";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertext for same input", () => {
    const plaintext = "secret data";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2); // Different IVs
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });
});
```

### 6.2 Integration Tests

```typescript
// src/services/tiktokApi.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { getUserInfo } from "./tiktokApi.service.js";

describe("TikTok API Service", () => {
  let accessToken: string;

  beforeAll(() => {
    accessToken = process.env.TEST_ACCESS_TOKEN!;
  });

  it("should fetch user info", async () => {
    const userInfo = await getUserInfo(accessToken);

    expect(userInfo).toHaveProperty("openId");
    expect(userInfo).toHaveProperty("displayName");
    expect(userInfo.followerCount).toBeGreaterThanOrEqual(0);
  });

  it("should handle invalid token", async () => {
    await expect(getUserInfo("invalid_token")).rejects.toThrow(TikTokApiError);
  });
});
```

### 6.3 E2E Tests

```typescript
// tests/e2e/oauth-flow.test.ts
import { describe, it, expect } from "vitest";
import { app } from "../../src/app.js";

describe("OAuth Flow", () => {
  it("should redirect to TikTok login", async () => {
    const res = await app.request("/auth/login?store_code=test-store");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(
      "https://www.tiktok.com/v2/auth/authorize"
    );
  });

  it("should handle callback", async () => {
    // Mock callback with valid code
    const res = await app.request(
      "/auth/callback?code=test_code&state=test_state"
    );

    expect(res.status).toBe(302);
  });
});
```

---

## 🎓 Kesimpulan Part 5

Anda telah menyelesaikan seluruh learning guide dan memahami:

✅ **Background Jobs**

- Cron scheduling
- Job execution patterns
- Error isolation
- Distributed locking

✅ **Application Architecture**

- Entry point configuration
- Middleware ordering
- Route organization
- Environment-based config

✅ **Production Deployment**

- Process management (PM2, Docker, K8s)
- Database migrations
- Graceful shutdown
- Health checks & monitoring

✅ **Security**

- Secrets management
- Input validation
- SQL injection prevention
- Rate limiting

✅ **Testing**

- Unit tests
- Integration tests
- E2E tests

---

## 🚀 Next Steps

Sekarang Anda sudah memahami seluruh codebase! Berikutnya bisa:

1. **Extend Features**

   - Add more platforms (Instagram, Facebook)
   - Build analytics dashboard
   - Add notification system
   - Implement data export

2. **Optimize Performance**

   - Add Redis caching
   - Implement connection pooling
   - Database query optimization
   - CDN for static assets

3. **Improve Monitoring**

   - Add APM (Application Performance Monitoring)
   - Implement distributed tracing
   - Set up log aggregation
   - Create custom dashboards

4. **Scale Infrastructure**
   - Horizontal scaling (multiple instances)
   - Load balancer configuration
   - Database replication
   - Message queue for async jobs

---

## 📚 Learning Resources

**Official Documentation:**

- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [TikTok for Developers](https://developers.tiktok.com/)
- [PostgreSQL Manual](https://www.postgresql.org/docs/)

**Advanced Topics:**

- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC](https://datatracker.ietf.org/doc/html/rfc7636)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [12-Factor App](https://12factor.net/)

---

## 🎉 Selamat!

Anda telah menyelesaikan 5-part comprehensive learning guide untuk TikTok Content Reporting Hub!

Sekarang Anda memahami:

- ✅ Project setup & configuration
- ✅ Database design & ORM
- ✅ OAuth & security
- ✅ API integration & services
- ✅ Background jobs & production deployment

**Happy coding!** 🚀
