# TikTok Content Reporting Hub - Backend API

Sistem backend untuk mengkonsolidasikan laporan performa konten TikTok dari 300+ store. Dioptimasi dengan parallel processing untuk sync cepat (< 15 menit untuk 300 stores).

**Tech Stack**: Hono + TypeScript + Drizzle ORM + PostgreSQL + Node.js 20

**API Documentation**: [Swagger UI](/api/docs) | [OpenAPI JSON](/api/openapi.json)

---

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [API Documentation](#-api-documentation-swagger)
- [Performance](#-performance-300-stores)
- [Architecture](#-architecture)
- [Configuration](#️-configuration)
- [TikTok Setup](#-tiktok-developer-setup)
- [Deployment](#-production-deployment)
- [Monitoring](#-monitoring)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Features

### Core Features
- ✅ **OAuth TikTok Login Kit** - Koneksi akun TikTok store dengan OAuth 2.0
- ✅ **Auto Daily Sync** - Sinkronisasi otomatis statistik user & video
- ✅ **Parallel Processing** - Sync 300 stores dalam ~11 menit (6x lebih cepat)
- ✅ **Historical Tracking** - Daily snapshots untuk tracking perubahan metrics
- ✅ **Secure Token Storage** - Enkripsi AES-256-GCM untuk access tokens

### Security & Reliability
- 🔒 **HMAC State Validation** - CSRF protection untuk OAuth flow
- 🔒 **Rate Limiting** - Per-IP rate limiting dengan auth attempt tracking
- 🔒 **Audit Logging** - Log semua admin operations
- 🔒 **API Key Authentication** - Secure admin endpoints
- 🔄 **Retry Logic** - Exponential backoff untuk API failures
- 🔄 **Distributed Locks** - PostgreSQL advisory locks untuk prevent duplicate syncs
- 📊 **Progress Tracking** - Real-time sync progress monitoring

### Performance (300+ Stores)
- ⚡ **Parallel Sync**: 30 concurrent user syncs, 20 concurrent video syncs
- ⚡ **Database Pool**: 100 connections (configurable)
- ⚡ **Batch Processing**: Controlled concurrency untuk prevent overload
- ⚡ **Token Caching**: Optional Redis integration

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 20.0.0
- **PostgreSQL** >= 14
- **TikTok Developer Account** (untuk client key & secret)

### 1. Installation

```bash
cd backend
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Generate encryption key (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste ke TOKEN_ENC_KEY

# Generate admin API key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Paste ke ADMIN_API_KEY

# Generate OAuth state secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste ke STATE_SECRET
```

**Edit `.env`** dan isi minimal:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/tiktok_hubs
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback
TOKEN_ENC_KEY=<generated_32_bytes_hex>
ADMIN_API_KEY=<generated_api_key>
STATE_SECRET=<generated_state_secret>

# Performance tuning (300+ stores)
DB_POOL_SIZE=100
SYNC_CONCURRENCY=30
VIDEO_SYNC_CONCURRENCY=20
```

### 3. Database Setup

```bash
# Start PostgreSQL (via Docker)
docker-compose up -d db

# Run migrations
npm run db:generate
npm run db:push
```

### 4. Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Server berjalan di: **http://localhost:3000**

### 5. Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# Should return:
# {"status":"healthy","timestamp":"...","checks":{...}}
```

---

## ⚡ Performance (300+ Stores)

### Before Optimization (Sequential)
```
User Sync:  300 stores × 4 sec  = 1,200 sec = 20 minutes
Video Sync: 300 stores × 9 sec  = 2,700 sec = 45 minutes
TOTAL:                             65 MINUTES ❌
```

### After Optimization (Parallel)
```
User Sync:  10 batches × 3 sec  = 30 sec   = ~2-3 minutes
Video Sync: 15 batches × 7 sec  = 105 sec  = ~5-8 minutes
TOTAL:                             11 MINUTES ✅
```

**Performance Gain: 6x FASTER** (83% reduction)

### Key Optimizations

1. **Batch Processing** (`src/utils/batch.ts`)
   - Process 30 stores concurrently (user sync)
   - Process 20 stores concurrently (video sync)
   - Configurable via environment variables

2. **Database Pool Optimization**
   - Increased from 20 → 100 connections
   - Support high concurrency without connection exhaustion

3. **Real-time Progress Tracking**
   - Monitor sync progress in real-time
   - Detailed logging per batch

📖 **Detailed Performance Guide**: See [PERFORMANCE.md](./PERFORMANCE.md)

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Admin Client  │────▶│   Hono Server   │────▶│   PostgreSQL    │
│   (HTTP/JSON)   │     │  (Node.js 20)   │     │   (Database)    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │  OAuth   │ │  Sync    │ │  Cron    │
              │  Flow    │ │  Service │ │  Jobs    │
              └────┬─────┘ └────┬─────┘ └────┬─────┘
                   │            │            │
                   ▼            ▼            ▼
              ┌─────────────────────────────────────┐
              │         TikTok API                  │
              │  (Login Kit + Display API)          │
              └─────────────────────────────────────┘
```

### Components

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **API Layer** | HTTP endpoints, validation | Hono (Express-like) |
| **Auth Service** | TikTok OAuth flow | OAuth 2.0 + HMAC |
| **Sync Service** | Data synchronization | Parallel batch processing |
| **Token Service** | Token encryption & refresh | AES-256-GCM |
| **Jobs** | Background tasks | node-cron |
| **Database** | Data persistence | PostgreSQL + Drizzle ORM |

### Database Schema

```sql
-- Stores (toko/outlet)
CREATE TABLE stores (
  store_code VARCHAR(50) PRIMARY KEY,
  store_name VARCHAR(255) NOT NULL,
  pic_name VARCHAR(255) NOT NULL,
  pic_contact VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- TikTok accounts per store
CREATE TABLE store_accounts (
  id SERIAL PRIMARY KEY,
  store_code VARCHAR(50) REFERENCES stores(store_code),
  platform VARCHAR(50) DEFAULT 'tiktok',
  account_identifier VARCHAR(255), -- open_id
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  status VARCHAR(50), -- CONNECTED, NEED_RECONNECT, etc
  connected_at TIMESTAMP,
  last_sync_time TIMESTAMP
);

-- User statistics (daily snapshots)
CREATE TABLE tiktok_user_daily (
  id SERIAL PRIMARY KEY,
  store_code VARCHAR(50) REFERENCES stores(store_code),
  snapshot_date DATE NOT NULL,
  follower_count INTEGER,
  following_count INTEGER,
  likes_count BIGINT,
  video_count INTEGER,
  display_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_code, snapshot_date)
);

-- Video statistics (daily snapshots)
CREATE TABLE tiktok_video_daily (
  id SERIAL PRIMARY KEY,
  store_code VARCHAR(50) REFERENCES stores(store_code),
  snapshot_date DATE NOT NULL,
  video_id VARCHAR(255) NOT NULL,
  view_count BIGINT,
  like_count INTEGER,
  comment_count INTEGER,
  share_count INTEGER,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_code, snapshot_date, video_id)
);

-- Sync logs
CREATE TABLE sync_logs (
  id SERIAL PRIMARY KEY,
  store_code VARCHAR(50),
  job_name VARCHAR(100),
  status VARCHAR(50), -- SUCCESS, FAILED, SKIPPED
  message TEXT,
  raw_error TEXT,
  duration_ms INTEGER,
  run_time TIMESTAMP DEFAULT NOW()
);
```

---

## 📖 API Documentation (Swagger)

### Interactive API Documentation

**Swagger UI** tersedia di: **`http://localhost:3000/api/docs`**

![Swagger UI](https://img.shields.io/badge/Swagger-Interactive_API_Docs-green?logo=swagger)

**OpenAPI JSON Spec**: `http://localhost:3000/api/openapi.json`

### ✨ Features Swagger UI:
- 🔍 **Explore all endpoints** - Browse 14 documented endpoints
- 📝 **Request/Response schemas** - View complete data models
- 🧪 **Try it out** - Test endpoints directly dari browser
- 🔐 **Authentication** - Support X-API-KEY header
- 📊 **Examples** - Request & response examples untuk setiap endpoint
- 📚 **Error codes** - Complete error code documentation

### Quick Access:
```bash
# Start server
npm run dev

# Open Swagger UI in browser
open http://localhost:3000/api/docs

# Or use shortcuts:
# - http://localhost:3000/docs
# - http://localhost:3000/swagger
```

### Documented Endpoints (14 Total):

#### Health & Info
- `GET /health` - Health check
- `GET /` - Service information

#### Store Management (Auth required)
- `GET /admin/stores` - List all stores
- `POST /admin/stores` - Create new store
- `GET /admin/stores/{store_code}` - Get store details

#### TikTok Accounts (Auth required)
- `GET /admin/stores/{store_code}/accounts` - Get connected accounts

#### Statistics (Auth required)
- `GET /admin/stores/{store_code}/user-stats?days=30` - User statistics
- `GET /admin/stores/{store_code}/video-stats?days=30` - Video statistics
- `GET /admin/stores/{store_code}/sync-logs?limit=50` - Sync logs

#### Sync Operations (Auth required)
- `POST /admin/sync/run` - Trigger manual sync
- `GET /admin/sync/status` - Get sync status
- `GET /admin/sync/logs?store_code=xxx&limit=50` - Get all sync logs

#### OAuth Flow (Public)
- `GET /connect/tiktok?store_code=xxx` - Connect TikTok account (redirect)
- `GET /auth/url?store_code=xxx` - Get OAuth URL
- `GET /auth/tiktok/callback` - OAuth callback handler

---

## 📖 API Examples (cURL)

Base URL: `http://localhost:3000`

### Authentication

Admin endpoints require **X-API-KEY** header:
```bash
curl -H "X-API-KEY: your_admin_api_key" http://localhost:3000/admin/stores
```

### Common Response Format

**Success Response**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Admin routes | 100 req/min | Per IP |
| OAuth routes | 10 req/min | Per IP |
| Auth failures | 5 attempts | 15 min block |

---

## 🔐 Health & Info Endpoints

### GET /health

Check service health status.

**No authentication required**

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-24T09:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "requestId": "abc123",
  "checks": {
    "database": "ok",
    "encryption": "ok",
    "scheduler": "enabled"
  },
  "responseTime": 5
}
```

### GET /

Get API information and available endpoints.

**No authentication required**

**Response**:
```json
{
  "name": "TikTok Content Reporting Hub",
  "version": "1.0.0",
  "documentation": "/docs",
  "endpoints": {
    "health": "GET /health",
    "connect": "GET /connect/tiktok?store_code=xxx",
    "admin": { ... }
  }
}
```

---

## 🏪 Store Management

### GET /admin/stores

List all stores with their connection status.

**Authentication**: Required (X-API-KEY)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "storeCode": "store_jakarta_01",
      "storeName": "Store Jakarta Pusat",
      "picName": "John Doe",
      "picContact": "john@example.com",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "connectionStatus": "CONNECTED",
      "accountId": 123,
      "accountIdentifier": "user_open_id_123",
      "connectedAt": "2026-01-02T10:00:00.000Z",
      "lastSyncTime": "2026-01-24T02:00:00.000Z",
      "tokenExpiresAt": "2026-01-25T10:00:00.000Z",
      "latestUserStats": {
        "followerCount": 5000,
        "likesCount": 10000,
        "videoCount": 50
      },
      "latestVideoStats": {
        "totalVideos": 50,
        "totalViews": 100000
      }
    }
  ],
  "count": 1
}
```

### POST /admin/stores

Create a new store.

**Authentication**: Required (X-API-KEY)

**Request Body**:
```json
{
  "store_code": "store_jakarta_01",
  "store_name": "Store Jakarta Pusat",
  "pic_name": "John Doe",
  "pic_contact": "john@example.com"
}
```

**Validation Rules**:
- `store_code`: 1-50 alphanumeric characters, underscores, hyphens
- `store_name`: 1-255 characters
- `pic_name`: 1-255 characters
- `pic_contact`: Optional, any string

**Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "storeCode": "store_jakarta_01",
    "storeName": "Store Jakarta Pusat",
    "picName": "John Doe",
    "picContact": "john@example.com",
    "createdAt": "2026-01-24T09:00:00.000Z"
  },
  "message": "Store created successfully",
  "next_step": "Connect TikTok account at: GET /connect/tiktok?store_code=store_jakarta_01"
}
```

**Error Responses**:
```json
// 400 Bad Request - Invalid input
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "store_code must be 1-50 alphanumeric characters with underscores or hyphens"
  }
}

// 409 Conflict - Store already exists
{
  "success": false,
  "error": {
    "code": "STORE_EXISTS",
    "message": "Store with this code already exists"
  }
}
```

### GET /admin/stores/:store_code

Get single store details with latest statistics.

**Authentication**: Required (X-API-KEY)

**Response**:
```json
{
  "success": true,
  "data": {
    "storeCode": "store_jakarta_01",
    "storeName": "Store Jakarta Pusat",
    "picName": "John Doe",
    "connectionStatus": "CONNECTED",
    "latestUserStats": { ... },
    "latestVideoStats": { ... }
  }
}
```

**Error Response** (404):
```json
{
  "success": false,
  "error": {
    "code": "STORE_NOT_FOUND",
    "message": "Store not found"
  }
}
```

---

## 📊 Statistics Endpoints

### GET /admin/stores/:store_code/accounts

Get TikTok accounts connected to a store.

**Authentication**: Required (X-API-KEY)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "store_jakarta_01",
      "platform": "tiktok",
      "hasValidToken": true,
      "accountIdentifier": "user_open_id_123",
      "lastSyncAt": "2026-01-24T02:00:00.000Z",
      "createdAt": "2026-01-02T10:00:00.000Z",
      "updatedAt": "2026-01-24T02:00:00.000Z"
    }
  ],
  "count": 1
}
```

### GET /admin/stores/:store_code/user-stats

Get user statistics history for a store.

**Authentication**: Required (X-API-KEY)

**Query Parameters**:
- `days` (optional): Number of days to retrieve (1-365, default: 30)

**Example**:
```bash
GET /admin/stores/store_jakarta_01/user-stats?days=7
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "store_jakarta_01",
      "snapshotDate": "2026-01-24",
      "followerCount": 5000,
      "followingCount": 100,
      "likesCount": 10000,
      "videoCount": 50,
      "displayName": "Store Jakarta",
      "avatarUrl": "https://...",
      "createdAt": "2026-01-24T02:00:00.000Z"
    },
    {
      "snapshotDate": "2026-01-23",
      "followerCount": 4950,
      // ... previous day stats
    }
  ],
  "count": 7
}
```

### GET /admin/stores/:store_code/video-stats

Get video statistics for a store.

**Authentication**: Required (X-API-KEY)

**Query Parameters**:
- `days` (optional): Number of days to retrieve (1-365, default: 30)

**Example**:
```bash
GET /admin/stores/store_jakarta_01/video-stats?days=7
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "store_jakarta_01",
      "snapshotDate": "2026-01-24",
      "videoId": "video_123",
      "viewCount": 1000,
      "likeCount": 50,
      "commentCount": 10,
      "shareCount": 5,
      "description": "Video description...",
      "createdAt": "2026-01-24T02:00:00.000Z"
    }
  ],
  "count": 50
}
```

---

## 🔄 Sync Operations

### POST /admin/sync/run

Trigger manual sync operation.

**Authentication**: Required (X-API-KEY)

**Request Body** (all optional):
```json
{
  "store_code": "store_jakarta_01",  // Optional: specific store
  "job": "all"                        // all | user | video | refresh_tokens
}
```

**Examples**:

```bash
# Sync all stores (user + video)
curl -X POST http://localhost:3000/admin/sync/run \
  -H "X-API-KEY: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"job": "all"}'

# Sync single store
curl -X POST http://localhost:3000/admin/sync/run \
  -H "X-API-KEY: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"store_code": "store_jakarta_01", "job": "all"}'

# Sync only user stats (all stores)
curl -X POST http://localhost:3000/admin/sync/run \
  -H "X-API-KEY: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"job": "user"}'

# Sync only video stats
curl -X POST http://localhost:3000/admin/sync/run \
  -H "X-API-KEY: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"job": "video"}'

# Refresh tokens only
curl -X POST http://localhost:3000/admin/sync/run \
  -H "X-API-KEY: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"job": "refresh_tokens"}'
```

**Success Response** (Single Store):
```json
{
  "success": true,
  "data": {
    "success": true,
    "storeCode": "store_jakarta_01",
    "message": "User stats synced successfully: 5000 followers, 50 videos",
    "duration": 2500,
    "recordsProcessed": 1
  }
}
```

**Success Response** (All Stores):
```json
{
  "success": true,
  "data": {
    "refresh_tokens": {
      "total": 300,
      "refreshed": 50,
      "failed": 0
    },
    "user_sync": {
      "total": 300,
      "successful": 298,
      "failed": 2,
      "skipped": 0
    },
    "video_sync": {
      "total": 300,
      "successful": 295,
      "failed": 3,
      "skipped": 2,
      "totalVideos": 15000
    }
  }
}
```

**Error Response** (404):
```json
{
  "success": false,
  "error": {
    "code": "STORE_NOT_FOUND",
    "message": "Store not found"
  }
}
```

### GET /admin/sync/status

Get scheduler status and next run times.

**Authentication**: Required (X-API-KEY)

**Response**:
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "timezone": "UTC",
    "jobs": [
      {
        "name": "refresh_tokens",
        "schedule": "0 1 * * *",
        "nextRun": "2026-01-25T01:00:00.000Z",
        "running": false
      },
      {
        "name": "sync_user_daily",
        "schedule": "0 2 * * *",
        "nextRun": "2026-01-25T02:00:00.000Z",
        "running": false
      },
      {
        "name": "sync_video_daily",
        "schedule": "0 3 * * *",
        "nextRun": "2026-01-25T03:00:00.000Z",
        "running": false
      }
    ]
  }
}
```

### GET /admin/sync/logs

Get sync operation logs.

**Authentication**: Required (X-API-KEY)

**Query Parameters**:
- `store_code` (optional): Filter by store code
- `limit` (optional): Number of logs to retrieve (1-500, default: 50)

**Examples**:
```bash
# All sync logs (last 50)
GET /admin/sync/logs

# Logs for specific store
GET /admin/sync/logs?store_code=store_jakarta_01

# Last 100 logs
GET /admin/sync/logs?limit=100
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "store_jakarta_01",
      "jobName": "sync_user_daily",
      "status": "SUCCESS",
      "message": "User stats synced successfully: 5000 followers, 50 videos",
      "rawError": null,
      "durationMs": 2500,
      "runTime": "2026-01-24T02:00:00.000Z"
    },
    {
      "id": 2,
      "storeCode": null,
      "jobName": "sync_user_daily",
      "status": "SUCCESS",
      "message": "Synced 298/300 stores, 2 failed, 0 skipped",
      "durationMs": 180000,
      "runTime": "2026-01-24T02:00:00.000Z"
    }
  ],
  "count": 2
}
```

### GET /admin/stores/:store_code/sync-logs

Get sync logs for specific store.

**Authentication**: Required (X-API-KEY)

**Query Parameters**:
- `limit` (optional): Number of logs to retrieve (1-500, default: 50)

**Response**: Same format as `/admin/sync/logs`

---

## 🔗 OAuth Flow

### GET /connect/tiktok

Initiate TikTok OAuth flow untuk connect store account.

**No authentication required** (public endpoint)

**Query Parameters**:
- `store_code` (required): Store code to connect

**Example**:
```bash
# Redirect user to this URL in browser
http://localhost:3000/connect/tiktok?store_code=store_jakarta_01
```

**Flow**:
1. User clicks link → redirected to TikTok
2. User logs in to TikTok and authorizes app
3. TikTok redirects back to `/auth/tiktok/callback`
4. Backend stores encrypted tokens
5. User sees success message

**Success Page** (HTML):
```html
<!DOCTYPE html>
<html>
<head>
  <title>TikTok Connection Successful</title>
</head>
<body>
  <h1>✅ Successfully connected!</h1>
  <p>Your TikTok account has been connected to store: store_jakarta_01</p>
  <p>You can close this window now.</p>
</body>
</html>
```

**Error Page** (HTML):
```html
<!DOCTYPE html>
<html>
<head>
  <title>Connection Failed</title>
</head>
<body>
  <h1>❌ Connection failed</h1>
  <p>Error: Invalid state parameter (possible CSRF attack)</p>
  <p>Please try again or contact support.</p>
</body>
</html>
```

### GET /auth/url

Get TikTok OAuth authorization URL (alternative to `/connect/tiktok`).

**No authentication required**

**Query Parameters**:
- `store_code` (required): Store code

**Example**:
```bash
curl "http://localhost:3000/auth/url?store_code=store_jakarta_01"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "authUrl": "https://www.tiktok.com/v2/auth/authorize?client_key=xxx&scope=user.info.basic&response_type=code&redirect_uri=http://localhost:3000/auth/tiktok/callback&state=store_jakarta_01_nonce_signature"
  }
}
```

### GET /auth/tiktok/callback

OAuth callback endpoint (handled automatically by TikTok).

**No authentication required** (internal use only)

**Query Parameters** (from TikTok):
- `code`: Authorization code
- `state`: HMAC-signed state for CSRF protection
- `error` (optional): Error code if authorization failed
- `error_description` (optional): Error description

This endpoint is called by TikTok after user authorization. You should NOT call this directly.

---

## ⚙️ Configuration

### Environment Variables

#### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/tiktok_hubs

# TikTok API Credentials
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret_min_32_chars
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback

# Security Secrets (generate with crypto.randomBytes)
TOKEN_ENC_KEY=64_char_hex_string_for_aes256_encryption
ADMIN_API_KEY=your_random_admin_api_key_min_32_chars
STATE_SECRET=64_char_hex_string_for_hmac_signing
```

#### Performance Tuning (300+ Stores)

```bash
# Database Pool
DB_POOL_SIZE=100              # Max connections (default: 100)
DB_POOL_MIN=20                # Min idle connections (default: 20)

# Sync Concurrency
SYNC_CONCURRENCY=30           # User sync concurrency (default: 30)
VIDEO_SYNC_CONCURRENCY=20     # Video sync concurrency (default: 20)
```

#### Optional Variables

```bash
# Server
PORT=3000                     # Server port (default: 3000)
HOST=0.0.0.0                  # Server host (default: 0.0.0.0)
NODE_ENV=development          # Environment (development | production)

# Logging
LOG_LEVEL=info                # Log level (trace|debug|info|warn|error|fatal)
DB_LOGGING=false              # Enable SQL query logging

# CORS
CORS_ORIGIN=http://localhost:5173  # Allowed origins (comma-separated)

# Scheduler
CRON_ENABLED=true             # Enable background jobs (default: true)
TZ=UTC                        # Timezone for cron (default: UTC)

# Custom Cron Schedules
CRON_TOKEN_REFRESH=0 1 * * *      # Token refresh (default: 1:00 AM)
CRON_SYNC_USER_DAILY=0 2 * * *    # User sync (default: 2:00 AM)
CRON_SYNC_VIDEO_DAILY=0 3 * * *   # Video sync (default: 3:00 AM)
```

### Generate Secrets

```bash
# Token encryption key (64 char hex = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Admin API key (Base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# State secret (64 char hex = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Tuning for Different Scales

#### 100-300 Stores (Standard)
```bash
DB_POOL_SIZE=100
SYNC_CONCURRENCY=30
VIDEO_SYNC_CONCURRENCY=20
```

#### 300-500 Stores (High Load)
```bash
DB_POOL_SIZE=150
SYNC_CONCURRENCY=40
VIDEO_SYNC_CONCURRENCY=25
```

#### 500-1000 Stores (Very High Load)
```bash
DB_POOL_SIZE=200
SYNC_CONCURRENCY=50
VIDEO_SYNC_CONCURRENCY=30
```

**Note**: Pastikan PostgreSQL `max_connections` >= `DB_POOL_SIZE + 50`

---

## 🔧 TikTok Developer Setup

### 1. Create TikTok App

1. Go to [TikTok Developers](https://developers.tiktok.com/apps)
2. Click **"Create an App"**
3. Fill in app details:
   - **App Name**: TikTok Content Hub
   - **Category**: Content Management
   - **Description**: Aggregate content performance for multiple stores

### 2. Enable Products

Enable these products for your app:
- ✅ **Login Kit** (for OAuth authentication)
- ✅ **Display API** (for fetching user/video stats)

### 3. Configure OAuth Settings

In app settings, configure:

**Redirect URI**:
```
Development: http://localhost:3000/auth/tiktok/callback
Production:  https://yourdomain.com/auth/tiktok/callback
```

**Important**: URI must match EXACTLY (including trailing slash if any)

### 4. Request Scopes

Request these scopes (may need approval):
- `user.info.basic` - Basic user information ✅ (auto-approved)
- `user.info.stats` - User statistics (followers, likes, etc.) ⏳ (needs approval)
- `video.list` - List user videos ⏳ (needs approval)

**Note**: Some scopes require manual approval by TikTok (may take 1-3 business days)

### 5. Get Credentials

After app is created, copy:
- **Client Key** → `TIKTOK_CLIENT_KEY`
- **Client Secret** → `TIKTOK_CLIENT_SECRET`

### 6. Test OAuth Flow

```bash
# 1. Create test store
curl -X POST http://localhost:3000/admin/stores \
  -H "X-API-KEY: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"store_code": "test_store", "store_name": "Test Store", "pic_name": "Tester"}'

# 2. Open in browser
open "http://localhost:3000/connect/tiktok?store_code=test_store"

# 3. Login to TikTok and authorize

# 4. Check connection
curl http://localhost:3000/admin/stores \
  -H "X-API-KEY: $ADMIN_API_KEY"
```

### Important TikTok API Notes

1. **Rate Limits**: TikTok enforces rate limits per app. Monitor for 429 errors.
2. **Token Expiry**: 
   - Access tokens expire in 24 hours
   - Refresh tokens expire in 30 days
3. **Scope Approval**: Production use requires approved scopes from TikTok
4. **Data Availability**: Not all fields are always available (handled gracefully)
5. **API Changes**: Check [TikTok API Docs](https://developers.tiktok.com/doc/display-api-overview) regularly

---

## 📦 Production Deployment

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- 2+ CPU cores
- 4+ GB RAM
- HTTPS certificate (required for production OAuth)

### 1. Build Application

```bash
npm run build
```

Output: `dist/` directory

### 2. Set Production Environment

```bash
export NODE_ENV=production
export DATABASE_URL=postgresql://prod_user:password@db.example.com:5432/tiktok_hubs
export TIKTOK_REDIRECT_URI=https://yourdomain.com/auth/tiktok/callback
# ... set all other env vars
```

### 3. Run Migrations

```bash
npm run db:push
```

### 4. Start Server

```bash
# Direct
node dist/index.js

# With PM2 (recommended)
pm2 start dist/index.js --name tiktok-hubs -i 2

# With systemd
sudo systemctl start tiktok-hubs
```

### Docker Deployment

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Build & Run**:
```bash
docker build -t tiktok-hubs-backend .
docker run -p 3000:3000 --env-file .env tiktok-hubs-backend
```

### Docker Compose (Full Stack)

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: tiktok_hubs
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/tiktok_hubs
    depends_on:
      - db
    restart: unless-stopped

volumes:
  postgres_data:
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (required for OAuth)
- [ ] Set strong secrets (32+ bytes random)
- [ ] Configure PostgreSQL `max_connections` (>= DB_POOL_SIZE + 50)
- [ ] Enable connection pooling
- [ ] Set up monitoring (health checks, logs)
- [ ] Configure log rotation
- [ ] Set up backups (database)
- [ ] Configure firewall (allow only necessary ports)
- [ ] Use environment variables (not .env file)
- [ ] Set up reverse proxy (nginx/Caddy)
- [ ] Enable rate limiting
- [ ] Configure CORS properly (not *)

---

## 📊 Monitoring

### Health Checks

```bash
# Basic health check
curl http://localhost:3000/health

# Monitor in loop
watch -n 5 'curl -s http://localhost:3000/health | jq ".checks"'
```

### Sync Progress

```bash
# Watch sync progress in real-time
docker-compose logs -f backend | grep "Sync progress"

# Output example:
# {"processed":30,"total":300,"percent":10,"msg":"Sync progress"}
# {"processed":60,"total":300,"percent":20,"msg":"Sync progress"}
```

### Database Pool Statistics

```bash
# Watch pool usage (production only)
docker-compose logs backend | grep "Database pool statistics"

# Output example:
# {"totalCount":45,"idleCount":20,"waitingCount":0}
```

### Performance Metrics (SQL)

```sql
-- Recent sync performance
SELECT 
  job_name,
  COUNT(*) as runs,
  AVG(duration_ms)/1000 as avg_duration_sec,
  MIN(duration_ms)/1000 as min_duration_sec,
  MAX(duration_ms)/1000 as max_duration_sec,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
FROM sync_logs
WHERE run_time >= CURRENT_DATE - INTERVAL '7 days'
  AND store_code IS NULL  -- Job-level logs only
GROUP BY job_name
ORDER BY job_name;

-- Stores with sync failures
SELECT 
  store_code,
  COUNT(*) as failure_count,
  MAX(run_time) as last_failure,
  MAX(message) as last_error
FROM sync_logs
WHERE status = 'FAILED'
  AND run_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY store_code
ORDER BY failure_count DESC
LIMIT 10;

-- Data growth over time
SELECT 
  DATE(snapshot_date) as date,
  COUNT(DISTINCT store_code) as stores_synced,
  SUM(follower_count) as total_followers,
  SUM(video_count) as total_videos
FROM tiktok_user_daily
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(snapshot_date)
ORDER BY date DESC;
```

### Alert Thresholds

Set up alerts for:

| Metric | Warning | Critical |
|--------|---------|----------|
| Sync duration (300 stores) | > 15 min | > 20 min |
| Failed syncs | > 5% | > 10% |
| DB pool usage | > 80% | > 90% |
| API response time | > 1s | > 3s |
| Token expiry | < 48h | < 24h |

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Sync Too Slow (> 15 minutes for 300 stores)

**Symptoms**:
- Sync takes longer than expected
- High CPU/memory usage

**Solutions**:
```bash
# Check current settings
echo "SYNC_CONCURRENCY: $SYNC_CONCURRENCY"
echo "DB_POOL_SIZE: $DB_POOL_SIZE"

# Increase concurrency (if server has resources)
SYNC_CONCURRENCY=40
VIDEO_SYNC_CONCURRENCY=25
DB_POOL_SIZE=150

# Check server resources
docker stats backend

# If CPU > 80% or Memory > 80%, reduce concurrency instead
```

#### 2. Database Connection Errors

**Symptoms**:
```
Error: connect ECONNREFUSED
Error: connection timeout
Error: remaining connection slots are reserved
```

**Solutions**:
```bash
# Check PostgreSQL max_connections
docker-compose exec db psql -U tiktok_user -d tiktok_hubs \
  -c "SHOW max_connections;"

# Increase if needed (in postgresql.conf)
max_connections = 150

# Or reduce pool size
DB_POOL_SIZE=50

# Check pool statistics
docker-compose logs backend | grep "Database pool"
```

#### 3. TikTok API Rate Limit (429 Errors)

**Symptoms**:
```
Error: 429 Too Many Requests
Rate limit exceeded
```

**Solutions**:
```bash
# Reduce concurrency
SYNC_CONCURRENCY=20
VIDEO_SYNC_CONCURRENCY=15

# Add delay between batches (in code if needed)
# Or wait for rate limit reset (usually 1 hour)

# Check sync logs for rate limit errors
curl "http://localhost:3000/admin/sync/logs?limit=100" \
  -H "X-API-KEY: $ADMIN_API_KEY" \
  | jq '.data[] | select(.rawError | contains("429"))'
```

#### 4. OAuth Connection Failed

**Symptoms**:
- User redirected with error
- "Invalid state parameter" error
- Tokens not saved

**Solutions**:
```bash
# Check STATE_SECRET is set
echo $STATE_SECRET

# Verify redirect URI matches exactly
echo $TIKTOK_REDIRECT_URI
# Must match TikTok Developer Portal settings (including trailing slash)

# Check store exists
curl http://localhost:3000/admin/stores \
  -H "X-API-KEY: $ADMIN_API_KEY"

# Clear and retry
# Delete store_accounts entry and reconnect
```

#### 5. Token Expired/Need Reconnect

**Symptoms**:
- Store status = `NEED_RECONNECT`
- Sync fails with auth errors

**Solutions**:
```bash
# Get store status
curl http://localhost:3000/admin/stores \
  -H "X-API-KEY: $ADMIN_API_KEY" \
  | jq '.data[] | select(.connectionStatus == "NEED_RECONNECT")'

# Have user reconnect
# Send this link to store PIC:
echo "http://localhost:3000/connect/tiktok?store_code=STORE_CODE"

# Or manually trigger token refresh (if within 30 days)
curl -X POST http://localhost:3000/admin/sync/run \
  -H "X-API-KEY: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"job": "refresh_tokens"}'
```

#### 6. Memory Leaks

**Symptoms**:
- Memory usage keeps growing
- Server becomes slow over time

**Solutions**:
```bash
# Monitor memory
docker stats backend --no-stream

# Check for connection leaks
docker-compose exec db psql -U tiktok_user -d tiktok_hubs \
  -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'tiktok_hubs';"

# Restart backend periodically (temp fix)
docker-compose restart backend

# Long-term: Check code for unclosed connections/promises
```

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev

# Or in production
LOG_LEVEL=debug node dist/index.js
```

### Support Resources

- **TikTok API Docs**: https://developers.tiktok.com/doc/display-api-overview
- **Hono Docs**: https://hono.dev
- **Drizzle ORM Docs**: https://orm.drizzle.team
- **Performance Guide**: [PERFORMANCE.md](./PERFORMANCE.md)

---

## 📝 API Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `STORE_NOT_FOUND` | 404 | Store with given code not found |
| `STORE_EXISTS` | 409 | Store already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVER_MISCONFIG` | 500 | Server misconfiguration |
| `SYNC_FAILED` | 500 | Sync operation failed |

---

## 📄 License

MIT License - See [LICENSE](./LICENSE)

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📞 Support

For issues and questions:
- GitHub Issues: [Create Issue](https://github.com/yourusername/tiktok-hubs/issues)
- Email: support@example.com

---

**Built with ❤️ using Hono + TypeScript + PostgreSQL**
