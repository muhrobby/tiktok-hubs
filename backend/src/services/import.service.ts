/**
 * Import Service
 *
 * Handles importing data from CSV and Excel files
 */

import ExcelJS from "exceljs";
import { Readable } from "stream";
import { db } from "../db/client.js";
import { stores } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger.js";

// ============================================
// TYPES
// ============================================

export interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  field?: string;
  value?: string;
  message: string;
}

export interface StoreImportRow {
  storeCode: string;
  storeName: string;
  picName: string;
  picContact?: string;
}

// ============================================
// VALIDATION HELPERS
// ============================================

function isValidStoreCode(code: string): boolean {
  return /^[a-zA-Z0-9_-]{1,50}$/.test(code);
}

function validateStoreRow(row: Record<string, any>, rowNumber: number): { valid: boolean; data?: StoreImportRow; errors: ImportError[] } {
  const errors: ImportError[] = [];

  // Get values (handle both camelCase and snake_case)
  const storeCode = (row.store_code || row.storeCode || "").toString().trim();
  const storeName = (row.store_name || row.storeName || "").toString().trim();
  const picName = (row.pic_name || row.picName || "").toString().trim();
  const picContact = (row.pic_contact || row.picContact || "").toString().trim();

  // Validate store_code
  if (!storeCode) {
    errors.push({ row: rowNumber, field: "store_code", message: "Store code is required" });
  } else if (!isValidStoreCode(storeCode)) {
    errors.push({
      row: rowNumber,
      field: "store_code",
      value: storeCode,
      message: "Store code must be 1-50 alphanumeric characters with underscores or hyphens",
    });
  }

  // Validate store_name
  if (!storeName) {
    errors.push({ row: rowNumber, field: "store_name", message: "Store name is required" });
  } else if (storeName.length > 255) {
    errors.push({
      row: rowNumber,
      field: "store_name",
      value: storeName.slice(0, 50) + "...",
      message: "Store name must be 255 characters or less",
    });
  }

  // Validate pic_name
  if (!picName) {
    errors.push({ row: rowNumber, field: "pic_name", message: "PIC name is required" });
  } else if (picName.length > 255) {
    errors.push({
      row: rowNumber,
      field: "pic_name",
      value: picName.slice(0, 50) + "...",
      message: "PIC name must be 255 characters or less",
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      storeCode,
      storeName,
      picName,
      picContact: picContact || undefined,
    },
    errors: [],
  };
}

// ============================================
// IMPORT FUNCTIONS
// ============================================

/**
 * Parse Excel/CSV file and return rows
 */
async function parseFile(buffer: Buffer, filename: string): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook();

  if (filename.endsWith(".csv")) {
    // Create a readable stream from buffer for CSV
    const stream = Readable.from(buffer);
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  }

  // Get first worksheet
  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    throw new Error("File is empty or has no data rows");
  }

  const rows: Record<string, any>[] = [];
  const headers: string[] = [];

  // Get headers from first row
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    const header = cell.value?.toString().toLowerCase().trim() || `column_${colNumber}`;
    // Normalize header names
    headers[colNumber - 1] = header
      .replace(/\*/g, "") // Remove required markers
      .replace(/\s+/g, "_"); // Replace spaces with underscores
  });

  // Parse data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const rowData: Record<string, any> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        rowData[header] = cell.value;
      }
    });

    // Skip empty rows
    if (Object.values(rowData).some((v) => v !== null && v !== undefined && v !== "")) {
      rows.push(rowData);
    }
  });

  return rows;
}

/**
 * Import stores from Excel/CSV file
 */
export async function importStores(
  buffer: Buffer,
  filename: string,
  options: { skipExisting?: boolean; updateExisting?: boolean } = {}
): Promise<ImportResult> {
  const { skipExisting = true, updateExisting = false } = options;

  const result: ImportResult = {
    success: false,
    totalRows: 0,
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
    errors: [],
  };

  try {
    // Parse file
    const rows = await parseFile(buffer, filename);
    result.totalRows = rows.length;

    if (rows.length === 0) {
      result.errors.push({ row: 0, message: "No data rows found in file" });
      return result;
    }

    logger.info({ rowCount: rows.length }, "Importing stores from file");

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // Excel row number (1-indexed + header)
      const row = rows[i];

      // Validate row
      const validation = validateStoreRow(row, rowNumber);
      if (!validation.valid) {
        result.errors.push(...validation.errors);
        result.errorCount++;
        continue;
      }

      const storeData = validation.data!;

      try {
        // Check if store exists
        const [existing] = await db
          .select({ storeCode: stores.storeCode })
          .from(stores)
          .where(eq(stores.storeCode, storeData.storeCode))
          .limit(1);

        if (existing) {
          if (updateExisting) {
            // Update existing store
            await db
              .update(stores)
              .set({
                storeName: storeData.storeName,
                picName: storeData.picName,
                picContact: storeData.picContact,
              })
              .where(eq(stores.storeCode, storeData.storeCode));

            result.successCount++;
            logger.debug({ storeCode: storeData.storeCode }, "Updated existing store");
          } else if (skipExisting) {
            result.skippedCount++;
            logger.debug({ storeCode: storeData.storeCode }, "Skipped existing store");
          } else {
            result.errors.push({
              row: rowNumber,
              field: "store_code",
              value: storeData.storeCode,
              message: "Store already exists",
            });
            result.errorCount++;
          }
          continue;
        }

        // Insert new store
        await db.insert(stores).values({
          storeCode: storeData.storeCode,
          storeName: storeData.storeName,
          picName: storeData.picName,
          picContact: storeData.picContact,
          createdAt: new Date(),
        });

        result.successCount++;
        logger.debug({ storeCode: storeData.storeCode }, "Created new store");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Database error";
        result.errors.push({
          row: rowNumber,
          field: "store_code",
          value: storeData.storeCode,
          message,
        });
        result.errorCount++;
        logger.error({ error, storeCode: storeData.storeCode }, "Failed to import store");
      }
    }

    result.success = result.errorCount === 0;
    logger.info(
      {
        total: result.totalRows,
        success: result.successCount,
        errors: result.errorCount,
        skipped: result.skippedCount,
      },
      "Import completed"
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse file";
    result.errors.push({ row: 0, message });
    logger.error({ error }, "Import failed");
    return result;
  }
}

/**
 * Validate import file without actually importing
 */
export async function validateImportFile(
  buffer: Buffer,
  filename: string
): Promise<{
  valid: boolean;
  totalRows: number;
  validRows: number;
  errors: ImportError[];
  preview: StoreImportRow[];
}> {
  const result = {
    valid: false,
    totalRows: 0,
    validRows: 0,
    errors: [] as ImportError[],
    preview: [] as StoreImportRow[],
  };

  try {
    const rows = await parseFile(buffer, filename);
    result.totalRows = rows.length;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const row = rows[i];

      const validation = validateStoreRow(row, rowNumber);
      if (validation.valid && validation.data) {
        result.validRows++;
        if (result.preview.length < 5) {
          result.preview.push(validation.data);
        }
      } else {
        result.errors.push(...validation.errors);
      }
    }

    result.valid = result.errors.length === 0 && result.validRows > 0;
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse file";
    result.errors.push({ row: 0, message });
    return result;
  }
}
