<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { UserStats, VideoStats, SyncLog } from "~/types/api";
import { getPaginationRowModel } from "@tanstack/table-core";
import { h } from "vue";

// Auth protection
definePageMeta({
  middleware: "auth",
});

const route = useRoute();
const storeCode = route.params.storeCode as string;

const {
  getUserStats,
  getVideoStats,
  getSyncLogs,
  syncUserStats,
  syncVideoStats,
} = useStores();
const { formatNumber, formatDate, getStatusColor } = useFormatters();
const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const toast = useToast();

type PaginationState = {
  pageIndex: number;
  pageSize: number;
};

type TableState = {
  pagination: PaginationState;
};

type TableApi = {
  getFilteredRowModel: () => { rows: unknown[] };
  getState: () => TableState;
  setPageIndex: (page: number) => void;
};

type TableRef = {
  tableApi?: TableApi;
};

// State
const userStats = ref<UserStats[]>([]);
const videoStats = ref<VideoStats[]>([]);
const syncLogs = ref<SyncLog[]>([]);
const loading = ref(true);
const syncing = ref(false);

// Table refs
const _userStatsTable = ref<TableRef | null>(null);
const _videoStatsTable = ref<TableRef | null>(null);
const syncLogsTable = ref<TableRef | null>(null);

// Search states
const userStatsSearch = ref("");
const videoStatsSearch = ref("");
const syncLogsSearch = ref("");

// Table states
const userStatsPagination = ref({ pageIndex: 0, pageSize: 10 });
const videoStatsPagination = ref({ pageIndex: 0, pageSize: 10 });
const syncLogsPagination = ref({ pageIndex: 0, pageSize: 10 });

// Computed: Latest stats for stat cards (backend returns DESC ordered)
const latestUserStats = computed(() => {
  if (userStats.value.length === 0) return null;
  // Backend returns data sorted DESC, so first item is latest
  return userStats.value[0];
});

// Computed: Latest user stats with growth indicators (show only latest row)
const latestUserStatsWithGrowth = computed(() => {
  if (userStats.value.length === 0) return [];

  const latest = userStats.value[0]!;
  const previous = userStats.value[1] || null;

  return [
    {
      ...latest,
      followerGrowth: previous
        ? latest.followerCount - previous.followerCount
        : null,
      followingGrowth: previous
        ? latest.followingCount - previous.followingCount
        : null,
      likesGrowth: previous ? latest.likesCount - previous.likesCount : null,
      videoGrowth: previous ? latest.videoCount - previous.videoCount : null,
    },
  ];
});

// Computed: Latest video stats with growth indicators (show only latest data)
const latestVideoStatsWithGrowth = computed(() => {
  if (videoStats.value.length === 0) return [];

  // Group by video ID to find previous stats
  const videoMap = new Map();
  videoStats.value.forEach((video) => {
    if (!videoMap.has(video.videoId)) {
      videoMap.set(video.videoId, []);
    }
    videoMap.get(video.videoId)!.push(video);
  });

  // Get latest stats for each video with growth
  const latestVideos: any[] = [];
  videoMap.forEach((videos) => {
    const latest = videos[0]; // Already sorted DESC
    const previous = videos[1] || null;

    latestVideos.push({
      ...latest,
      viewGrowth: previous ? latest.viewCount - previous.viewCount : null,
      likeGrowth: previous ? latest.likeCount - previous.likeCount : null,
      commentGrowth: previous
        ? latest.commentCount - previous.commentCount
        : null,
      shareGrowth: previous ? latest.shareCount - previous.shareCount : null,
    });
  });

  return latestVideos;
});

const filteredUserStats = computed(() => {
  if (!userStatsSearch.value) return userStats.value;
  const query = userStatsSearch.value.toLowerCase();
  return userStats.value.filter((stat) =>
    [
      stat.displayName,
      stat.followerCount.toString(),
      formatDate(stat.snapshotDate, "dd MMM yyyy"),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
});

const filteredVideoStats = computed(() => {
  if (!videoStatsSearch.value) return videoStats.value;
  const query = videoStatsSearch.value.toLowerCase();
  return videoStats.value.filter((video) =>
    [
      video.description,
      video.viewCount.toString(),
      formatDate(video.createTime, "dd MMM yyyy"),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
});

const filteredSyncLogs = computed(() => {
  if (!syncLogsSearch.value) return syncLogs.value;
  const query = syncLogsSearch.value.toLowerCase();
  return syncLogs.value.filter((log) =>
    [
      log.jobName,
      log.status,
      log.message || "",
      formatDate(log.runTime, "dd MMM yyyy HH:mm:ss"),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
});

// Helper function to render growth indicator
const renderGrowth = (value: number, growth: number | null) => {
  if (growth === null) {
    return h("div", { class: "flex items-center gap-2" }, [
      h("span", formatNumber(value)),
      h(UBadge, { color: "gray", variant: "subtle", size: "sm" }, { default: () => "-" }),
    ]);
  }

  const isPositive = growth > 0;
  const isNegative = growth < 0;
  const color = isPositive ? "green" : isNegative ? "red" : "gray";
  const icon = isPositive
    ? "i-lucide-trending-up"
    : isNegative
      ? "i-lucide-trending-down"
      : "i-lucide-minus";

  return h("div", { class: "flex items-center gap-2" }, [
    h("span", formatNumber(value)),
    h(UBadge, { color, variant: "subtle", size: "sm", icon }, {
      default: () =>
        growth === 0
          ? "0"
          : (growth > 0 ? "+" : "") + formatNumber(Math.abs(growth)),
    }),
  ]);
};

const userStatColumns: TableColumn<any>[] = [
  {
    accessorKey: "snapshotDate",
    header: "Tanggal",
    cell: ({ row }) => formatDate(row.original.snapshotDate, "dd MMM yyyy"),
  },
  {
    accessorKey: "displayName",
    header: "Username",
  },
  {
    accessorKey: "followerCount",
    header: "Pengikut",
    cell: ({ row }) =>
      renderGrowth(row.original.followerCount, row.original.followerGrowth),
  },
  {
    accessorKey: "followingCount",
    header: "Mengikuti",
    cell: ({ row }) =>
      renderGrowth(row.original.followingCount, row.original.followingGrowth),
  },
  {
    accessorKey: "likesCount",
    header: "Total Suka",
    cell: ({ row }) =>
      renderGrowth(row.original.likesCount, row.original.likesGrowth),
  },
  {
    accessorKey: "videoCount",
    header: "Total Video",
    cell: ({ row }) =>
      renderGrowth(row.original.videoCount, row.original.videoGrowth),
  },
];

const videoColumns: TableColumn<any>[] = [
  {
    accessorKey: "coverImageUrl",
    header: "Thumbnail",
    cell: ({ row }) =>
      h("img", {
        src: row.original.coverImageUrl,
        alt: row.original.description || "Thumbnail",
        class: "w-16 h-16 object-cover rounded",
      }),
  },
  {
    accessorKey: "shareUrl",
    header: "Tautan",
    cell: ({ row }) =>
      h(
        UButton,
        {
          color: "primary",
          variant: "ghost",
          size: "xs",
          onClick: () => window.open(row.original.shareUrl, "_blank"),
        },
        { default: () => "Lihat" },
      ),
  },
  {
    accessorKey: "viewCount",
    header: "Tayangan",
    cell: ({ row }) =>
      renderGrowth(row.original.viewCount, row.original.viewGrowth),
  },
  {
    accessorKey: "likeCount",
    header: "Suka",
    cell: ({ row }) =>
      renderGrowth(row.original.likeCount, row.original.likeGrowth),
  },
  {
    accessorKey: "commentCount",
    header: "Komentar",
    cell: ({ row }) =>
      renderGrowth(row.original.commentCount, row.original.commentGrowth),
  },
  {
    accessorKey: "shareCount",
    header: "Bagikan",
    cell: ({ row }) =>
      renderGrowth(row.original.shareCount, row.original.shareGrowth),
  },
  {
    accessorKey: "createTime",
    header: "Tanggal Posting",
    cell: ({ row }) => formatDate(row.original.createTime, "dd MMM yyyy"),
  },
  {
    accessorKey: "snapshotDate",
    header: "Pembaruan Terakhir",
    cell: ({ row }) => formatDate(row.original.snapshotDate, "dd MMM yyyy"),
  },
];

const syncLogColumns: TableColumn<SyncLog>[] = [
  {
    accessorKey: "jobName",
    header: "Jenis Pekerjaan",
    cell: ({ row }) => {
      const jobLabels: Record<string, string> = {
        refresh_tokens: "Refresh Token",
        sync_user_stats: "Sinkron Statistik User",
        sync_user_daily: "Sinkron Data Harian User",
        sync_video_stats: "Sinkron Statistik Video",
        sync_video_daily: "Sinkron Data Harian Video",
      };
      return jobLabels[row.original.jobName] || row.original.jobName;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) =>
      h(
        UBadge,
        {
          color: getStatusColor(row.original.status) as any,
          variant: "subtle",
        },
        { default: () => row.original.status },
      ),
  },
  {
    accessorKey: "durationMs",
    header: "Durasi",
    cell: ({ row }) => {
      if (!row.original.durationMs) return "-";
      const seconds = (row.original.durationMs / 1000).toFixed(2);
      return `${seconds}s`;
    },
  },
  {
    accessorKey: "runTime",
    header: "Waktu Eksekusi",
    cell: ({ row }) => formatDate(row.original.runTime, "dd MMM yyyy HH:mm:ss"),
  },
  {
    accessorKey: "message",
    header: "Pesan",
    cell: ({ row }) => {
      const message = row.original.message || "-";
      return h(
        "div",
        {
          class: "max-w-xs truncate",
          title: message,
        },
        message,
      );
    },
  },
];

// Load data
const loadData = async () => {
  try {
    loading.value = true;

    const [users, videos, logs] = await Promise.all([
      getUserStats(storeCode, 30).catch(() => []),
      getVideoStats(storeCode, 30).catch(() => []),
      getSyncLogs(storeCode, 20).catch(() => []),
    ]);

    userStats.value = users;
    videoStats.value = videos;
    syncLogs.value = logs;
  } catch (error) {
    console.error("Error loading store data:", error);
    toast.add({
      title: "Error",
      description: "Gagal memuat data toko",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Handle sync
const handleSync = async () => {
  try {
    syncing.value = true;

    const results = await Promise.allSettled([
      syncUserStats(storeCode),
      syncVideoStats(storeCode),
    ]);

    // Check if any sync failed
    const failed = results.some((result) => result.status === "rejected");

    if (failed) {
      const errors = results
        .filter((result) => result.status === "rejected")
        .map((result) => {
          const reason = (result as PromiseRejectedResult).reason;
          return reason?.data?.error || reason?.message || "Unknown error";
        });

      toast.add({
        title: "Error",
        description: errors.join(", ") || "Gagal memulai sinkronisasi",
        color: "error",
      });
    } else {
      toast.add({
        title: "Sukses",
        description:
          "Sinkronisasi berhasil dimulai. Muat ulang halaman dalam beberapa saat.",
        color: "success",
      });

      // Reload after 3 seconds
      setTimeout(() => {
        loadData();
      }, 3000);
    }
  } catch (error) {
    console.error("Error syncing:", error);
    const err = error as { data?: { error?: string }; message?: string };
    toast.add({
      title: "Error",
      description:
        err?.data?.error || err?.message || "Gagal memulai sinkronisasi",
      color: "error",
    });
  } finally {
    syncing.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <UContainer class="py-6 pb-8">
      <!-- Header -->
      <PageHeader :title="storeCode" description="Analitik & Performa">
        <template #actions>
          <div class="flex gap-2">
            <UButton
              to="/tiktok-store-accounts"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-left"
            >
              Kembali
            </UButton>
            <UButton
              v-if="canTriggerSync"
              color="primary"
              icon="i-lucide-refresh-cw"
              :loading="syncing"
              @click="handleSync"
            >
              Sinkronkan Data
            </UButton>
          </div>
        </template>
      </PageHeader>

      <!-- User Stats -->
      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-3">Statistik Pengguna</h2>
        <div v-if="loading" class="text-center p-8 text-gray-500">
          Memuat...
        </div>
        <div v-else-if="!latestUserStats" class="text-center p-8 text-gray-500">
          Belum ada statistik pengguna
        </div>
        <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <UCard>
            <div class="flex items-center gap-3 p-4">
              <div class="p-2 rounded-lg bg-primary/10">
                <UIcon name="i-lucide-users" class="w-5 h-5 text-primary" />
              </div>
              <div>
                <div class="text-sm text-gray-500">Pengikut</div>
                <div class="text-xl font-bold text-primary">
                  {{ formatNumber(latestUserStats.followerCount) }}
                </div>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-center gap-3 p-4">
              <div class="p-2 rounded-lg bg-blue-500/10">
                <UIcon
                  name="i-lucide-user-check"
                  class="w-5 h-5 text-blue-500"
                />
              </div>
              <div>
                <div class="text-sm text-gray-500">Mengikuti</div>
                <div class="text-xl font-bold">
                  {{ formatNumber(latestUserStats.followingCount) }}
                </div>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-center gap-3 p-4">
              <div class="p-2 rounded-lg bg-pink-500/10">
                <UIcon name="i-lucide-heart" class="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <div class="text-sm text-gray-500">Total Suka</div>
                <div class="text-xl font-bold">
                  {{ formatNumber(latestUserStats.likesCount) }}
                </div>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-center gap-3 p-4">
              <div class="p-2 rounded-lg bg-emerald-500/10">
                <UIcon name="i-lucide-video" class="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <div class="text-sm text-gray-500">Video</div>
                <div class="text-xl font-bold">
                  {{ formatNumber(latestUserStats.videoCount) }}
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Statistik Harian Pengguna -->
      <div class="mb-6">
        <UCard>
          <template #header>
            <div>
              <h3 class="text-lg font-semibold">Statistik Harian Pengguna</h3>
              <p class="text-sm text-gray-500">
                Data terbaru dengan indikator pertumbuhan
              </p>
            </div>
          </template>

          <div v-if="loading" class="text-center p-8 text-gray-500">
            Memuat...
          </div>
          <div
            v-else-if="userStats.length === 0"
            class="text-center p-8 text-gray-500"
          >
            Belum ada data statistik harian
          </div>
          <div v-else>
            <div class="overflow-x-auto">
              <UTable
                :data="latestUserStatsWithGrowth"
                :columns="userStatColumns as any"
                :loading="loading"
              />
            </div>
          </div>
        </UCard>
      </div>

      <!-- Statistik Video -->
      <div class="mb-6">
        <UCard>
          <template #header>
            <div>
              <h3 class="text-lg font-semibold">Statistik Video</h3>
              <p class="text-sm text-gray-500">
                Data terbaru dengan indikator pertumbuhan
              </p>
            </div>
          </template>

          <div v-if="loading" class="text-center p-8 text-gray-500">
            Memuat...
          </div>
          <div
            v-else-if="videoStats.length === 0"
            class="text-center p-8 text-gray-500"
          >
            Tidak ada data video
          </div>
          <div v-else>
            <div class="overflow-x-auto">
              <UTable
                :data="latestVideoStatsWithGrowth"
                :columns="videoColumns as any"
                :loading="loading"
              />
            </div>
          </div>
        </UCard>
      </div>

      <!-- Sync Logs -->
      <UCard>
        <template #header>
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold">Riwayat Sinkronisasi</h3>
              <p class="text-sm text-gray-500">Riwayat sinkronisasi data</p>
            </div>
            <div class="w-full md:w-64">
              <UInput
                v-model="syncLogsSearch"
                icon="i-lucide-search"
                placeholder="Cari jenis, status, pesan..."
                size="sm"
                class="w-full"
              />
            </div>
          </div>
        </template>

        <div v-if="loading" class="text-center p-8 text-gray-500">
          Memuat...
        </div>
        <div
          v-else-if="syncLogs.length === 0"
          class="text-center p-8 text-gray-500"
        >
          Belum ada riwayat sinkronisasi
        </div>
        <div v-else>
          <div class="overflow-x-auto">
            <UTable
              ref="syncLogsTable"
              :data="filteredSyncLogs"
              :columns="syncLogColumns as any"
              :loading="loading"
              :state="{
                pagination: syncLogsPagination ?? { pageIndex: 0, pageSize: 10 },
              }"
              :get-pagination-row-model="getPaginationRowModel()"
              @update:pagination="(e) => { if (e) syncLogsPagination = e }"
            />
          </div>

          <div
            v-if="syncLogsTable?.tableApi"
            class="flex flex-col sm:flex-row items-center justify-between px-2 py-4 border-t gap-4"
          >
            <div class="text-sm text-muted-foreground">
              Menampilkan
              {{
                syncLogsTable.tableApi.getState().pagination.pageIndex *
                  syncLogsPagination.pageSize +
                1
              }}
              -
              {{
                Math.min(
                  (syncLogsTable.tableApi.getState().pagination.pageIndex + 1) *
                    syncLogsPagination.pageSize,
                  filteredSyncLogs.length,
                )
              }}
              dari
              {{ filteredSyncLogs.length }} log
            </div>
            <div class="flex items-center gap-2">
              <UButton
                :disabled="
                  syncLogsTable.tableApi.getState().pagination.pageIndex === 0
                "
                @click="syncLogsTable.tableApi?.setPageIndex(0)"
                variant="outline"
                size="sm"
                icon="i-lucide-chevrons-left"
              />
              <UButton
                :disabled="
                  syncLogsTable.tableApi.getState().pagination.pageIndex === 0
                "
                @click="
                  syncLogsTable.tableApi?.setPageIndex(
                    syncLogsTable.tableApi.getState().pagination.pageIndex - 1,
                  )
                "
                variant="outline"
                size="sm"
                icon="i-lucide-chevron-left"
              />
              <span class="text-sm px-2">
                Halaman
                {{ syncLogsTable.tableApi.getState().pagination.pageIndex + 1 }}
                dari
                {{
                  Math.max(
                    1,
                    Math.ceil(
                      filteredSyncLogs.length / syncLogsPagination.pageSize,
                    ),
                  )
                }}
              </span>
              <UButton
                :disabled="
                  syncLogsTable.tableApi.getState().pagination.pageIndex >=
                  Math.ceil(
                    filteredSyncLogs.length / syncLogsPagination.pageSize,
                  ) -
                    1
                "
                @click="
                  syncLogsTable.tableApi?.setPageIndex(
                    syncLogsTable.tableApi.getState().pagination.pageIndex + 1,
                  )
                "
                variant="outline"
                size="sm"
                icon="i-lucide-chevron-right"
              />
              <UButton
                :disabled="
                  syncLogsTable.tableApi.getState().pagination.pageIndex >=
                  Math.ceil(
                    syncLogsTable.tableApi.getFilteredRowModel().rows.length /
                      syncLogsPagination.pageSize,
                  ) -
                    1
                "
                @click="
                  syncLogsTable.tableApi?.setPageIndex(
                    Math.max(
                      0,
                      Math.ceil(
                        filteredSyncLogs.length / syncLogsPagination.pageSize,
                      ) - 1,
                    ),
                  )
                "
                variant="outline"
                size="sm"
                icon="i-lucide-chevrons-right"
              />
            </div>
          </div>
        </div>
      </UCard>
    </UContainer>
  </div>
</template>
