<script setup lang="ts">
import type { ExportType, ExportFormat, ImportValidationResult, ImportResult } from "~/composables/useExportImport";

// Auth protection - Admin/Ops only
definePageMeta({
  middleware: "auth",
  requiredPermissions: ["export_all_data"],
});

useHead({
  title: "Data Management - Sosmed HUB",
});

const {
  loading,
  canExport,
  canImport,
  exportData,
  downloadTemplate,
  validateFile,
  importStores,
  exportTypes,
  exportFormats,
} = useExportImport();

// ============================================
// EXPORT STATE
// ============================================

const exportOptions = ref({
  type: "stores" as ExportType,
  format: "xlsx" as ExportFormat,
  startDate: "",
  endDate: "",
});

const showDateFilters = computed(() => {
  return ["user-stats", "video-stats"].includes(exportOptions.value.type);
});

// Quick Export Cards
const quickExportCards = [
  { 
    type: "stores" as ExportType, 
    icon: "i-lucide-store", 
    label: "Stores Data",
    description: "Export all store information",
    bgClass: "bg-gray-900/10 dark:bg-white/10"
  },
  { 
    type: "user-stats" as ExportType, 
    icon: "i-lucide-users", 
    label: "User Stats",
    description: "Export TikTok user statistics",
    bgClass: "bg-gray-800/10 dark:bg-white/10"
  },
  { 
    type: "video-stats" as ExportType, 
    icon: "i-lucide-video", 
    label: "Video Stats",
    description: "Export TikTok video statistics",
    bgClass: "bg-gray-700/10 dark:bg-white/10"
  },
  { 
    type: "sync-logs" as ExportType, 
    icon: "i-lucide-file-clock", 
    label: "Sync Logs",
    description: "Export synchronization logs",
    bgClass: "bg-gray-600/10 dark:bg-white/10"
  }
];

// ============================================
// IMPORT STATE
// ============================================

const selectedFile = ref<File | null>(null);
const validationResult = ref<ImportValidationResult | null>(null);
const importResult = ref<ImportResult | null>(null);
const importOptions = ref({
  skipExisting: true,
  updateExisting: false,
});
const importStep = ref<"upload" | "validate" | "result">("upload");

// Import wizard steps
const wizardSteps = [
  { number: 1, label: "Download Template", icon: "i-lucide-download" },
  { number: 2, label: "Fill Data", icon: "i-lucide-edit" },
  { number: 3, label: "Upload File", icon: "i-lucide-upload" },
  { number: 4, label: "Validate", icon: "i-lucide-check-circle" },
  { number: 5, label: "Import", icon: "i-lucide-package" }
];

const currentStepNumber = computed(() => {
  if (importStep.value === "upload") return selectedFile.value ? 3 : 1;
  if (importStep.value === "validate") return 4;
  if (importStep.value === "result") return 5;
  return 1;
});

// ============================================
// EXPORT HANDLERS
// ============================================

const handleExport = async () => {
  await exportData({
    type: exportOptions.value.type,
    format: exportOptions.value.format,
    startDate: exportOptions.value.startDate || undefined,
    endDate: exportOptions.value.endDate || undefined,
  });
};

const handleQuickExport = async (type: ExportType) => {
  await exportData({ type, format: "xlsx" });
};

const handleDownloadTemplate = async () => {
  await downloadTemplate();
};

// ============================================
// IMPORT HANDLERS
// ============================================

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    selectedFile.value = file;
    validationResult.value = null;
    importResult.value = null;
    importStep.value = "upload";
  }
};

const handleFileDrop = (event: DragEvent) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    const validTypes = [".xlsx", ".csv"];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (validTypes.includes(fileExt)) {
      selectedFile.value = file;
      validationResult.value = null;
      importResult.value = null;
      importStep.value = "upload";
    }
  }
};

const handleValidate = async () => {
  if (!selectedFile.value) return;
  
  const result = await validateFile(selectedFile.value);
  if (result) {
    validationResult.value = result;
    importStep.value = "validate";
  }
};

const handleImport = async () => {
  if (!selectedFile.value) return;
  
  const result = await importStores(selectedFile.value, {
    skipExisting: importOptions.value.skipExisting,
    updateExisting: importOptions.value.updateExisting,
  });
  
  if (result) {
    importResult.value = result;
    importStep.value = "result";
  }
};

const resetImport = () => {
  selectedFile.value = null;
  validationResult.value = null;
  importResult.value = null;
  importStep.value = "upload";
  importOptions.value = {
    skipExisting: true,
    updateExisting: false,
  };
};

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};
</script>

<template>
  <UContainer class="py-6">
    <!-- Header -->
    <PageHeader 
      title="Data Management" 
      description="Export and import data in bulk with step-by-step guidance"
    />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
      <!-- ========================================== -->
      <!-- LEFT COLUMN: EXPORT SECTION -->
      <!-- ========================================== -->
      <div class="space-y-6">
        <!-- Quick Export Cards -->
        <UCard v-if="canExport">
          <template #header>
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-gray-900/10 dark:bg-white/10">
                <UIcon name="i-lucide-download" class="w-5 h-5" />
              </div>
              <div>
                <h2 class="text-lg font-semibold">Quick Export</h2>
                <p class="text-sm text-muted-foreground">Download data with one click</p>
              </div>
            </div>
          </template>

          <!-- Quick Export Cards Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              v-for="card in quickExportCards"
              :key="card.type"
              @click="handleQuickExport(card.type)"
              :disabled="loading"
              class="group relative p-4 rounded-lg border border-default hover:border-gray-900 dark:hover:border-white transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div class="flex items-start gap-3">
                <div class="p-2.5 rounded-lg" :class="card.bgClass">
                  <UIcon :name="card.icon" class="w-5 h-5" />
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-sm mb-0.5">{{ card.label }}</h3>
                  <p class="text-xs text-muted-foreground">{{ card.description }}</p>
                </div>
              </div>
              <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
                <UIcon name="i-lucide-loader-2" class="w-5 h-5 animate-spin" />
              </div>
            </button>
          </div>
        </UCard>

        <!-- Advanced Export Options -->
        <UCard v-if="canExport">
          <template #header>
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-gray-800/10 dark:bg-white/10">
                <UIcon name="i-lucide-settings-2" class="w-5 h-5" />
              </div>
              <div>
                <h2 class="text-lg font-semibold">Advanced Export</h2>
                <p class="text-sm text-muted-foreground">Customize your export settings</p>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <!-- Data Type -->
            <UFormField label="Data Type" required class="w-full">
              <USelect
                v-model="exportOptions.type"
                :items="exportTypes"
                class="w-full"
              />
            </UFormField>

            <!-- Format Selection -->
            <UFormField label="Export Format" required class="w-full">
              <div class="flex gap-3">
                <button
                  v-for="format in exportFormats"
                  :key="format.value"
                  @click="exportOptions.format = format.value"
                  class="flex-1 px-4 py-3 rounded-lg border transition-all text-center"
                  :class="exportOptions.format === format.value 
                    ? 'border-gray-900 bg-gray-900/10 dark:border-white dark:bg-white/10 font-medium' 
                    : 'border-default hover:border-gray-400'"
                >
                  <div class="text-sm">{{ format.label }}</div>
                  <div class="text-xs text-muted-foreground mt-1">
                    {{ format.value === 'xlsx' ? 'Recommended' : 'Plain text' }}
                  </div>
                </button>
              </div>
            </UFormField>

            <!-- Date Filters (for stats) -->
            <template v-if="showDateFilters">
              <USeparator />
              <div class="space-y-3">
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  <UIcon name="i-lucide-calendar" class="w-4 h-4" />
                  <span>Date Range (Optional)</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <UFormField label="Start Date" class="w-full">
                    <UInput
                      v-model="exportOptions.startDate"
                      type="date"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="End Date" class="w-full">
                    <UInput
                      v-model="exportOptions.endDate"
                      type="date"
                      class="w-full"
                    />
                  </UFormField>
                </div>
                <p class="text-xs text-muted-foreground">
                  Leave empty to export all available data
                </p>
              </div>
            </template>

            <!-- Export Button -->
            <UButton
              icon="i-lucide-download"
              color="gray"
              size="lg"
              :loading="loading"
              @click="handleExport"
              class="w-full"
            >
              Export Data
            </UButton>
          </div>
        </UCard>

        <!-- No Export Permission -->
        <UCard v-else>
          <div class="text-center py-12">
            <div class="p-4 rounded-full bg-gray-900/10 dark:bg-white/10 w-fit mx-auto mb-4">
              <UIcon name="i-lucide-lock" class="w-8 h-8" />
            </div>
            <h3 class="font-medium mb-2">No Export Access</h3>
            <p class="text-sm text-muted-foreground">
              Contact an administrator for export permissions
            </p>
          </div>
        </UCard>
      </div>

      <!-- ========================================== -->
      <!-- RIGHT COLUMN: IMPORT SECTION -->
      <!-- ========================================== -->
      <div class="space-y-6">
        <UCard v-if="canImport">
          <template #header>
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-gray-900/10 dark:bg-white/10">
                <UIcon name="i-lucide-upload" class="w-5 h-5" />
              </div>
              <div>
                <h2 class="text-lg font-semibold">Import Stores</h2>
                <p class="text-sm text-muted-foreground">Follow the step-by-step wizard</p>
              </div>
            </div>
          </template>

          <!-- Wizard Progress -->
          <div class="mb-6 pb-6 border-b border-default">
            <div class="flex items-center justify-between">
              <div
                v-for="(step, idx) in wizardSteps"
                :key="step.number"
                class="flex items-center"
              >
                <!-- Step Circle -->
                <div class="flex flex-col items-center">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center transition-all"
                    :class="currentStepNumber >= step.number 
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-black' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'"
                  >
                    <UIcon 
                      v-if="currentStepNumber > step.number"
                      name="i-lucide-check" 
                      class="w-5 h-5" 
                    />
                    <span v-else class="text-sm font-medium">{{ step.number }}</span>
                  </div>
                  <span class="text-xs mt-1.5 hidden sm:block text-center" :class="currentStepNumber >= step.number ? 'font-medium' : 'text-muted-foreground'">
                    {{ step.label }}
                  </span>
                </div>
                
                <!-- Connector Line -->
                <div
                  v-if="idx < wizardSteps.length - 1"
                  class="h-0.5 w-8 sm:w-12 mx-1 sm:mx-2"
                  :class="currentStepNumber > step.number ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'"
                />
              </div>
            </div>
          </div>

          <!-- Step: Upload -->
          <div v-if="importStep === 'upload'" class="space-y-5">
            <!-- Step 1 & 2: Download Template & Instructions -->
            <div class="p-4 bg-gray-900/5 dark:bg-white/5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
              <div class="flex items-start gap-3 mb-3">
                <div class="p-2 rounded-lg bg-gray-900/10 dark:bg-white/10">
                  <UIcon name="i-lucide-file-spreadsheet" class="w-5 h-5" />
                </div>
                <div class="flex-1">
                  <h3 class="font-medium text-sm mb-1">Step 1: Download Template</h3>
                  <p class="text-sm text-muted-foreground mb-3">
                    Get the Excel template with the correct column format
                  </p>
                  <UButton
                    variant="soft"
                    color="gray"
                    size="sm"
                    icon="i-lucide-download"
                    :loading="loading"
                    @click="handleDownloadTemplate"
                  >
                    Download Template
                  </UButton>
                </div>
              </div>

              <USeparator class="my-4" />

              <div class="flex items-start gap-3">
                <div class="p-2 rounded-lg bg-gray-800/10 dark:bg-white/10">
                  <UIcon name="i-lucide-edit" class="w-5 h-5" />
                </div>
                <div class="flex-1">
                  <h3 class="font-medium text-sm mb-1">Step 2: Fill Your Data</h3>
                  <ul class="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Open the downloaded template in Excel</li>
                    <li>Fill in store information (code, name, PIC details)</li>
                    <li>Don't modify the column headers</li>
                    <li>Save as .xlsx or export as .csv</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Step 3: File Drop Zone -->
            <div>
              <h3 class="font-medium text-sm mb-3 flex items-center gap-2">
                <span>Step 3: Upload Your File</span>
              </h3>
              <div
                class="border-2 border-dashed rounded-lg p-8 text-center transition-all"
                :class="selectedFile 
                  ? 'border-gray-900 bg-gray-900/5 dark:border-white dark:bg-white/5' 
                  : 'border-gray-300 dark:border-gray-700 hover:border-gray-500 dark:hover:border-gray-500'"
                @dragover.prevent
                @drop="handleFileDrop"
              >
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  class="hidden"
                  id="file-input"
                  @change="handleFileSelect"
                />
                
                <template v-if="!selectedFile">
                  <div class="p-4 rounded-full bg-gray-900/10 dark:bg-white/10 w-fit mx-auto mb-4">
                    <UIcon name="i-lucide-upload-cloud" class="w-10 h-10" />
                  </div>
                  <p class="text-sm mb-3">
                    Drag and drop your file here, or
                  </p>
                  <label for="file-input">
                    <UButton as="span" variant="soft" color="gray" class="cursor-pointer">
                      Browse Files
                    </UButton>
                  </label>
                  <p class="text-xs text-muted-foreground mt-4">
                    Supports Excel (.xlsx) and CSV (.csv) files up to 5MB
                  </p>
                </template>
                
                <template v-else>
                  <div class="p-4 rounded-full bg-gray-900/10 dark:bg-white/10 w-fit mx-auto mb-4">
                    <UIcon name="i-lucide-file-check" class="w-10 h-10" />
                  </div>
                  <p class="font-medium mb-1">{{ selectedFile.name }}</p>
                  <p class="text-sm text-muted-foreground mb-4">
                    {{ formatFileSize(selectedFile.size) }}
                  </p>
                  <div class="flex justify-center gap-2">
                    <label for="file-input">
                      <UButton as="span" variant="soft" color="neutral" size="sm" class="cursor-pointer">
                        Change File
                      </UButton>
                    </label>
                    <UButton
                      variant="ghost"
                      size="sm"
                      color="gray"
                      @click="selectedFile = null"
                    >
                      Remove
                    </UButton>
                  </div>
                </template>
              </div>
            </div>

            <!-- Validate Button -->
            <UButton
              icon="i-lucide-check-circle"
              color="gray"
              size="lg"
              :loading="loading"
              :disabled="!selectedFile"
              @click="handleValidate"
              class="w-full"
            >
              Validate File
            </UButton>
          </div>

          <!-- Step: Validate -->
          <div v-else-if="importStep === 'validate' && validationResult" class="space-y-5">
            <!-- Validation Summary -->
            <div
              class="p-4 rounded-lg border"
              :class="validationResult.valid 
                ? 'bg-gray-900/10 border-gray-900/20 dark:bg-white/10 dark:border-white/20' 
                : 'bg-gray-800/10 border-gray-800/20 dark:bg-white/10 dark:border-white/20'"
            >
              <div class="flex items-center gap-3 mb-3">
                <div class="p-2 rounded-lg" :class="validationResult.valid ? 'bg-gray-900/20 dark:bg-white/20' : 'bg-gray-800/20 dark:bg-white/20'">
                  <UIcon
                    :name="validationResult.valid ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
                    class="w-5 h-5"
                  />
                </div>
                <span class="font-medium">
                  {{ validationResult.valid ? "File is Valid" : "Validation Errors Found" }}
                </span>
              </div>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="p-3 bg-background rounded-lg">
                  <div class="text-muted-foreground text-xs mb-1">Total Rows</div>
                  <div class="text-lg font-semibold">{{ validationResult.totalRows }}</div>
                </div>
                <div class="p-3 bg-background rounded-lg">
                  <div class="text-muted-foreground text-xs mb-1">Valid Rows</div>
                  <div class="text-lg font-semibold">{{ validationResult.validRows }}</div>
                </div>
              </div>
              <div v-if="validationResult.errors.length" class="mt-3 p-3 bg-background rounded-lg">
                <div class="text-muted-foreground text-xs mb-1">Errors Found</div>
                <div class="text-lg font-semibold">{{ validationResult.errors.length }}</div>
              </div>
            </div>

            <!-- Preview Table -->
            <div v-if="validationResult.preview.length" class="space-y-3">
              <h4 class="font-medium text-sm flex items-center gap-2">
                <UIcon name="i-lucide-eye" class="w-4 h-4" />
                Preview (first 5 rows)
              </h4>
              <div class="overflow-x-auto rounded-lg border border-default">
                <table class="w-full text-sm">
                  <thead class="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th class="px-4 py-3 text-left font-medium">Store Code</th>
                      <th class="px-4 py-3 text-left font-medium">Store Name</th>
                      <th class="px-4 py-3 text-left font-medium">PIC Name</th>
                      <th class="px-4 py-3 text-left font-medium">Contact</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default">
                    <tr v-for="(row, idx) in validationResult.preview" :key="idx" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td class="px-4 py-3 font-mono text-xs">{{ row.storeCode }}</td>
                      <td class="px-4 py-3">{{ row.storeName }}</td>
                      <td class="px-4 py-3">{{ row.picName }}</td>
                      <td class="px-4 py-3 text-muted-foreground">{{ row.picContact || "-" }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Errors -->
            <div v-if="validationResult.errors.length" class="space-y-3">
              <h4 class="font-medium text-sm flex items-center gap-2">
                <UIcon name="i-lucide-alert-triangle" class="w-4 h-4" />
                Validation Errors
              </h4>
              <div class="max-h-64 overflow-y-auto space-y-2 p-4 bg-gray-800/5 dark:bg-white/5 rounded-lg border border-default">
                <div
                  v-for="(err, idx) in validationResult.errors.slice(0, 20)"
                  :key="idx"
                  class="text-sm p-3 bg-background rounded border border-default"
                >
                  <div class="flex items-start gap-2">
                    <UBadge color="neutral" size="xs" class="font-mono">Row {{ err.row }}</UBadge>
                    <span class="flex-1">
                      <span v-if="err.field" class="font-medium">{{ err.field }}:</span>
                      {{ err.message }}
                    </span>
                  </div>
                </div>
                <div v-if="validationResult.errors.length > 20" class="text-sm text-muted-foreground text-center pt-2">
                  ... and {{ validationResult.errors.length - 20 }} more errors
                </div>
              </div>
            </div>

            <!-- Import Options -->
            <div v-if="validationResult.valid" class="space-y-3 p-4 bg-gray-900/5 dark:bg-white/5 rounded-lg border border-default">
              <h4 class="font-medium text-sm flex items-center gap-2">
                <UIcon name="i-lucide-settings" class="w-4 h-4" />
                Import Options
              </h4>
              <div class="space-y-2">
                <UCheckbox
                  v-model="importOptions.skipExisting"
                  label="Skip existing stores (don't create duplicates)"
                />
                <UCheckbox
                  v-model="importOptions.updateExisting"
                  label="Update existing stores with new data"
                  :disabled="importOptions.skipExisting"
                />
              </div>
              <p class="text-xs text-muted-foreground">
                If both options are disabled, importing existing stores will show as errors.
              </p>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-3">
              <UButton
                variant="soft"
                color="neutral"
                @click="resetImport"
              >
                Back
              </UButton>
              <UButton
                v-if="validationResult.valid"
                icon="i-lucide-upload"
                color="gray"
                size="lg"
                :loading="loading"
                @click="handleImport"
                class="flex-1"
              >
                Import {{ validationResult.validRows }} Stores
              </UButton>
            </div>
          </div>

          <!-- Step: Result -->
          <div v-else-if="importStep === 'result' && importResult" class="space-y-5">
            <!-- Result Summary -->
            <div
              class="p-5 rounded-lg border"
              :class="importResult.success 
                ? 'bg-gray-900/10 border-gray-900/20 dark:bg-white/10 dark:border-white/20' 
                : 'bg-gray-700/10 border-gray-700/20 dark:bg-white/10 dark:border-white/20'"
            >
              <div class="flex items-center gap-3 mb-4">
                <div class="p-3 rounded-full" :class="importResult.success ? 'bg-gray-900/20 dark:bg-white/20' : 'bg-gray-700/20 dark:bg-white/20'">
                  <UIcon
                    :name="importResult.success ? 'i-lucide-check-circle' : 'i-lucide-alert-triangle'"
                    class="w-6 h-6"
                  />
                </div>
                <span class="font-semibold text-lg">
                  {{ importResult.success ? "Import Successful!" : "Import Completed with Errors" }}
                </span>
              </div>
              
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="text-center p-4 bg-background rounded-lg">
                  <div class="text-2xl font-bold mb-1">{{ importResult.totalRows }}</div>
                  <div class="text-xs text-muted-foreground">Total</div>
                </div>
                <div class="text-center p-4 bg-background rounded-lg">
                  <div class="text-2xl font-bold mb-1">{{ importResult.successCount }}</div>
                  <div class="text-xs text-muted-foreground">Imported</div>
                </div>
                <div class="text-center p-4 bg-background rounded-lg">
                  <div class="text-2xl font-bold mb-1 text-muted-foreground">{{ importResult.skippedCount }}</div>
                  <div class="text-xs text-muted-foreground">Skipped</div>
                </div>
                <div class="text-center p-4 bg-background rounded-lg">
                  <div class="text-2xl font-bold mb-1">{{ importResult.errorCount }}</div>
                  <div class="text-xs text-muted-foreground">Errors</div>
                </div>
              </div>
            </div>

            <!-- Import Errors -->
            <div v-if="importResult.errors.length" class="space-y-3">
              <h4 class="font-medium text-sm flex items-center gap-2">
                <UIcon name="i-lucide-x-circle" class="w-4 h-4" />
                Import Errors ({{ importResult.errors.length }})
              </h4>
              <div class="max-h-64 overflow-y-auto space-y-2 p-4 bg-gray-800/5 dark:bg-white/5 rounded-lg border border-default">
                <div
                  v-for="(err, idx) in importResult.errors.slice(0, 20)"
                  :key="idx"
                  class="text-sm p-3 bg-background rounded border border-default"
                >
                  <div class="flex items-start gap-2">
                    <UBadge color="neutral" size="xs" class="font-mono">Row {{ err.row }}</UBadge>
                    <span class="flex-1">
                      <span v-if="err.field" class="font-medium">{{ err.field }}</span>
                      <span v-if="err.value" class="text-muted-foreground"> ({{ err.value }})</span>:
                      {{ err.message }}
                    </span>
                  </div>
                </div>
                <div v-if="importResult.errors.length > 20" class="text-sm text-muted-foreground text-center pt-2">
                  ... and {{ importResult.errors.length - 20 }} more errors
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-3">
              <UButton
                icon="i-lucide-refresh-cw"
                variant="soft"
                color="neutral"
                @click="resetImport"
                class="flex-1"
              >
                Import Another File
              </UButton>
              <NuxtLink to="/" class="flex-1">
                <UButton variant="soft" color="gray" class="w-full">
                  Go to Dashboard
                </UButton>
              </NuxtLink>
            </div>
          </div>
        </UCard>

        <!-- No Import Permission -->
        <UCard v-else>
          <template #header>
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-gray-900/10 dark:bg-white/10">
                <UIcon name="i-lucide-upload" class="w-5 h-5" />
              </div>
              <div>
                <h2 class="text-lg font-semibold">Import Stores</h2>
              </div>
            </div>
          </template>
          
          <div class="text-center py-12">
            <div class="p-4 rounded-full bg-gray-900/10 dark:bg-white/10 w-fit mx-auto mb-4">
              <UIcon name="i-lucide-lock" class="w-8 h-8" />
            </div>
            <h3 class="font-medium mb-2">No Import Access</h3>
            <p class="text-sm text-muted-foreground">
              Contact an administrator for import permissions
            </p>
          </div>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>
