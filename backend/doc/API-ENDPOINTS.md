# API Endpoints Documentation

**Date:** January 17, 2026  
**Version:** 1.0.0

## Overview

Dokumentasi lengkap untuk semua API endpoints yang tersedia di TikTok Hubs. Dokumentasi ini memastikan konsistensi antara frontend dan backend.

---

## Base URL

```
Backend: http://localhost:3000
Frontend: http://localhost:3002 (dengan proxy ke backend)
```

---

## Authentication

Semua endpoint `/admin/*` memerlukan API Key authentication.

**Header Required:**

```
X-API-KEY: <your-api-key>
```

**Response untuk missing/invalid API key:**

- Status: `401 Unauthorized`
- Body:

```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing API key"
}
```

---

## Store Management Endpoints

### 1. List All Stores

**Endpoint:** `GET /admin/stores`

**Description:** Mendapatkan daftar semua stores dengan status koneksi TikTok.

**Request:**

```bash
curl -X GET http://localhost:3000/admin/stores \
  -H "X-API-KEY: your-api-key"
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "store_001",
      "storeName": "My Store",
      "picName": "John Doe",
      "picContact": "john@example.com",
      "status": "CONNECTED",
      "lastSyncTime": "2026-01-17T10:30:00.000Z",
      "connectedAt": "2026-01-01T00:00:00.000Z",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-17T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Create New Store

**Endpoint:** `POST /admin/stores`

**Description:** Membuat store baru.

**Request Body:**

```json
{
  "store_code": "store_002",
  "store_name": "New Store",
  "pic_name": "Jane Smith",
  "pic_contact": "jane@example.com"
}
```

**Validation Rules:**

- `store_code`: 1-50 alphanumeric, underscore, dash (required)
- `store_name`: 1-255 characters (required)
- `pic_name`: 1-255 characters (required)
- `pic_contact`: optional string

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": 2,
    "storeCode": "store_002",
    "storeName": "New Store",
    "picName": "Jane Smith",
    "picContact": "jane@example.com",
    "createdAt": "2026-01-17T10:00:00.000Z",
    "updatedAt": "2026-01-17T10:00:00.000Z"
  },
  "message": "Store created successfully",
  "next_step": "Connect TikTok account at: GET /connect/tiktok?store_code=store_002"
}
```

**Error Response:** `409 Conflict` (store already exists)

```json
{
  "success": false,
  "error": "Store with this code already exists"
}
```

---

### 3. Get Single Store Details

**Endpoint:** `GET /admin/stores/:store_code`

**Description:** Mendapatkan detail single store dengan status terkini.

**Request:**

```bash
curl -X GET http://localhost:3000/admin/stores/store_001 \
  -H "X-API-KEY: your-api-key"
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "storeCode": "store_001",
    "storeName": "My Store",
    "picName": "John Doe",
    "picContact": "john@example.com",
    "status": "CONNECTED",
    "lastSyncTime": "2026-01-17T10:30:00.000Z",
    "connectedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Error Response:** `404 Not Found`

```json
{
  "success": false,
  "error": "Store not found"
}
```

---

## Store Accounts Endpoints

### 4. Get Store Accounts

**Endpoint:** `GET /admin/stores/:store_code/accounts`

**Description:** Mendapatkan daftar akun TikTok yang terhubung dengan store tertentu.

**Request:**

```bash
curl -X GET http://localhost:3000/admin/stores/store_001/accounts \
  -H "X-API-KEY: your-api-key"
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "store_001",
      "platform": "tiktok",
      "hasValidToken": true,
      "accountIdentifier": "tiktok_open_id_123",
      "lastSyncAt": "2026-01-17T10:30:00.000Z",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-17T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

## User Stats Endpoints

### 5. Get User Stats History

**Endpoint:** `GET /admin/stores/:store_code/user-stats`

**Description:** Mendapatkan historical data user stats (followers, likes, videos, dll).

**Query Parameters:**

- `days` (optional): Number of days to retrieve (default: 30, max: 365)

**Request:**

```bash
curl -X GET "http://localhost:3000/admin/stores/store_001/user-stats?days=7" \
  -H "X-API-KEY: your-api-key"
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "store_001",
      "snapshotDate": "2026-01-17",
      "followerCount": 15000,
      "followingCount": 320,
      "likesCount": 450000,
      "videoCount": 87,
      "displayName": "My TikTok",
      "avatarUrl": "https://...",
      "createdAt": "2026-01-17T00:00:00.000Z"
    }
  ],
  "count": 7
}
```

---

## Video Stats Endpoints

### 6. Get Video Stats

**Endpoint:** `GET /admin/stores/:store_code/video-stats`

**Description:** Mendapatkan statistics untuk semua videos dalam rentang waktu tertentu.

**Query Parameters:**

- `days` (optional): Number of days to retrieve (default: 30, max: 365)

**Request:**

```bash
curl -X GET "http://localhost:3000/admin/stores/store_001/video-stats?days=14" \
  -H "X-API-KEY: your-api-key"
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "store_001",
      "videoId": "7123456789",
      "snapshotDate": "2026-01-17",
      "viewCount": 125000,
      "likeCount": 8500,
      "commentCount": 320,
      "shareCount": 450,
      "description": "Check out this amazing video!",
      "coverImageUrl": "https://...",
      "shareUrl": "https://www.tiktok.com/@user/video/7123456789",
      "createdAt": "2026-01-17T00:00:00.000Z"
    }
  ],
  "count": 42
}
```

---

## Sync Logs Endpoints

### 7. Get Sync Logs for Store

**Endpoint:** `GET /admin/stores/:store_code/sync-logs`

**Description:** Mendapatkan riwayat sync operations untuk store tertentu.

**Query Parameters:**

- `limit` (optional): Maximum number of logs to return (default: 50, max: 500)

**Request:**

```bash
curl -X GET "http://localhost:3000/admin/stores/store_001/sync-logs?limit=10" \
  -H "X-API-KEY: your-api-key"
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "store_001",
      "jobName": "sync_user_stats",
      "status": "SUCCESS",
      "message": "User stats synced successfully",
      "rawError": null,
      "durationMs": 1234,
      "runTime": "2026-01-17T10:30:00.000Z"
    }
  ],
  "count": 10
}
```

---

### 8. Get All Sync Logs

**Endpoint:** `GET /admin/sync/logs`

**Description:** Mendapatkan riwayat sync operations untuk semua stores.

**Query Parameters:**

- `store_code` (optional): Filter by specific store
- `limit` (optional): Maximum number of logs (default: 50, max: 500)

**Request:**

```bash
curl -X GET "http://localhost:3000/admin/sync/logs?limit=20" \
  -H "X-API-KEY: your-api-key"
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "store_001",
      "jobName": "sync_user_stats",
      "status": "SUCCESS",
      "message": "User stats synced successfully",
      "runTime": "2026-01-17T10:30:00.000Z"
    }
  ],
  "count": 20
}
```

---

## Sync Operations Endpoints

### 9. Trigger Manual Sync

**Endpoint:** `POST /admin/sync/run`

**Description:** Memicu manual sync operation untuk store tertentu atau semua stores.

**Request Body:**

```json
{
  "store_code": "store_001",
  "job": "all"
}
```

**Job Types:**

- `all`: Sync user stats + video stats (default)
- `user`: Sync user stats only
- `video`: Sync video stats only
- `refresh_tokens`: Refresh OAuth tokens only

**Request (specific store):**

```bash
curl -X POST http://localhost:3000/admin/sync/run \
  -H "X-API-KEY: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"store_code":"store_001","job":"all"}'
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "success": true,
    "storeCode": "store_001",
    "message": "Full sync completed successfully",
    "duration": 5234,
    "recordsProcessed": 87
  }
}
```

---

### 10. Get Sync Status

**Endpoint:** `GET /admin/sync/status`

**Description:** Mendapatkan status scheduler dan waktu next run untuk automated sync jobs.

**Request:**

```bash
curl -X GET http://localhost:3000/admin/sync/status \
  -H "X-API-KEY: your-api-key"
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "refreshTokensJob": {
      "enabled": true,
      "schedule": "0 */6 * * *",
      "nextRun": "2026-01-17T18:00:00.000Z"
    },
    "syncUserDailyJob": {
      "enabled": true,
      "schedule": "0 2 * * *",
      "nextRun": "2026-01-18T02:00:00.000Z"
    },
    "syncVideoDailyJob": {
      "enabled": true,
      "schedule": "0 3 * * *",
      "nextRun": "2026-01-18T03:00:00.000Z"
    }
  }
}
```

---

## Error Responses

Semua endpoints dapat mengembalikan error responses berikut:

### 400 Bad Request

```json
{
  "success": false,
  "error": "Validation error message"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing API key"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Store not found"
}
```

### 409 Conflict

```json
{
  "success": false,
  "error": "Store with this code already exists"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to process request",
  "message": "Detailed error message"
}
```

---

## Frontend Integration

### API Client Configuration

Frontend menggunakan proxy configuration di `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/admin': 'http://localhost:3000',
    '/connect': 'http://localhost:3000',
  }
}
```

### Service Layer

File: `frontend/src/services/store.service.ts`

```typescript
export const storeService = {
  async getStores(): Promise<Store[]>
  async createStore(data): Promise<Store>
  async getStoreAccounts(storeCode): Promise<StoreAccount[]>
  async getUserStats(storeCode, days): Promise<UserStats[]>
  async getVideoStats(storeCode, days): Promise<VideoStats[]>
  async getSyncLogs(storeCode, limit): Promise<SyncLog[]>
  async triggerSync(storeCode): Promise<void>
}
```

---

## Testing

Integration tests tersedia di:

```
/tests/integration/admin-endpoints.test.ts
```

Run tests dengan:

```bash
npm test
```

---

## Changelog

### Version 1.0.0 (2026-01-17)

- ✅ Added `GET /admin/stores/:store_code/user-stats`
- ✅ Added `GET /admin/stores/:store_code/video-stats`
- ✅ Added `GET /admin/stores/:store_code/sync-logs`
- ✅ Fixed frontend `triggerSync` endpoint from `/admin/stores/:store_code/sync` to `/admin/sync/run`
- ✅ Added comprehensive integration tests
- ✅ Updated documentation with all endpoints

---

## Contact

For questions or issues, please refer to the main README.md or create an issue in the repository.
