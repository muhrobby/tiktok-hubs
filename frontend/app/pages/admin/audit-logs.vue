<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { h } from "vue";
import type { AuditLog, AuditAction, AuditLogFilters, AuditLogSummary } from "~/composables/useAuditLogs";

// Auth protection - Admin only
definePageMeta({
  middleware: "auth",
  requiredPermissions: ["view_audit_logs"],
});

useHead({
  title: "Audit Logs - Sosmed HUB",
});

const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");

const {
  loading,
  getAuditLogs,
  getAuditSummary,
  getAuditLogById,
  getDistinctResources,
  formatAction,
  formatDuration,
  formatTimestamp,
  getActionOptions,
} = useAuditLogs();

// State
const auditLogs = ref<AuditLog[]>([]);
const summary = ref<AuditLogSummary | null>(null);
const resources = ref<string[]>([]);
const isLoading = ref(true);

// Filters
const filters = ref<AuditLogFilters>({});
const searchQuery = ref("");
const selectedAction = ref<string>("all");
const selectedResource = ref<string>("all");
const selectedStatus = ref<string>("all");
const dateRange = ref<{ start: string; end: string }>({
  start: "",
  end: "",
});

// Pagination
const pagination = ref({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
});

// Detail modal
const isDetailModalOpen = ref(false);
const selectedLog = ref<AuditLog | null>(null);
const loadingDetail = ref(false);

// Load audit logs
const loadAuditLogs = async () => {
  isLoading.value = true;

  const filterParams: AuditLogFilters = {};
  if (searchQuery.value) filterParams.search = searchQuery.value;
  if (selectedAction.value !== "all") filterParams.action = selectedAction.value as AuditAction;
  if (selectedResource.value !== "all") filterParams.resource = selectedResource.value;
  if (selectedStatus.value !== "all") filterParams.success = selectedStatus.value === "true";
  if (dateRange.value.start) filterParams.startDate = dateRange.value.start;
  if (dateRange.value.end) filterParams.endDate = dateRange.value.end;

  const result = await getAuditLogs(filterParams, pagination.value.page, pagination.value.limit);

  if (result) {
    auditLogs.value = result.data;
    pagination.value = {
      ...pagination.value,
      ...result.pagination,
    };
  }

  isLoading.value = false;
};

// Load summary
const loadSummary = async () => {
  summary.value = await getAuditSummary(24);
};

// Load resources for filter
const loadResources = async () => {
  resources.value = await getDistinctResources();
};

// View log detail
const viewLogDetail = async (log: AuditLog) => {
  loadingDetail.value = true;
  isDetailModalOpen.value = true;
  
  const fullLog = await getAuditLogById(log.id);
  if (fullLog) {
    selectedLog.value = fullLog;
  } else {
    selectedLog.value = log;
  }
  
  loadingDetail.value = false;
};

// Table columns
const columns: TableColumn<AuditLog>[] = [
  {
    accessorKey: "timestamp",
    header: "Time",
    cell: ({ row }) => h("span", { class: "text-sm whitespace-nowrap" }, formatTimestamp(row.original.timestamp)),
  },
  {
    accessorKey: "username",
    header: "User",
    cell: ({ row }) => h("span", { class: "font-medium" }, row.original.username || "System"),
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => {
      const { label, color } = formatAction(row.original.action);
      return h(
        UBadge,
        {
          color: color as "gray" | "gray" | "gray" | "neutral" | "neutral" | "neutral",
          variant: "subtle",
          size: "sm",
        },
        { default: () => label }
      );
    },
  },
  {
    accessorKey: "resource",
    header: "Resource",
    cell: ({ row }) => h("code", { class: "text-xs bg-muted px-1.5 py-0.5 rounded" }, row.original.resource),
  },
  {
    accessorKey: "resourceId",
    header: "Resource ID",
    cell: ({ row }) => row.original.resourceId || "-",
  },
  {
    accessorKey: "success",
    header: "Status",
    cell: ({ row }) =>
      h(
        UBadge,
        {
          color: row.original.success ? "gray" : "gray",
          variant: "subtle",
          size: "sm",
        },
        { default: () => (row.original.success ? "Success" : "Failed") }
      ),
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => h("span", { class: "text-sm text-muted-foreground" }, formatDuration(row.original.duration)),
  },
  {
    accessorKey: "ipAddress",
    header: "IP Address",
    cell: ({ row }) => h("code", { class: "text-xs" }, row.original.ipAddress || "-"),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h(
        UButton,
        {
          icon: "i-lucide-eye",
          color: "neutral",
          variant: "ghost",
          size: "xs",
          onClick: () => viewLogDetail(row.original),
        }
      ),
  },
];

// Action options for filter
const actionOptions = computed(() => [
  { label: "All Actions", value: "all" },
  ...getActionOptions().map((opt) => ({ label: opt.label, value: opt.value })),
]);

// Resource options for filter
const resourceOptions = computed(() => [
  { label: "All Resources", value: "all" },
  ...resources.value.map((r) => ({ label: r, value: r })),
]);

// Status options for filter
const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Success", value: "true" },
  { label: "Failed", value: "false" },
];

// Clear filters
const clearFilters = () => {
  searchQuery.value = "";
  selectedAction.value = "all";
  selectedResource.value = "all";
  selectedStatus.value = "all";
  dateRange.value = { start: "", end: "" };
  pagination.value.page = 1;
  loadAuditLogs();
};

// Refresh data
const refreshData = () => {
  loadAuditLogs();
  loadSummary();
};

// Watch for filter changes
watch([searchQuery, selectedAction, selectedResource, selectedStatus, dateRange], () => {
  pagination.value.page = 1;
  loadAuditLogs();
}, { deep: true });

// Initial load
onMounted(async () => {
  await Promise.all([loadAuditLogs(), loadSummary(), loadResources()]);
});
</script>

<template>
  <div>
    <!-- Header -->
    <UDashboardNavbar title="Audit Logs" icon="i-lucide-shield-check">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>

      <template #right>
        <UButton icon="i-lucide-refresh-cw" variant="outline" @click="refreshData" :loading="isLoading" size="sm">
          Refresh
        </UButton>
      </template>
    </UDashboardNavbar>

    <!-- Body -->
    <div class="p-4 sm:p-6">
      <!-- Summary Cards -->
      <div v-if="summary" class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <UCard>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-gray-800/10 dark:bg-white/10 rounded-lg">
            <UIcon name="i-lucide-activity" class="w-5 h-5 text-gray-800 dark:text-gray-200" />
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Total Events (24h)</p>
            <p class="text-2xl font-bold">{{ summary.total.toLocaleString() }}</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-gray-700/10 dark:bg-white/10 rounded-lg">
            <UIcon name="i-lucide-check-circle" class="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Successful</p>
            <p class="text-2xl font-bold">{{ (summary.total - summary.failedCount).toLocaleString() }}</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-gray-800/10 dark:bg-white/10 rounded-lg">
            <UIcon name="i-lucide-x-circle" class="w-5 h-5 text-gray-800 dark:text-gray-200" />
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Failed</p>
            <p class="text-2xl font-bold">{{ summary.failedCount.toLocaleString() }}</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-gray-600/10 dark:bg-white/10 rounded-lg">
            <UIcon name="i-lucide-layers" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Resources</p>
            <p class="text-2xl font-bold">{{ Object.keys(summary.byResource).length }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Filters -->
    <UCard class="mb-6">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col md:flex-row gap-4">
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search by username, path, or request ID..."
            class="flex-1"
          />
          <USelect v-model="selectedAction" :items="actionOptions" class="w-full md:w-40" />
          <USelect v-model="selectedResource" :items="resourceOptions" class="w-full md:w-40" />
          <USelect v-model="selectedStatus" :items="statusOptions" class="w-full md:w-36" />
        </div>

        <div class="flex flex-col md:flex-row gap-4 items-end">
          <UFormField label="Start Date" class="flex-1">
            <UInput v-model="dateRange.start" type="date" class="w-full" />
          </UFormField>
          <UFormField label="End Date" class="flex-1">
            <UInput v-model="dateRange.end" type="date" class="w-full" />
          </UFormField>
          <UButton variant="ghost" color="neutral" @click="clearFilters" class="w-full md:w-auto">
            Clear Filters
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Audit Logs Table -->
    <UCard>
      <div class="overflow-x-auto">
        <UTable :data="auditLogs" :columns="columns" :loading="isLoading">
        <template #loading-state>
          <div class="flex items-center justify-center py-12">
            <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-gray-900 dark:text-white" />
          </div>
        </template>

        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-12">
            <UIcon name="i-lucide-scroll-text" class="w-12 h-12 text-muted-foreground mb-4" />
            <p class="text-muted-foreground">No audit logs found</p>
            <p class="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
          </div>
        </template>
      </UTable>
      </div>

      <!-- Pagination -->
      <div
        v-if="pagination.totalPages > 1"
        class="flex flex-col sm:flex-row items-center justify-between px-2 py-4 border-t gap-4"
      >
        <div class="text-sm text-muted-foreground">
          Showing {{ (pagination.page - 1) * pagination.limit + 1 }} -
          {{ Math.min(pagination.page * pagination.limit, pagination.total) }}
          of {{ pagination.total }} logs
        </div>
        <UPagination
          :default-page="pagination.page"
          :items-per-page="pagination.limit"
          :total="pagination.total"
          @update:page="(p) => { pagination.page = p; loadAuditLogs(); }"
        />
      </div>
    </UCard>

    <!-- Log Detail Modal -->
    <UModal v-model:open="isDetailModalOpen" title="Audit Log Details">
      <template #body>
        <div v-if="loadingDetail" class="flex items-center justify-center py-8">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-gray-900 dark:text-white" />
        </div>

        <div v-else-if="selectedLog" class="space-y-4">
          <!-- Basic Info -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">Timestamp</p>
              <p class="font-medium">{{ formatTimestamp(selectedLog.timestamp) }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Request ID</p>
              <code class="text-xs bg-muted px-1.5 py-0.5 rounded">{{ selectedLog.requestId || "-" }}</code>
            </div>
          </div>

          <USeparator />

          <!-- User Info -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">User</p>
              <p class="font-medium">{{ selectedLog.username || "System" }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">User ID</p>
              <p class="font-medium">{{ selectedLog.userId || "-" }}</p>
            </div>
          </div>

          <USeparator />

          <!-- Action Info -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">Action</p>
              <UBadge
                :color="formatAction(selectedLog.action).color as 'gray' | 'gray' | 'gray' | 'neutral' | 'neutral' | 'neutral'"
                variant="subtle"
              >
                {{ formatAction(selectedLog.action).label }}
              </UBadge>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Status</p>
              <UBadge :color="selectedLog.success ? 'gray' : 'gray'" variant="subtle">
                {{ selectedLog.success ? "Success" : "Failed" }}
              </UBadge>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">Resource</p>
              <code class="text-xs bg-muted px-1.5 py-0.5 rounded">{{ selectedLog.resource }}</code>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Resource ID</p>
              <p class="font-medium">{{ selectedLog.resourceId || "-" }}</p>
            </div>
          </div>

          <USeparator />

          <!-- Request Info -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">Method</p>
              <UBadge color="neutral" variant="subtle">{{ selectedLog.method || "-" }}</UBadge>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Duration</p>
              <p class="font-medium">{{ formatDuration(selectedLog.duration) }}</p>
            </div>
          </div>

          <div>
            <p class="text-sm text-muted-foreground">Path</p>
            <code class="text-xs bg-muted px-1.5 py-0.5 rounded block mt-1 overflow-x-auto">{{ selectedLog.path || "-" }}</code>
          </div>

          <USeparator />

          <!-- Client Info -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">IP Address</p>
              <code class="text-xs">{{ selectedLog.ipAddress || "-" }}</code>
            </div>
            <div v-if="selectedLog.errorCode">
              <p class="text-sm text-muted-foreground">Error Code</p>
              <UBadge color="gray" variant="subtle">{{ selectedLog.errorCode }}</UBadge>
            </div>
          </div>

          <div>
            <p class="text-sm text-muted-foreground">User Agent</p>
            <p class="text-xs text-muted-foreground mt-1 break-all">{{ selectedLog.userAgent || "-" }}</p>
          </div>

          <!-- Details (if present) -->
          <div v-if="selectedLog.details && Object.keys(selectedLog.details).length > 0">
            <USeparator class="my-4" />
            <p class="text-sm text-muted-foreground mb-2">Additional Details</p>
            <pre class="text-xs bg-muted p-3 rounded overflow-x-auto">{{ JSON.stringify(selectedLog.details, null, 2) }}</pre>
          </div>
        </div>

        <div class="flex justify-end pt-4 border-t mt-4">
          <UButton color="neutral" variant="ghost" @click="isDetailModalOpen = false">
            Close
          </UButton>
        </div>
      </template>
    </UModal>
    </div>
  </div>
</template>
