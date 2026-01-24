/**
 * Type definitions untuk API responses dari backend
 */

export interface Store {
  storeCode: string;
  storeName: string;
  picName: string;
  picContact: string | null;
  status: string;
  lastSyncTime: string | null;
  connectedAt: string | null;
  createdAt?: string;
}

export interface StoreAccount {
  id: number;
  storeCode: string;
  platform: "tiktok";
  hasValidToken: boolean;
  accountIdentifier: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  openId: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
  snapshotDate: string;
}

export interface VideoStats {
  videoId: string;
  description: string;
  coverImageUrl: string;
  shareUrl: string;
  createTime: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  snapshotDate: string;
}

export interface SyncLog {
  id: number;
  storeCode: string;
  jobName: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";
  message: string | null;
  runTime: string;
  durationMs: number | null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface CreateStoreRequest {
  storeName: string;
  storeCode: string;
  picName: string;
  picContact?: string;
}
