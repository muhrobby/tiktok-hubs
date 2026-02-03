# 🔒 SECURITY AUDIT REPORT - TikTok Content Reporting Hub Backend

**Tanggal Audit:** 24 Januari 2026  
**Auditor:** Security Review Team  
**Framework:** OWASP Top 10 Security Risks  
**Status:** ⚠️ MEMERLUKAN PERBAIKAN

---

## 📋 EXECUTIVE SUMMARY

Backend TikTok Content Reporting Hub telah diaudit berdasarkan OWASP Top 10 Security Risks. Secara keseluruhan, aplikasi memiliki fondasi keamanan yang baik dengan beberapa praktik keamanan yang sudah diimplementasikan. Namun, ada beberapa area **KRITIS** yang memerlukan perbaikan segera sebelum deployment ke production.

### Ringkasan Temuan

| Kategori | Status | Tingkat Risiko |
|----------|--------|----------------|
| SQL Injection Protection | ✅ BAIK | LOW |
| Authentication | ⚠️ MEMADAI | MEDIUM |
| Authorization | ⚠️ PERLU PERBAIKAN | MEDIUM-HIGH |
| Sensitive Data Exposure | ✅ BAIK | LOW |
| Security Misconfiguration | ❌ KRITIS | HIGH |
| CORS & Headers | ⚠️ PERLU PERBAIKAN | MEDIUM |
| Error Handling | ✅ BAIK | LOW |
| Logging | ⚠️ PERLU PERBAIKAN | MEDIUM |
| Rate Limiting | ⚠️ KURANG MEMADAI | MEDIUM |
| Input Validation | ✅ BAIK | LOW |

---

## 🔍 DETAILED FINDINGS

### 1. ✅ A01:2021 - Broken Access Control

**Status:** MEMADAI dengan beberapa perbaikan diperlukan

#### ✅ Yang Sudah Baik:
- Admin routes dilindungi dengan API Key authentication
- Validasi store_code pada setiap request
- Middleware authentication untuk semua `/admin/*` routes

#### ⚠️ Yang Perlu Diperbaiki:

1. **API Key Authentication Terlalu Sederhana**
   - Location: `backend/src/routes/admin.routes.ts:109-134`
   - Issue: Menggunakan simple string comparison tanpa rate limiting khusus untuk failed attempts
   - Risk: Brute force attack terhadap API key
   
2. **Tidak Ada Session Management**
   - Issue: Tidak ada timeout atau expiry untuk API key
   - Risk: Jika API key bocor, akan valid selamanya

3. **Logging Insufficient untuk Security Events**
   - Issue: Failed authentication attempts tidak di-log dengan detail yang cukup
   - Risk: Sulit mendeteksi attempted attacks

#### 🔧 Rekomendasi:

```typescript
// 1. Tambahkan rate limiting untuk failed auth attempts
const authAttempts = new Map<string, { count: number; resetTime: number }>();

admin.use("*", async (c, next) => {
  const apiKey = c.req.header("X-API-KEY");
  const clientIp = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  
  // Check rate limit untuk IP ini
  const attemptKey = `auth:${clientIp}`;
  const attempts = authAttempts.get(attemptKey);
  
  if (attempts && attempts.count >= 5 && Date.now() < attempts.resetTime) {
    logger.warn({ clientIp }, "Too many failed authentication attempts");
    return errorResponse(c, 429, "TOO_MANY_ATTEMPTS", "Too many failed attempts. Try again later.");
  }
  
  const expectedKey = process.env.ADMIN_API_KEY;
  
  if (!apiKey || apiKey !== expectedKey) {
    // Increment failed attempts
    const now = Date.now();
    const resetTime = now + 15 * 60 * 1000; // 15 minutes
    authAttempts.set(attemptKey, {
      count: (attempts?.count || 0) + 1,
      resetTime: attempts?.resetTime || resetTime
    });
    
    logger.warn({ 
      clientIp, 
      hasKey: !!apiKey,
      path: c.req.path,
      attempts: authAttempts.get(attemptKey)?.count 
    }, "Failed authentication attempt");
    
    return errorResponse(c, 401, "UNAUTHORIZED", "Unauthorized: Invalid or missing API key");
  }
  
  // Reset attempts pada successful auth
  authAttempts.delete(attemptKey);
  
  await next();
});

// 2. Tambahkan API key rotation support
// Simpan beberapa valid keys dengan expiry
interface ApiKeyConfig {
  key: string;
  createdAt: Date;
  expiresAt?: Date;
  description?: string;
}

// 3. Tambahkan audit logging
logger.info({
  clientIp,
  path: c.req.path,
  method: c.req.method,
  userAgent: c.req.header("user-agent")
}, "Admin API accessed");
```

---

### 2. ✅ A02:2021 - Cryptographic Failures

**Status:** BAIK

#### ✅ Yang Sudah Baik:
- Menggunakan AES-256-GCM untuk enkripsi token (strong encryption)
- Proper key derivation dari environment variable
- Token selalu terenkripsi sebelum disimpan ke database
- Auth tags untuk integrity verification
- Random IV untuk setiap enkripsi

#### ⚠️ Yang Perlu Diperbaikan:

1. **Key Rotation Tidak Didukung**
   - Location: `backend/src/utils/crypto.ts`
   - Issue: Tidak ada mekanisme untuk rotate encryption key
   - Risk: Jika key compromise, semua data harus di-re-encrypt manual

2. **Database Connection Tidak Enforce SSL**
   - Location: `backend/src/db/client.ts`
   - Issue: DATABASE_URL tidak enforce SSL/TLS connection
   - Risk: Data in transit tidak terenkripsi

#### 🔧 Rekomendasi:

```typescript
// 1. Support multiple encryption keys untuk rotation
// crypto.ts
const KEYS_CONFIG = {
  current: process.env.TOKEN_ENC_KEY,
  previous: process.env.TOKEN_ENC_KEY_OLD, // optional
};

export function encryptWithVersion(plaintext: string): string {
  const version = "v1"; // key version
  const encrypted = encrypt(plaintext);
  return `${version}:${encrypted}`;
}

export function decryptWithVersion(encryptedData: string): string {
  const [version, data] = encryptedData.split(":", 2);
  // Use appropriate key based on version
  return decrypt(data);
}

// 2. Enforce SSL untuk database
// db/client.ts
const connectionString = process.env.DATABASE_URL;
if (process.env.NODE_ENV === "production" && !connectionString?.includes("sslmode=require")) {
  throw new Error("Production database must use SSL connection");
}

const db = drizzle(pool, {
  logger: process.env.DB_LOGGING === "true",
  // For PostgreSQL SSL
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
});
```

---

### 3. ✅ A03:2021 - Injection

**Status:** BAIK

#### ✅ Yang Sudah Baik:
- Menggunakan Drizzle ORM dengan parameterized queries
- Tidak ada raw SQL queries yang ditemukan
- Input validation dengan regex untuk store_code
- Type safety dengan TypeScript

#### ✅ Tidak Ada Issue yang Ditemukan

Penggunaan ORM dan parameterized queries sudah mencegah SQL Injection dengan efektif.

---

### 4. ⚠️ A04:2021 - Insecure Design

**Status:** PERLU PERBAIKAN

#### ⚠️ Yang Perlu Diperbaikan:

1. **Tidak Ada Account Lockout Mechanism**
   - Issue: OAuth callback bisa dipanggil berkali-kali tanpa throttling
   - Risk: Replay attacks atau abuse

2. **Tidak Ada Request ID Tracking**
   - Issue: Sulit untuk trace request flow untuk debugging/security investigation
   - Risk: Sulit investigasi jika ada security incident

3. **CSRF Protection Tidak Ada**
   - Issue: State parameter di OAuth tidak divalidasi dengan session
   - Risk: CSRF attacks pada OAuth flow

#### 🔧 Rekomendasi:

```typescript
// 1. Tambahkan request ID middleware
import { v4 as uuidv4 } from 'uuid';

app.use("*", async (c, next) => {
  const requestId = c.req.header("X-Request-ID") || uuidv4();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  
  logger.info({ requestId, method: c.req.method, path: c.req.path }, "Request received");
  
  await next();
});

// 2. Validasi state parameter lebih ketat dengan HMAC
import { createHmac } from "crypto";

function generateSecureState(storeCode: string): string {
  const timestamp = Date.now();
  const random = randomBytes(16).toString("hex");
  const data = `${storeCode}:${timestamp}:${random}`;
  const hmac = createHmac("sha256", process.env.STATE_SECRET!)
    .update(data)
    .digest("hex");
  return `${data}:${hmac}`;
}

function validateSecureState(state: string): { valid: boolean; storeCode?: string } {
  const parts = state.split(":");
  if (parts.length !== 4) return { valid: false };
  
  const [storeCode, timestamp, random, hmac] = parts;
  const data = `${storeCode}:${timestamp}:${random}`;
  const expectedHmac = createHmac("sha256", process.env.STATE_SECRET!)
    .update(data)
    .digest("hex");
  
  // Check HMAC
  if (hmac !== expectedHmac) return { valid: false };
  
  // Check timestamp (10 minutes expiry)
  const age = Date.now() - parseInt(timestamp);
  if (age > 10 * 60 * 1000) return { valid: false };
  
  return { valid: true, storeCode };
}

// 3. Rate limit OAuth callbacks
const oauthCallbackLimiter = simpleRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 5, // max 5 callbacks per minute per IP
});

auth.get("/auth/tiktok/callback", oauthCallbackLimiter, async (c) => {
  // ... existing code
});
```

---

### 5. ❌ A05:2021 - Security Misconfiguration

**Status:** KRITIS - PERLU PERBAIKAN SEGERA

#### ❌ Critical Issues:

1. **Docker Compose Menggunakan Credentials Default**
   - Location: `backend/docker-compose.yml:10-11`
   - Issue: Password database adalah "postgres" (default)
   - Risk: **CRITICAL** - Anyone can access database jika exposed
   
   ```yaml
   # ❌ JANGAN LAKUKAN INI
   POSTGRES_USER: postgres
   POSTGRES_PASSWORD: postgres  # CRITICAL: Default password!
   ```

2. **Environment File Ter-commit ke Git**
   - Location: File `.env` ada di repository
   - Issue: Sensitive data bisa ter-expose
   - Risk: **CRITICAL** - Credentials bisa bocor

3. **CORS Wildcard di Production**
   - Location: `backend/src/app.ts:70`
   - Issue: `CORS_ORIGIN` default ke `*`
   - Risk: **HIGH** - Any domain bisa akses API

4. **Error Messages Terlalu Verbose**
   - Issue: Stack traces di development mode bisa leak ke production
   - Risk: Information disclosure

5. **Tidak Ada Helmet/Security Headers Lengkap**
   - Issue: Hanya menggunakan basic `secureHeaders()`
   - Risk: Missing important security headers

#### 🔧 Rekomendasi KRITIS:

```bash
# 1. SEGERA ubah docker-compose.yml
# Jangan hardcode credentials!
services:
  postgres:
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?Database password required}
      POSTGRES_DB: ${DB_NAME:-tiktok_hubs}

# 2. Tambahkan .env ke .gitignore (sudah ada) dan HAPUS dari git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

# 3. Generate strong passwords
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```typescript
// 4. Enforce CORS di production
app.use(
  "*",
  cors({
    origin: process.env.NODE_ENV === "production" 
      ? process.env.CORS_ORIGIN?.split(",") || [] 
      : "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-API-KEY"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86400,
    credentials: true,
  })
);

// Validasi CORS_ORIGIN di production
if (process.env.NODE_ENV === "production") {
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*") {
    throw new Error("CORS_ORIGIN must be set to specific domain(s) in production");
  }
}

// 5. Enhanced security headers
import { secureHeaders } from "hono/secure-headers";

app.use("*", secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
  xFrameOptions: "DENY",
  xContentTypeOptions: "nosniff",
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
  },
}));

// 6. Enforce HTTPS di production
if (process.env.NODE_ENV === "production") {
  app.use("*", async (c, next) => {
    if (c.req.header("x-forwarded-proto") !== "https") {
      return c.redirect(`https://${c.req.header("host")}${c.req.path}`, 301);
    }
    await next();
  });
}
```

---

### 6. ⚠️ A06:2021 - Vulnerable and Outdated Components

**Status:** PERLU MONITORING

#### ✅ Yang Sudah Baik:
- Dependencies relatif up-to-date
- Menggunakan TypeScript untuk type safety
- Package manager lockfile ada

#### ⚠️ Rekomendasi:

```bash
# 1. Setup automated dependency scanning
npm install -g npm-check-updates
ncu -u

# 2. Tambahkan di package.json scripts
{
  "scripts": {
    "audit": "npm audit --audit-level=moderate",
    "audit:fix": "npm audit fix",
    "deps:check": "ncu",
    "deps:update": "ncu -u && npm install"
  }
}

# 3. Setup GitHub Dependabot atau Renovate Bot
# Create .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    versioning-strategy: increase
```

---

### 7. ⚠️ A07:2021 - Identification and Authentication Failures

**Status:** PERLU PERBAIKAN

#### ⚠️ Issues:

1. **Tidak Ada Multi-Factor Authentication (MFA)**
   - Issue: Admin API hanya protected dengan single API key
   - Risk: MEDIUM - Jika API key bocor, full access

2. **Tidak Ada Session Expiry**
   - Issue: API key valid selamanya
   - Risk: MEDIUM

3. **OAuth State Parameter Bisa Di-reuse**
   - Location: `backend/src/services/tiktokAuth.service.ts:73-98`
   - Issue: State hanya dihapus setelah use, tapi bisa dicoba multiple times sebelum expiry
   - Risk: Potential replay dalam 10 menit window

#### 🔧 Rekomendasi:

```typescript
// 1. Implementasi JWT untuk admin authentication (more secure than static API key)
import { sign, verify } from "@tsndr/cloudflare-worker-jwt";

interface AdminSession {
  iat: number;
  exp: number;
  jti: string; // unique session ID
}

// Generate JWT instead of using static API key
async function generateAdminToken(expiresIn: number = 3600): Promise<string> {
  const token = await sign({
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    jti: randomBytes(16).toString("hex"),
  }, process.env.JWT_SECRET!);
  
  return token;
}

// Verify JWT
async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const isValid = await verify(token, process.env.JWT_SECRET!);
    if (!isValid) return null;
    
    const { payload } = decode(token);
    return payload as AdminSession;
  } catch {
    return null;
  }
}

// 2. Track used OAuth states untuk prevent replay
const usedOAuthStates = new Set<string>();

async function validateAndConsumeState(state: string): Promise<boolean> {
  if (usedOAuthStates.has(state)) {
    logger.warn({ state }, "OAuth state reuse attempt detected");
    return false;
  }
  
  // Validate state exists in DB
  const valid = await retrieveCodeVerifier(state);
  if (!valid) return false;
  
  // Mark as used
  usedOAuthStates.add(state);
  
  // Clean up old states after 10 minutes
  setTimeout(() => {
    usedOAuthStates.delete(state);
  }, 10 * 60 * 1000);
  
  return true;
}
```

---

### 8. ✅ A08:2021 - Software and Data Integrity Failures

**Status:** BAIK

#### ✅ Yang Sudah Baik:
- Menggunakan package-lock.json untuk dependency integrity
- Environment validation saat startup
- Encryption integrity checks dengan GCM auth tags

#### ⚠️ Rekomendasi Minor:

```typescript
// Tambahkan integrity checks untuk critical operations
import { createHash } from "crypto";

function generateIntegrityHash(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

// Example: Verify data integrity before critical operations
async function storeWithIntegrity(data: any) {
  const dataString = JSON.stringify(data);
  const hash = generateIntegrityHash(dataString);
  
  await db.insert(someTable).values({
    data: dataString,
    integrity_hash: hash,
  });
}
```

---

### 9. ⚠️ A09:2021 - Security Logging and Monitoring Failures

**Status:** PERLU PERBAIKAN

#### ✅ Yang Sudah Baik:
- Menggunakan Pino untuk structured logging
- Token redaction di logger
- Child loggers untuk context

#### ⚠️ Issues:

1. **Tidak Ada Centralized Logging**
   - Issue: Logs hanya ke console/file
   - Risk: Sulit monitor di production

2. **Tidak Ada Alerting**
   - Issue: Tidak ada alerting untuk security events
   - Risk: Security incidents tidak terdeteksi

3. **Logs Tidak Ter-index**
   - Issue: Sulit search dan analyze logs
   - Risk: Slow incident response

#### 🔧 Rekomendasi:

```typescript
// 1. Setup logging ke external service (e.g., Datadog, Sentry, CloudWatch)
import pino from "pino";

const logger = pino({
  level: logLevel,
  transport: process.env.NODE_ENV === "production" ? {
    target: "pino-datadog",
    options: {
      apiKey: process.env.DATADOG_API_KEY,
      service: "tiktok-hubs-backend",
      hostname: process.env.HOSTNAME || "unknown",
    },
  } : {
    target: "pino-pretty",
    options: { colorize: true },
  },
});

// 2. Log security events dengan severity
const SecurityLogger = {
  authFailure: (details: any) => {
    logger.error({ 
      type: "security.auth.failure", 
      severity: "high",
      ...details 
    }, "Authentication failure");
  },
  
  suspiciousActivity: (details: any) => {
    logger.warn({ 
      type: "security.suspicious", 
      severity: "medium",
      ...details 
    }, "Suspicious activity detected");
  },
  
  dataAccess: (details: any) => {
    logger.info({ 
      type: "security.data.access", 
      ...details 
    }, "Sensitive data accessed");
  },
};

// 3. Setup monitoring alerts
// Example: Alert if too many failed auth attempts
let failedAuthCount = 0;
const ALERT_THRESHOLD = 10;

function checkAndAlert() {
  if (failedAuthCount >= ALERT_THRESHOLD) {
    // Send alert to Slack/PagerDuty/Email
    sendAlert({
      severity: "high",
      message: `Too many failed auth attempts: ${failedAuthCount}`,
      timestamp: new Date().toISOString(),
    });
    failedAuthCount = 0;
  }
}

// 4. Tambahkan audit log table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  actor: varchar("actor", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 255 }),
  resourceId: varchar("resource_id", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  success: boolean("success").notNull(),
  details: jsonb("details"),
});
```

---

### 10. ⚠️ A10:2021 - Server-Side Request Forgery (SSRF)

**Status:** PERLU VALIDASI

#### ⚠️ Potential Issues:

1. **External API Calls Tidak Divalidasi**
   - Location: `backend/src/services/tiktokApi.service.ts`
   - Issue: Fetch ke TikTok API hardcoded, tapi bisa di-intercept
   - Risk: LOW (karena endpoint fixed)

#### 🔧 Rekomendasi:

```typescript
// Whitelist allowed external domains
const ALLOWED_EXTERNAL_DOMAINS = [
  "open.tiktokapis.com",
  "www.tiktok.com",
];

function validateExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    
    // Check whitelist
    if (!ALLOWED_EXTERNAL_DOMAINS.includes(hostname)) {
      logger.warn({ hostname, url }, "Attempt to access non-whitelisted domain");
      return false;
    }
    
    // Prevent localhost/private IPs
    if (hostname === "localhost" || 
        hostname === "127.0.0.1" ||
        hostname.startsWith("10.") ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("172.")) {
      logger.warn({ hostname }, "Attempt to access private IP");
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// Use before any external fetch
async function safeFetch(url: string, options?: RequestInit) {
  if (!validateExternalUrl(url)) {
    throw new Error("External URL not allowed");
  }
  return fetch(url, options);
}
```

---

## 🚨 CRITICAL ACTIONS REQUIRED

### Sebelum Deploy ke Production:

1. ❌ **HAPUS .env dari Git History** (CRITICAL)
2. ❌ **Ubah Database Password di docker-compose.yml** (CRITICAL)
3. ❌ **Set CORS_ORIGIN ke Domain Spesifik** (HIGH)
4. ⚠️ **Implement Rate Limiting untuk Auth** (HIGH)
5. ⚠️ **Setup Logging ke External Service** (MEDIUM)
6. ⚠️ **Add Security Monitoring & Alerts** (MEDIUM)

### Script untuk Quick Fix:

```bash
#!/bin/bash
# quick-security-fixes.sh

echo "🔒 Running Security Quick Fixes..."

# 1. Remove .env from git history
echo "Removing .env from git history..."
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

# 2. Generate new secrets
echo "Generating new secrets..."
echo "TOKEN_ENC_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
echo "ADMIN_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
echo "DB_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"

# 3. Check for vulnerable dependencies
echo "Checking dependencies..."
cd backend && npm audit --audit-level=high

echo "✅ Quick fixes completed. Please update .env with new secrets!"
```

---

## 📊 SECURITY SCORE

**Overall Security Score: 6.5/10** ⚠️

- ✅ Strong Points: Encryption, SQL Injection Protection, Input Validation
- ❌ Weak Points: Secrets Management, CORS Configuration, Rate Limiting
- ⚠️ Areas Needing Improvement: Authentication, Monitoring, Security Headers

---

## 📝 NEXT STEPS

1. Implement semua **CRITICAL** fixes dalam 1-2 hari
2. Implement **HIGH** priority fixes dalam 1 minggu
3. Setup automated security scanning (Dependabot, SAST)
4. Conduct penetration testing sebelum production launch
5. Create incident response plan
6. Setup security monitoring dashboard

---

## 📚 REFERENCES

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Hono Security](https://hono.dev/docs/guides/middleware)

---

**Report Generated:** 24 Januari 2026  
**Valid Until:** 24 April 2026 (Re-audit recommended every 3 months)
