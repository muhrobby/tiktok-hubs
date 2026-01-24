/**
 * Composable untuk Store management API calls
 * Semua API calls melalui Nuxt Server Routes (/api/admin/**)
 */

import type {
  Store,
  StoreAccount,
  UserStats,
  VideoStats,
  SyncLog,
  CreateStoreRequest,
  ApiResponse,
} from "~/types/api";

export const useStores = () => {
  const toBoolean = (value: unknown): boolean => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") return value === "true" || value === "1";
    return false;
  };

  const mapStore = (item: Record<string, unknown>): Store => {
    return {
      storeCode: (item.storeCode ?? item.store_code ?? "") as string,
      storeName: (item.storeName ?? item.store_name ?? "") as string,
      picName: (item.picName ?? item.pic_name ?? "") as string,
      picContact: (item.picContact ?? item.pic_contact ?? null) as
        | string
        | null,
      status: (item.status ?? item.connection_status ?? "") as string,
      lastSyncTime: (item.lastSyncTime ??
        item.last_sync_time ??
        item.last_sync_at ??
        null) as string | null,
      connectedAt: (item.connectedAt ?? item.connected_at ?? null) as
        | string
        | null,
      createdAt: (item.createdAt ?? item.created_at ?? undefined) as
        | string
        | undefined,
    };
  };

  const mapStoreAccount = (item: Record<string, unknown>): StoreAccount => {
    return {
      id: Number(item.id ?? 0),
      storeCode: (item.storeCode ?? item.store_code ?? "") as string,
      platform: (item.platform ?? "tiktok") as "tiktok",
      hasValidToken: toBoolean(item.hasValidToken ?? item.has_valid_token),
      accountIdentifier: (item.accountIdentifier ??
        item.account_identifier ??
        null) as string | null,
      lastSyncAt: (item.lastSyncAt ?? item.last_sync_at ?? null) as
        | string
        | null,
      createdAt: (item.createdAt ?? item.created_at ?? "") as string,
      updatedAt: (item.updatedAt ?? item.updated_at ?? "") as string,
    };
  };

  const mapUserStats = (item: Record<string, unknown>): UserStats => {
    return {
      openId: (item.openId ?? item.open_id ?? "") as string,
      displayName: (item.displayName ?? item.display_name ?? "") as string,
      avatarUrl: (item.avatarUrl ?? item.avatar_url ?? "") as string,
      followerCount: Number(item.followerCount ?? item.follower_count ?? 0),
      followingCount: Number(item.followingCount ?? item.following_count ?? 0),
      likesCount: Number(item.likesCount ?? item.likes_count ?? 0),
      videoCount: Number(item.videoCount ?? item.video_count ?? 0),
      snapshotDate: (item.snapshotDate ?? item.snapshot_date ?? "") as string,
    };
  };

  const mapVideoStats = (item: Record<string, unknown>): VideoStats => {
    return {
      videoId: (item.videoId ?? item.video_id ?? "") as string,
      description: (item.description ?? "") as string,
      coverImageUrl: (item.coverImageUrl ??
        item.cover_image_url ??
        "") as string,
      shareUrl: (item.shareUrl ?? item.share_url ?? "") as string,
      createTime: (item.createTime ?? item.create_time ?? "") as string,
      viewCount: Number(item.viewCount ?? item.view_count ?? 0),
      likeCount: Number(item.likeCount ?? item.like_count ?? 0),
      commentCount: Number(item.commentCount ?? item.comment_count ?? 0),
      shareCount: Number(item.shareCount ?? item.share_count ?? 0),
      snapshotDate: (item.snapshotDate ?? item.snapshot_date ?? "") as string,
    };
  };

  const mapSyncLog = (item: Record<string, unknown>): SyncLog => {
    return {
      id: Number(item.id ?? 0),
      storeCode: (item.storeCode ?? item.store_code ?? "") as string,
      jobName: (item.jobName ?? item.job_name ?? "") as string,
      status: (item.status ?? "") as SyncLog["status"],
      message: (item.message ?? null) as string | null,
      runTime: (item.runTime ?? item.run_time ?? "") as string,
      durationMs: (item.durationMs ?? item.duration_ms ?? null) as
        | number
        | null,
    };
  };
  /**
   * Get all stores
   */
  const getStores = async (): Promise<Store[]> => {
    const response = await $fetch<ApiResponse<Store[]>>("/api/admin/stores");
    const data = (response.data ?? []) as unknown[];
    return data.map((item) => mapStore(item as Record<string, unknown>));
  };

  /**
   * Create new store
   */
  const createStore = async (request: CreateStoreRequest): Promise<Store> => {
    const response = await $fetch<ApiResponse<Store>>("/api/admin/stores", {
      method: "POST",
      body: {
        store_code: request.storeCode,
        store_name: request.storeName,
        pic_name: request.picName,
        pic_contact: request.picContact,
      },
    });

    if (response.error || !response.data) {
      throw new Error(response.error?.message || "Gagal membuat toko");
    }
    return mapStore(response.data as unknown as Record<string, unknown>);
  };

  /**
   * Get store accounts
   */
  const getStoreAccounts = async (
    storeCode: string,
  ): Promise<StoreAccount[]> => {
    const response = await $fetch<ApiResponse<StoreAccount[]>>(
      `/api/admin/stores/${storeCode}/accounts`,
    );
    const data = (response.data ?? []) as unknown[];
    return data.map((item) => mapStoreAccount(item as Record<string, unknown>));
  };

  /**
   * Connect TikTok account (get OAuth URL)
   */
  const connectTikTok = async (storeCode: string): Promise<string> => {
    const response = await $fetch<{
      authUrl?: string;
      auth_url?: string;
      success?: boolean;
    }>("/api/auth/url", {
      query: { store_code: storeCode },
    });
    return response.authUrl || response.auth_url || "";
  };

  /**
   * Disconnect account
   */
  const disconnectAccount = async (storeCode: string): Promise<void> => {
    await $fetch(`/api/admin/stores/${storeCode}/disconnect`, {
      method: "DELETE",
    });
  };

  /**
   * Get user daily stats
   */
  const getUserStats = async (
    storeCode: string,
    days: number = 30,
  ): Promise<UserStats[]> => {
    const response = await $fetch<ApiResponse<UserStats[]>>(
      `/api/admin/stores/${storeCode}/user-stats`,
      { query: { days: days.toString() } },
    );
    const data = (response.data ?? []) as unknown[];
    return data.map((item) => mapUserStats(item as Record<string, unknown>));
  };

  /**
   * Get video daily stats
   */
  const getVideoStats = async (
    storeCode: string,
    days: number = 30,
  ): Promise<VideoStats[]> => {
    const response = await $fetch<ApiResponse<VideoStats[]>>(
      `/api/admin/stores/${storeCode}/video-stats`,
      { query: { days: days.toString() } },
    );
    const data = (response.data ?? []) as unknown[];
    return data.map((item) => mapVideoStats(item as Record<string, unknown>));
  };

  /**
   * Get sync logs
   */
  const getSyncLogs = async (
    storeCode: string,
    limit: number = 50,
  ): Promise<SyncLog[]> => {
    const response = await $fetch<ApiResponse<SyncLog[]>>(
      `/api/admin/stores/${storeCode}/sync-logs`,
      { query: { limit: limit.toString() } },
    );
    const data = (response.data ?? []) as unknown[];
    return data.map((item) => mapSyncLog(item as Record<string, unknown>));
  };

  /**
   * Trigger manual sync - user stats
   */
  const syncUserStats = async (storeCode: string): Promise<void> => {
    await $fetch(`/api/admin/sync/run`, {
      method: "POST",
      body: {
        store_code: storeCode,
        job: "user",
      },
    });
  };

  /**
   * Trigger manual sync - video stats
   */
  const syncVideoStats = async (storeCode: string): Promise<void> => {
    await $fetch(`/api/admin/sync/run`, {
      method: "POST",
      body: {
        store_code: storeCode,
        job: "video",
      },
    });
  };

  /**
   * Trigger manual sync for all stores
   */
  const syncAllStores = async (): Promise<void> => {
    await $fetch(`/api/admin/sync/run`, {
      method: "POST",
      body: {
        job: "all",
      },
    });
  };

  return {
    getStores,
    createStore,
    getStoreAccounts,
    connectTikTok,
    disconnectAccount,
    getUserStats,
    getVideoStats,
    getSyncLogs,
    syncUserStats,
    syncVideoStats,
    syncAllStores,
  };
};
