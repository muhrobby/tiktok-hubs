# TikTok Content Reporting Hub - API Specification

## Overview

Backend API untuk mengagregasi data performa konten TikTok dari 300+ toko/outlet.

**Base URL:** `http://localhost:3000` (development) | `https://api.yourdomain.com` (production)

**API Version:** 1.0.0

---

## Table of Contents

1. [Authentication](#authentication)
2. [Health & Service Info](#health--service-info)
3. [Store Management](#store-management)
4. [TikTok Account Management](#tiktok-account-management)
5. [Statistics](#statistics)
6. [Sync Operations](#sync-operations)
7. [User Authentication](#user-authentication)
8. [User Management](#user-management)
9. [Analytics](#analytics)
10. [Export/Import](#exportimport)
11. [Audit Logs](#audit-logs)
12. [Error Codes](#error-codes)
13. [Rate Limiting](#rate-limiting)

---

## Authentication

API ini mendukung dua metode autentikasi:

### 1. API Key Authentication

Untuk external systems dan scripts. Kirim API key di header:

```http
X-API-KEY: your-admin-api-key
```

Set API key di environment variable: `ADMIN_API_KEY`

### 2. JWT Bearer Authentication

Untuk web UI users. Token dikirim via:

**Option A: httpOnly Cookie**
```http
Cookie: access_token=<jwt_token>; refresh_token=<refresh_token>
```

**Option B: Authorization Header**
```http
Authorization: Bearer <jwt_token>
```

### Roles & Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| **Admin** | Full system access | All permissions |
| **Ops** | Operations access | View all stores, trigger sync, view analytics |
| **Store** | Limited access | View assigned stores only |

### Available Permissions

- `VIEW_ALL_STORES` - View all stores
- `VIEW_OWN_STORE` - View assigned stores
- `VIEW_DASHBOARD_ALL` - View all analytics
- `VIEW_DASHBOARD_OWN` - View assigned store analytics
- `VIEW_AUDIT_LOGS` - View audit logs (Admin only)
- `CREATE_STORE` - Create stores
- `TRIGGER_SYNC_ALL` - Trigger global sync
- `EXPORT_ALL_DATA` - Export all data
- `MANAGE_USERS` - Manage users
- `VIEW_USERS` - View users

---

## Health & Service Info

### GET /

Get API information and available endpoints.

**Authentication:** None

**Response:**
```json
{
  "name": "TikTok Content Reporting Hub API",
  "version": "1.0.0",
  "documentation": "/api/docs",
  "endpoints": {
    "health": "/health",
    "stores": "/admin/stores",
    "sync": "/admin/sync"
  }
}
```

### GET /health

Check if service and database are healthy.

**Authentication:** None

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "encryption": "ok",
    "scheduler": "enabled"
  }
}
```

---

## Store Management

### GET /admin/stores

List all stores with their connection status.

**Authentication:** API Key or JWT (Admin/Ops/Store)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| - | - | - | (No parameters) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "storeCode": "STORE001",
      "storeName": "Toko Jakarta Pusat",
      "picName": "John Doe",
      "picContact": "john@example.com",
      "createdAt": "2025-01-01T00:00:00Z",
      "accountStatus": "CONNECTED",
      "connectedAt": "2025-01-02T10:00:00Z",
      "lastSyncAt": "2025-01-15T02:00:00Z"
    }
  ],
  "count": 1
}
```

### POST /admin/stores

Create a new store.

**Authentication:** API Key or JWT (Admin only)

**Request Body:**
```json
{
  "store_code": "STORE001",
  "store_name": "Toko Jakarta Pusat",
  "pic_name": "John Doe",
  "pic_contact": "john@example.com"
}
```

**Validation:**
- `store_code`: 1-50 characters, alphanumeric with underscores/hyphens
- `store_name`: 1-255 characters, required
- `pic_name`: 1-255 characters, required
- `pic_contact`: Optional

**Response:**
```json
{
  "success": true,
  "data": {
    "storeCode": "STORE001",
    "storeName": "Toko Jakarta Pusat",
    "picName": "John Doe",
    "picContact": "john@example.com",
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "message": "Store created successfully",
  "next_step": "Connect TikTok account at: GET /connect/tiktok?store_code=STORE001"
}
```

### GET /admin/stores/{store_code}

Get single store details with latest stats.

**Authentication:** API Key or JWT (with access)

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| store_code | string | Yes |

**Response:**
```json
{
  "success": true,
  "data": {
    "storeCode": "STORE001",
    "storeName": "Toko Jakarta Pusat",
    "picName": "John Doe",
    "picContact": "john@example.com",
    "createdAt": "2025-01-01T00:00:00Z",
    "accountStatus": "CONNECTED",
    "connectedAt": "2025-01-02T10:00:00Z",
    "lastSyncAt": "2025-01-15T02:00:00Z"
  }
}
```

---

## TikTok Account Management

### GET /admin/tiktok-accounts

Get comprehensive list of all TikTok accounts with metrics (Admin/Ops only).

**Authentication:** API Key or JWT (Admin/Ops only)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| search | string | - | Search by store code, name, or display name |
| status | string | all | Filter by account status (CONNECTED, DISCONNECTED, TOKEN_EXPIRED) |
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page (max 100) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "storeCode": "STORE001",
      "storeName": "Toko Jakarta Pusat",
      "displayName": "@officialstore",
      "avatarUrl": "https://example.com/avatar.jpg",
      "followers": 15000,
      "profileLikes": 50000,
      "videoCount": 150,
      "totalViews": 1000000,
      "totalVideoLikes": 50000,
      "totalComments": 2000,
      "totalShares": 1000,
      "engagementRate": 5.67,
      "status": "CONNECTED"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### GET /admin/stores/{store_code}/accounts

Get TikTok accounts for a specific store.

**Authentication:** API Key or JWT (with access)

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| store_code | string | Yes |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "STORE001",
      "platform": "tiktok",
      "hasValidToken": true,
      "accountIdentifier": "open_id_123",
      "lastSyncAt": "2025-01-15T02:00:00Z",
      "createdAt": "2025-01-02T10:00:00Z",
      "updatedAt": "2025-01-15T02:00:00Z"
    }
  ],
  "count": 1
}
```

### GET /connect/tiktok

Redirect user to TikTok OAuth authorization page.

**Authentication:** None

**Query Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| store_code | string | Yes |

**Response:** `302 Redirect` to TikTok OAuth

### GET /auth/url

Get TikTok OAuth URL without redirect (for copy link feature).

**Authentication:** None

**Query Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| store_code | string | Yes |

**Response:**
```json
{
  "success": true,
  "authUrl": "https://open-api.tiktok.com/platform/oauth/connect...",
  "state": "random_state_token"
}
```

### GET /auth/tiktok/callback

Handle OAuth callback from TikTok.

**Authentication:** None

**Query Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| code | string | Yes |
| state | string | Yes |
| scopes | string | No |

**Response:** Redirects to frontend on success

---

## Statistics

### GET /admin/stores/{store_code}/user-stats

Get TikTok user stats for a store over time.

**Authentication:** API Key or JWT (with access)

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| store_code | string | Yes |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | integer | 30 | Number of days (1-365) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "snapshotDate": "2025-01-15",
      "storeCode": "STORE001",
      "openId": "open_id_123",
      "displayName": "@officialstore",
      "followerCount": 15000,
      "followingCount": 150,
      "likesCount": 50000,
      "videoCount": 150,
      "avatarUrl": "https://example.com/avatar.jpg"
    }
  ],
  "count": 30
}
```

### GET /admin/stores/{store_code}/video-stats

Get TikTok video stats for a store over time.

**Authentication:** API Key or JWT (with access)

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| store_code | string | Yes |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | integer | 30 | Number of days (1-365) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "snapshotDate": "2025-01-15",
      "storeCode": "STORE001",
      "videoId": "video_123",
      "description": "Amazing product showcase",
      "viewCount": 100000,
      "likeCount": 5000,
      "commentCount": 200,
      "shareCount": 100,
      "coverImageUrl": "https://example.com/cover.jpg",
      "shareUrl": "https://tiktok.com/@user/video/123",
      "createTime": "2025-01-10T10:00:00Z"
    }
  ],
  "count": 500
}
```

### GET /admin/stores/{store_code}/sync-logs

Get sync logs for a specific store.

**Authentication:** API Key or JWT (with access)

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| store_code | string | Yes |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | integer | 50 | Max 500 |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "STORE001",
      "syncType": "all",
      "status": "success",
      "message": "Sync completed successfully",
      "errorDetails": null,
      "startedAt": "2025-01-15T02:00:00Z",
      "completedAt": "2025-01-15T02:05:00Z"
    }
  ],
  "count": 10
}
```

---

## Sync Operations

### POST /admin/sync/run

Trigger manual sync for one or all stores.

**Authentication:** API Key or JWT (Admin/Ops for global, Store for assigned stores)

**Request Body:**
```json
{
  "store_code": "STORE001",
  "job": "all"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| store_code | string | No | Optional - specific store or all stores |
| job | string | Yes | Options: `user`, `video`, `all`, `refresh_tokens` |

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "storesProcessed": 150,
    "storesSucceeded": 148,
    "storesFailed": 2,
    "storesSkipped": 0
  }
}
```

### GET /admin/sync/status

Get scheduler status and next run times.

**Authentication:** API Key or JWT

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "activeJobs": [],
    "lastRun": "2025-01-15T02:00:00Z",
    "nextRun": "2025-01-16T02:00:00Z",
    "schedule": {
      "tokenRefresh": "01:00",
      "userSync": "02:00",
      "videoSync": "03:00"
    }
  }
}
```

### GET /admin/sync/logs

Get all sync logs with optional filtering.

**Authentication:** API Key or JWT

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| store_code | string | - | Filter by store |
| limit | integer | 50 | Max 500 |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "storeCode": "STORE001",
      "syncType": "all",
      "status": "success",
      "message": null,
      "startedAt": "2025-01-15T02:00:00Z",
      "completedAt": "2025-01-15T02:05:00Z"
    }
  ],
  "count": 50
}
```

---

## User Authentication

### POST /user-auth/login

Authenticate user with username and password.

**Authentication:** None (Rate limited: 5 attempts, 5-min block)

**Request Body:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Validation:**
- `username`: 1-50 characters, required
- `password`: Required (no length limit enforced on login)

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "fullName": "Administrator",
      "roles": [
        {
          "name": "Admin",
          "storeCode": null
        }
      ]
    },
    "expiresIn": 900
  }
}
```

**Sets Cookies:**
- `access_token` (httpOnly, 15 min expiry)
- `refresh_token` (httpOnly, 30 days expiry)

### POST /user-auth/logout

Logout current session.

**Authentication:** JWT Required

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /user-auth/logout-all

Logout from all devices (revoke all refresh tokens).

**Authentication:** JWT Required

**Response:**
```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

### POST /user-auth/refresh

Refresh access token using refresh token.

**Authentication:** Refresh Token (from cookie)

**Response:**
```json
{
  "success": true,
  "data": {
    "expiresIn": 900
  }
}
```

**Sets Cookie:**
- `access_token` (updated)

### GET /user-auth/me

Get current user info with roles and permissions.

**Authentication:** JWT Required

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "fullName": "Administrator",
    "isActive": true,
    "lastLoginAt": "2025-01-15T10:00:00Z",
    "roles": [
      {
        "name": "Admin",
        "storeCode": null
      }
    ],
    "permissions": [
      "VIEW_ALL_STORES",
      "VIEW_DASHBOARD_ALL",
      "VIEW_AUDIT_LOGS",
      "CREATE_STORE",
      "MANAGE_USERS",
      "TRIGGER_SYNC_ALL",
      "EXPORT_ALL_DATA"
    ],
    "assignedStores": []
  }
}
```

### PUT /user-auth/password

Change current user's password.

**Authentication:** JWT Required

**Request Body:**
```json
{
  "currentPassword": "oldpass123",
  "newPassword": "newpass12345678"
}
```

**Validation:**
- `currentPassword`: Required
- `newPassword`: 8-128 characters, required

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully. Please login again on other devices."
}
```

### PUT /user-auth/profile

Update current user's profile.

**Authentication:** JWT Required

**Request Body:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe"
}
```

**Validation:**
- `email`: Valid email format, optional/nullable
- `fullName`: Max 100 characters, optional/nullable

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "user@example.com",
    "fullName": "John Doe"
  },
  "message": "Profile updated successfully"
}
```

---

## User Management

### GET /admin/users

List all users with filters and pagination.

**Authentication:** JWT with `VIEW_USERS` permission

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page (max 100) |
| search | string | - | Search by username, email, or full name |
| roleName | string | - | Filter by role (Admin, Ops, Store) |
| isActive | boolean | - | Filter by active status |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "fullName": "Administrator",
      "isActive": true,
      "lastLoginAt": "2025-01-15T10:00:00Z",
      "roles": [
        {
          "id": 1,
          "name": "Admin",
          "storeCode": null
        }
      ],
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### GET /admin/users/roles

List all available roles.

**Authentication:** JWT with `VIEW_USERS` permission

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Admin",
      "description": "Full system access",
      "permissions": [
        "VIEW_ALL_STORES",
        "VIEW_DASHBOARD_ALL",
        "VIEW_AUDIT_LOGS",
        "CREATE_STORE",
        "MANAGE_USERS",
        "TRIGGER_SYNC_ALL",
        "EXPORT_ALL_DATA"
      ]
    },
    {
      "id": 2,
      "name": "Ops",
      "description": "Operations access",
      "permissions": [
        "VIEW_ALL_STORES",
        "VIEW_DASHBOARD_ALL",
        "TRIGGER_SYNC_ALL",
        "EXPORT_ALL_DATA"
      ]
    },
    {
      "id": 3,
      "name": "Store",
      "description": "Limited store access",
      "permissions": [
        "VIEW_OWN_STORE",
        "VIEW_DASHBOARD_OWN"
      ]
    }
  ]
}
```

### GET /admin/users/{id}

Get a specific user by ID.

**Authentication:** JWT with `VIEW_USERS` permission

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| id | integer | Yes |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "fullName": "Administrator",
    "isActive": true,
    "lastLoginAt": "2025-01-15T10:00:00Z",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z",
    "roles": [
      {
        "id": 1,
        "userId": 1,
        "roleId": 1,
        "role": {
          "id": 1,
          "name": "Admin"
        },
        "storeCode": null
      }
    ]
  }
}
```

### POST /admin/users

Create a new user (Admin only).

**Authentication:** JWT with `MANAGE_USERS` permission

**Request Body:**
```json
{
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com",
  "fullName": "New User",
  "isActive": true
}
```

**Validation:**
- `username`: 3-50 characters, alphanumeric with underscore/hyphen only
- `password`: 8-128 characters, required
- `email`: Valid email format, optional/nullable
- `fullName`: Max 100 characters, optional/nullable
- `isActive`: Boolean, defaults to true

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "newuser",
    "email": "user@example.com",
    "fullName": "New User",
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

### PUT /admin/users/{id}

Update a user (Admin only).

**Authentication:** JWT with `MANAGE_USERS` permission

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| id | integer | Yes |

**Request Body:**
```json
{
  "email": "updated@example.com",
  "fullName": "Updated Name",
  "isActive": false,
  "password": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "newuser",
    "email": "updated@example.com",
    "fullName": "Updated Name",
    "isActive": false,
    "updatedAt": "2025-01-15T10:35:00Z"
  }
}
```

### DELETE /admin/users/{id}

Delete a user (Admin only).

**Authentication:** JWT with `MANAGE_USERS` permission

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| id | integer | Yes |

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### POST /admin/users/{id}/roles

Assign a role to a user (Admin only).

**Authentication:** JWT with `MANAGE_USERS` permission

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| id | integer | Yes |

**Request Body:**
```json
{
  "roleName": "Store",
  "storeCode": "STORE001"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| roleName | string | Yes | Must be: Admin, Ops, or Store |
| storeCode | string | Conditionally | Required for Store role |

**Response:**
```json
{
  "success": true,
  "message": "Role 'Store' assigned successfully",
  "data": {
    "roles": [
      {
        "id": 1,
        "name": "Admin",
        "storeCode": null
      },
      {
        "id": 2,
        "name": "Store",
        "storeCode": "STORE001"
      }
    ]
  }
}
```

### DELETE /admin/users/{id}/roles/{roleName}

Remove a role from a user (Admin only).

**Authentication:** JWT with `MANAGE_USERS` permission

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| id | integer | Yes |
| roleName | string | Yes |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| storeCode | string | Conditionally | Required for Store role |

**Response:**
```json
{
  "success": true,
  "message": "Role 'Store' removed successfully",
  "data": {
    "roles": [
      {
        "id": 1,
        "name": "Admin",
        "storeCode": null
      }
    ]
  }
}
```

---

## Analytics

### GET /admin/analytics/overview

Get overall statistics summary.

**Authentication:** API Key or JWT with dashboard permission

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| storeCode | string | - | Filter by specific store (Admin/Ops only) |

**Response:**
```json
{
  "success": true,
  "data": {
    "stores": {
      "total": 300,
      "connected": 280
    },
    "followers": {
      "total": 5000000
    },
    "videos": {
      "total": 45000,
      "totalViews": 100000000,
      "totalLikes": 15000000,
      "totalComments": 500000,
      "totalShares": 250000
    },
    "snapshotDate": "2025-01-15"
  }
}
```

### GET /admin/analytics/followers-trend

Get follower trend over time (aggregated across accessible stores).

**Authentication:** API Key or JWT with dashboard permission

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | integer | 30 | 7-90 days |
| storeCode | string | - | Filter by specific store (Admin/Ops only) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-01-01",
      "followers": 4500000,
      "likes": 12000000,
      "stores": 270
    },
    {
      "date": "2025-01-02",
      "followers": 4600000,
      "likes": 12500000,
      "stores": 275
    }
  ]
}
```

### GET /admin/analytics/video-performance

Get video performance metrics over time.

**Authentication:** API Key or JWT with dashboard permission

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | integer | 30 | 7-90 days |
| storeCode | string | - | Filter by specific store (Admin/Ops only) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-01-01",
      "views": 5000000,
      "likes": 500000,
      "comments": 20000,
      "shares": 10000,
      "videos": 1500
    }
  ]
}
```

### GET /admin/analytics/top-stores

Get top performing stores by various metrics.

**Authentication:** API Key or JWT with dashboard permission

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| sort | string | followers | Options: followers, views, engagement |
| limit | integer | 10 | 1-50 |
| storeCode | string | - | Filter by specific store (Admin/Ops only) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "storeCode": "STORE001",
      "storeName": "Toko Jakarta Pusat",
      "displayName": "@officialstore",
      "avatarUrl": "https://example.com/avatar.jpg",
      "followers": 50000,
      "profileLikes": 150000,
      "videoCount": 200,
      "totalViews": 5000000,
      "totalVideoLikes": 250000,
      "totalComments": 10000,
      "totalShares": 5000,
      "engagementScore": 5200000
    }
  ],
  "sortBy": "followers",
  "snapshotDate": "2025-01-15"
}
```

### GET /admin/analytics/top-videos

Get top performing videos across accessible stores.

**Authentication:** API Key or JWT with dashboard permission

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| sort | string | views | Options: views, likes, comments, shares |
| limit | integer | 10 | 1-50 |
| storeCode | string | - | Filter by specific store (Admin/Ops only) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "storeCode": "STORE001",
      "videoId": "video_123",
      "description": "Amazing product showcase",
      "coverImageUrl": "https://example.com/cover.jpg",
      "shareUrl": "https://tiktok.com/@user/video/123",
      "createTime": "2025-01-10T10:00:00Z",
      "views": 1000000,
      "likes": 50000,
      "comments": 2000,
      "shares": 1000,
      "storeName": "Toko Jakarta Pusat"
    }
  ],
  "sortBy": "views",
  "snapshotDate": "2025-01-15"
}
```

### GET /admin/analytics/sync-health

Get sync health status across accessible stores.

**Authentication:** API Key or JWT with dashboard permission

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| storeCode | string | - | Filter by specific store (Admin/Ops only) |

**Response:**
```json
{
  "success": true,
  "data": {
    "last24Hours": {
      "success": 280,
      "failed": 5,
      "skipped": 10,
      "running": 5
    },
    "accountStatus": {
      "needReconnect": 15,
      "hasError": 5
    }
  }
}
```

---

## Export/Import

### GET /admin/export/stores

Export stores list to Excel or CSV.

**Authentication:** API Key or JWT with export permission

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| format | string | Yes | Options: xlsx, csv |

**Response:** File download with appropriate headers

### GET /admin/export/user-stats

Export user statistics to Excel or CSV.

**Authentication:** API Key or JWT with export permission

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| format | string | Yes | Options: xlsx, csv |
| start_date | string | No | Format: YYYY-MM-DD |
| end_date | string | No | Format: YYYY-MM-DD |

**Response:** File download with appropriate headers

### GET /admin/export/video-stats

Export video statistics to Excel or CSV.

**Authentication:** API Key or JWT with export permission

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| format | string | Yes | Options: xlsx, csv |
| start_date | string | No | Format: YYYY-MM-DD |
| end_date | string | No | Format: YYYY-MM-DD |

**Response:** File download with appropriate headers

### GET /admin/export/sync-logs

Export sync logs to Excel or CSV.

**Authentication:** API Key or JWT with export permission

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| format | string | Yes | Options: xlsx, csv |

**Response:** File download with appropriate headers

### GET /admin/export/template/stores

Download import template for stores.

**Authentication:** API Key or JWT

**Response:** Excel template file

### POST /admin/import/stores/validate

Validate import file without importing.

**Authentication:** API Key or JWT with `CREATE_STORE` permission

**Request:** Multipart form data with `file` field

**Form Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | file | Yes | .xlsx or .csv, max 5MB |

**Response:**
```json
{
  "success": true,
  "data": {
    "validRows": 150,
    "invalidRows": 5,
    "errors": [
      {
        "row": 5,
        "field": "store_code",
        "message": "Store code already exists"
      }
    ],
    "warnings": [
      {
        "row": 10,
        "field": "pic_name",
        "message": "PIC name exceeds recommended length"
      }
    ]
  }
}
```

### POST /admin/import/stores

Import stores from Excel/CSV file.

**Authentication:** API Key or JWT with `CREATE_STORE` permission

**Request:** Multipart form data

**Form Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | file | Yes | .xlsx or .csv, max 5MB |
| skip_existing | string | No | Skip existing stores (default: true) |
| update_existing | string | No | Update existing stores (default: false) |

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRows": 200,
    "successCount": 180,
    "errorCount": 15,
    "skippedCount": 5,
    "errors": [
      {
        "row": 5,
        "field": "store_code",
        "message": "Store code already exists"
      }
    ]
  }
}
```

---

## Audit Logs

### GET /admin/audit-logs

Get paginated audit logs with filters (Admin only).

**Authentication:** API Key or JWT (Admin only)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 50 | Items per page (max 100) |
| userId | integer | - | Filter by user ID |
| username | string | - | Filter by username |
| action | string | - | Filter by action type |
| resource | string | - | Filter by resource type |
| resourceId | string | - | Filter by resource ID |
| success | boolean | - | Filter by success status |
| startDate | string | - | Format: YYYY-MM-DD |
| endDate | string | - | Format: YYYY-MM-DD |
| search | string | - | Search in details |

**Action Types:** CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, IMPORT, SYNC

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "timestamp": "2025-01-15T10:30:00Z",
      "requestId": "req_abc123",
      "userId": 1,
      "username": "admin",
      "action": "CREATE",
      "resource": "store",
      "resourceId": "STORE001",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "method": "POST",
      "path": "/admin/stores",
      "success": true,
      "errorCode": null,
      "duration": 150,
      "details": {
        "store_code": "STORE001"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1000,
    "totalPages": 20
  }
}
```

### GET /admin/audit-logs/summary

Get audit log summary for dashboard (Admin only).

**Authentication:** API Key or JWT (Admin only)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| hours | integer | 24 | Time window (1-720) |

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEvents": 1500,
    "successfulEvents": 1450,
    "failedEvents": 50,
    "byAction": {
      "CREATE": 150,
      "READ": 800,
      "UPDATE": 300,
      "DELETE": 50,
      "LOGIN": 100,
      "LOGOUT": 80,
      "EXPORT": 15,
      "IMPORT": 3,
      "SYNC": 2
    },
    "topUsers": [
      {
        "userId": 1,
        "username": "admin",
        "actionCount": 500
      }
    ]
  }
}
```

### GET /admin/audit-logs/resources

Get distinct resources for filtering (Admin only).

**Authentication:** API Key or JWT (Admin only)

**Response:**
```json
{
  "success": true,
  "data": [
    "store",
    "user",
    "sync",
    "audit_log",
    "tiktok_account"
  ]
}
```

### GET /admin/audit-logs/{id}

Get a single audit log by ID (Admin only).

**Authentication:** API Key or JWT (Admin only)

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| id | integer | Yes |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "req_abc123",
    "userId": 1,
    "username": "admin",
    "action": "CREATE",
    "resource": "store",
    "resourceId": "STORE001",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "method": "POST",
    "path": "/admin/stores",
    "success": true,
    "errorCode": null,
    "duration": 150,
    "details": {
      "store_code": "STORE001",
      "store_name": "Toko Jakarta Pusat"
    }
  }
}
```

### GET /admin/audit-logs/user/{userId}

Get audit logs for a specific user (Admin only).

**Authentication:** API Key or JWT (Admin only)

**Path Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| userId | integer | Yes |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 50 | Items per page |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "timestamp": "2025-01-15T11:00:00Z",
      "userId": 5,
      "username": "storeuser",
      "action": "READ",
      "resource": "store",
      "success": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

---

## Error Codes

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Authentication required or failed |
| `TOKEN_INVALID` | 401 | Invalid or expired JWT token |
| `REFRESH_TOKEN_REQUIRED` | 401 | Refresh token is required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `STORE_NOT_FOUND` | 404 | Store not found |
| `DUPLICATE_ERROR` | 409 | Resource already exists |
| `STORE_EXISTS` | 409 | Store with this code already exists |
| `SERVER_MISCONFIG` | 500 | Server misconfiguration |
| `INTERNAL_ERROR` | 500 | Internal server error |

### Authentication Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Invalid username or password |
| `USER_INACTIVE` | 403 | User account has been deactivated |
| `REFRESH_FAILED` | 401 | Invalid or expired refresh token |

### Store Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_STORE_CODE` | 400 | Invalid store code format |
| `STORE_EXISTS` | 409 | Store already exists |

### OAuth Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `OAUTH_ERROR` | 400 | OAuth authorization was denied or failed |
| `OAUTH_MISSING_PARAMS` | 400 | Missing OAuth parameters |
| `OAUTH_STATE_INVALID` | 400 | Invalid or expired OAuth state |
| `OAUTH_CALLBACK_FAILED` | 500 | OAuth callback processing failed |

### Sync Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SYNC_IN_PROGRESS` | 409 | Sync already in progress for this store |
| `SYNC_FAILED` | 500 | Sync operation failed |

### User Management Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `USER_NOT_FOUND` | 404 | User not found |
| `SELF_DELETE` | 400 | Cannot delete your own account |
| `LAST_ADMIN` | 400 | Cannot delete/remove the last admin |
| `SELF_DEMOTE` | 400 | Cannot remove your own Admin role |

### Export/Import Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_FORMAT` | 400 | Invalid export format (must be csv or xlsx) |
| `NO_FILE` | 400 | No file provided |
| `INVALID_FILE_TYPE` | 400 | File must be .xlsx or .csv |
| `FILE_TOO_LARGE` | 400 | File size must be less than 5MB |
| `EXPORT_FAILED` | 500 | Failed to export data |
| `IMPORT_FAILED` | 500 | Failed to import data |
| `VALIDATION_FAILED` | 500 | Failed to validate file |
| `TEMPLATE_FAILED` | 500 | Failed to generate template |

---

## Rate Limiting

### Rate Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Admin endpoints | 100 requests | per minute |
| OAuth endpoints | 10 requests | per minute |
| Authentication failures | 5 attempts | 15-min window (5-min block) |

### Rate Limit Headers

All rate-limited responses include these headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642258800
```

### Rate Limit Error Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "limit": 100,
      "window": "1 minute"
    }
  }
}
```

---

## Auto Sync Schedule

The system automatically runs sync jobs daily:

| Time (UTC) | Job | Description |
|------------|-----|-------------|
| 01:00 | Token Refresh | Refresh expired access tokens |
| 02:00 | User Stats Sync | Sync user statistics |
| 03:00 | Video Stats Sync | Sync video statistics |

---

## Performance Notes

For 300 stores:
- User sync: ~2-3 minutes
- Video sync: ~5-8 minutes
- Total: ~7-11 minutes

---

## Support & Documentation

- **Swagger UI**: `/api/docs`
- **OpenAPI JSON**: `/api/openapi.json`
- **API Support**: support@example.com
- **License**: MIT
