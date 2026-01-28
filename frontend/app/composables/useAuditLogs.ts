/**
 * Audit Logs Composable
 * Fetches and manages audit log data from backend
 */

// Audit action types
export type AuditAction =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"
  | "IMPORT"
  | "SYNC";

export interface AuditLog {
  id: number;
  timestamp: string;
  requestId: string | null;
  userId: number | null;
  username: string | null;
  action: AuditAction;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  method: string | null;
  path: string | null;
  success: boolean;
  errorCode: string | null;
  duration: number | null;
  details: Record<string, unknown> | null;
}

export interface AuditLogFilters {
  userId?: number;
  username?: string;
  action?: AuditAction;
  resource?: string;
  resourceId?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface AuditLogSummary {
  total: number;
  byAction: Record<AuditAction, number>;
  byResource: Record<string, number>;
  failedCount: number;
  periodHours: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const useAuditLogs = () => {
  const toast = useToast();

  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Get paginated audit logs with filters
   */
  const getAuditLogs = async (
    filters: AuditLogFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: AuditLog[]; pagination: PaginationMeta } | null> => {
    loading.value = true;
    error.value = null;

    try {
      // Build query params
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      if (filters.userId) params.set("userId", filters.userId.toString());
      if (filters.username) params.set("username", filters.username);
      if (filters.action) params.set("action", filters.action);
      if (filters.resource) params.set("resource", filters.resource);
      if (filters.resourceId) params.set("resourceId", filters.resourceId);
      if (filters.success !== undefined) params.set("success", filters.success.toString());
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.search) params.set("search", filters.search);

      const response = await $fetch<{
        data?: AuditLog[];
        pagination?: PaginationMeta;
        error?: { message: string };
      }>(`/api/admin/audit-logs?${params.toString()}`);

      if (response.data && response.pagination) {
        return {
          data: response.data,
          pagination: response.pagination,
        };
      }

      error.value = response.error?.message || "Failed to fetch audit logs";
      return null;
    } catch (err: unknown) {
      console.error("Failed to fetch audit logs:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch audit logs";
      error.value = errorMessage;
      toast.add({
        title: "Error",
        description: errorMessage,
        color: "error",
      });
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Get audit log summary for dashboard
   */
  const getAuditSummary = async (hours: number = 24): Promise<AuditLogSummary | null> => {
    try {
      const response = await $fetch<{
        data?: AuditLogSummary;
        error?: { message: string };
      }>(`/api/admin/audit-logs/summary?hours=${hours}`);

      if (response.data) {
        return response.data;
      }

      return null;
    } catch (err) {
      console.error("Failed to fetch audit summary:", err);
      return null;
    }
  };

  /**
   * Get single audit log by ID
   */
  const getAuditLogById = async (id: number): Promise<AuditLog | null> => {
    try {
      const response = await $fetch<{
        data?: AuditLog;
        error?: { message: string };
      }>(`/api/admin/audit-logs/${id}`);

      if (response.data) {
        return response.data;
      }

      return null;
    } catch (err) {
      console.error("Failed to fetch audit log:", err);
      return null;
    }
  };

  /**
   * Get audit logs for a specific user
   */
  const getUserAuditLogs = async (
    userId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: AuditLog[]; pagination: PaginationMeta } | null> => {
    try {
      const response = await $fetch<{
        data?: AuditLog[];
        pagination?: PaginationMeta;
        error?: { message: string };
      }>(`/api/admin/audit-logs/user/${userId}?page=${page}&limit=${limit}`);

      if (response.data && response.pagination) {
        return {
          data: response.data,
          pagination: response.pagination,
        };
      }

      return null;
    } catch (err) {
      console.error("Failed to fetch user audit logs:", err);
      return null;
    }
  };

  /**
   * Get distinct resources for filter dropdown
   */
  const getDistinctResources = async (): Promise<string[]> => {
    try {
      const response = await $fetch<{
        data?: string[];
        error?: { message: string };
      }>("/api/admin/audit-logs/resources");

      if (response.data) {
        return response.data;
      }

      return [];
    } catch (err) {
      console.error("Failed to fetch resources:", err);
      return [];
    }
  };

  /**
   * Format action for display with black & white elegant theme
   */
  const formatAction = (action: AuditAction): { label: string; color: string } => {
    const actionMap: Record<AuditAction, { label: string; color: string }> = {
      CREATE: { label: "Create", color: "gray" },
      READ: { label: "Read", color: "neutral" },
      UPDATE: { label: "Update", color: "gray" },
      DELETE: { label: "Delete", color: "gray" },
      LOGIN: { label: "Login", color: "gray" },
      LOGOUT: { label: "Logout", color: "neutral" },
      EXPORT: { label: "Export", color: "gray" },
      IMPORT: { label: "Import", color: "gray" },
      SYNC: { label: "Sync", color: "neutral" },
    };
    return actionMap[action] || { label: action, color: "neutral" };
  };

  /**
   * Format duration in milliseconds
   */
  const formatDuration = (ms: number | null): string => {
    if (ms === null) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  /**
   * Get all available actions for filter dropdown
   */
  const getActionOptions = (): { label: string; value: AuditAction }[] => {
    return [
      { label: "Create", value: "CREATE" },
      { label: "Read", value: "READ" },
      { label: "Update", value: "UPDATE" },
      { label: "Delete", value: "DELETE" },
      { label: "Login", value: "LOGIN" },
      { label: "Logout", value: "LOGOUT" },
      { label: "Export", value: "EXPORT" },
      { label: "Import", value: "IMPORT" },
      { label: "Sync", value: "SYNC" },
    ];
  };

  return {
    // State
    loading: computed(() => loading.value),
    error: computed(() => error.value),

    // Actions
    getAuditLogs,
    getAuditSummary,
    getAuditLogById,
    getUserAuditLogs,
    getDistinctResources,

    // Helpers
    formatAction,
    formatDuration,
    formatTimestamp,
    getActionOptions,
  };
};
