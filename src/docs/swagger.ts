/**
 * Static OpenAPI Documentation
 * 
 * Complete API documentation with all endpoints and responses
 */

import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import type { Context } from "hono";

/**
 * Create comprehensive OpenAPI documentation
 */
export function createDocsApp() {
  const app = new Hono();

  // Complete OpenAPI 3.1.0 specification
  app.get("/api/openapi.json", (c: Context) => {
    return c.json({
      openapi: "3.1.0",
      info: {
        title: "TikTok Content Reporting Hub API",
        version: "1.0.0",
        description: `
# TikTok Content Reporting Hub API

Backend API untuk mengagregasi data performa konten TikTok dari 300+ toko/outlet.

## 🚀 Fitur Utama
- 📊 **Agregasi Data**: Mengumpulkan data dari 300+ stores
- 🔄 **Auto Sync**: Sinkronisasi otomatis harian (user stats & video stats)
- 🔐 **OAuth 2.0**: Integrasi aman dengan TikTok API
- 📈 **Analytics**: Tracking user & video statistics over time
- ⚡ **High Performance**: Optimized 6x faster dengan batch processing

## 🔒 Authentication

Semua admin endpoints memerlukan API key di header:

\`\`\`bash
curl -H "X-API-KEY: your-admin-api-key" http://localhost:3000/admin/stores
\`\`\`

Set API key di environment variable:
\`\`\`bash
ADMIN_API_KEY=your_secure_api_key_here
\`\`\`

## 🚦 Rate Limiting
- **Admin endpoints**: 100 requests/minute per IP
- **OAuth endpoints**: 10 requests/minute per IP  
- **Auth failures**: Max 5 attempts, lalu block 30 menit

## ⚠️ Error Codes

| Code | Description |
|------|-------------|
| \`AUTH_MISSING_KEY\` | API key tidak ada di header |
| \`AUTH_INVALID_KEY\` | API key tidak valid |
| \`STORE_NOT_FOUND\` | Store dengan code tersebut tidak ditemukan |
| \`ACCOUNT_NOT_FOUND\` | TikTok account belum terhubung |
| \`SYNC_IN_PROGRESS\` | Sync sedang berjalan untuk store ini |
| \`OAUTH_STATE_INVALID\` | OAuth state token tidak valid (CSRF) |
| \`OAUTH_EXCHANGE_FAILED\` | Gagal menukar authorization code |

## 📖 Quick Start

### 1. Setup Store
\`\`\`bash
curl -X POST http://localhost:3000/admin/stores \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: your-api-key" \\
  -d '{
    "store_code": "STORE001",
    "store_name": "Toko Jakarta Pusat",
    "pic_name": "John Doe"
  }'
\`\`\`

### 2. Connect TikTok Account
\`\`\`bash
# Redirect user ke URL ini
http://localhost:3000/connect/tiktok?store_code=STORE001
\`\`\`

### 3. View Statistics
\`\`\`bash
curl -H "X-API-KEY: your-api-key" \\
  "http://localhost:3000/admin/stores/STORE001/user-stats?days=30"

curl -H "X-API-KEY: your-api-key" \\
  "http://localhost:3000/admin/stores/STORE001/video-stats?days=30"
\`\`\`

### 4. Manual Sync (Optional)
\`\`\`bash
curl -X POST http://localhost:3000/admin/sync/run \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: your-api-key" \\
  -d '{
    "store_code": "STORE001",
    "job": "all"
  }'
\`\`\`

## 🔄 Auto Sync Schedule

Sistem akan otomatis sync setiap hari:
- **01:00 AM**: Token refresh
- **02:00 AM**: User stats sync
- **03:00 AM**: Video stats sync

## 📊 Performance

Untuk 300 stores:
- **User sync**: ~2-3 menit (was 20 min)
- **Video sync**: ~5-8 menit (was 45 min)
- **Total**: ~7-11 menit (was 65 min)
- **Improvement**: **6x faster** 🚀
        `,
        contact: {
          name: "API Support",
          email: "support@example.com",
        },
        license: {
          name: "MIT",
        },
      },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Development server",
        },
        {
          url: "https://api.yourdomain.com",
          description: "Production server",
        },
      ],
      tags: [
        { name: "Health", description: "Health check & service information" },
        { name: "Stores", description: "Store management endpoints" },
        { name: "Accounts", description: "TikTok account management" },
        { name: "Statistics", description: "User & video statistics" },
        { name: "Sync", description: "Manual sync operations" },
        { name: "OAuth", description: "TikTok OAuth 2.0 flow" },
        { name: "User Auth", description: "User authentication (login, logout, profile)" },
        { name: "User Management", description: "Admin user management" },
        { name: "Analytics", description: "Analytics dashboard endpoints" },
        { name: "Export/Import", description: "Data export and import" },
        { name: "Audit Logs", description: "System audit logs" },
      ],
      paths: {
        "/health": {
          get: {
            tags: ["Health"],
            summary: "Health check",
            description: "Check if service and database are healthy",
            responses: {
              "200": {
                description: "Service is healthy",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        status: { type: "string", enum: ["healthy", "unhealthy"] },
                        timestamp: { type: "string", format: "date-time" },
                        uptime: { type: "number", description: "Uptime in seconds" },
                        version: { type: "string" },
                        checks: {
                          type: "object",
                          properties: {
                            database: { type: "string", enum: ["ok", "fail"] },
                            encryption: { type: "string", enum: ["ok", "fail"] },
                            scheduler: { type: "string", enum: ["enabled", "disabled"] },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/": {
          get: {
            tags: ["Health"],
            summary: "Service information",
            description: "Get API information and available endpoints",
            responses: {
              "200": {
                description: "Service information",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        version: { type: "string" },
                        documentation: { type: "string" },
                        endpoints: { type: "object" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/admin/stores": {
          get: {
            tags: ["Stores"],
            summary: "List all stores",
            description: "Get list of all registered stores",
            security: [{ ApiKeyAuth: [] }],
            responses: {
              "200": {
                description: "List of stores",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        stores: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              storeCode: { type: "string" },
                              storeName: { type: "string" },
                              picName: { type: "string" },
                              createdAt: { type: "string", format: "date-time" },
          },
        },
        // User Authentication Endpoints
        "/user-auth/login": {
          post: {
            tags: ["User Auth"],
            summary: "User login",
            description: "Authenticate user with username and password",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["username", "password"],
                    properties: {
                      username: { type: "string" },
                      password: { type: "string" },
                    },
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "Login successful",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        data: {
                          type: "object",
                          properties: {
                            user: { $ref: "#/components/schemas/AuthUser" },
                            expiresIn: { type: "number" },
                          },
                        },
                      },
                    },
                  },
                },
              },
              "401": { $ref: "#/components/responses/Unauthorized" },
            },
          },
        },
        "/user-auth/logout": {
          post: {
            tags: ["User Auth"],
            summary: "User logout",
            security: [{ BearerAuth: [] }],
            responses: {
              "200": { description: "Logout successful" },
            },
          },
        },
        "/user-auth/me": {
          get: {
            tags: ["User Auth"],
            summary: "Get current user",
            security: [{ BearerAuth: [] }],
            responses: {
              "200": {
                description: "Current user info",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        data: { $ref: "#/components/schemas/AuthUser" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/user-auth/password": {
          put: {
            tags: ["User Auth"],
            summary: "Change password",
            security: [{ BearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["currentPassword", "newPassword"],
                    properties: {
                      currentPassword: { type: "string" },
                      newPassword: { type: "string", minLength: 8 },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Password changed" },
              "400": { $ref: "#/components/responses/BadRequest" },
            },
          },
        },
        "/user-auth/profile": {
          put: {
            tags: ["User Auth"],
            summary: "Update profile",
            security: [{ BearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      email: { type: "string", format: "email", nullable: true },
                      fullName: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Profile updated" },
            },
          },
        },
        "/user-auth/refresh": {
          post: {
            tags: ["User Auth"],
            summary: "Refresh access token",
            responses: {
              "200": { description: "Token refreshed" },
              "401": { $ref: "#/components/responses/Unauthorized" },
            },
          },
        },
        // User Management Endpoints
        "/admin/users": {
          get: {
            tags: ["User Management"],
            summary: "List users",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "page", in: "query", schema: { type: "integer", default: 1 } },
              { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
              { name: "search", in: "query", schema: { type: "string" } },
              { name: "roleName", in: "query", schema: { type: "string" } },
              { name: "isActive", in: "query", schema: { type: "boolean" } },
            ],
            responses: {
              "200": { description: "List of users" },
            },
          },
          post: {
            tags: ["User Management"],
            summary: "Create user",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["username", "password"],
                    properties: {
                      username: { type: "string" },
                      password: { type: "string", minLength: 8 },
                      email: { type: "string", format: "email" },
                      fullName: { type: "string" },
                      isActive: { type: "boolean", default: true },
                    },
                  },
                },
              },
            },
            responses: {
              "201": { description: "User created" },
            },
          },
        },
        "/admin/users/{id}": {
          get: {
            tags: ["User Management"],
            summary: "Get user by ID",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "integer" } },
            ],
            responses: {
              "200": { description: "User details" },
              "404": { $ref: "#/components/responses/NotFound" },
            },
          },
          put: {
            tags: ["User Management"],
            summary: "Update user",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "integer" } },
            ],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      email: { type: "string" },
                      fullName: { type: "string" },
                      isActive: { type: "boolean" },
                      password: { type: "string" },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "User updated" },
            },
          },
          delete: {
            tags: ["User Management"],
            summary: "Delete user",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "integer" } },
            ],
            responses: {
              "200": { description: "User deleted" },
            },
          },
        },
        "/admin/users/{id}/roles": {
          post: {
            tags: ["User Management"],
            summary: "Assign role to user",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "integer" } },
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["roleName"],
                    properties: {
                      roleName: { type: "string", enum: ["Admin", "Ops", "Store"] },
                      storeCode: { type: "string" },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Role assigned" },
            },
          },
        },
        "/admin/users/{id}/roles/{roleName}": {
          delete: {
            tags: ["User Management"],
            summary: "Remove role from user",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "integer" } },
              { name: "roleName", in: "path", required: true, schema: { type: "string" } },
              { name: "storeCode", in: "query", schema: { type: "string" } },
            ],
            responses: {
              "200": { description: "Role removed" },
            },
          },
        },
        "/admin/users/roles": {
          get: {
            tags: ["User Management"],
            summary: "List available roles",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            responses: {
              "200": { description: "List of roles" },
            },
          },
        },
        // Analytics Endpoints
        "/admin/analytics/overview": {
          get: {
            tags: ["Analytics"],
            summary: "Get analytics overview",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            responses: {
              "200": { description: "Analytics overview data" },
            },
          },
        },
        "/admin/analytics/followers-trend": {
          get: {
            tags: ["Analytics"],
            summary: "Get followers trend",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "days", in: "query", schema: { type: "integer", default: 30 } },
            ],
            responses: {
              "200": { description: "Followers trend data" },
            },
          },
        },
        "/admin/analytics/video-performance": {
          get: {
            tags: ["Analytics"],
            summary: "Get video performance",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "days", in: "query", schema: { type: "integer", default: 30 } },
            ],
            responses: {
              "200": { description: "Video performance data" },
            },
          },
        },
        "/admin/analytics/top-stores": {
          get: {
            tags: ["Analytics"],
            summary: "Get top stores",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "sort", in: "query", schema: { type: "string", enum: ["followers", "views", "engagement"] } },
              { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
            ],
            responses: {
              "200": { description: "Top stores data" },
            },
          },
        },
        "/admin/analytics/top-videos": {
          get: {
            tags: ["Analytics"],
            summary: "Get top videos",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "sort", in: "query", schema: { type: "string", enum: ["views", "likes", "comments", "shares"] } },
              { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
            ],
            responses: {
              "200": { description: "Top videos data" },
            },
          },
        },
        "/admin/analytics/sync-health": {
          get: {
            tags: ["Analytics"],
            summary: "Get sync health status",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            responses: {
              "200": { description: "Sync health data" },
            },
          },
        },
        // Export Endpoints
        "/admin/export/stores": {
          get: {
            tags: ["Export/Import"],
            summary: "Export stores",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "format", in: "query", required: true, schema: { type: "string", enum: ["xlsx", "csv"] } },
            ],
            responses: {
              "200": { description: "File download" },
            },
          },
        },
        "/admin/export/user-stats": {
          get: {
            tags: ["Export/Import"],
            summary: "Export user stats",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "format", in: "query", required: true, schema: { type: "string", enum: ["xlsx", "csv"] } },
              { name: "start_date", in: "query", schema: { type: "string", format: "date" } },
              { name: "end_date", in: "query", schema: { type: "string", format: "date" } },
            ],
            responses: {
              "200": { description: "File download" },
            },
          },
        },
        "/admin/export/video-stats": {
          get: {
            tags: ["Export/Import"],
            summary: "Export video stats",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "format", in: "query", required: true, schema: { type: "string", enum: ["xlsx", "csv"] } },
              { name: "start_date", in: "query", schema: { type: "string", format: "date" } },
              { name: "end_date", in: "query", schema: { type: "string", format: "date" } },
            ],
            responses: {
              "200": { description: "File download" },
            },
          },
        },
        "/admin/export/sync-logs": {
          get: {
            tags: ["Export/Import"],
            summary: "Export sync logs",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "format", in: "query", required: true, schema: { type: "string", enum: ["xlsx", "csv"] } },
            ],
            responses: {
              "200": { description: "File download" },
            },
          },
        },
        "/admin/export/template/stores": {
          get: {
            tags: ["Export/Import"],
            summary: "Download stores import template",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            responses: {
              "200": { description: "Template file download" },
            },
          },
        },
        "/admin/import/stores/validate": {
          post: {
            tags: ["Export/Import"],
            summary: "Validate stores import file",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "multipart/form-data": {
                  schema: {
                    type: "object",
                    properties: {
                      file: { type: "string", format: "binary" },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Validation result" },
            },
          },
        },
        "/admin/import/stores": {
          post: {
            tags: ["Export/Import"],
            summary: "Import stores",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "multipart/form-data": {
                  schema: {
                    type: "object",
                    properties: {
                      file: { type: "string", format: "binary" },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Import result" },
            },
          },
        },
        // Audit Logs Endpoints
        "/admin/audit-logs": {
          get: {
            tags: ["Audit Logs"],
            summary: "Get audit logs",
            description: "Get paginated audit logs with filters (Admin only)",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "page", in: "query", schema: { type: "integer", default: 1 } },
              { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
              { name: "userId", in: "query", schema: { type: "integer" } },
              { name: "username", in: "query", schema: { type: "string" } },
              { name: "action", in: "query", schema: { type: "string", enum: ["CREATE", "READ", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "IMPORT", "SYNC"] } },
              { name: "resource", in: "query", schema: { type: "string" } },
              { name: "success", in: "query", schema: { type: "boolean" } },
              { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
              { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
              { name: "search", in: "query", schema: { type: "string" } },
            ],
            responses: {
              "200": {
                description: "Audit logs list",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: { $ref: "#/components/schemas/AuditLog" },
                        },
                        pagination: { $ref: "#/components/schemas/Pagination" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/admin/audit-logs/summary": {
          get: {
            tags: ["Audit Logs"],
            summary: "Get audit logs summary",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "hours", in: "query", schema: { type: "integer", default: 24 } },
            ],
            responses: {
              "200": { description: "Audit summary" },
            },
          },
        },
        "/admin/audit-logs/resources": {
          get: {
            tags: ["Audit Logs"],
            summary: "Get distinct resources",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            responses: {
              "200": { description: "List of resources" },
            },
          },
        },
        "/admin/audit-logs/{id}": {
          get: {
            tags: ["Audit Logs"],
            summary: "Get audit log by ID",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "integer" } },
            ],
            responses: {
              "200": { description: "Audit log details" },
              "404": { $ref: "#/components/responses/NotFound" },
            },
          },
        },
        "/admin/audit-logs/user/{userId}": {
          get: {
            tags: ["Audit Logs"],
            summary: "Get user audit logs",
            security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
            parameters: [
              { name: "userId", in: "path", required: true, schema: { type: "integer" } },
              { name: "page", in: "query", schema: { type: "integer" } },
              { name: "limit", in: "query", schema: { type: "integer" } },
            ],
            responses: {
              "200": { description: "User audit logs" },
            },
          },
        },
      },
                        total: { type: "number" },
                      },
                    },
                  },
                },
              },
              "401": {
                description: "Unauthorized",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Error" },
                  },
                },
              },
            },
          },
          post: {
            tags: ["Stores"],
            summary: "Create new store",
            description: "Register a new store in the system",
            security: [{ ApiKeyAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["store_code", "store_name", "pic_name"],
                    properties: {
                      store_code: { type: "string", minLength: 1, maxLength: 50 },
                      store_name: { type: "string", minLength: 1, maxLength: 200 },
                      pic_name: { type: "string", minLength: 1, maxLength: 100 },
                    },
                  },
                  example: {
                    store_code: "STORE001",
                    store_name: "Toko Jakarta Pusat",
                    pic_name: "John Doe",
                  },
                },
              },
            },
            responses: {
              "201": {
                description: "Store created",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        store: { $ref: "#/components/schemas/Store" },
                        message: { type: "string" },
                      },
                    },
                  },
                },
              },
              "400": { $ref: "#/components/responses/BadRequest" },
              "401": { $ref: "#/components/responses/Unauthorized" },
              "409": { $ref: "#/components/responses/Conflict" },
            },
          },
        },
        "/admin/stores/{store_code}": {
          get: {
            tags: ["Stores"],
            summary: "Get store details",
            security: [{ ApiKeyAuth: [] }],
            parameters: [
              {
                name: "store_code",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": {
                description: "Store details",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        store: { $ref: "#/components/schemas/Store" },
                      },
                    },
                  },
                },
              },
              "404": { $ref: "#/components/responses/NotFound" },
            },
          },
        },
        "/admin/stores/{store_code}/accounts": {
          get: {
            tags: ["Accounts"],
            summary: "Get store TikTok accounts",
            security: [{ ApiKeyAuth: [] }],
            parameters: [
              {
                name: "store_code",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": {
                description: "List of accounts",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        accounts: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Account" },
                        },
                      },
                    },
                  },
                },
              },
              "404": { $ref: "#/components/responses/NotFound" },
            },
          },
        },
        "/admin/stores/{store_code}/user-stats": {
          get: {
            tags: ["Statistics"],
            summary: "Get user statistics",
            description: "Get TikTok user stats for a store over time",
            security: [{ ApiKeyAuth: [] }],
            parameters: [
              {
                name: "store_code",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "days",
                in: "query",
                schema: { type: "integer", default: 30 },
                description: "Number of days to query",
              },
            ],
            responses: {
              "200": {
                description: "User statistics",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        stats: {
                          type: "array",
                          items: { $ref: "#/components/schemas/UserStats" },
                        },
                        days: { type: "number" },
                      },
                    },
                  },
                },
              },
              "404": { $ref: "#/components/responses/NotFound" },
            },
          },
        },
        "/admin/stores/{store_code}/video-stats": {
          get: {
            tags: ["Statistics"],
            summary: "Get video statistics",
            description: "Get TikTok video stats for a store over time",
            security: [{ ApiKeyAuth: [] }],
            parameters: [
              {
                name: "store_code",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "days",
                in: "query",
                schema: { type: "integer", default: 30 },
                description: "Number of days to query",
              },
            ],
            responses: {
              "200": {
                description: "Video statistics",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        stats: {
                          type: "array",
                          items: { $ref: "#/components/schemas/VideoStats" },
                        },
                        days: { type: "number" },
                      },
                    },
                  },
                },
              },
              "404": { $ref: "#/components/responses/NotFound" },
            },
          },
        },
        "/admin/stores/{store_code}/sync-logs": {
          get: {
            tags: ["Statistics"],
            summary: "Get store sync logs",
            security: [{ ApiKeyAuth: [] }],
            parameters: [
              {
                name: "store_code",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "limit",
                in: "query",
                schema: { type: "integer", default: 50 },
              },
            ],
            responses: {
              "200": {
                description: "Sync logs",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        logs: {
                          type: "array",
                          items: { $ref: "#/components/schemas/SyncLog" },
                        },
                        total: { type: "number" },
                      },
                    },
                  },
                },
              },
              "404": { $ref: "#/components/responses/NotFound" },
            },
          },
        },
        "/admin/sync/run": {
          post: {
            tags: ["Sync"],
            summary: "Trigger manual sync",
            description: "Manually trigger sync for one or all stores",
            security: [{ ApiKeyAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["job"],
                    properties: {
                      store_code: { type: "string", description: "Optional store code" },
                      job: { type: "string", enum: ["user", "video", "all"] },
                    },
                  },
                  example: {
                    store_code: "STORE001",
                    job: "all",
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "Sync triggered",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        message: { type: "string" },
                      },
                    },
                  },
                },
              },
              "400": { $ref: "#/components/responses/BadRequest" },
              "404": { $ref: "#/components/responses/NotFound" },
              "409": { $ref: "#/components/responses/Conflict" },
            },
          },
        },
        "/admin/sync/status": {
          get: {
            tags: ["Sync"],
            summary: "Get sync status",
            security: [{ ApiKeyAuth: [] }],
            responses: {
              "200": {
                description: "Sync status",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        status: {
                          type: "object",
                          properties: {
                            activeStores: { type: "number" },
                            lastSync: { type: "string", format: "date-time", nullable: true },
                            nextSync: { type: "string", format: "date-time", nullable: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/admin/sync/logs": {
          get: {
            tags: ["Sync"],
            summary: "Get all sync logs",
            security: [{ ApiKeyAuth: [] }],
            parameters: [
              {
                name: "store_code",
                in: "query",
                schema: { type: "string" },
              },
              {
                name: "limit",
                in: "query",
                schema: { type: "integer", default: 50 },
              },
            ],
            responses: {
              "200": {
                description: "Sync logs",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        logs: {
                          type: "array",
                          items: { $ref: "#/components/schemas/SyncLog" },
                        },
                        total: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/auth/url": {
          get: {
            tags: ["OAuth"],
            summary: "Get TikTok OAuth URL",
            description: "Generate TikTok OAuth authorization URL",
            parameters: [
              {
                name: "store_code",
                in: "query",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": {
                description: "OAuth URL",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        authUrl: { type: "string", format: "uri" },
                        state: { type: "string" },
                      },
                    },
                  },
                },
              },
              "404": { $ref: "#/components/responses/NotFound" },
            },
          },
        },
        "/connect/tiktok": {
          get: {
            tags: ["OAuth"],
            summary: "Connect TikTok account (redirect)",
            description: "Redirect user to TikTok OAuth page",
            parameters: [
              {
                name: "store_code",
                in: "query",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "302": { description: "Redirect to TikTok OAuth" },
              "404": { $ref: "#/components/responses/NotFound" },
            },
          },
        },
        "/auth/tiktok/callback": {
          get: {
            tags: ["OAuth"],
            summary: "OAuth callback handler",
            description: "Handle OAuth callback from TikTok",
            parameters: [
              { name: "code", in: "query", required: true, schema: { type: "string" } },
              { name: "state", in: "query", required: true, schema: { type: "string" } },
              { name: "scopes", in: "query", schema: { type: "string" } },
            ],
            responses: {
              "200": {
                description: "OAuth callback processed",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        message: { type: "string" },
                        storeCode: { type: "string" },
                        openId: { type: "string" },
                      },
                    },
                  },
                },
              },
              "400": { $ref: "#/components/responses/BadRequest" },
              "401": { $ref: "#/components/responses/Unauthorized" },
              "500": { $ref: "#/components/responses/InternalError" },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "X-API-KEY",
            description: "Admin API key for authentication. Set via ADMIN_API_KEY environment variable.",
          },
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT token from login. Sent as httpOnly cookie or Authorization header.",
          },
        },
        schemas: {
          Error: {
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string" },
              details: { type: "object" },
            },
          },
          Store: {
            type: "object",
            properties: {
              storeCode: { type: "string" },
              storeName: { type: "string" },
              picName: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          Account: {
            type: "object",
            properties: {
              storeCode: { type: "string" },
              openId: { type: "string" },
              status: { type: "string", enum: ["CONNECTED", "DISCONNECTED", "TOKEN_EXPIRED"] },
              connectedAt: { type: "string", format: "date-time", nullable: true },
              lastSyncAt: { type: "string", format: "date-time", nullable: true },
              tokenExpiredAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          UserStats: {
            type: "object",
            properties: {
              snapshotDate: { type: "string", format: "date" },
              storeCode: { type: "string" },
              openId: { type: "string" },
              displayName: { type: "string" },
              followerCount: { type: "number" },
              followingCount: { type: "number" },
              likesCount: { type: "number" },
              videoCount: { type: "number" },
              avatarUrl: { type: "string", nullable: true },
            },
          },
          VideoStats: {
            type: "object",
            properties: {
              snapshotDate: { type: "string", format: "date" },
              storeCode: { type: "string" },
              videoId: { type: "string" },
              description: { type: "string" },
              viewCount: { type: "number" },
              likeCount: { type: "number" },
              commentCount: { type: "number" },
              shareCount: { type: "number" },
              coverImageUrl: { type: "string", nullable: true },
              shareUrl: { type: "string" },
              createTime: { type: "string", format: "date-time" },
            },
          },
          SyncLog: {
            type: "object",
            properties: {
              id: { type: "number" },
              storeCode: { type: "string" },
              syncType: { type: "string", enum: ["user", "video", "all"] },
              status: { type: "string", enum: ["success", "failed", "partial"] },
              message: { type: "string", nullable: true },
              errorDetails: { type: "object", nullable: true },
              startedAt: { type: "string", format: "date-time" },
              completedAt: { type: "string", format: "date-time", nullable: true },
            },
          },
          AuthUser: {
            type: "object",
            properties: {
              id: { type: "number" },
              username: { type: "string" },
              email: { type: "string", nullable: true },
              fullName: { type: "string", nullable: true },
              isActive: { type: "boolean" },
              lastLoginAt: { type: "string", format: "date-time", nullable: true },
              roles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", enum: ["Admin", "Ops", "Store"] },
                    storeCode: { type: "string", nullable: true },
                  },
                },
              },
              permissions: {
                type: "array",
                items: { type: "string" },
              },
              assignedStores: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
          AuditLog: {
            type: "object",
            properties: {
              id: { type: "number" },
              timestamp: { type: "string", format: "date-time" },
              requestId: { type: "string", nullable: true },
              userId: { type: "number", nullable: true },
              username: { type: "string", nullable: true },
              action: { type: "string", enum: ["CREATE", "READ", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "IMPORT", "SYNC"] },
              resource: { type: "string" },
              resourceId: { type: "string", nullable: true },
              ipAddress: { type: "string", nullable: true },
              userAgent: { type: "string", nullable: true },
              method: { type: "string", nullable: true },
              path: { type: "string", nullable: true },
              success: { type: "boolean" },
              errorCode: { type: "string", nullable: true },
              duration: { type: "number", nullable: true },
              details: { type: "object", nullable: true },
            },
          },
          Pagination: {
            type: "object",
            properties: {
              page: { type: "number" },
              limit: { type: "number" },
              total: { type: "number" },
              totalPages: { type: "number" },
            },
          },
        },
        responses: {
          BadRequest: {
            description: "Bad request - validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          Unauthorized: {
            description: "Unauthorized - missing or invalid API key",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          NotFound: {
            description: "Resource not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          Conflict: {
            description: "Conflict - resource already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          InternalError: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    });
  });

  // Swagger UI
  app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

  // Shortcuts
  app.get("/docs", (c: Context) => c.redirect("/api/docs"));
  app.get("/swagger", (c: Context) => c.redirect("/api/docs"));

  return app;
}
