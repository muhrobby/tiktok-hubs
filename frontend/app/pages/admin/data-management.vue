<script setup lang="ts">
import type { ExportType, ExportFormat, ImportValidationResult, ImportResult } from "~/composables/useExportImport";

// Auth protection - Admin/Ops only
definePageMeta({
  middleware: "auth",
  requiredPermissions: ["export_all_data"],
});

useHead({
  title: "Data Management - TikTok Hubs",
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
      description="Export and import data in bulk"
    />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Export Section -->
      <UCard v-if="canExport">
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-download" class="w-5 h-5 text-primary" />
            <h2 class="text-lg font-semibold">Export Data</h2>
          </div>
        </template>

        <div class="space-y-4">
          <!-- Data Type -->
          <UFormField label="Data Type" class="w-full">
            <USelect
              v-model="exportOptions.type"
              :items="exportTypes"
              class="w-full"
            />
          </UFormField>

          <!-- Format -->
          <UFormField label="Format" class="w-full">
            <USelect
              v-model="exportOptions.format"
              :items="exportFormats"
              class="w-full"
            />
          </UFormField>

          <!-- Date Filters (for stats) -->
          <template v-if="showDateFilters">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </template>

          <!-- Export Button -->
          <UButton
            icon="i-lucide-download"
            :loading="loading"
            @click="handleExport"
            class="w-full"
          >
            Export Data
          </UButton>
        </div>
      </UCard>

      <!-- Import Section -->
      <UCard v-if="canImport">
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-upload" class="w-5 h-5 text-primary" />
            <h2 class="text-lg font-semibold">Import Stores</h2>
          </div>
        </template>

        <!-- Step: Upload -->
        <div v-if="importStep === 'upload'" class="space-y-4">
          <!-- Download Template -->
          <div class="p-4 bg-muted/50 rounded-lg border border-dashed">
            <div class="flex items-center gap-3 mb-2">
              <UIcon name="i-lucide-file-spreadsheet" class="w-5 h-5 text-muted-foreground" />
              <span class="font-medium">Need a template?</span>
            </div>
            <p class="text-sm text-muted-foreground mb-3">
              Download our Excel template with the correct column format
            </p>
            <UButton
              variant="outline"
              size="sm"
              icon="i-lucide-download"
              :loading="loading"
              @click="handleDownloadTemplate"
            >
              Download Template
            </UButton>
          </div>

          <!-- File Drop Zone -->
          <div
            class="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
            :class="selectedFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'"
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
              <UIcon name="i-lucide-upload-cloud" class="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p class="text-muted-foreground mb-2">
                Drag and drop your file here, or
              </p>
              <label for="file-input">
                <UButton as="span" variant="outline" class="cursor-pointer">
                  Browse Files
                </UButton>
              </label>
              <p class="text-xs text-muted-foreground mt-3">
                Supports Excel (.xlsx) and CSV (.csv) files up to 5MB
              </p>
            </template>
            
            <template v-else>
              <UIcon name="i-lucide-file-check" class="w-12 h-12 mx-auto text-primary mb-4" />
              <p class="font-medium mb-1">{{ selectedFile.name }}</p>
              <p class="text-sm text-muted-foreground mb-3">
                {{ formatFileSize(selectedFile.size) }}
              </p>
              <div class="flex justify-center gap-2">
                <label for="file-input">
                  <UButton as="span" variant="outline" size="sm" class="cursor-pointer">
                    Change File
                  </UButton>
                </label>
                <UButton
                  variant="ghost"
                  size="sm"
                  color="error"
                  @click="selectedFile = null"
                >
                  Remove
                </UButton>
              </div>
            </template>
          </div>

          <!-- Validate Button -->
          <UButton
            icon="i-lucide-check-circle"
            :loading="loading"
            :disabled="!selectedFile"
            @click="handleValidate"
            class="w-full"
          >
            Validate File
          </UButton>
        </div>

        <!-- Step: Validate -->
        <div v-else-if="importStep === 'validate' && validationResult" class="space-y-4">
          <!-- Validation Summary -->
          <div
            class="p-4 rounded-lg"
            :class="validationResult.valid ? 'bg-success/10 border border-success/20' : 'bg-error/10 border border-error/20'"
          >
            <div class="flex items-center gap-2 mb-2">
              <UIcon
                :name="validationResult.valid ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
                :class="validationResult.valid ? 'text-success' : 'text-error'"
                class="w-5 h-5"
              />
              <span class="font-medium">
                {{ validationResult.valid ? "File is valid" : "Validation errors found" }}
              </span>
            </div>
            <div class="text-sm grid grid-cols-2 gap-2">
              <div>Total Rows: <strong>{{ validationResult.totalRows }}</strong></div>
              <div>Valid Rows: <strong class="text-success">{{ validationResult.validRows }}</strong></div>
              <div v-if="validationResult.errors.length">
                Errors: <strong class="text-error">{{ validationResult.errors.length }}</strong>
              </div>
            </div>
          </div>

          <!-- Preview -->
          <div v-if="validationResult.preview.length" class="space-y-2">
            <h4 class="font-medium text-sm">Preview (first 5 rows):</h4>
            <div class="overflow-x-auto">
              <table class="w-full text-sm border rounded-lg">
                <thead class="bg-muted">
                  <tr>
                    <th class="px-3 py-2 text-left">Store Code</th>
                    <th class="px-3 py-2 text-left">Store Name</th>
                    <th class="px-3 py-2 text-left">PIC Name</th>
                    <th class="px-3 py-2 text-left">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in validationResult.preview" :key="idx" class="border-t">
                    <td class="px-3 py-2">{{ row.storeCode }}</td>
                    <td class="px-3 py-2">{{ row.storeName }}</td>
                    <td class="px-3 py-2">{{ row.picName }}</td>
                    <td class="px-3 py-2">{{ row.picContact || "-" }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Errors -->
          <div v-if="validationResult.errors.length" class="space-y-2">
            <h4 class="font-medium text-sm text-error">Errors:</h4>
            <div class="max-h-48 overflow-y-auto space-y-1">
              <div
                v-for="(err, idx) in validationResult.errors.slice(0, 10)"
                :key="idx"
                class="text-sm p-2 bg-error/5 rounded border border-error/10"
              >
                <span class="font-mono text-error">Row {{ err.row }}</span>
                <span v-if="err.field"> - {{ err.field }}</span>:
                {{ err.message }}
              </div>
              <div v-if="validationResult.errors.length > 10" class="text-sm text-muted-foreground">
                ... and {{ validationResult.errors.length - 10 }} more errors
              </div>
            </div>
          </div>

          <!-- Import Options -->
          <div v-if="validationResult.valid" class="space-y-3 p-4 bg-muted/50 rounded-lg">
            <h4 class="font-medium text-sm">Import Options:</h4>
            <UCheckbox
              v-model="importOptions.skipExisting"
              label="Skip existing stores"
            />
            <UCheckbox
              v-model="importOptions.updateExisting"
              label="Update existing stores"
              :disabled="importOptions.skipExisting"
            />
            <p class="text-xs text-muted-foreground">
              If both options are disabled, importing existing stores will show as errors.
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3">
            <UButton
              variant="outline"
              @click="resetImport"
            >
              Back
            </UButton>
            <UButton
              v-if="validationResult.valid"
              icon="i-lucide-upload"
              :loading="loading"
              @click="handleImport"
              class="flex-1"
            >
              Import {{ validationResult.validRows }} Stores
            </UButton>
          </div>
        </div>

        <!-- Step: Result -->
        <div v-else-if="importStep === 'result' && importResult" class="space-y-4">
          <!-- Result Summary -->
          <div
            class="p-4 rounded-lg"
            :class="importResult.success ? 'bg-success/10 border border-success/20' : 'bg-warning/10 border border-warning/20'"
          >
            <div class="flex items-center gap-2 mb-3">
              <UIcon
                :name="importResult.success ? 'i-lucide-check-circle' : 'i-lucide-alert-triangle'"
                :class="importResult.success ? 'text-success' : 'text-warning'"
                class="w-6 h-6"
              />
              <span class="font-semibold text-lg">
                {{ importResult.success ? "Import Successful" : "Import Completed with Errors" }}
              </span>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="text-center p-3 bg-background rounded-lg">
                <div class="text-2xl font-bold">{{ importResult.totalRows }}</div>
                <div class="text-xs text-muted-foreground">Total Rows</div>
              </div>
              <div class="text-center p-3 bg-background rounded-lg">
                <div class="text-2xl font-bold text-success">{{ importResult.successCount }}</div>
                <div class="text-xs text-muted-foreground">Imported</div>
              </div>
              <div class="text-center p-3 bg-background rounded-lg">
                <div class="text-2xl font-bold text-muted-foreground">{{ importResult.skippedCount }}</div>
                <div class="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div class="text-center p-3 bg-background rounded-lg">
                <div class="text-2xl font-bold text-error">{{ importResult.errorCount }}</div>
                <div class="text-xs text-muted-foreground">Errors</div>
              </div>
            </div>
          </div>

          <!-- Errors -->
          <div v-if="importResult.errors.length" class="space-y-2">
            <h4 class="font-medium text-sm text-error">Import Errors:</h4>
            <div class="max-h-48 overflow-y-auto space-y-1">
              <div
                v-for="(err, idx) in importResult.errors.slice(0, 10)"
                :key="idx"
                class="text-sm p-2 bg-error/5 rounded border border-error/10"
              >
                <span class="font-mono text-error">Row {{ err.row }}</span>
                <span v-if="err.field"> - {{ err.field }}</span>
                <span v-if="err.value" class="text-muted-foreground"> ({{ err.value }})</span>:
                {{ err.message }}
              </div>
              <div v-if="importResult.errors.length > 10" class="text-sm text-muted-foreground">
                ... and {{ importResult.errors.length - 10 }} more errors
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3">
            <UButton
              icon="i-lucide-refresh-cw"
              variant="outline"
              @click="resetImport"
            >
              Import Another File
            </UButton>
            <NuxtLink to="/">
              <UButton variant="ghost">
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
            <UIcon name="i-lucide-upload" class="w-5 h-5 text-muted-foreground" />
            <h2 class="text-lg font-semibold">Import Stores</h2>
          </div>
        </template>
        
        <div class="text-center py-8">
          <UIcon name="i-lucide-lock" class="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p class="text-muted-foreground">
            You don't have permission to import data.<br />
            Contact an administrator for access.
          </p>
        </div>
      </UCard>
    </div>

    <!-- Quick Export Buttons -->
    <UCard v-if="canExport" class="mt-8">
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-zap" class="w-5 h-5 text-warning" />
          <h2 class="text-lg font-semibold">Quick Export</h2>
        </div>
      </template>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <UButton
          variant="outline"
          icon="i-lucide-store"
          :loading="loading"
          @click="exportData({ type: 'stores', format: 'xlsx' })"
        >
          Stores (Excel)
        </UButton>
        <UButton
          variant="outline"
          icon="i-lucide-users"
          :loading="loading"
          @click="exportData({ type: 'user-stats', format: 'xlsx' })"
        >
          User Stats (Excel)
        </UButton>
        <UButton
          variant="outline"
          icon="i-lucide-video"
          :loading="loading"
          @click="exportData({ type: 'video-stats', format: 'xlsx' })"
        >
          Video Stats (Excel)
        </UButton>
        <UButton
          variant="outline"
          icon="i-lucide-file-clock"
          :loading="loading"
          @click="exportData({ type: 'sync-logs', format: 'xlsx' })"
        >
          Sync Logs (Excel)
        </UButton>
      </div>
    </UCard>
  </UContainer>
</template>
