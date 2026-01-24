import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import {
  HealthResponseSchema,
  InfoResponseSchema,
  ErrorResponseSchema,
  StoreListResponseSchema,
  CreateStoreSchema,
  StoreSchema,
  AccountListResponseSchema,
  UserStatsListResponseSchema,
  VideoStatsListResponseSchema,
  SyncLogsResponseSchema,
  SyncRequestSchema,
  SyncStatusResponseSchema,
  OAuthUrlResponseSchema,
  OAuthCallbackResponseSchema,
  DaysQuerySchema,
  LimitQuerySchema,
  SyncLogsQuerySchema,
  SecurityHeadersSchema,
  SuccessResponseSchema,
} from "./schemas.js";

// ============================================
// Health & Info Routes
// ============================================

export const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Health check endpoint",
  description: "Check if the service and database are healthy",
  responses: {
    200: {
      description: "Service is healthy",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

export const infoRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Health"],
  summary: "Service information",
  description: "Get service name, version, and uptime",
  responses: {
    200: {
      description: "Service information",
      content: {
        "application/json": {
          schema: InfoResponseSchema,
        },
      },
    },
  },
});

// ============================================
// Store Routes
// ============================================

export const listStoresRoute = createRoute({
  method: "get",
  path: "/admin/stores",
  tags: ["Stores"],
  summary: "List all stores",
  description: "Get a list of all registered stores",
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: "List of stores",
      content: {
        "application/json": {
          schema: StoreListResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - missing or invalid API key",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const createStoreRoute = createRoute({
  method: "post",
  path: "/admin/stores",
  tags: ["Stores"],
  summary: "Create a new store",
  description: "Register a new store in the system",
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateStoreSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Store created successfully",
      content: {
        "application/json": {
          schema: z.object({
            store: StoreSchema,
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: "Bad request - validation error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - missing or invalid API key",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Conflict - store already exists",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const getStoreRoute = createRoute({
  method: "get",
  path: "/admin/stores/{store_code}",
  tags: ["Stores"],
  summary: "Get store details",
  description: "Get detailed information about a specific store",
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({
      store_code: z.string().describe("Store identifier"),
    }),
  },
  responses: {
    200: {
      description: "Store details",
      content: {
        "application/json": {
          schema: z.object({
            store: StoreSchema,
          }),
        },
      },
    },
    404: {
      description: "Store not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================
// Account Routes
// ============================================

export const getStoreAccountsRoute = createRoute({
  method: "get",
  path: "/admin/stores/{store_code}/accounts",
  tags: ["Accounts"],
  summary: "Get store TikTok accounts",
  description: "Get all TikTok accounts connected to a store",
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({
      store_code: z.string().describe("Store identifier"),
    }),
  },
  responses: {
    200: {
      description: "List of accounts",
      content: {
        "application/json": {
          schema: AccountListResponseSchema,
        },
      },
    },
    404: {
      description: "Store not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================
// Statistics Routes
// ============================================

export const getUserStatsRoute = createRoute({
  method: "get",
  path: "/admin/stores/{store_code}/user-stats",
  tags: ["Statistics"],
  summary: "Get user statistics",
  description: "Get TikTok user statistics for a store over time",
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({
      store_code: z.string().describe("Store identifier"),
    }),
    query: DaysQuerySchema,
  },
  responses: {
    200: {
      description: "User statistics",
      content: {
        "application/json": {
          schema: UserStatsListResponseSchema,
        },
      },
    },
    404: {
      description: "Store not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const getVideoStatsRoute = createRoute({
  method: "get",
  path: "/admin/stores/{store_code}/video-stats",
  tags: ["Statistics"],
  summary: "Get video statistics",
  description: "Get TikTok video statistics for a store over time",
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({
      store_code: z.string().describe("Store identifier"),
    }),
    query: DaysQuerySchema,
  },
  responses: {
    200: {
      description: "Video statistics",
      content: {
        "application/json": {
          schema: VideoStatsListResponseSchema,
        },
      },
    },
    404: {
      description: "Store not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const getStoreSyncLogsRoute = createRoute({
  method: "get",
  path: "/admin/stores/{store_code}/sync-logs",
  tags: ["Statistics"],
  summary: "Get store sync logs",
  description: "Get sync operation logs for a specific store",
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({
      store_code: z.string().describe("Store identifier"),
    }),
    query: LimitQuerySchema,
  },
  responses: {
    200: {
      description: "Sync logs",
      content: {
        "application/json": {
          schema: SyncLogsResponseSchema,
        },
      },
    },
    404: {
      description: "Store not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================
// Sync Routes
// ============================================

export const triggerSyncRoute = createRoute({
  method: "post",
  path: "/admin/sync/run",
  tags: ["Sync"],
  summary: "Trigger manual sync",
  description: "Manually trigger a sync operation for one or all stores",
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SyncRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Sync triggered successfully",
      content: {
        "application/json": {
          schema: SuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Bad request - validation error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Store not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: "Sync already in progress",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const getSyncStatusRoute = createRoute({
  method: "get",
  path: "/admin/sync/status",
  tags: ["Sync"],
  summary: "Get sync status",
  description: "Get current sync operation status",
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: "Sync status",
      content: {
        "application/json": {
          schema: SyncStatusResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const getAllSyncLogsRoute = createRoute({
  method: "get",
  path: "/admin/sync/logs",
  tags: ["Sync"],
  summary: "Get all sync logs",
  description: "Get sync operation logs for all stores",
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: SyncLogsQuerySchema,
  },
  responses: {
    200: {
      description: "Sync logs",
      content: {
        "application/json": {
          schema: SyncLogsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================
// OAuth Routes
// ============================================

export const getOAuthUrlRoute = createRoute({
  method: "get",
  path: "/auth/url",
  tags: ["OAuth"],
  summary: "Get TikTok OAuth URL",
  description: "Generate TikTok OAuth authorization URL for connecting an account",
  request: {
    query: z.object({
      store_code: z.string().describe("Store identifier to connect"),
    }),
  },
  responses: {
    200: {
      description: "OAuth authorization URL",
      content: {
        "application/json": {
          schema: OAuthUrlResponseSchema,
        },
      },
    },
    404: {
      description: "Store not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const connectTikTokRoute = createRoute({
  method: "get",
  path: "/connect/tiktok",
  tags: ["OAuth"],
  summary: "Connect TikTok account (redirect)",
  description: "Redirect user to TikTok OAuth page to connect their account",
  request: {
    query: z.object({
      store_code: z.string().describe("Store identifier to connect"),
    }),
  },
  responses: {
    302: {
      description: "Redirect to TikTok OAuth page",
    },
    404: {
      description: "Store not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const oauthCallbackRoute = createRoute({
  method: "get",
  path: "/auth/tiktok/callback",
  tags: ["OAuth"],
  summary: "OAuth callback handler",
  description: "Handle OAuth callback from TikTok after user authorization",
  request: {
    query: z.object({
      code: z.string().describe("Authorization code from TikTok"),
      state: z.string().describe("CSRF protection state token"),
      scopes: z.string().optional().describe("Granted scopes"),
    }),
  },
  responses: {
    200: {
      description: "OAuth callback processed successfully",
      content: {
        "application/json": {
          schema: OAuthCallbackResponseSchema,
        },
      },
    },
    400: {
      description: "Bad request - missing parameters",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Invalid state token (CSRF protection)",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "OAuth exchange failed",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});
