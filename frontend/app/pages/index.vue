<script setup lang="ts">
import type { Store, StoreAccount } from "~/types/api";

// Auth protection
definePageMeta({
  middleware: "auth",
});

// Set page metadata
useHead({
  title: "Dashboard - TikTok Hubs",
});

// Composables
const { getStores, getStoreAccounts } = useStores();
const { formatRelativeTime } = useFormatters();
const { hasPermission } = useAuth();
const toast = useToast();

// Permissions
const canCreateStore = computed(() => hasPermission('create_store'));

// Reactive data
const stores = ref<Store[]>([]);
const accounts = ref<StoreAccount[]>([]);
const loading = ref(true);

// Computed stats
const storeCount = computed(() => stores.value.length);
const connectedCount = computed(
  () => accounts.value.filter((a) => a.hasValidToken).length,
);
const lastSyncTime = computed(() => {
  const latestSync = accounts.value
    .filter((a) => a.lastSyncAt)
    .sort(
      (a, b) =>
        new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime(),
    )[0];

  return latestSync?.lastSyncAt
    ? formatRelativeTime(latestSync.lastSyncAt)
    : "Belum pernah sinkronisasi";
});

// Load data
const loadData = async () => {
  try {
    loading.value = true;

    // Get stores
    stores.value = await getStores();

    // Get accounts for each store
    const accountPromises = stores.value.map((store) =>
      getStoreAccounts(store.storeCode),
    );
    const accountsArray = await Promise.all(accountPromises);
    accounts.value = accountsArray.flat();
  } catch (error) {
    console.error("Error loading dashboard:", error);
    toast.add({
      title: "Error",
      description: error instanceof Error ? error.message : "Gagal memuat data",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Load on mount
onMounted(() => {
  loadData();
});

// Get store display data
const getStoreData = (store: Store) => {
  const storeAccounts = accounts.value.filter(
    (a) => a.storeCode === store.storeCode,
  );
  const hasConnected = storeAccounts.some((a) => a.hasValidToken);

  return {
    hasConnected,
    accountCount: storeAccounts.length,
  };
};
</script>

<template>
  <UContainer class="py-4 sm:py-6 max-w-full overflow-x-hidden">
    <!-- Header with Burger Menu -->
    <PageHeader 
      title="Dashboard" 
      description="Selamat datang di TikTok Hubs - Kelola semua toko TikTok Anda"
    >
      <template #actions>
        <UButton
          v-if="canCreateStore"
          to="/tiktok-store-accounts"
          color="primary"
          icon="i-lucide-plus"
          size="sm"
          class="shadow-lg w-full sm:w-auto"
        >
          <span class="hidden sm:inline">Tambah Toko Baru</span>
          <span class="sm:hidden">Tambah Toko</span>
        </UButton>
      </template>
    </PageHeader>

    <!-- Stats Cards with Enhanced Design -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
      <!-- Total Stores -->
      <UCard class="hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <p
              class="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              Total Toko
            </p>
            <p class="text-3xl sm:text-4xl font-bold text-primary truncate">
              {{ loading ? "-" : storeCount }}
            </p>
            <p class="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <UIcon name="i-lucide-store" class="w-3 h-3 flex-shrink-0" />
              <span class="truncate">Semua toko terdaftar</span>
            </p>
          </div>
          <div class="p-3 sm:p-4 bg-primary/10 rounded-xl flex-shrink-0">
            <UIcon name="i-lucide-store" class="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          </div>
        </div>
      </UCard>

      <!-- Connected Accounts -->
      <UCard class="hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <p
              class="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              Akun Terkoneksi
            </p>
            <p class="text-3xl sm:text-4xl font-bold text-success truncate">
              {{ loading ? "-" : connectedCount }}
            </p>
            <p class="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <UIcon name="i-lucide-check-circle" class="w-3 h-3 flex-shrink-0" />
              <span class="truncate">Akun TikTok aktif</span>
            </p>
          </div>
          <div class="p-3 sm:p-4 bg-success/10 rounded-xl flex-shrink-0">
            <UIcon name="i-lucide-link" class="w-6 h-6 sm:w-8 sm:h-8 text-success" />
          </div>
        </div>
      </UCard>

      <!-- Last Sync -->
      <UCard class="hover:shadow-lg transition-shadow sm:col-span-2 lg:col-span-1">
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <p
              class="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              Terakhir Sinkronisasi
            </p>
            <p class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              {{ loading ? "-" : lastSyncTime }}
            </p>
            <p class="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <UIcon name="i-lucide-refresh-cw" class="w-3 h-3 flex-shrink-0" />
              <span class="truncate">Data sinkronisasi</span>
            </p>
          </div>
          <div class="p-3 sm:p-4 bg-blue-500/10 rounded-xl flex-shrink-0">
            <UIcon name="i-lucide-clock" class="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
      <UCard
        class="hover:shadow-lg transition-shadow cursor-pointer"
        @click="$router.push('/tiktok-store-accounts')"
      >
        <div class="flex items-center gap-3 sm:gap-4">
          <div class="p-2 sm:p-3 bg-primary/10 rounded-lg flex-shrink-0">
            <UIcon name="i-lucide-store" class="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-base sm:text-lg mb-1 truncate">Kelola TikTok Store</h3>
            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
              Kelola toko, koneksi, dan lihat performa
            </p>
          </div>
          <UIcon name="i-lucide-arrow-right" class="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
        </div>
      </UCard>

      <UCard
        class="hover:shadow-lg transition-shadow cursor-pointer"
        @click="$router.push('/analytics')"
      >
        <div class="flex items-center gap-3 sm:gap-4">
          <div class="p-2 sm:p-3 bg-success/10 rounded-lg flex-shrink-0">
            <UIcon name="i-lucide-bar-chart-3" class="w-5 h-5 sm:w-6 sm:h-6 text-success" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-base sm:text-lg mb-1 truncate">Analytics</h3>
            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
              Lihat statistik dan performa akun
            </p>
          </div>
          <UIcon name="i-lucide-arrow-right" class="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
        </div>
      </UCard>
    </div>

    <!-- Recent Stores -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0 flex-1">
            <h3 class="text-lg sm:text-xl font-bold mb-1 truncate">Toko Terdaftar</h3>
            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
              {{ stores.length }} toko total
            </p>
          </div>
          <UButton
            to="/tiktok-store-accounts"
            variant="ghost"
            icon="i-lucide-arrow-right"
            trailing
            size="sm"
            class="flex-shrink-0"
          >
            <span class="hidden sm:inline">Lihat Semua</span>
            <span class="sm:hidden">Semua</span>
          </UButton>
        </div>
      </template>

      <div
        v-if="loading"
        class="flex flex-col items-center justify-center p-8 sm:p-12"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="animate-spin w-8 h-8 sm:w-10 sm:h-10 mb-4 text-primary"
        />
        <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400">Memuat data toko...</p>
      </div>

      <div v-else-if="stores.length === 0" class="text-center p-8 sm:p-12">
        <div
          class="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-4"
        >
          <UIcon name="i-lucide-store" class="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
        </div>
        <h3 class="text-base sm:text-lg font-semibold mb-2">Belum Ada Toko</h3>
        <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
          {{ canCreateStore ? 'Mulai dengan menambahkan toko pertama Anda' : 'Tidak ada toko yang tersedia' }}
        </p>
        <UButton v-if="canCreateStore" to="/tiktok-store-accounts" color="primary" icon="i-lucide-plus" size="sm" class="sm:size-md">
          <span class="hidden sm:inline">Tambah Toko Sekarang</span>
          <span class="sm:hidden">Tambah Toko</span>
        </UButton>
      </div>

      <div v-else class="divide-y divide-gray-200 dark:divide-gray-800">
        <NuxtLink
          v-for="store in stores.slice(0, 5)"
          :key="store.storeCode"
          :to="`/stores/${store.storeCode}`"
          class="flex items-center justify-between p-4 sm:p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all group"
        >
          <div class="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <div class="relative flex-shrink-0">
              <div
                class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center"
              >
                <UIcon name="i-lucide-store" class="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div
                v-if="getStoreData(store).hasConnected"
                class="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-success rounded-full border-2 border-white dark:border-gray-900"
              />
            </div>

            <div class="flex-1 min-w-0">
              <h4
                class="font-semibold text-base sm:text-lg group-hover:text-primary transition-colors truncate"
              >
                {{ store.storeName }}
              </h4>
              <div
                class="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400"
              >
                <span class="flex items-center gap-1 truncate">
                  <UIcon name="i-lucide-hash" class="w-3 h-3 flex-shrink-0" />
                  <span class="truncate">{{ store.storeCode }}</span>
                </span>
                <span class="flex items-center gap-1 flex-shrink-0">
                  <UIcon name="i-lucide-link" class="w-3 h-3" />
                  {{ getStoreData(store).accountCount }} akun
                </span>
              </div>
            </div>

            <UBadge
              :color="getStoreData(store).hasConnected ? 'success' : 'neutral'"
              variant="subtle"
              class="hidden sm:inline-flex flex-shrink-0"
              size="xs"
            >
              {{
                getStoreData(store).hasConnected
                  ? "Terkoneksi"
                  : "Belum Terhubung"
              }}
            </UBadge>
          </div>

          <UIcon
            name="i-lucide-chevron-right"
            class="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all ml-2 sm:ml-4 flex-shrink-0"
          />
        </NuxtLink>

        <div v-if="stores.length > 5" class="p-3 sm:p-4 text-center">
          <UButton
            to="/tiktok-store-accounts"
            variant="ghost"
            icon="i-lucide-arrow-right"
            trailing
            size="sm"
          >
            Lihat {{ stores.length - 5 }} toko lainnya
          </UButton>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
