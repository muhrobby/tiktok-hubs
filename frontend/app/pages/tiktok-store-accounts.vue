<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { getPaginationRowModel } from "@tanstack/table-core";
import { h } from "vue";

// Auth protection
definePageMeta({
  middleware: "auth",
});

useHead({
  title: "Store Accounts - Sosmed HUB",
});

const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const UAvatar = resolveComponent("UAvatar");
const toast = useToast();
const { formatNumber, formatDate } = useFormatters();
const { hasPermission, isAdminOrOps } = useAuth();
const canCreateStore = computed(() => hasPermission('create_store'));

// Types
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

interface StoreAccountRow {
  storeCode: string;
  storeName: string;
  displayName: string | null;
  avatarUrl: string | null;
  followers: number;
  videoCount: number;
  totalViews: number;
  engagementRate: number;
  status: "CONNECTED" | "NEED_RECONNECT" | "ERROR" | "DISCONNECTED";
  lastSyncAt: string | null;
  snapshotDate: string | null;
  hasValidToken: boolean;
  picName: string;
  picContact: string | null;
}

// State
const table = ref<TableRef | null>(null);
const allStores = ref<StoreAccountRow[]>([]);
const loading = ref(true);
const searchQuery = ref("");
const selectedStatus = ref<string>("all");
const isModalOpen = ref(false);
const isSubmitting = ref(false);
const isSyncing = ref(false);
const pagination = ref({ pageIndex: 0, pageSize: 10 });

// Form data
const formData = ref({
  storeName: "",
  storeCode: "",
  picName: "",
  picContact: "",
});

const formErrors = ref({
  storeName: "",
  storeCode: "",
  picName: "",
});

// Composables
const { getStores, createStore, getStoreAccounts, getUserStats, connectTikTok, disconnectAccount, syncAllStores } = useStores();

// Reset form when modal closes
watch(isModalOpen, (newValue) => {
  if (!newValue) {
    formData.value = {
      storeName: "",
      storeCode: "",
      picName: "",
      picContact: "",
    };
    formErrors.value = {
      storeName: "",
      storeCode: "",
      picName: "",
    };
  }
});

// Validate store code
const validateStoreCode = () => {
  const code = formData.value.storeCode;
  if (!code) {
    formErrors.value.storeCode = "";
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
    formErrors.value.storeCode = "Hanya boleh alphanumeric, underscore (_), dan dash (-)";
    return;
  }
  if (code.length < 3) {
    formErrors.value.storeCode = "Minimal 3 karakter";
    return;
  }
  formErrors.value.storeCode = "";
};

watch(() => formData.value.storeCode, validateStoreCode);

// Load stores data
const loadStores = async () => {
  loading.value = true;
  try {
    // For Admin/Ops: use comprehensive API endpoint
    if (isAdminOrOps.value) {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "100"); // Get all for client-side filtering

      const response = await $fetch<{
        success: boolean;
        data: any[];
      }>(`/api/admin/tiktok-accounts?${params.toString()}`);

      if (response.success) {
        allStores.value = response.data.map((item) => ({
          storeCode: item.storeCode,
          storeName: item.storeName,
          displayName: item.displayName,
          avatarUrl: item.avatarUrl,
          followers: item.followers || 0,
          videoCount: item.videoCount || 0,
          totalViews: item.totalViews || 0,
          engagementRate: item.engagementRate || 0,
          status: item.status,
          lastSyncAt: null, // Will be populated from accounts
          snapshotDate: null,
          hasValidToken: item.status === "CONNECTED",
          picName: "",
          picContact: null,
        }));

        // Load last sync date for each store
        const accountPromises = allStores.value.map(async (store) => {
          const accounts = await getStoreAccounts(store.storeCode).catch(() => []);
          const lastSync = accounts.find((acc) => acc.lastSyncAt)?.lastSyncAt || null;
          return { storeCode: store.storeCode, lastSyncAt: lastSync };
        });

        const syncDates = await Promise.all(accountPromises);
        syncDates.forEach(({ storeCode, lastSyncAt }) => {
          const store = allStores.value.find((s) => s.storeCode === storeCode);
          if (store) store.lastSyncAt = lastSyncAt;
        });
      }
    } else {
      // For Store role: use regular stores API
      const storesData = await getStores();
      
      // Load accounts and stats for each store
      const accountPromises = storesData.map((store) => getStoreAccounts(store.storeCode));
      const statsPromises = storesData.map(async (store) => {
        const stats = await getUserStats(store.storeCode, 30).catch(() => []);
        return stats.slice().sort((a, b) => 
          new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime()
        )[0] || null;
      });

      const [accountsArray, statsArray] = await Promise.all([
        Promise.all(accountPromises),
        Promise.all(statsPromises),
      ]);

      allStores.value = storesData.map((store, index) => {
        const accounts = accountsArray[index];
        const latestStats = statsArray[index];
        const hasValidToken = accounts.some((acc) => acc.hasValidToken);
        const lastSyncAt = accounts.find((acc) => acc.lastSyncAt)?.lastSyncAt || null;

        // Determine status
        let status: "CONNECTED" | "NEED_RECONNECT" | "ERROR" | "DISCONNECTED" = "DISCONNECTED";
        if (hasValidToken) {
          status = "CONNECTED";
        } else if (accounts.length > 0) {
          const account = accounts[0];
          if (account.status === "ERROR") status = "ERROR";
          else if (account.status === "NEED_RECONNECT") status = "NEED_RECONNECT";
        }

        return {
          storeCode: store.storeCode,
          storeName: store.storeName,
          displayName: latestStats?.displayName || null,
          avatarUrl: latestStats?.avatarUrl || null,
          followers: latestStats?.followerCount || 0,
          videoCount: latestStats?.videoCount || 0,
          totalViews: 0,
          engagementRate: 0,
          status,
          lastSyncAt,
          snapshotDate: latestStats?.snapshotDate || null,
          hasValidToken,
          picName: store.picName,
          picContact: store.picContact,
        };
      });
    }
  } catch (error) {
    console.error("Failed to load stores:", error);
    toast.add({
      title: "Error",
      description: "Gagal memuat data",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Filtered rows based on search and status
const filteredRows = computed(() => {
  let filtered = allStores.value;

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter((row) =>
      [row.storeCode, row.storeName, row.displayName || ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }

  // Apply status filter
  if (selectedStatus.value !== "all") {
    filtered = filtered.filter((row) => row.status === selectedStatus.value);
  }

  return filtered;
});

// Handle create store
const handleCreateStore = async () => {
  if (!formData.value.storeName || !formData.value.storeCode || !formData.value.picName) {
    toast.add({
      title: "Error",
      description: "Mohon lengkapi semua field yang required",
      color: "warning",
    });
    return;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(formData.value.storeCode)) {
    toast.add({
      title: "Error",
      description: "Kode Toko hanya boleh alphanumeric, underscore, dan dash",
      color: "warning",
    });
    return;
  }

  try {
    isSubmitting.value = true;
    await createStore(formData.value);

    toast.add({
      title: "Sukses",
      description: "Toko berhasil dibuat",
      color: "success",
    });

    formData.value = {
      storeName: "",
      storeCode: "",
      picName: "",
      picContact: "",
    };
    isModalOpen.value = false;
    await loadStores();
  } catch (error) {
    console.error("Error creating store:", error);
    toast.add({
      title: "Error",
      description: error instanceof Error ? error.message : "Gagal membuat toko",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
  }
};

// Handle connect
const handleConnect = async (storeCode: string) => {
  try {
    const authUrl = await connectTikTok(storeCode);
    if (authUrl) {
      window.location.href = authUrl;
    }
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Gagal memulai OAuth",
      color: "error",
    });
  }
};

// Handle copy OAuth link
const handleCopyOAuthLink = async (storeCode: string) => {
  try {
    const authUrl = await connectTikTok(storeCode);
    if (authUrl) {
      await navigator.clipboard.writeText(authUrl);
      toast.add({
        title: "Sukses",
        description: "Link OAuth berhasil disalin",
        color: "success",
      });
    } else {
      toast.add({
        title: "Error",
        description: "Gagal mendapatkan link OAuth",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Error getting OAuth link:", error);
    toast.add({
      title: "Error",
      description: "Gagal mendapatkan link OAuth",
      color: "error",
    });
  }
};

// Handle disconnect
const handleDisconnect = async (storeCode: string) => {
  if (!confirm("Yakin ingin memutus koneksi akun ini?")) return;

  try {
    await disconnectAccount(storeCode);
    toast.add({
      title: "Sukses",
      description: "Akun berhasil diputuskan",
      color: "success",
    });
    await loadStores();
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Gagal memutus akun",
      color: "error",
    });
  }
};

// Handle sync all stores
const handleSyncAll = async () => {
  if (!confirm("Yakin ingin sinkronkan SEMUA store? Proses ini membutuhkan waktu.")) return;

  try {
    isSyncing.value = true;
    await syncAllStores();

    toast.add({
      title: "Sukses",
      description: "Sinkronisasi semua store berhasil dimulai. Data akan diperbarui dalam beberapa menit.",
      color: "success",
    });

    // Reload after 5 seconds
    setTimeout(() => {
      loadStores();
    }, 5000);
  } catch (error) {
    console.error("Failed to sync all stores:", error);
    toast.add({
      title: "Error",
      description: error instanceof Error ? error.message : "Gagal memulai sinkronisasi",
      color: "error",
    });
  } finally {
    isSyncing.value = false;
  }
};

// Get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case "CONNECTED":
      return "gray";
    case "NEED_RECONNECT":
      return "neutral";
    case "ERROR":
      return "gray";
    default:
      return "neutral";
  }
};

// Get status label
const getStatusLabel = (status: string) => {
  switch (status) {
    case "CONNECTED":
      return "Terkoneksi";
    case "NEED_RECONNECT":
      return "Perlu Reconnect";
    case "ERROR":
      return "Error";
    default:
      return "Belum Terhubung";
  }
};

// Get initials for avatar
const getInitials = (value: string) => {
  if (!value) return "";
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

// Table columns
const columns: TableColumn<StoreAccountRow>[] = [
  {
    id: "store",
    header: "Store",
    cell: ({ row }) =>
      h("div", { class: "flex items-center gap-3" }, [
        h(UAvatar, {
          src: row.original.avatarUrl || undefined,
          text: getInitials(row.original.storeName),
          size: "sm",
        }),
        h("div", { class: "min-w-0" }, [
          h("div", { class: "font-medium truncate" }, row.original.storeName),
          h("div", { class: "text-xs text-muted-foreground truncate" }, row.original.storeCode),
        ]),
      ]),
  },
  {
    accessorKey: "displayName",
    header: "Platform Username",
    cell: ({ row }) =>
      row.original.displayName
        ? h("span", { class: "font-medium" }, `@${row.original.displayName}`)
        : h("span", { class: "text-muted-foreground text-sm" }, "-"),
  },
  {
    accessorKey: "followers",
    header: "Followers",
    cell: ({ row }) => h("span", { class: "font-semibold" }, formatNumber(row.original.followers)),
  },
  {
    accessorKey: "videoCount",
    header: "Videos",
    cell: ({ row }) => formatNumber(row.original.videoCount),
  },
];

// Add engagement rate column for Admin/Ops
if (isAdminOrOps.value) {
  columns.push({
    id: "engagement",
    header: "Engagement",
    cell: ({ row }) => {
      const rate = row.original.engagementRate;
      return h(
        UBadge,
        {
          color: rate > 5 ? "gray" : rate > 2 ? "neutral" : "neutral",
          variant: "subtle",
        },
        { default: () => rate.toFixed(2) + "%" }
      );
    },
  });
}

// Add status column
columns.push({
  accessorKey: "status",
  header: "Status",
  cell: ({ row }) =>
    h(
      UBadge,
      {
        color: getStatusColor(row.original.status),
        variant: "subtle",
      },
      { default: () => getStatusLabel(row.original.status) }
    ),
});

// Add last sync column
columns.push({
  id: "lastSync",
  header: "Last Sync",
  cell: ({ row }) =>
    row.original.lastSyncAt
      ? h("span", { class: "text-sm" }, formatDate(row.original.lastSyncAt))
      : row.original.snapshotDate
        ? h("span", { class: "text-sm" }, formatDate(row.original.snapshotDate))
        : h("span", { class: "text-muted-foreground text-sm" }, "-"),
});

// Actions column
columns.push({
  id: "actions",
  header: "Aksi",
  cell: ({ row }) => {
    const storeCode = row.original.storeCode;
    const hasConnected = row.original.hasValidToken;

    return h(
      "div",
      { class: "flex items-center gap-2" },
      [
        // Button Lihat Detail
        h(UButton, {
          size: "sm",
          variant: "soft",
          color: "gray",
          label: "Lihat",
          onClick: () => navigateTo(`/stores/${storeCode}`),
        }),
        // Button Connect atau Disconnect
        !hasConnected
          ? h(UButton, {
              size: "sm",
              variant: "outline",
              color: "gray",
              icon: "i-lucide-link",
              label: "Connect",
              onClick: () => handleConnect(storeCode),
            })
          : h(UButton, {
              size: "sm",
              variant: "ghost",
              color: "gray",
              icon: "i-lucide-unlink",
              onClick: () => handleDisconnect(storeCode),
            }),
        // Button Copy OAuth Link (only for disconnected)
        !hasConnected
          ? h(UButton, {
              size: "sm",
              variant: "ghost",
              color: "gray",
              icon: "i-lucide-copy",
              onClick: () => handleCopyOAuthLink(storeCode),
            })
          : null,
      ].filter(Boolean)
    );
  },
});

// Status filter options
const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Terkoneksi", value: "CONNECTED" },
  { label: "Perlu Reconnect", value: "NEED_RECONNECT" },
  { label: "Error", value: "ERROR" },
  { label: "Belum Terhubung", value: "DISCONNECTED" },
];

// Summary stats
const summaryStats = computed(() => ({
  totalAccounts: filteredRows.value.length,
  totalFollowers: filteredRows.value.reduce((sum, s) => sum + s.followers, 0),
  totalVideos: filteredRows.value.reduce((sum, s) => sum + s.videoCount, 0),
  totalViews: filteredRows.value.reduce((sum, s) => sum + s.totalViews, 0),
  connectedCount: filteredRows.value.filter((s) => s.status === "CONNECTED").length,
}));

// Initial load
onMounted(() => {
  loadStores();
});
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="TikTok Store Accounts" icon="i-lucide-store">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              v-if="isAdminOrOps"
              icon="i-lucide-refresh-cw"
              variant="outline"
              color="gray"
              :loading="isSyncing"
              @click="handleSyncAll"
              size="sm"
            >
              <span class="hidden sm:inline">Sync Semua Data</span>
              <span class="sm:hidden">Sync All</span>
            </UButton>
            <UButton
              v-if="canCreateStore"
              icon="i-lucide-plus"
              @click="isModalOpen = true"
              size="sm"
            >
              <span class="hidden sm:inline">Tambah Toko</span>
              <span class="sm:hidden">Tambah</span>
            </UButton>
            <UButton
              icon="i-lucide-refresh-cw"
                  variant="outline"
              @click="loadStores"
              :loading="loading"
              size="sm"
            >
              Refresh
            </UButton>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <UCard>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-gray-900/10 dark:bg-white/10 rounded-lg flex-shrink-0">
            <UIcon name="i-lucide-store" class="w-5 h-5 text-gray-900 dark:text-white" />
          </div>
          <div class="min-w-0">
            <p class="text-xs sm:text-sm text-muted-foreground">Total Stores</p>
            <p class="text-xl sm:text-2xl font-bold truncate">{{ summaryStats.totalAccounts }}</p>
            <p class="text-xs text-muted-foreground mt-0.5 truncate">
              {{ summaryStats.connectedCount }} terkoneksi
            </p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-gray-800/10 dark:bg-white/10 rounded-lg flex-shrink-0">
            <UIcon name="i-lucide-users" class="w-5 h-5 text-gray-800 dark:text-gray-200" />
          </div>
          <div class="min-w-0">
            <p class="text-xs sm:text-sm text-muted-foreground">Total Followers</p>
            <p class="text-xl sm:text-2xl font-bold truncate">{{ formatNumber(summaryStats.totalFollowers) }}</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-gray-700/10 dark:bg-white/10 rounded-lg flex-shrink-0">
            <UIcon name="i-lucide-video" class="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </div>
          <div class="min-w-0">
            <p class="text-xs sm:text-sm text-muted-foreground">Total Videos</p>
            <p class="text-xl sm:text-2xl font-bold truncate">{{ formatNumber(summaryStats.totalVideos) }}</p>
          </div>
        </div>
      </UCard>

      <UCard v-if="isAdminOrOps">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-gray-600/10 dark:bg-white/10 rounded-lg flex-shrink-0">
            <UIcon name="i-lucide-eye" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div class="min-w-0">
            <p class="text-xs sm:text-sm text-muted-foreground">Total Views</p>
            <p class="text-xl sm:text-2xl font-bold truncate">{{ formatNumber(summaryStats.totalViews) }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Modal Form Tambah Toko -->
    <UModal v-model:open="isModalOpen" title="Tambah Toko Baru">
      <template #body>
        <form @submit.prevent="handleCreateStore" class="space-y-5">
          <!-- Kode Toko -->
          <div class="space-y-2 w-full">
            <label class="block text-sm font-semibold">
              Kode Toko
              <span class="text-red-500">*</span>
            </label>
            <UInput
              v-model="formData.storeCode"
              placeholder="Contoh: A304"
              size="lg"
              class="w-full"
              @blur="validateStoreCode"
            />
            <p v-if="formErrors.storeCode" class="text-xs text-red-500 mt-1">
              {{ formErrors.storeCode }}
            </p>
            <p v-else class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Alfabet, angka, underscore (_), dash (-) saja
            </p>
          </div>

          <!-- Nama Toko -->
          <div class="space-y-2 w-full">
            <label class="block text-sm font-semibold">
              Nama Toko
              <span class="text-red-500">*</span>
            </label>
            <UInput
              v-model="formData.storeName"
              placeholder="Contoh: AZKO Puri Indah"
              size="lg"
              class="w-full"
            />
          </div>

          <!-- Nama PIC -->
          <div class="space-y-2 w-full">
            <label class="block text-sm font-semibold">
              Nama PIC
              <span class="text-red-500">*</span>
            </label>
            <UInput
              v-model="formData.picName"
              placeholder="Contoh: Robby"
              size="lg"
              class="w-full"
            />
          </div>

          <!-- No PIC -->
          <div class="space-y-2 w-full">
            <label class="block text-sm font-semibold">No PIC</label>
            <UInput
              v-model="formData.picContact"
              placeholder="Contoh: 292811"
              size="lg"
              class="w-full"
            />
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-end gap-3 pt-4 border-t">
            <UButton
              type="button"
              color="gray"
              variant="ghost"
              size="lg"
              @click="isModalOpen = false"
              :disabled="isSubmitting"
            >
              Batal
            </UButton>
            <UButton
              type="submit"
              size="lg"
              :loading="isSubmitting"
              :disabled="
                !formData.storeName ||
                !formData.storeCode ||
                !formData.picName ||
                !!formErrors.storeCode
              "
            >
              Tambah Toko
            </UButton>
          </div>
        </form>
      </template>
    </UModal>

    <!-- Filters & Table Card -->
    <UCard>
      <div class="mb-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Cari toko atau username..."
          class="flex-1 w-full"
          size="md"
        />
        <USelect
          v-model="selectedStatus"
          :items="statusOptions"
          class="w-full sm:w-48"
          size="md"
        />
      </div>

      <div class="overflow-x-auto -mx-4 sm:mx-0">
        <div class="min-w-full inline-block align-middle">
          <div class="overflow-hidden">
            <UTable
              ref="table"
              :data="filteredRows"
              :columns="columns"
              :loading="loading"
              :state="{
                pagination: pagination ?? { pageIndex: 0, pageSize: 10 },
              }"
              :get-pagination-row-model="getPaginationRowModel()"
              @update:pagination="(e) => { if (e) pagination = e }"
            >
          <template #loading-state>
            <div class="flex items-center justify-center py-12">
              <div class="flex flex-col items-center gap-3">
                <UIcon
                  name="i-lucide-loader-2"
                  class="w-8 h-8 animate-spin text-gray-900 dark:text-white"
                />
                <p class="text-sm text-muted-foreground">Memuat data...</p>
              </div>
            </div>
          </template>

          <template #empty-state>
            <div class="flex flex-col items-center justify-center py-12">
              <UIcon name="i-lucide-store" class="w-12 h-12 text-muted-foreground mb-4" />
              <p class="text-muted-foreground">
                {{ searchQuery || selectedStatus !== "all" ? "Tidak ada data yang cocok" : "Belum ada toko" }}
              </p>
              <p class="text-sm text-muted-foreground mt-1">
                {{ searchQuery || selectedStatus !== "all" ? "Coba ubah filter pencarian" : "Tambahkan toko pertama Anda" }}
              </p>
            </div>
          </template>
        </UTable>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="table?.tableApi"
        class="flex flex-col sm:flex-row items-center justify-between px-2 sm:px-4 py-3 sm:py-4 border-t gap-3 sm:gap-4"
      >
        <div class="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
          Menampilkan
          {{
            table.tableApi.getState().pagination.pageIndex *
              pagination.pageSize +
            1
          }}
          -
          {{
            Math.min(
              (table.tableApi.getState().pagination.pageIndex + 1) *
                pagination.pageSize,
              filteredRows.length,
            )
          }}
          dari {{ filteredRows.length }} toko
        </div>
        <div class="flex items-center gap-1 sm:gap-2">
          <UButton
            :disabled="table.tableApi.getState().pagination.pageIndex === 0"
            @click="table.tableApi?.setPageIndex(0)"
            variant="outline"
            size="sm"
            icon="i-lucide-chevrons-left"
          />
          <UButton
            :disabled="table.tableApi.getState().pagination.pageIndex === 0"
            @click="
              table.tableApi?.setPageIndex(
                table.tableApi.getState().pagination.pageIndex - 1,
              )
            "
            variant="outline"
            size="sm"
            icon="i-lucide-chevron-left"
          />
          <span class="text-sm px-2">
            Halaman
            {{ table.tableApi.getState().pagination.pageIndex + 1 }}
            dari
            {{
              Math.max(1, Math.ceil(filteredRows.length / pagination.pageSize))
            }}
          </span>
          <UButton
            :disabled="
              table.tableApi.getState().pagination.pageIndex >=
              Math.ceil(filteredRows.length / pagination.pageSize) - 1
            "
            @click="
              table.tableApi?.setPageIndex(
                table.tableApi.getState().pagination.pageIndex + 1,
              )
            "
            variant="outline"
            size="sm"
            icon="i-lucide-chevron-right"
          />
          <UButton
            :disabled="
              table.tableApi.getState().pagination.pageIndex >=
              Math.ceil(filteredRows.length / pagination.pageSize) - 1
            "
            @click="
              table.tableApi?.setPageIndex(
                Math.max(
                  0,
                  Math.ceil(filteredRows.length / pagination.pageSize) - 1,
                ),
              )
            "
            variant="outline"
            size="sm"
            icon="i-lucide-chevrons-right"
          />
        </div>
      </div>
    </UCard>
    </template>
  </UDashboardPanel>
</template>
