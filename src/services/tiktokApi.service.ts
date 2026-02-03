/**
 * TikTok API Service
 *
 * Implements TikTok Display API for fetching user info and videos
 *
 * IMPORTANT: This implementation follows TikTok's official documentation.
 * Before deploying, verify endpoints and response structures at:
 * https://developers.tiktok.com/doc/display-api-overview
 *
 * API Endpoints used:
 * - /v2/user/info/ - Get user profile and statistics
 * - /v2/video/list/ - List user's public videos
 * - /v2/video/query/ - Get specific video details (optional)
 */

import { logger } from "../utils/logger.js";
import { withRetry, createRateLimiter } from "../utils/backoff.js";

// ============================================
// TYPES
// ============================================

export interface TikTokUserInfo {
  open_id: string;
  union_id?: string;
  avatar_url: string;
  avatar_url_100?: string;
  avatar_large_url?: string;
  display_name: string;
  bio_description?: string;
  profile_deep_link?: string;
  is_verified?: boolean;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
}

export interface TikTokUserInfoResponse {
  data: {
    user: TikTokUserInfo;
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

export interface TikTokVideo {
  id: string;
  title?: string;
  create_time: number; // Unix timestamp
  cover_image_url?: string;
  share_url?: string;
  video_description?: string;
  duration?: number;
  height?: number;
  width?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
}

export interface TikTokVideoListResponse {
  data: {
    videos: TikTokVideo[];
    cursor: number;
    has_more: boolean;
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

export interface UserStats {
  openId: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
}

export interface VideoStats {
  videoId: string;
  description: string;
  createTime: Date;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  coverImageUrl: string;
  shareUrl: string;
}

// ============================================
// CONFIGURATION
// ============================================

const TIKTOK_API_BASE = "https://open.tiktokapis.com";

// API endpoints
const USER_INFO_URL = `${TIKTOK_API_BASE}/v2/user/info/`;
const VIDEO_LIST_URL = `${TIKTOK_API_BASE}/v2/video/list/`;

// Fields to request from API
// PLACEHOLDER: Adjust these based on your approved scopes
const USER_INFO_FIELDS = [
  "open_id",
  "display_name",
  "avatar_url",
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
];

const VIDEO_FIELDS = [
  "id",
  "create_time",
  "cover_image_url",
  "share_url",
  "video_description",
  "duration",
  "like_count",
  "comment_count",
  "share_count",
  "view_count",
];

// Rate limiter: TikTok allows ~100 requests/minute per user token
// Being conservative with 1 request per second
const rateLimiter = createRateLimiter(1);

// ============================================
// ERROR HANDLING
// ============================================

export class TikTokApiError extends Error {
  public code: string;
  public logId: string;
  public statusCode?: number;

  constructor(
    message: string,
    code: string,
    logId: string,
    statusCode?: number
  ) {
    super(message);
    this.name = "TikTokApiError";
    this.code = code;
    this.logId = logId;
    this.statusCode = statusCode;
  }

  isAuthError(): boolean {
    return (
      this.code === "access_token_invalid" ||
      this.code === "access_token_expired" ||
      this.code === "invalid_token" ||
      this.statusCode === 401
    );
  }

  isRateLimitError(): boolean {
    return this.code === "rate_limit_exceeded" || this.statusCode === 429;
  }
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Get user info and statistics
 */
export async function getUserInfo(accessToken: string): Promise<UserStats> {
  await rateLimiter();

  const url = new URL(USER_INFO_URL);
  url.searchParams.set("fields", USER_INFO_FIELDS.join(","));

  logger.debug("Fetching user info from TikTok API");

  const response = await withRetry(
    async () => {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = (await res.json()) as TikTokUserInfoResponse;

      // Check for API errors
      if (data.error?.code && data.error.code !== "ok") {
        throw new TikTokApiError(
          data.error.message || "Unknown TikTok API error",
          data.error.code,
          data.error.log_id,
          res.status
        );
      }

      if (!res.ok) {
        throw new TikTokApiError(
          `HTTP error ${res.status}`,
          "http_error",
          "",
          res.status
        );
      }

      return data;
    },
    {
      maxRetries: 3,
      retryableErrors: (err): boolean => {
        if (err instanceof TikTokApiError) {
          return (
            err.isRateLimitError() ||
            Boolean(err.statusCode && err.statusCode >= 500)
          );
        }
        return false;
      },
    },
    "getUserInfo"
  );

  const user = response.data.user;

  return {
    openId: user.open_id,
    displayName: user.display_name || "",
    avatarUrl: user.avatar_url || "",
    followerCount: user.follower_count ?? 0,
    followingCount: user.following_count ?? 0,
    likesCount: user.likes_count ?? 0,
    videoCount: user.video_count ?? 0,
  };
}

/**
 * List user's videos with pagination
 */
export async function listVideos(
  accessToken: string,
  options: {
    cursor?: number;
    maxCount?: number;
  } = {}
): Promise<{
  videos: VideoStats[];
  cursor: number;
  hasMore: boolean;
}> {
  await rateLimiter();

  const { cursor = 0, maxCount = 20 } = options;

  logger.debug({ cursor, maxCount }, "Fetching video list from TikTok API");

  // Build URL with fields as query parameter
  const url = new URL(VIDEO_LIST_URL);
  url.searchParams.set("fields", VIDEO_FIELDS.join(","));

  const response = await withRetry(
    async () => {
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cursor,
          max_count: Math.min(maxCount, 20), // TikTok max is 20
        }),
      });

      const data = (await res.json()) as TikTokVideoListResponse;

      // Check for API errors
      if (data.error?.code && data.error.code !== "ok") {
        throw new TikTokApiError(
          data.error.message || "Unknown TikTok API error",
          data.error.code,
          data.error.log_id,
          res.status
        );
      }

      if (!res.ok) {
        throw new TikTokApiError(
          `HTTP error ${res.status}`,
          "http_error",
          "",
          res.status
        );
      }

      return data;
    },
    {
      maxRetries: 3,
      retryableErrors: (err): boolean => {
        if (err instanceof TikTokApiError) {
          return (
            err.isRateLimitError() ||
            Boolean(err.statusCode && err.statusCode >= 500)
          );
        }
        return false;
      },
    },
    "listVideos"
  );

  const videos: VideoStats[] = (response.data.videos || []).map((video) => ({
    videoId: video.id,
    description: video.video_description || video.title || "",
    createTime: new Date(video.create_time * 1000),
    viewCount: video.view_count ?? 0,
    likeCount: video.like_count ?? 0,
    commentCount: video.comment_count ?? 0,
    shareCount: video.share_count ?? 0,
    coverImageUrl: video.cover_image_url || "",
    shareUrl: video.share_url || "",
  }));

  return {
    videos,
    cursor: response.data.cursor,
    hasMore: response.data.has_more,
  };
}

/**
 * Fetch all videos with automatic pagination
 * Warning: This can be slow and rate-limited for accounts with many videos
 */
export async function fetchAllVideos(
  accessToken: string,
  options: {
    maxVideos?: number;
    onProgress?: (fetched: number, total: number | null) => void;
  } = {}
): Promise<VideoStats[]> {
  const { maxVideos = 1000, onProgress } = options;
  const allVideos: VideoStats[] = [];
  let cursor = 0;
  let hasMore = true;
  let pageCount = 0;

  logger.info("Starting to fetch all videos");

  while (hasMore && allVideos.length < maxVideos) {
    const result = await listVideos(accessToken, { cursor, maxCount: 20 });

    allVideos.push(...result.videos);
    cursor = result.cursor;
    hasMore = result.hasMore;
    pageCount++;

    onProgress?.(allVideos.length, null);

    logger.debug(
      {
        page: pageCount,
        fetched: result.videos.length,
        total: allVideos.length,
        hasMore,
      },
      "Fetched video page"
    );

    // Safety check - don't fetch forever
    if (pageCount > 100) {
      logger.warn("Reached maximum page limit (100 pages)");
      break;
    }
  }

  logger.info(
    { totalVideos: allVideos.length, pages: pageCount },
    "Completed fetching all videos"
  );

  return allVideos.slice(0, maxVideos);
}

/**
 * Check if an error indicates the token needs refresh
 */
export function needsTokenRefresh(error: unknown): boolean {
  if (error instanceof TikTokApiError) {
    return error.isAuthError();
  }
  return false;
}
