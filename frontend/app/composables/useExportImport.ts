/**
 * Export/Import Composable
 * Handles exporting and importing data
 */

import type { Permission } from "~/types/auth";

// ============================================
// TYPES
// ============================================

export type ExportFormat = "csv" | "xlsx";

export type ExportType = "stores" | "user-stats" | "video-stats" | "sync-logs";

export interface ExportOptions {
  type: ExportType;
  format: ExportFormat;
  startDate?: string;
  endDate?: string;
}

export interface ImportError {
  row: number;
  field?: string;
  value?: string;
  message: string;
}

export interface ImportValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errors: ImportError[];
  preview: StoreImportRow[];
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  errors: ImportError[];
}

export interface StoreImportRow {
  storeCode: string;
  storeName: string;
  picName: string;
  picContact?: string;
}

// ============================================
// COMPOSABLE
// ============================================

export const useExportImport = () => {
  const toast = useToast();
  const { hasPermission, isAdmin } = useAuth();

  const loading = ref(false);
  const error = ref<string | null>(null);

  // ============================================
  // PERMISSIONS
  // ============================================

  const canExport = computed(() => {
    return hasPermission("export_all_data" as Permission) || 
           hasPermission("export_own_data" as Permission);
  });

  const canExportAll = computed(() => {
    return hasPermission("export_all_data" as Permission);
  });

  const canImport = computed(() => {
    return hasPermission("create_store" as Permission) || isAdmin.value;
  });

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================

  /**
   * Build export URL with parameters
   */
  const buildExportUrl = (options: ExportOptions): string => {
    const params = new URLSearchParams();
    params.set("format", options.format);
    
    if (options.startDate) {
      params.set("start_date", options.startDate);
    }
    if (options.endDate) {
      params.set("end_date", options.endDate);
    }

    return `/api/admin/export/${options.type}?${params.toString()}`;
  };

  /**
   * Get filename from Content-Disposition header
   */
  const getFilenameFromHeader = (header: string | null): string | null => {
    if (!header) return null;
    const match = header.match(/filename="?([^";\n]+)"?/);
    return match?.[1] ?? null;
  };

  /**
   * Export data and trigger download
   */
  const exportData = async (options: ExportOptions): Promise<boolean> => {
    if (!canExport.value) {
      toast.add({
        title: "Permission Denied",
        description: "You do not have permission to export data",
        color: "error",
      });
      return false;
    }

    loading.value = true;
    error.value = null;

    try {
      const url = buildExportUrl(options);
      
      // Fetch as blob
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Export failed: ${response.statusText}`);
      }

      // Get filename from header or generate one
      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = getFilenameFromHeader(contentDisposition) || 
                       `${options.type}_${new Date().toISOString().slice(0, 10)}.${options.format}`;

      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(downloadUrl);

      toast.add({
        title: "Export Successful",
        description: `Downloaded ${filename}`,
        color: "success",
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      error.value = message;
      console.error("Export failed:", err);
      
      toast.add({
        title: "Export Failed",
        description: message,
        color: "error",
      });
      
      return false;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Download import template
   */
  const downloadTemplate = async (): Promise<boolean> => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch("/api/admin/export/template/stores", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to download template");
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = getFilenameFromHeader(contentDisposition) || "stores_import_template.xlsx";

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(downloadUrl);

      toast.add({
        title: "Template Downloaded",
        description: "Fill in the template and upload to import stores",
        color: "success",
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      error.value = message;
      
      toast.add({
        title: "Download Failed",
        description: message,
        color: "error",
      });
      
      return false;
    } finally {
      loading.value = false;
    }
  };

  // ============================================
  // IMPORT FUNCTIONS
  // ============================================

  /**
   * Validate import file without importing
   */
  const validateFile = async (file: File): Promise<ImportValidationResult | null> => {
    if (!canImport.value) {
      toast.add({
        title: "Permission Denied",
        description: "You do not have permission to import data",
        color: "error",
      });
      return null;
    }

    // Validate file type
    const validTypes = [".xlsx", ".csv"];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!validTypes.includes(fileExt)) {
      toast.add({
        title: "Invalid File Type",
        description: "Please upload an Excel (.xlsx) or CSV (.csv) file",
        color: "error",
      });
      return null;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.add({
        title: "File Too Large",
        description: "File size must be less than 5MB",
        color: "error",
      });
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await $fetch<{
        success: boolean;
        data?: ImportValidationResult;
        error?: { message: string };
      }>("/api/admin/import/stores/validate", {
        method: "POST",
        body: formData,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Validation failed");
      }

      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      error.value = message;
      console.error("Validation failed:", err);
      
      toast.add({
        title: "Validation Failed",
        description: message,
        color: "error",
      });
      
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Import stores from file
   */
  const importStores = async (
    file: File,
    options: { skipExisting?: boolean; updateExisting?: boolean } = {}
  ): Promise<ImportResult | null> => {
    if (!canImport.value) {
      toast.add({
        title: "Permission Denied",
        description: "You do not have permission to import data",
        color: "error",
      });
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (options.skipExisting !== undefined) {
        formData.append("skip_existing", String(options.skipExisting));
      }
      if (options.updateExisting !== undefined) {
        formData.append("update_existing", String(options.updateExisting));
      }

      const response = await $fetch<{
        success: boolean;
        data?: ImportResult;
        error?: { message: string };
      }>("/api/admin/import/stores", {
        method: "POST",
        body: formData,
      });

      if (!response.data) {
        throw new Error(response.error?.message || "Import failed");
      }

      const result = response.data;

      // Show result toast
      if (result.success) {
        toast.add({
          title: "Import Successful",
          description: `Imported ${result.successCount} stores. Skipped: ${result.skippedCount}`,
          color: "success",
        });
      } else {
        toast.add({
          title: "Import Completed with Errors",
          description: `Success: ${result.successCount}, Errors: ${result.errorCount}, Skipped: ${result.skippedCount}`,
          color: "warning",
        });
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      error.value = message;
      console.error("Import failed:", err);
      
      toast.add({
        title: "Import Failed",
        description: message,
        color: "error",
      });
      
      return null;
    } finally {
      loading.value = false;
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Get export type display name
   */
  const getExportTypeName = (type: ExportType): string => {
    const names: Record<ExportType, string> = {
      "stores": "Stores",
      "user-stats": "User Stats (Followers)",
      "video-stats": "Video Stats",
      "sync-logs": "Sync Logs",
    };
    return names[type];
  };

  /**
   * Get available export types
   */
  const exportTypes: { value: ExportType; label: string }[] = [
    { value: "stores", label: "Stores" },
    { value: "user-stats", label: "User Stats (Followers)" },
    { value: "video-stats", label: "Video Stats" },
    { value: "sync-logs", label: "Sync Logs" },
  ];

  /**
   * Get available export formats
   */
  const exportFormats: { value: ExportFormat; label: string }[] = [
    { value: "xlsx", label: "Excel (.xlsx)" },
    { value: "csv", label: "CSV (.csv)" },
  ];

  return {
    // State
    loading: computed(() => loading.value),
    error: computed(() => error.value),

    // Permissions
    canExport,
    canExportAll,
    canImport,

    // Export
    exportData,
    downloadTemplate,

    // Import
    validateFile,
    importStores,

    // Helpers
    getExportTypeName,
    exportTypes,
    exportFormats,
  };
};
