<script setup lang="ts">
import { VisXYContainer, VisLine, VisArea, VisAxis, VisBulletLegend, VisTooltip } from "@unovis/vue";
import type { AnalyticsOverview, FollowersTrendPoint, VideoPerformancePoint, TopStore, SyncHealth } from "~/composables/useAnalytics";

// Auth protection - Admin or Ops only
definePageMeta({
  middleware: "auth",
  requiredRoles: ["Admin", "Ops"],
});

useHead({
  title: "Analytics - TikTok Hubs",
});

const { 
  getOverview, 
  getFollowersTrend, 
  getVideoPerformance, 
  getTopStores, 
  getSyncHealth,
  formatNumber 
} = useAnalytics();

const { getStores } = useStores();

// State
const loading = ref(true);
const overview = ref<AnalyticsOverview | null>(null);
const followersTrend = ref<FollowersTrendPoint[]>([]);
const videoPerformance = ref<VideoPerformancePoint[]>([]);
const topStores = ref<TopStore[]>([]);
const syncHealth = ref<SyncHealth | null>(null);
const storesList = ref<Array<{ storeCode: string; storeName: string }>>([]);
const selectedStore = ref<string>("all");

// Chart settings
const selectedDays = ref(30);
const daysOptions = [
  { label: "7 Days", value: 7 },
  { label: "14 Days", value: 14 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
];

// Chart accessors
const x = (d: FollowersTrendPoint | VideoPerformancePoint) => new Date(d.date);
const followersY = (d: FollowersTrendPoint) => d.followers;
const likesY = (d: FollowersTrendPoint) => d.likes;
const viewsY = (d: VideoPerformancePoint) => d.views;
const videoLikesY = (d: VideoPerformancePoint) => d.likes;

// Load data
const loadData = async () => {
  loading.value = true;
  try {
    const storeCode = selectedStore.value !== "all" ? selectedStore.value : undefined;
    const [overviewData, followersData, videoData, storesData, healthData] = await Promise.all([
      getOverview(storeCode),
      getFollowersTrend(selectedDays.value, storeCode),
      getVideoPerformance(selectedDays.value, storeCode),
      getTopStores("followers", 10),
      getSyncHealth(),
    ]);

    overview.value = overviewData;
    followersTrend.value = followersData;
    videoPerformance.value = videoData;
    topStores.value = storesData;
    syncHealth.value = healthData;
    
    console.log('Analytics data loaded:', {
      overview: overviewData,
      followersDataPoints: followersData?.length || 0,
      videoDataPoints: videoData?.length || 0,
      selectedStore: storeCode || 'all',
    });
  } catch (error) {
    console.error("Failed to load analytics:", error);
  } finally {
    loading.value = false;
  }
};

// Load stores for filter
const loadStores = async () => {
  try {
    const stores = await getStores();
    storesList.value = stores.map(s => ({
      storeCode: s.storeCode,
      storeName: s.storeName,
    }));
  } catch (error) {
    console.error("Failed to load stores:", error);
  }
};

// Watch days or store change
watch([selectedDays, selectedStore], async () => {
  const storeCode = selectedStore.value !== "all" ? selectedStore.value : undefined;
  
  loading.value = true;
  try {
    const [overviewData, followersData, videoData] = await Promise.all([
      getOverview(storeCode),
      getFollowersTrend(selectedDays.value, storeCode),
      getVideoPerformance(selectedDays.value, storeCode),
    ]);
    
    overview.value = overviewData;
    followersTrend.value = followersData;
    videoPerformance.value = videoData;
    
    console.log('Analytics filter updated:', {
      selectedStore: storeCode || 'all',
      selectedDays: selectedDays.value,
      followersDataPoints: followersData?.length || 0,
      videoDataPoints: videoData?.length || 0,
    });
  } catch (error) {
    console.error("Failed to update analytics:", error);
  } finally {
    loading.value = false;
  }
});

// Load on mount
onMounted(() => {
  loadData();
  loadStores();
});

// Calculate engagement rate
const engagementRate = computed(() => {
  if (!overview.value) return "0%";
  const totalViews = overview.value.videos.totalViews;
  const totalEngagement = overview.value.videos.totalLikes + 
    overview.value.videos.totalComments + 
    overview.value.videos.totalShares;
  if (totalViews === 0) return "0%";
  return ((totalEngagement / totalViews) * 100).toFixed(2) + "%";
});

// Sync health color
const getSyncHealthColor = (health: SyncHealth | null) => {
  if (!health) return "neutral";
  const { success, failed } = health.last24Hours;
  if (failed > 0 && failed >= success) return "error";
  if (failed > 0) return "warning";
  return "success";
};
</script>

<template>
  <UContainer class="py-4 sm:py-6 max-w-full overflow-x-hidden">
    <!-- Header -->
    <PageHeader title="Analytics" description="View system-wide analytics and insights">
      <template #actions>
        <USelect
          v-model="selectedStore"
          :items="[
            { label: 'All Stores', value: 'all' },
            ...storesList.map(s => ({ label: s.storeName, value: s.storeCode }))
          ]"
          class="w-full sm:w-48"
          size="sm"
          placeholder="Filter by store"
        />
        <USelect
          v-model="selectedDays"
          :items="daysOptions"
          class="w-full sm:w-32"
          size="sm"
        />
        <UButton
          icon="i-lucide-refresh-cw"
          variant="outline"
          :loading="loading"
          @click="loadData"
          size="sm"
          class="w-full sm:w-auto"
        >
          <span class="hidden sm:inline">Refresh</span>
          <span class="sm:hidden">↻</span>
        </UButton>
      </template>
    </PageHeader>

    <div class="mt-4 sm:mt-6">
        <!-- Loading State -->
        <div v-if="loading" class="flex flex-col items-center justify-center py-20">
          <UIcon name="i-lucide-loader-2" class="animate-spin w-10 h-10 mb-4 text-primary" />
          <p class="text-dimmed">Loading analytics data...</p>
        </div>

        <div v-else class="space-y-4 sm:space-y-6">
          <!-- Overview Stats -->
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <!-- Total Stores -->
            <UCard>
              <div class="flex items-center justify-between">
                <div class="min-w-0 flex-1">
                  <p class="text-xs sm:text-sm text-dimmed">Total Stores</p>
                  <p class="text-2xl sm:text-3xl font-bold truncate">{{ overview?.stores.total || 0 }}</p>
                  <p class="text-xs text-dimmed mt-1 truncate">
                    {{ overview?.stores.connected || 0 }} connected
                  </p>
                </div>
                <div class="p-2 sm:p-3 bg-primary/10 rounded-lg flex-shrink-0">
                  <UIcon name="i-lucide-store" class="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
              </div>
            </UCard>

            <!-- Total Followers -->
            <UCard>
              <div class="flex items-center justify-between">
                <div class="min-w-0 flex-1">
                  <p class="text-xs sm:text-sm text-dimmed">Total Followers</p>
                  <p class="text-2xl sm:text-3xl font-bold truncate">{{ formatNumber(overview?.followers.total || 0) }}</p>
                  <p class="text-xs text-dimmed mt-1 truncate">
                    Across all stores
                  </p>
                </div>
                <div class="p-2 sm:p-3 bg-success/10 rounded-lg flex-shrink-0">
                  <UIcon name="i-lucide-users" class="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                </div>
              </div>
            </UCard>

            <!-- Total Views -->
            <UCard>
              <div class="flex items-center justify-between">
                <div class="min-w-0 flex-1">
                  <p class="text-xs sm:text-sm text-dimmed">Total Views</p>
                  <p class="text-2xl sm:text-3xl font-bold truncate">{{ formatNumber(overview?.videos.totalViews || 0) }}</p>
                  <p class="text-xs text-dimmed mt-1 truncate">
                    {{ formatNumber(overview?.videos.total || 0) }} videos
                  </p>
                </div>
                <div class="p-2 sm:p-3 bg-info/10 rounded-lg flex-shrink-0">
                  <UIcon name="i-lucide-eye" class="w-5 h-5 sm:w-6 sm:h-6 text-info" />
                </div>
              </div>
            </UCard>

            <!-- Engagement Rate -->
            <UCard>
              <div class="flex items-center justify-between">
                <div class="min-w-0 flex-1">
                  <p class="text-xs sm:text-sm text-dimmed">Engagement Rate</p>
                  <p class="text-2xl sm:text-3xl font-bold truncate">{{ engagementRate }}</p>
                  <p class="text-xs text-dimmed mt-1 truncate">
                    {{ formatNumber(overview?.videos.totalLikes || 0) }} likes
                  </p>
                </div>
                <div class="p-2 sm:p-3 bg-warning/10 rounded-lg flex-shrink-0">
                  <UIcon name="i-lucide-heart" class="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
                </div>
              </div>
            </UCard>
          </div>

          <!-- Charts Row -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <!-- Followers Trend -->
            <UCard>
              <template #header>
                <h3 class="text-sm sm:text-base font-semibold">Followers Trend</h3>
              </template>
              
              <div v-if="followersTrend.length > 0" class="h-48 sm:h-64">
                <VisXYContainer :data="followersTrend" :margin="{ top: 10, right: 10, bottom: 30, left: 50 }">
                  <VisArea :x="x" :y="followersY" color="var(--color-primary-500)" :opacity="0.2" />
                  <VisLine :x="x" :y="followersY" color="var(--color-primary-500)" />
                  <VisAxis type="x" :tickFormat="(d: Date) => d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })" />
                  <VisAxis type="y" :tickFormat="(d: number) => formatNumber(d)" />
                </VisXYContainer>
              </div>
              <div v-else class="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <UIcon name="i-lucide-bar-chart-3" class="w-12 h-12 mb-3" />
                <p class="font-medium">No follower data available</p>
                <p class="text-sm mt-1">Data will appear after running daily sync jobs</p>
              </div>
            </UCard>

            <!-- Video Views Trend -->
            <UCard>
              <template #header>
                <h3 class="text-sm sm:text-base font-semibold">Video Views Trend</h3>
              </template>
              
              <div v-if="videoPerformance.length > 0" class="h-48 sm:h-64">
                <VisXYContainer :data="videoPerformance" :margin="{ top: 10, right: 10, bottom: 30, left: 50 }">
                  <VisArea :x="x" :y="viewsY" color="var(--color-info-500)" :opacity="0.2" />
                  <VisLine :x="x" :y="viewsY" color="var(--color-info-500)" />
                  <VisAxis type="x" :tickFormat="(d: Date) => d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })" />
                  <VisAxis type="y" :tickFormat="(d: number) => formatNumber(d)" />
                </VisXYContainer>
              </div>
              <div v-else class="h-64 flex items-center justify-center text-dimmed">
                <p>No data available</p>
              </div>
            </UCard>
          </div>

          <!-- Bottom Row -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <!-- Top Stores -->
            <UCard class="lg:col-span-2">
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-sm sm:text-base font-semibold">Top Stores by Followers</h3>
                  <UButton
                    to="/tiktok-store-accounts"
                    variant="ghost"
                    size="xs"
                    trailing-icon="i-lucide-arrow-right"
                  >
                    <span class="hidden sm:inline">View All</span>
                    <span class="sm:hidden">All</span>
                  </UButton>
                </div>
              </template>
              
              <div v-if="topStores.length > 0" class="divide-y divide-default">
                <div
                  v-for="(store, index) in topStores.slice(0, 5)"
                  :key="store.storeCode"
                  class="flex items-center gap-3 sm:gap-4 py-2 sm:py-3"
                >
                  <span class="text-base sm:text-lg font-bold text-dimmed w-5 sm:w-6 flex-shrink-0">{{ index + 1 }}</span>
                  <UAvatar
                    :src="store.avatarUrl || undefined"
                    :text="store.storeName.slice(0, 2).toUpperCase()"
                    size="sm"
                    class="flex-shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <NuxtLink 
                      :to="`/stores/${store.storeCode}`"
                      class="text-sm sm:text-base font-medium hover:text-primary truncate block"
                    >
                      {{ store.storeName }}
                    </NuxtLink>
                    <p class="text-xs text-dimmed truncate">
                      {{ store.displayName || store.storeCode }}
                    </p>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="text-sm sm:text-base font-semibold">{{ formatNumber(store.followers) }}</p>
                    <p class="text-xs text-dimmed">followers</p>
                  </div>
                </div>
              </div>
              <div v-else class="py-6 sm:py-8 text-center text-dimmed">
                <UIcon name="i-lucide-users" class="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
                <p class="text-sm">No store data available</p>
              </div>
            </UCard>

            <!-- Sync Health -->
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm sm:text-base font-semibold">Sync Health</h3>
                  <UBadge :color="getSyncHealthColor(syncHealth)" variant="subtle" size="xs">
                    {{ syncHealth ? 'Last 24h' : 'N/A' }}
                  </UBadge>
                </div>
              </template>
              
              <div v-if="syncHealth" class="space-y-3 sm:space-y-4">
                <div class="grid grid-cols-2 gap-3 sm:gap-4">
                  <div class="text-center p-2 sm:p-3 bg-success/10 rounded-lg">
                    <p class="text-xl sm:text-2xl font-bold text-success">{{ syncHealth.last24Hours.success }}</p>
                    <p class="text-xs text-dimmed">Successful</p>
                  </div>
                  <div class="text-center p-2 sm:p-3 bg-error/10 rounded-lg">
                    <p class="text-xl sm:text-2xl font-bold text-error">{{ syncHealth.last24Hours.failed }}</p>
                    <p class="text-xs text-dimmed">Failed</p>
                  </div>
                </div>

                <USeparator />

                <div class="space-y-2">
                  <div class="flex items-center justify-between text-xs sm:text-sm">
                    <span class="text-dimmed">Need Reconnect</span>
                    <UBadge 
                      :color="syncHealth.accountStatus.needReconnect > 0 ? 'warning' : 'success'" 
                      variant="subtle"
                      size="xs"
                    >
                      {{ syncHealth.accountStatus.needReconnect }}
                    </UBadge>
                  </div>
                  <div class="flex items-center justify-between text-xs sm:text-sm">
                    <span class="text-dimmed">Has Errors</span>
                    <UBadge 
                      :color="syncHealth.accountStatus.hasError > 0 ? 'error' : 'success'" 
                      variant="subtle"
                      size="xs"
                    >
                      {{ syncHealth.accountStatus.hasError }}
                    </UBadge>
                  </div>
                  <div class="flex items-center justify-between text-xs sm:text-sm">
                    <span class="text-dimmed">Skipped</span>
                    <UBadge color="neutral" variant="subtle" size="xs">
                      {{ syncHealth.last24Hours.skipped }}
                    </UBadge>
                  </div>
                </div>

                <UButton
                  to="/tiktok-store-accounts"
                  color="neutral"
                  variant="soft"
                  block
                  icon="i-lucide-settings"
                  size="sm"
                >
                  <span class="text-xs sm:text-sm">Manage Connections</span>
                </UButton>
              </div>
              <div v-else class="py-6 sm:py-8 text-center text-dimmed">
                <UIcon name="i-lucide-activity" class="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
                <p class="text-sm">No sync data available</p>
              </div>
            </UCard>
          </div>

          <!-- Video Engagement Stats -->
          <UCard>
            <template #header>
              <h3 class="text-sm sm:text-base font-semibold">Video Engagement Overview</h3>
            </template>
            
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div class="text-center p-3 sm:p-4 bg-default/50 rounded-lg">
                <UIcon name="i-lucide-eye" class="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-info" />
                <p class="text-lg sm:text-2xl font-bold">{{ formatNumber(overview?.videos.totalViews || 0) }}</p>
                <p class="text-xs sm:text-sm text-dimmed">Total Views</p>
              </div>
              <div class="text-center p-3 sm:p-4 bg-default/50 rounded-lg">
                <UIcon name="i-lucide-heart" class="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-error" />
                <p class="text-lg sm:text-2xl font-bold">{{ formatNumber(overview?.videos.totalLikes || 0) }}</p>
                <p class="text-xs sm:text-sm text-dimmed">Total Likes</p>
              </div>
              <div class="text-center p-3 sm:p-4 bg-default/50 rounded-lg">
                <UIcon name="i-lucide-message-circle" class="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-primary" />
                <p class="text-lg sm:text-2xl font-bold">{{ formatNumber(overview?.videos.totalComments || 0) }}</p>
                <p class="text-xs sm:text-sm text-dimmed">Total Comments</p>
              </div>
              <div class="text-center p-3 sm:p-4 bg-default/50 rounded-lg">
                <UIcon name="i-lucide-share-2" class="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-success" />
                <p class="text-lg sm:text-2xl font-bold">{{ formatNumber(overview?.videos.totalShares || 0) }}</p>
                <p class="text-xs sm:text-sm text-dimmed">Total Shares</p>
              </div>
            </div>
          </UCard>
        </div>
      </div>
  </UContainer>
</template>
