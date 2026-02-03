import { z } from "zod";

// ============================================
// Common Schemas
// ============================================

export const ErrorResponseSchema = z.object({
  error: z.string().describe("Error message"),
  code: z.string().optional().describe("Error code"),
  details: z.any().optional().describe("Additional error details"),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean().describe("Operation success status"),
  message: z.string().optional().describe("Success message"),
});

// ============================================
// Health & Info Schemas
// ============================================

export const HealthResponseSchema = z.object({
  status: z.enum(["healthy", "unhealthy"]).describe("Health status"),
  timestamp: z.string().describe("ISO timestamp"),
  database: z.enum(["connected", "disconnected"]).describe("Database status"),
});

export const InfoResponseSchema = z.object({
  service: z.string().describe("Service name"),
  version: z.string().describe("API version"),
  environment: z.string().describe("Environment (development/production)"),
  uptime: z.number().describe("Uptime in seconds"),
  timestamp: z.string().describe("ISO timestamp"),
});

// ============================================
// Store Schemas
// ============================================

export const StoreSchema = z.object({
  storeCode: z.string().describe("Unique store identifier"),
  storeName: z.string().describe("Store display name"),
  picName: z.string().describe("Person in charge name"),
  createdAt: z.string().describe("ISO timestamp of creation"),
});

export const CreateStoreSchema = z.object({
  store_code: z.string().min(1).max(50).describe("Unique store identifier"),
  store_name: z.string().min(1).max(200).describe("Store display name"),
  pic_name: z.string().min(1).max(100).describe("Person in charge name"),
});

export const StoreListResponseSchema = z.object({
  stores: z.array(StoreSchema).describe("List of stores"),
  total: z.number().describe("Total number of stores"),
});

// ============================================
// Account Schemas
// ============================================

export const AccountSchema = z.object({
  storeCode: z.string().describe("Store identifier"),
  openId: z.string().describe("TikTok Open ID"),
  status: z.enum(["CONNECTED", "DISCONNECTED", "TOKEN_EXPIRED"]).describe("Account status"),
  connectedAt: z.string().nullable().describe("ISO timestamp of connection"),
  lastSyncAt: z.string().nullable().describe("ISO timestamp of last sync"),
  tokenExpiredAt: z.string().describe("ISO timestamp of token expiration"),
  updatedAt: z.string().describe("ISO timestamp of last update"),
});

export const AccountListResponseSchema = z.object({
  accounts: z.array(AccountSchema).describe("List of TikTok accounts"),
});

// ============================================
// Stats Schemas
// ============================================

export const UserStatsSchema = z.object({
  snapshotDate: z.string().describe("Date of snapshot (YYYY-MM-DD)"),
  storeCode: z.string().describe("Store identifier"),
  openId: z.string().describe("TikTok Open ID"),
  displayName: z.string().describe("Display name"),
  followerCount: z.number().describe("Number of followers"),
  followingCount: z.number().describe("Number of following"),
  likesCount: z.number().describe("Total likes received"),
  videoCount: z.number().describe("Total videos posted"),
  avatarUrl: z.string().nullable().describe("Avatar image URL"),
});

export const UserStatsListResponseSchema = z.object({
  stats: z.array(UserStatsSchema).describe("List of user statistics"),
  days: z.number().describe("Number of days included"),
});

export const VideoStatsSchema = z.object({
  snapshotDate: z.string().describe("Date of snapshot (YYYY-MM-DD)"),
  storeCode: z.string().describe("Store identifier"),
  videoId: z.string().describe("TikTok video ID"),
  description: z.string().describe("Video description"),
  viewCount: z.number().describe("Number of views"),
  likeCount: z.number().describe("Number of likes"),
  commentCount: z.number().describe("Number of comments"),
  shareCount: z.number().describe("Number of shares"),
  coverImageUrl: z.string().nullable().describe("Cover image URL"),
  shareUrl: z.string().describe("Video share URL"),
  createTime: z.string().describe("ISO timestamp of video creation"),
});

export const VideoStatsListResponseSchema = z.object({
  stats: z.array(VideoStatsSchema).describe("List of video statistics"),
  days: z.number().describe("Number of days included"),
});

// ============================================
// Sync Schemas
// ============================================

export const SyncLogSchema = z.object({
  id: z.number().describe("Log ID"),
  storeCode: z.string().describe("Store identifier"),
  syncType: z.enum(["user", "video", "all"]).describe("Type of sync operation"),
  status: z.enum(["success", "failed", "partial"]).describe("Sync status"),
  message: z.string().nullable().describe("Status message"),
  errorDetails: z.any().nullable().describe("Error details if failed"),
  startedAt: z.string().describe("ISO timestamp of sync start"),
  completedAt: z.string().nullable().describe("ISO timestamp of sync completion"),
});

export const SyncLogsResponseSchema = z.object({
  logs: z.array(SyncLogSchema).describe("List of sync logs"),
  total: z.number().describe("Total number of logs"),
});

export const SyncRequestSchema = z.object({
  store_code: z.string().optional().describe("Store code to sync (optional for all stores)"),
  job: z.enum(["user", "video", "all"]).describe("Type of sync job"),
});

export const SyncStatusSchema = z.object({
  activeStores: z.number().describe("Number of stores being synced"),
  lastSync: z.string().nullable().describe("ISO timestamp of last sync"),
  nextSync: z.string().nullable().describe("ISO timestamp of next scheduled sync"),
});

export const SyncStatusResponseSchema = z.object({
  status: SyncStatusSchema.describe("Current sync status"),
});

// ============================================
// OAuth Schemas
// ============================================

export const OAuthUrlResponseSchema = z.object({
  authUrl: z.string().url().describe("TikTok OAuth authorization URL"),
  state: z.string().describe("CSRF protection state token"),
});

export const OAuthCallbackResponseSchema = z.object({
  success: z.boolean().describe("OAuth callback success status"),
  message: z.string().describe("Status message"),
  storeCode: z.string().optional().describe("Store identifier"),
  openId: z.string().optional().describe("TikTok Open ID"),
});

// ============================================
// Query Parameters Schemas
// ============================================

export const DaysQuerySchema = z.object({
  days: z.string().regex(/^\d+$/).optional().describe("Number of days to query (default: 30)"),
});

export const LimitQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).optional().describe("Maximum number of results (default: 50)"),
});

export const StoreCodeQuerySchema = z.object({
  store_code: z.string().optional().describe("Store code filter"),
});

export const SyncLogsQuerySchema = z.object({
  store_code: z.string().optional().describe("Store code filter"),
  limit: z.string().regex(/^\d+$/).optional().describe("Maximum number of results (default: 50)"),
});

// ============================================
// Security Headers Schema
// ============================================

export const SecurityHeadersSchema = z.object({
  "X-API-KEY": z.string().describe("Admin API key for authentication"),
});
