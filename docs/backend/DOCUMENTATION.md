# 📘 TikTok Content Reporting Hub - Backend Documentation

**Version:** 1.0.0  
**Last Updated:** 24 Januari 2026  
**Maintainer:** Development Team

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Getting Started](#getting-started)
5. [Environment Configuration](#environment-configuration)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Authentication & Authorization](#authentication--authorization)
9. [Background Jobs](#background-jobs)
10. [Security](#security)
11. [Error Handling](#error-handling)
12. [Logging](#logging)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

TikTok Content Reporting Hub Backend adalah REST API yang dibangun untuk mengkonsolidasikan dan mengelola laporan performa konten TikTok dari berbagai store/akun. Backend ini menangani OAuth authentication dengan TikTok, sinkronisasi data otomatis, dan menyediakan API untuk frontend.

### Key Features

- 🔐 **OAuth 2.0 Integration** dengan TikTok Login Kit (PKCE flow)
- 🔄 **Automated Daily Sync** untuk user stats dan video performance
- 🔒 **Encrypted Token Storage** menggunakan AES-256-GCM
- 📊 **Historical Data Tracking** untuk analytics dan reporting
- 🛡️ **API Key Authentication** untuk admin endpoints
- 📝 **Structured Logging** dengan Pino
- ⏰ **Scheduled Jobs** dengan node-cron

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Frontend      │
│   (Nuxt 4)      │
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────┐
│   Backend API   │
│   (Hono)        │
├─────────────────┤
│ • Auth Routes   │
│ • Admin Routes  │
│ • Middleware    │
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    ↓         ↓          ↓
┌─────────┐ ┌──────┐ ┌──────────┐
│TikTok   │ │ Jobs │ │PostgreSQL│
│ API     │ │Cron  │ │ Database │
└─────────┘ └──────┘ └──────────┘
```

### Directory Structure

```
backend/
├── src/
│   ├── app.ts                 # Hono app setup & middleware
│   ├── index.ts               # Entry point & server startup
│   ├── db/
│   │   ├── client.ts          # Database connection
│   │   ├── schema.ts          # Drizzle ORM schema
│   │   └── migrations/        # Database migrations
│   ├── routes/
│   │   ├── auth.routes.ts     # OAuth & connection routes
│   │   └── admin.routes.ts    # Admin API routes
│   ├── services/
│   │   ├── tiktokAuth.service.ts    # TikTok OAuth logic
│   │   ├── tiktokApi.service.ts     # TikTok API calls
│   │   ├── token.service.ts         # Token management
│   │   └── sync.service.ts          # Data sync logic
│   ├── jobs/
│   │   ├── scheduler.ts             # Cron job scheduler
│   │   ├── refreshTokens.job.ts     # Token refresh job
│   │   ├── syncUserDaily.job.ts     # User stats sync
│   │   └── syncVideoDaily.job.ts    # Video stats sync
│   └── utils/
│       ├── crypto.ts          # Encryption utilities
│       ├── logger.ts          # Logging setup
│       ├── http.ts            # HTTP helpers
│       ├── locks.ts           # Distributed locking
│       └── backoff.ts         # Retry logic
├── tests/
│   └── integration/           # Integration tests
├── dist/                      # Compiled output
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── vitest.config.ts
└── docker-compose.yml
```

---

## 🛠️ Tech Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | ≥20.0.0 | Runtime environment |
| **TypeScript** | 5.8.3 | Type-safe development |
| **Hono** | 4.11.3 | Fast web framework |
| **PostgreSQL** | 16+ | Relational database |
| **Drizzle ORM** | 0.36.4 | Type-safe database access |

### Key Libraries

- **@hono/node-server**: Node.js adapter untuk Hono
- **node-cron**: Job scheduling
- **pino**: High-performance logging
- **dotenv**: Environment management
- **vitest**: Testing framework

### Security

- **AES-256-GCM**: Token encryption
- **PKCE**: OAuth 2.0 security
- **Secure Headers**: XSS, CSRF protection
- **Rate Limiting**: DDoS protection

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥20.0.0
- PostgreSQL 16+
- npm atau pnpm
- TikTok Developer Account

### Installation

```bash
# 1. Clone repository
git clone <repository-url>
cd tiktok-hubs/backend

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env dengan credentials Anda

# 4. Start PostgreSQL (via Docker)
docker-compose up -d postgres

# 5. Run database migrations
npm run db:push

# 6. Start development server
npm run dev
```

Server akan berjalan di `http://localhost:3000`

### Verification

```bash
# Check health endpoint
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "encryption": "ok",
    "scheduler": "enabled"
  }
}
```

---

## ⚙️ Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `TIKTOK_CLIENT_KEY` | TikTok app client key | From TikTok Developer Portal |
| `TIKTOK_CLIENT_SECRET` | TikTok app client secret | From TikTok Developer Portal |
| `TIKTOK_REDIRECT_URI` | OAuth callback URL | `http://localhost:3000/auth/tiktok/callback` |
| `TOKEN_ENC_KEY` | 32-byte encryption key (hex) | Generate: `openssl rand -hex 32` |
| `ADMIN_API_KEY` | API key for admin endpoints | Generate: `openssl rand -base64 32` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `NODE_ENV` | development | Environment mode |
| `LOG_LEVEL` | info | Logging level (trace, debug, info, warn, error) |
| `CORS_ORIGIN` | * | Allowed CORS origins |
| `CRON_ENABLED` | true | Enable/disable scheduled jobs |
| `DB_LOGGING` | false | Enable SQL query logging |

### Environment Setup

```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug
CRON_ENABLED=true

# Production
NODE_ENV=production
LOG_LEVEL=warn
CRON_ENABLED=true
CORS_ORIGIN=https://yourdomain.com
```

### Generating Secrets

```bash
# Generate encryption key (64 hex characters = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate API key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🗄️ Database Schema

### Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────────┐
│   stores    │────────○│ store_accounts   │
│             │ 1     1 │                  │
│ store_code  │         │ access_token_enc │
│ store_name  │         │ refresh_token_enc│
│ pic_name    │         │ status           │
└──────┬──────┘         └──────────────────┘
       │
       │ 1
       │
       │ *
┌──────┴──────────────┐  ┌─────────────────────┐
│ tiktok_user_daily   │  │ tiktok_video_daily  │
│                     │  │                     │
│ snapshot_date       │  │ video_id            │
│ follower_count      │  │ snapshot_date       │
│ following_count     │  │ view_count          │
│ likes_count         │  │ like_count          │
│ video_count         │  │ comment_count       │
└─────────────────────┘  └─────────────────────┘
```

### Tables

#### `stores`
Store/akun yang dikelola oleh sistem.

| Column | Type | Description |
|--------|------|-------------|
| store_code | VARCHAR(50) PK | Unique identifier untuk store |
| store_name | VARCHAR(255) | Nama store |
| pic_name | VARCHAR(255) | Nama person in charge |
| pic_contact | VARCHAR(255) | Kontak PIC (optional) |
| created_at | TIMESTAMP | Waktu pembuatan |

#### `store_accounts`
Token dan status koneksi TikTok per store.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment ID |
| store_code | VARCHAR(50) FK | Reference ke stores |
| open_id | VARCHAR(255) | TikTok user identifier |
| access_token_enc | TEXT | Encrypted access token |
| refresh_token_enc | TEXT | Encrypted refresh token |
| token_expired_at | TIMESTAMP | Access token expiry |
| refresh_token_expired_at | TIMESTAMP | Refresh token expiry |
| status | ENUM | CONNECTED, NEED_RECONNECT, ERROR, DISABLED |
| last_sync_time | TIMESTAMP | Last successful sync |
| connected_at | TIMESTAMP | Initial connection time |
| updated_at | TIMESTAMP | Last update time |

**Indexes:**
- Unique: `store_code` (one account per store)
- Index: `status`

#### `tiktok_user_daily`
Daily snapshot statistik akun TikTok.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment ID |
| store_code | VARCHAR(50) FK | Reference ke stores |
| snapshot_date | DATE | Tanggal snapshot |
| follower_count | INTEGER | Jumlah followers |
| following_count | INTEGER | Jumlah following |
| likes_count | INTEGER | Total likes |
| video_count | INTEGER | Total videos |
| display_name | VARCHAR(255) | Display name |
| avatar_url | TEXT | Avatar URL |
| created_at | TIMESTAMP | Record creation time |

**Indexes:**
- Unique: `(store_code, snapshot_date)` (one record per day per store)
- Index: `store_code`, `snapshot_date`

#### `tiktok_video_daily`
Daily snapshot statistik video TikTok.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment ID |
| store_code | VARCHAR(50) FK | Reference ke stores |
| video_id | VARCHAR(100) | TikTok video ID |
| snapshot_date | DATE | Tanggal snapshot |
| view_count | BIGINT | Jumlah views |
| like_count | BIGINT | Jumlah likes |
| comment_count | BIGINT | Jumlah comments |
| share_count | BIGINT | Jumlah shares |
| create_time | TIMESTAMP | Video creation time |
| description | TEXT | Video description |
| cover_image_url | TEXT | Cover image URL |
| share_url | TEXT | Share URL |
| created_at | TIMESTAMP | Record creation time |

**Indexes:**
- Unique: `(store_code, video_id, snapshot_date)`
- Index: `store_code`, `video_id`, `snapshot_date`

#### `sync_logs`
Log sinkronisasi untuk audit dan debugging.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment ID |
| store_code | VARCHAR(50) FK | Reference ke stores (nullable) |
| job_name | VARCHAR(100) | Nama job |
| run_time | TIMESTAMP | Waktu eksekusi |
| status | ENUM | SUCCESS, FAILED, SKIPPED, RUNNING |
| message | TEXT | Log message |
| raw_error | TEXT | Error details (if failed) |
| duration_ms | INTEGER | Execution duration |

**Indexes:**
- Index: `store_code`, `job_name`, `run_time`

#### `sync_locks`
Advisory locks untuk mencegah concurrent sync.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment ID |
| lock_key | VARCHAR(100) UNIQUE | Lock identifier |
| locked_by | VARCHAR(255) | Lock holder identifier |
| locked_at | TIMESTAMP | Lock acquisition time |
| expires_at | TIMESTAMP | Lock expiry time |

**Indexes:**
- Unique: `lock_key`
- Index: `lock_key`, `expires_at`

#### `oauth_state`
Temporary storage untuk OAuth PKCE flow.

| Column | Type | Description |
|--------|------|-------------|
| state | VARCHAR(100) PK | OAuth state parameter |
| code_verifier | TEXT | PKCE code verifier |
| store_code | VARCHAR(50) | Associated store |
| created_at | TIMESTAMP | Creation time |
| expires_at | TIMESTAMP | Expiry time (10 minutes) |

### Database Migrations

```bash
# Generate migration
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (development)
npm run db:push

# Open Drizzle Studio (GUI)
npm run db:studio
```

---

## 🔌 API Endpoints

### Base URL
- Development: `http://localhost:3000`
- Production: `https://api.yourdomain.com`

### Public Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-24T10:30:00.000Z",
  "uptime": 123.456,
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "encryption": "ok",
    "scheduler": "enabled"
  },
  "responseTime": 5
}
```

#### Root Info
```http
GET /
```

**Response:**
```json
{
  "name": "TikTok Content Reporting Hub",
  "version": "1.0.0",
  "endpoints": {
    "health": "GET /health",
    "connect": "GET /connect/tiktok?store_code=xxx",
    "admin": { ... }
  }
}
```

---

### OAuth Flow Endpoints

#### 1. Initiate TikTok Connection
```http
GET /connect/tiktok?store_code={store_code}
```

Redirect user ke TikTok OAuth authorization page.

**Query Parameters:**
- `store_code` (required): Store identifier (alphanumeric, underscore, hyphen, 1-50 chars)

**Responses:**
- `302`: Redirect ke TikTok OAuth page
- `400`: Invalid store_code
- `404`: Store not found

**Example:**
```bash
curl -L "http://localhost:3000/connect/tiktok?store_code=store_001"
```

#### 2. OAuth Callback
```http
GET /auth/tiktok/callback?code={code}&state={state}
```

Internal endpoint yang dipanggil oleh TikTok setelah user authorize.

**Query Parameters:**
- `code`: Authorization code dari TikTok
- `state`: State parameter untuk CSRF protection

**Responses:**
- `200`: HTML success page
- `400`: Invalid parameters atau state
- `500`: OAuth flow failed

#### 3. Get OAuth URL (Copy Link Feature)
```http
GET /auth/url?store_code={store_code}
```

Mendapatkan OAuth URL tanpa redirect (untuk copy link).

**Response:**
```json
{
  "success": true,
  "authUrl": "https://www.tiktok.com/v2/auth/authorize/..."
}
```

---

### Admin Endpoints

**Authentication:** All admin endpoints require `X-API-KEY` header.

```bash
curl -H "X-API-KEY: your_admin_api_key" \
  http://localhost:3000/admin/stores
```

#### List Stores
```http
GET /admin/stores
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "storeCode": "store_001",
      "storeName": "Main Store",
      "picName": "John Doe",
      "picContact": "john@example.com",
      "status": "CONNECTED",
      "lastSyncTime": "2024-01-24T10:00:00Z",
      "latestStats": {
        "followerCount": 10000,
        "videoCount": 50,
        "totalViews": 1000000
      }
    }
  ],
  "count": 1
}
```

#### Create Store
```http
POST /admin/stores
Content-Type: application/json

{
  "store_code": "store_002",
  "store_name": "Branch Store",
  "pic_name": "Jane Smith",
  "pic_contact": "jane@example.com"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "storeCode": "store_002",
    "storeName": "Branch Store",
    "picName": "Jane Smith",
    "picContact": "jane@example.com",
    "createdAt": "2024-01-24T10:30:00Z"
  },
  "message": "Store created successfully",
  "next_step": "Connect TikTok account at: GET /connect/tiktok?store_code=store_002"
}
```

**Errors:**
- `409`: Store already exists

#### Get Single Store
```http
GET /admin/stores/{store_code}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "storeCode": "store_001",
    "storeName": "Main Store",
    ...
  }
}
```

#### Get Store Accounts
```http
GET /admin/stores/{store_code}/accounts
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "store_001",
      "platform": "tiktok",
      "hasValidToken": true,
      "accountIdentifier": "tiktok_open_id_xxx",
      "lastSyncAt": "2024-01-24T10:00:00Z",
      "createdAt": "2024-01-20T08:00:00Z"
    }
  ],
  "count": 1
}
```

#### Get User Stats History
```http
GET /admin/stores/{store_code}/user-stats?days=30
```

**Query Parameters:**
- `days` (optional): Number of days (default: 30, max: 365)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "snapshotDate": "2024-01-24",
      "followerCount": 10000,
      "followingCount": 500,
      "likesCount": 50000,
      "videoCount": 50,
      "displayName": "My TikTok",
      "avatarUrl": "https://..."
    }
  ],
  "count": 30
}
```

#### Get Video Stats History
```http
GET /admin/stores/{store_code}/video-stats?days=30
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "videoId": "7123456789",
      "snapshotDate": "2024-01-24",
      "viewCount": 10000,
      "likeCount": 500,
      "commentCount": 50,
      "shareCount": 20,
      "description": "Video description",
      "coverImageUrl": "https://...",
      "shareUrl": "https://www.tiktok.com/@user/video/7123456789"
    }
  ],
  "count": 50
}
```

#### Get Sync Logs
```http
GET /admin/stores/{store_code}/sync-logs?limit=50
```

atau untuk semua stores:

```http
GET /admin/sync/logs?limit=100
```

**Query Parameters:**
- `limit` (optional): Max records (default: 50, max: 500)
- `store_code` (optional): Filter by store

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "storeCode": "store_001",
      "jobName": "sync_user_daily",
      "runTime": "2024-01-24T10:00:00Z",
      "status": "SUCCESS",
      "message": "Synced user stats successfully",
      "durationMs": 1234
    }
  ],
  "count": 50
}
```

#### Trigger Manual Sync
```http
POST /admin/sync/run
Content-Type: application/json

{
  "store_code": "store_001",  // optional, sync single store
  "job": "all"                 // all, user, video, refresh_tokens
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "userSync": {
      "followerCount": 10000,
      "videoCount": 50
    },
    "videoSync": {
      "videosProcessed": 50
    }
  }
}
```

**Job Types:**
- `all`: Run all sync jobs (default)
- `user`: Sync user stats only
- `video`: Sync video stats only
- `refresh_tokens`: Refresh access tokens only

#### Get Scheduler Status
```http
GET /admin/sync/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "jobs": {
      "refresh_tokens": {
        "schedule": "30 1 * * *",
        "nextRun": "2024-01-25T01:30:00Z",
        "lastRun": "2024-01-24T01:30:00Z"
      },
      "sync_user_daily": {
        "schedule": "0 2 * * *",
        "nextRun": "2024-01-25T02:00:00Z"
      },
      "sync_video_daily": {
        "schedule": "30 2 * * *",
        "nextRun": "2024-01-25T02:30:00Z"
      }
    }
  }
}
```

---

### Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}  // optional
  },
  "timestamp": "2024-01-24T10:30:00.000Z"
}
```

**Common Error Codes:**

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_REQUEST` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `NOT_FOUND` | 404 | Resource not found |
| `STORE_NOT_FOUND` | 404 | Store does not exist |
| `STORE_EXISTS` | 409 | Store already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `OAUTH_ERROR` | 400 | OAuth flow failed |

---

## 🔐 Authentication & Authorization

### OAuth 2.0 Flow (TikTok Login Kit)

Backend mengimplementasikan **Authorization Code Flow with PKCE** untuk keamanan maksimal.

#### Flow Diagram

```
User          Frontend       Backend           TikTok
 │               │              │                │
 │  1. Connect   │              │                │
 │──────────────>│              │                │
 │               │              │                │
 │               │  2. GET /connect/tiktok      │
 │               │──────────────>│               │
 │               │              │               │
 │               │  3. Generate │               │
 │               │     PKCE     │               │
 │               │     params   │               │
 │               │              │               │
 │  4. Redirect to TikTok OAuth │               │
 │<──────────────────────────────────────────────│
 │               │              │               │
 │  5. Authorize │              │               │
 │──────────────────────────────────────────────>│
 │               │              │               │
 │  6. Callback with code       │               │
 │──────────────────────────────>│               │
 │               │              │               │
 │               │  7. Exchange │               │
 │               │     code +   │               │
 │               │     verifier │               │
 │               │              │──────────────>│
 │               │              │               │
 │               │              │  8. Tokens   │
 │               │              │<──────────────│
 │               │              │               │
 │               │  9. Encrypt  │               │
 │               │     & Store  │               │
 │               │              │               │
 │  10. Success  │              │               │
 │<──────────────────────────────│               │
```

#### PKCE Implementation

**backend/src/services/tiktokAuth.service.ts:31-49**

```typescript
// Generate code_verifier (random 43-128 chars)
function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Generate code_challenge = SHA256(code_verifier)
function generateCodeChallenge(codeVerifier: string): string {
  return createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
```

#### State Parameter

State parameter digunakan untuk:
1. **CSRF Protection**: Mencegah cross-site request forgery
2. **Store Association**: Menyimpan store_code
3. **Session Binding**: Mengikat request dengan session

Format: `{store_code}_{random_16_bytes}`

#### Token Storage

Semua tokens (access & refresh) disimpan terenkripsi menggunakan AES-256-GCM:

**backend/src/utils/crypto.ts:48-67**

```typescript
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey(); // 32 bytes
  const iv = randomBytes(16);     // Random IV
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag(); // Integrity check
  
  // Combine: iv + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  return combined.toString("base64");
}
```

### Admin API Authentication

Admin endpoints protected dengan API Key authentication.

**backend/src/routes/admin.routes.ts:109-134**

```typescript
admin.use("*", async (c, next) => {
  const apiKey = c.req.header("X-API-KEY");
  const expectedKey = process.env.ADMIN_API_KEY;
  
  if (!apiKey || apiKey !== expectedKey) {
    return errorResponse(c, 401, "UNAUTHORIZED", "Invalid API key");
  }
  
  await next();
});
```

**Usage:**

```bash
curl -H "X-API-KEY: your_api_key_here" \
  http://localhost:3000/admin/stores
```

---

## ⏰ Background Jobs

Backend menjalankan scheduled jobs menggunakan node-cron untuk automated data sync.

### Job Scheduler

**backend/src/jobs/scheduler.ts**

Jobs berjalan pada timezone UTC (atau sesuai `TZ` env var).

| Job | Schedule (Cron) | Default Time | Description |
|-----|-----------------|--------------|-------------|
| `refreshTokens` | `30 1 * * *` | 01:30 UTC | Refresh expiring tokens (< 24h) |
| `syncUserDaily` | `0 2 * * *` | 02:00 UTC | Sync user stats (followers, likes, etc.) |
| `syncVideoDaily` | `30 2 * * *` | 02:30 UTC | Sync video performance stats |

### Cron Format

```
┌────────────── minute (0 - 59)
│ ┌──────────── hour (0 - 23)
│ │ ┌────────── day of month (1 - 31)
│ │ │ ┌──────── month (1 - 12)
│ │ │ │ ┌────── day of week (0 - 6) (Sunday=0)
│ │ │ │ │
* * * * *
```

### Job: Refresh Tokens

**Purpose:** Proactively refresh access tokens sebelum expired.

**Logic:**
```typescript
// backend/src/jobs/refreshTokens.job.ts
export async function refreshTokensJob() {
  // 1. Get accounts dengan token expiring dalam 24 jam
  const accounts = await tokenService.getAccountsNeedingRefresh(24);
  
  // 2. Refresh each account
  for (const account of accounts) {
    try {
      await tokenService.refreshStoreToken(account.storeCode);
      logger.info({ storeCode: account.storeCode }, "Token refreshed");
    } catch (error) {
      logger.error({ error, storeCode: account.storeCode }, "Token refresh failed");
    }
  }
}
```

### Job: Sync User Stats

**Purpose:** Daily snapshot statistik user (followers, likes, video count).

**Logic:**
```typescript
// backend/src/jobs/syncUserDaily.job.ts
export async function syncUserDailyJob() {
  const stores = await tokenService.getConnectedAccounts();
  
  for (const store of stores) {
    try {
      await syncService.syncUserStatsWithLock(store.storeCode);
    } catch (error) {
      logger.error({ error, storeCode: store.storeCode }, "User sync failed");
    }
  }
}
```

### Job: Sync Video Stats

**Purpose:** Daily snapshot performance video (views, likes, comments).

**Logic:**
```typescript
// backend/src/jobs/syncVideoDaily.job.ts
export async function syncVideoDailyJob() {
  const stores = await tokenService.getConnectedAccounts();
  
  for (const store of stores) {
    try {
      await syncService.syncVideoStatsWithLock(store.storeCode);
    } catch (error) {
      logger.error({ error, storeCode: store.storeCode }, "Video sync failed");
    }
  }
}
```

### Distributed Locking

Jobs menggunakan database-based locking untuk prevent concurrent execution.

**backend/src/utils/locks.ts**

```typescript
// Acquire lock sebelum sync
const lock = await acquireLock(`sync:user:${storeCode}`, 5 * 60); // 5 min timeout

if (!lock) {
  logger.warn("Failed to acquire lock, sync already running");
  return;
}

try {
  // Do sync work...
} finally {
  await releaseLock(lock.lockKey);
}
```

### Disabling Jobs

```bash
# .env
CRON_ENABLED=false
```

### Custom Schedules

```bash
# .env
CRON_REFRESH_TOKENS=0 */6 * * *  # Every 6 hours
CRON_SYNC_USER_DAILY=0 3 * * *   # 3:00 AM daily
CRON_SYNC_VIDEO_DAILY=0 4 * * *  # 4:00 AM daily
```

---

## 🛡️ Security

### Security Measures Implemented

#### 1. Token Encryption (AES-256-GCM)
- All OAuth tokens encrypted at rest
- Random IV per encryption
- Authentication tags untuk integrity
- Key stored securely in environment

#### 2. PKCE Flow (OAuth 2.0)
- Prevents authorization code interception
- Code verifier stored securely in database
- State parameter untuk CSRF protection
- One-time use code verifiers

#### 3. Secure Headers
- XSS protection headers
- Content Security Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

#### 4. Rate Limiting
- Admin routes: 100 req/min
- OAuth endpoints: Limited per IP
- Prevents brute force attacks

#### 5. Input Validation
- Regex validation for store codes
- Type validation dengan TypeScript
- Request body validation
- SQL injection prevention via ORM

#### 6. Logging & Monitoring
- Structured logging dengan Pino
- Automatic token redaction
- Security event logging
- Request/response tracking

#### 7. Error Handling
- No stack traces in production
- Generic error messages for external users
- Detailed logs for debugging
- Error code standardization

### Security Best Practices

#### Environment Variables
```bash
# ✅ DO
TOKEN_ENC_KEY=$(openssl rand -hex 32)
ADMIN_API_KEY=$(openssl rand -base64 32)

# ❌ DON'T
TOKEN_ENC_KEY=mysecretkey123  # Too weak!
```

#### Database Passwords
```bash
# ✅ DO
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# ❌ DON'T
POSTGRES_PASSWORD=postgres  # Default password!
```

#### CORS Configuration
```bash
# ✅ DO (Production)
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# ❌ DON'T (Production)
CORS_ORIGIN=*  # Allows any domain!
```

#### HTTPS Enforcement
```typescript
// ✅ DO (Production)
if (process.env.NODE_ENV === "production") {
  app.use("*", async (c, next) => {
    if (c.req.header("x-forwarded-proto") !== "https") {
      return c.redirect(`https://${c.req.header("host")}${c.req.path}`, 301);
    }
    await next();
  });
}
```

### Security Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Generate strong encryption keys
- [ ] Set specific CORS origins
- [ ] Enable HTTPS
- [ ] Review and rotate API keys
- [ ] Setup logging to external service
- [ ] Configure alerting for security events
- [ ] Run security audit (`npm audit`)
- [ ] Review OWASP Top 10 compliance
- [ ] Test authentication flows
- [ ] Verify token encryption
- [ ] Check rate limiting effectiveness
- [ ] Remove `.env` from git history
- [ ] Setup database backups
- [ ] Configure firewall rules

---

## ⚠️ Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "details": {}  // Optional additional info
  },
  "timestamp": "2024-01-24T10:30:00.000Z"
}
```

### Error Handling Middleware

**backend/src/app.ts:99-116**

```typescript
// Global error handler
app.onError((err, c) => {
  logger.error({ error: err.message, stack: err.stack }, "Unhandled error");
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === "development" 
    ? err.message 
    : "Internal server error";
  
  return errorResponse(c, 500, "INTERNAL_ERROR", message);
});

// 404 handler
app.notFound((c) => {
  return errorResponse(c, 404, "NOT_FOUND", "Not found", {
    path: c.req.path,
  });
});
```

### Error Utility

**backend/src/utils/http.ts**

```typescript
export function errorResponse(
  c: Context,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return c.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
    },
    status
  );
}
```

### Try-Catch Pattern

```typescript
try {
  // Operation that might fail
  const result = await riskyOperation();
  return c.json({ success: true, data: result });
} catch (error) {
  logger.error({ error }, "Operation failed");
  return errorResponse(c, 500, "OPERATION_FAILED", "Operation failed");
}
```

---

## 📝 Logging

### Logger Configuration

**backend/src/utils/logger.ts**

```typescript
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development" ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
    },
  } : undefined,
  redact: {
    paths: [
      "accessToken", "refreshToken", 
      "access_token", "refresh_token",
      "password", "token",
    ],
    censor: "[REDACTED]",
  },
});
```

### Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| `trace` | Very detailed debugging | Function entry/exit |
| `debug` | Detailed debugging | Variable values |
| `info` | General information | Request/response, job completion |
| `warn` | Warning conditions | Recoverable errors |
| `error` | Error conditions | Failed operations |
| `fatal` | Application crash | Unrecoverable errors |

### Logging Best Practices

```typescript
// ✅ Structured logging
logger.info({ 
  storeCode: "store_001", 
  duration: 1234 
}, "Sync completed");

// ❌ String concatenation
logger.info("Sync completed for store_001 in 1234ms");

// ✅ Child loggers for context
const log = logger.child({ storeCode: "store_001" });
log.info("Starting sync");
log.info("Sync completed");

// ✅ Error logging dengan context
try {
  await riskyOperation();
} catch (error) {
  logger.error({ 
    error, 
    storeCode, 
    operation: "sync" 
  }, "Operation failed");
}
```

### Specialized Loggers

```typescript
// Store-specific logging
import { storeLogger } from "./utils/logger.js";
const log = storeLogger("store_001");
log.info("Store operation");

// Job-specific logging
import { jobLogger } from "./utils/logger.js";
const log = jobLogger("sync_user_daily");
log.info("Job started");
```

---

## 🧪 Testing

### Test Structure

```
tests/
└── integration/
    ├── admin-endpoints.test.ts
    ├── oauth-callback.test.ts
    ├── security-sanity.test.ts
    ├── sync-daily.test.ts
    └── test-utils.ts
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- oauth-callback.test.ts
```

### Test Configuration

**vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```

### Writing Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("Admin Endpoints", () => {
  beforeAll(async () => {
    // Setup test database
  });
  
  afterAll(async () => {
    // Cleanup
  });
  
  it("should list stores", async () => {
    const response = await fetch("http://localhost:3000/admin/stores", {
      headers: { "X-API-KEY": process.env.TEST_API_KEY },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

---

## 🚀 Deployment

### Production Deployment Checklist

#### Pre-Deployment

- [ ] Run security audit: `npm audit`
- [ ] Run tests: `npm test`
- [ ] Build application: `npm run build`
- [ ] Review environment variables
- [ ] Generate production secrets
- [ ] Setup database backup
- [ ] Configure monitoring

#### Environment Setup

```bash
# Production .env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:password@prod-db:5432/tiktok_hubs

# TikTok API
TIKTOK_CLIENT_KEY=prod_client_key
TIKTOK_CLIENT_SECRET=prod_client_secret
TIKTOK_REDIRECT_URI=https://api.yourdomain.com/auth/tiktok/callback

# Security
TOKEN_ENC_KEY=<64-char-hex-string>
ADMIN_API_KEY=<strong-api-key>

# CORS
CORS_ORIGIN=https://yourdomain.com

# Logging
LOG_LEVEL=warn

# Jobs
CRON_ENABLED=true
TZ=UTC
```

#### Deployment Options

##### Option 1: Docker

```bash
# Build image
docker build -t tiktok-hubs-backend .

# Run container
docker run -d \
  --name tiktok-hubs-api \
  --env-file .env.production \
  -p 3000:3000 \
  tiktok-hubs-backend
```

##### Option 2: PM2

```bash
# Install PM2
npm install -g pm2

# Build
npm run build

# Start with PM2
pm2 start dist/index.js \
  --name tiktok-hubs-api \
  --instances 4 \
  --max-memory-restart 500M

# Save PM2 config
pm2 save

# Setup startup script
pm2 startup
```

##### Option 3: systemd

```ini
# /etc/systemd/system/tiktok-hubs.service
[Unit]
Description=TikTok Hubs Backend
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/opt/tiktok-hubs/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable tiktok-hubs
sudo systemctl start tiktok-hubs
```

#### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Health Check Monitoring

```bash
# Setup monitoring with uptime check
*/5 * * * * curl -f https://api.yourdomain.com/health || alert_admin
```

---

## 🔧 Troubleshooting

### Common Issues

#### Issue: "Database connection failed"

**Symptoms:**
```
Error: Database connection failed. Check DATABASE_URL.
```

**Solutions:**
1. Verify `DATABASE_URL` format:
   ```bash
   postgresql://user:password@host:port/database
   ```
2. Check database is running:
   ```bash
   docker-compose ps postgres
   ```
3. Test connection:
   ```bash
   psql $DATABASE_URL
   ```

#### Issue: "Token encryption failed"

**Symptoms:**
```
Error: TOKEN_ENC_KEY must be exactly 32 bytes
```

**Solutions:**
1. Generate proper key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Ensure key is 64 hex characters
3. Update `.env` file

#### Issue: "OAuth callback failed"

**Symptoms:**
```
Error: Invalid or expired OAuth state
```

**Solutions:**
1. Check `TIKTOK_REDIRECT_URI` matches TikTok Developer Portal
2. Verify state hasn't expired (10 min timeout)
3. Check `oauth_state` table for records:
   ```sql
   SELECT * FROM oauth_state WHERE expires_at > NOW();
   ```

#### Issue: "Rate limit exceeded"

**Symptoms:**
```
{"error": {"code": "RATE_LIMITED", "message": "Rate limit exceeded"}}
```

**Solutions:**
1. Wait for rate limit window to reset (1 minute)
2. Reduce request frequency
3. Contact admin for API key increase

#### Issue: "Jobs not running"

**Symptoms:**
- Scheduler status shows jobs but they don't run
- No sync logs generated

**Solutions:**
1. Check `CRON_ENABLED=true` in `.env`
2. Verify timezone setting
3. Check logs for cron errors:
   ```bash
   grep "cron" backend.log
   ```
4. Manually trigger job:
   ```bash
   curl -X POST http://localhost:3000/admin/sync/run \
     -H "X-API-KEY: $ADMIN_API_KEY"
   ```

#### Issue: "TikTok API rate limit"

**Symptoms:**
```
Error: TikTok API rate limit exceeded
```

**Solutions:**
1. Wait for TikTok rate limit reset (typically 1 hour)
2. Reduce sync frequency
3. Implement exponential backoff (already implemented)
4. Contact TikTok support for higher limits

### Debug Mode

Enable detailed logging:

```bash
# .env
LOG_LEVEL=debug
DB_LOGGING=true
```

### Database Debugging

```bash
# Open database shell
psql $DATABASE_URL

# Check tables
\dt

# View store accounts
SELECT store_code, status, token_expired_at 
FROM store_accounts;

# Check sync logs
SELECT store_code, job_name, status, message 
FROM sync_logs 
ORDER BY run_time DESC 
LIMIT 10;

# Check locks
SELECT * FROM sync_locks WHERE expires_at > NOW();
```

### Getting Help

1. Check logs: `tail -f backend.log`
2. Review documentation
3. Run health check: `curl http://localhost:3000/health`
4. Check GitHub issues
5. Contact support team

---

## 📚 Additional Resources

### Related Documentation

- [API Endpoints](./doc/API-ENDPOINTS.md)
- [Architecture Diagrams](./doc/ARCHITECTURE-DIAGRAMS.md)
- [Learning Guides](./docs/)
  - [01: Setup](./docs/LEARNING-01-SETUP.md)
  - [02: Database](./docs/LEARNING-02-DATABASE.md)
  - [03: OAuth & Security](./docs/LEARNING-03-OAUTH-SECURITY.md)
  - [04: API Services](./docs/LEARNING-04-API-SERVICES.md)
  - [05: Background Jobs](./docs/LEARNING-05-BACKGROUND-JOBS.md)

### External References

- [TikTok for Developers](https://developers.tiktok.com/)
- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## 📝 Changelog

### Version 1.0.0 (2024-01-24)
- Initial release
- OAuth 2.0 integration with TikTok
- Automated daily sync
- Admin API endpoints
- Token encryption
- Background jobs

---

**Maintained by:** Development Team  
**Last Updated:** 24 Januari 2026  
**Next Review:** 24 April 2026
