/**
 * Analytics Composable
 * Fetches aggregated analytics data from backend
 */

export interface AnalyticsOverview {
  stores: {
    total: number;
    connected: number;
  };
  followers: {
    total: number;
  };
  videos: {
    total: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
  };
  snapshotDate: string;
}

export interface FollowersTrendPoint {
  date: string;
  followers: number;
  likes: number;
  stores: number;
}

export interface VideoPerformancePoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  videos: number;
}

export interface TopStore {
  storeCode: string;
  storeName: string;
  displayName: string | null;
  avatarUrl: string | null;
  followers: number;
  profileLikes: number;
  videoCount: number;
  totalViews: number;
  totalVideoLikes: number;
  totalComments: number;
  totalShares: number;
  engagementScore: number;
}

export interface TopVideo {
  storeCode: string;
  storeName: string;
  videoId: string;
  description: string | null;
  coverImageUrl: string | null;
  shareUrl: string | null;
  createTime: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface SyncHealth {
  last24Hours: {
    success: number;
    failed: number;
    skipped: number;
    running: number;
  };
  accountStatus: {
    needReconnect: number;
    hasError: number;
  };
}

export const useAnalytics = () => {
  const toast = useToast();

  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Get analytics overview
   */
  const getOverview = async (storeCode?: string): Promise<AnalyticsOverview | null> => {
    loading.value = true;
    error.value = null;

    try {
      const url = storeCode && storeCode !== "all" 
        ? `/api/admin/analytics/overview?storeCode=${storeCode}`
        : "/api/admin/analytics/overview";
      
      const response = await $fetch<{
        success: boolean;
        data?: AnalyticsOverview;
        error?: { message: string };
      }>(url);

      if (response.success && response.data) {
        return response.data;
      }

      error.value = response.error?.message || "Failed to fetch overview";
      return null;
    } catch (err) {
      console.error("Failed to fetch analytics overview:", err);
      error.value = "Failed to fetch analytics data";
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Get followers trend data
   */
  const getFollowersTrend = async (days: number = 30, storeCode?: string): Promise<FollowersTrendPoint[]> => {
    try {
      const params = new URLSearchParams({ days: days.toString() });
      if (storeCode && storeCode !== "all") {
        params.append("storeCode", storeCode);
      }
      
      const response = await $fetch<{
        success: boolean;
        data?: FollowersTrendPoint[];
        error?: { message: string };
      }>(`/api/admin/analytics/followers-trend?${params.toString()}`);

      if (response.success && response.data) {
        return response.data;
      }

      return [];
    } catch (err) {
      console.error("Failed to fetch followers trend:", err);
      return [];
    }
  };

  /**
   * Get video performance data
   */
  const getVideoPerformance = async (days: number = 30, storeCode?: string): Promise<VideoPerformancePoint[]> => {
    try {
      const params = new URLSearchParams({ days: days.toString() });
      if (storeCode && storeCode !== "all") {
        params.append("storeCode", storeCode);
      }
      
      const response = await $fetch<{
        success: boolean;
        data?: VideoPerformancePoint[];
        error?: { message: string };
      }>(`/api/admin/analytics/video-performance?${params.toString()}`);

      if (response.success && response.data) {
        return response.data;
      }

      return [];
    } catch (err) {
      console.error("Failed to fetch video performance:", err);
      return [];
    }
  };

  /**
   * Get top stores
   */
  const getTopStores = async (
    sort: "followers" | "views" | "engagement" = "followers",
    limit: number = 10
  ): Promise<TopStore[]> => {
    try {
      const response = await $fetch<{
        success: boolean;
        data?: TopStore[];
        error?: { message: string };
      }>(`/api/admin/analytics/top-stores?sort=${sort}&limit=${limit}`);

      if (response.success && response.data) {
        return response.data;
      }

      return [];
    } catch (err) {
      console.error("Failed to fetch top stores:", err);
      return [];
    }
  };

  /**
   * Get top videos
   */
  const getTopVideos = async (
    sort: "views" | "likes" | "comments" | "shares" = "views",
    limit: number = 10
  ): Promise<TopVideo[]> => {
    try {
      const response = await $fetch<{
        success: boolean;
        data?: TopVideo[];
        error?: { message: string };
      }>(`/api/admin/analytics/top-videos?sort=${sort}&limit=${limit}`);

      if (response.success && response.data) {
        return response.data;
      }

      return [];
    } catch (err) {
      console.error("Failed to fetch top videos:", err);
      return [];
    }
  };

  /**
   * Get sync health status
   */
  const getSyncHealth = async (): Promise<SyncHealth | null> => {
    try {
      const response = await $fetch<{
        success: boolean;
        data?: SyncHealth;
        error?: { message: string };
      }>("/api/admin/analytics/sync-health");

      if (response.success && response.data) {
        return response.data;
      }

      return null;
    } catch (err) {
      console.error("Failed to fetch sync health:", err);
      return null;
    }
  };

  /**
   * Format large numbers
   */
  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(1) + "B";
    }
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + "M";
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1) + "K";
    }
    return num.toString();
  };

  /**
   * Format percentage change
   */
  const formatChange = (current: number, previous: number): { value: string; positive: boolean } => {
    if (previous === 0) {
      return { value: current > 0 ? "+100%" : "0%", positive: current > 0 };
    }
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? "+" : "";
    return {
      value: `${sign}${change.toFixed(1)}%`,
      positive: change >= 0,
    };
  };

  return {
    // State
    loading: computed(() => loading.value),
    error: computed(() => error.value),

    // Actions
    getOverview,
    getFollowersTrend,
    getVideoPerformance,
    getTopStores,
    getTopVideos,
    getSyncHealth,

    // Helpers
    formatNumber,
    formatChange,
  };
};
