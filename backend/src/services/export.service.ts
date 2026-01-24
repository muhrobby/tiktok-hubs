/**
 * Export Service
 *
 * Handles exporting data to CSV and Excel formats
 */

import ExcelJS from "exceljs";
import { db } from "../db/client.js";
import {
  stores,
  storeAccounts,
  tiktokUserDaily,
  tiktokVideoDaily,
  syncLogs,
} from "../db/schema.js";
import { eq, and, gte, lte, inArray, desc } from "drizzle-orm";
import { logger } from "../utils/logger.js";

// ============================================
// TYPES
// ============================================

export type ExportFormat = "csv" | "xlsx";

export interface ExportOptions {
  format: ExportFormat;
  storeFilter?: string[] | null; // null = all stores
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

// ============================================
// HELPERS
// ============================================

function formatDateTime(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().replace("T", " ").slice(0, 19);
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Export stores list
 */
export async function exportStores(options: ExportOptions): Promise<ExportResult> {
  const { format, storeFilter } = options;

  // Fetch data
  let query = db
    .select({
      storeCode: stores.storeCode,
      storeName: stores.storeName,
      picName: stores.picName,
      picContact: stores.picContact,
      createdAt: stores.createdAt,
      status: storeAccounts.status,
      lastSyncTime: storeAccounts.lastSyncTime,
      connectedAt: storeAccounts.connectedAt,
    })
    .from(stores)
    .leftJoin(storeAccounts, eq(stores.storeCode, storeAccounts.storeCode));

  if (storeFilter && storeFilter.length > 0) {
    query = query.where(inArray(stores.storeCode, storeFilter)) as typeof query;
  }

  const data = await query;

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TikTok Hubs";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Stores");

  // Define columns
  worksheet.columns = [
    { header: "Store Code", key: "storeCode", width: 15 },
    { header: "Store Name", key: "storeName", width: 30 },
    { header: "PIC Name", key: "picName", width: 25 },
    { header: "PIC Contact", key: "picContact", width: 25 },
    { header: "Status", key: "status", width: 15 },
    { header: "Connected At", key: "connectedAt", width: 20 },
    { header: "Last Sync", key: "lastSyncTime", width: 20 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data
  data.forEach((row) => {
    worksheet.addRow({
      storeCode: row.storeCode,
      storeName: row.storeName,
      picName: row.picName,
      picContact: row.picContact || "",
      status: row.status || "NOT_CONNECTED",
      connectedAt: formatDateTime(row.connectedAt),
      lastSyncTime: formatDateTime(row.lastSyncTime),
      createdAt: formatDateTime(row.createdAt),
    });
  });

  // Generate buffer
  const buffer = await generateBuffer(workbook, format);
  const timestamp = new Date().toISOString().slice(0, 10);

  return {
    buffer,
    filename: `stores_${timestamp}.${format}`,
    mimeType: format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv",
  };
}

/**
 * Export user stats (followers, likes, etc.)
 */
export async function exportUserStats(options: ExportOptions): Promise<ExportResult> {
  const { format, storeFilter, startDate, endDate } = options;

  // Build conditions
  const conditions = [];
  if (storeFilter && storeFilter.length > 0) {
    conditions.push(inArray(tiktokUserDaily.storeCode, storeFilter));
  }
  if (startDate) {
    conditions.push(gte(tiktokUserDaily.snapshotDate, startDate));
  }
  if (endDate) {
    conditions.push(lte(tiktokUserDaily.snapshotDate, endDate));
  }

  // Fetch data
  let query = db
    .select({
      storeCode: tiktokUserDaily.storeCode,
      storeName: stores.storeName,
      snapshotDate: tiktokUserDaily.snapshotDate,
      displayName: tiktokUserDaily.displayName,
      followerCount: tiktokUserDaily.followerCount,
      followingCount: tiktokUserDaily.followingCount,
      likesCount: tiktokUserDaily.likesCount,
      videoCount: tiktokUserDaily.videoCount,
    })
    .from(tiktokUserDaily)
    .leftJoin(stores, eq(tiktokUserDaily.storeCode, stores.storeCode))
    .orderBy(desc(tiktokUserDaily.snapshotDate), tiktokUserDaily.storeCode);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const data = await query;

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TikTok Hubs";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("User Stats");

  // Define columns
  worksheet.columns = [
    { header: "Store Code", key: "storeCode", width: 15 },
    { header: "Store Name", key: "storeName", width: 30 },
    { header: "Snapshot Date", key: "snapshotDate", width: 15 },
    { header: "Display Name", key: "displayName", width: 25 },
    { header: "Followers", key: "followerCount", width: 12 },
    { header: "Following", key: "followingCount", width: 12 },
    { header: "Likes", key: "likesCount", width: 12 },
    { header: "Videos", key: "videoCount", width: 10 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data
  data.forEach((row) => {
    worksheet.addRow({
      storeCode: row.storeCode,
      storeName: row.storeName || "",
      snapshotDate: row.snapshotDate,
      displayName: row.displayName || "",
      followerCount: row.followerCount,
      followingCount: row.followingCount,
      likesCount: row.likesCount,
      videoCount: row.videoCount,
    });
  });

  // Format number columns
  ["E", "F", "G", "H"].forEach((col) => {
    worksheet.getColumn(col).numFmt = "#,##0";
  });

  // Generate buffer
  const buffer = await generateBuffer(workbook, format);
  const timestamp = new Date().toISOString().slice(0, 10);

  return {
    buffer,
    filename: `user_stats_${timestamp}.${format}`,
    mimeType: format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv",
  };
}

/**
 * Export video stats
 */
export async function exportVideoStats(options: ExportOptions): Promise<ExportResult> {
  const { format, storeFilter, startDate, endDate } = options;

  // Build conditions
  const conditions = [];
  if (storeFilter && storeFilter.length > 0) {
    conditions.push(inArray(tiktokVideoDaily.storeCode, storeFilter));
  }
  if (startDate) {
    conditions.push(gte(tiktokVideoDaily.snapshotDate, startDate));
  }
  if (endDate) {
    conditions.push(lte(tiktokVideoDaily.snapshotDate, endDate));
  }

  // Fetch data
  let query = db
    .select({
      storeCode: tiktokVideoDaily.storeCode,
      storeName: stores.storeName,
      videoId: tiktokVideoDaily.videoId,
      snapshotDate: tiktokVideoDaily.snapshotDate,
      description: tiktokVideoDaily.description,
      createTime: tiktokVideoDaily.createTime,
      viewCount: tiktokVideoDaily.viewCount,
      likeCount: tiktokVideoDaily.likeCount,
      commentCount: tiktokVideoDaily.commentCount,
      shareCount: tiktokVideoDaily.shareCount,
      shareUrl: tiktokVideoDaily.shareUrl,
    })
    .from(tiktokVideoDaily)
    .leftJoin(stores, eq(tiktokVideoDaily.storeCode, stores.storeCode))
    .orderBy(desc(tiktokVideoDaily.snapshotDate), desc(tiktokVideoDaily.viewCount));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const data = await query.limit(10000); // Limit to prevent huge exports

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TikTok Hubs";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Video Stats");

  // Define columns
  worksheet.columns = [
    { header: "Store Code", key: "storeCode", width: 15 },
    { header: "Store Name", key: "storeName", width: 25 },
    { header: "Video ID", key: "videoId", width: 25 },
    { header: "Snapshot Date", key: "snapshotDate", width: 15 },
    { header: "Description", key: "description", width: 40 },
    { header: "Created At", key: "createTime", width: 20 },
    { header: "Views", key: "viewCount", width: 12 },
    { header: "Likes", key: "likeCount", width: 10 },
    { header: "Comments", key: "commentCount", width: 10 },
    { header: "Shares", key: "shareCount", width: 10 },
    { header: "URL", key: "shareUrl", width: 50 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data
  data.forEach((row) => {
    worksheet.addRow({
      storeCode: row.storeCode,
      storeName: row.storeName || "",
      videoId: row.videoId,
      snapshotDate: row.snapshotDate,
      description: row.description?.slice(0, 100) || "",
      createTime: formatDateTime(row.createTime),
      viewCount: row.viewCount,
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      shareCount: row.shareCount,
      shareUrl: row.shareUrl || "",
    });
  });

  // Format number columns
  ["G", "H", "I", "J"].forEach((col) => {
    worksheet.getColumn(col).numFmt = "#,##0";
  });

  // Generate buffer
  const buffer = await generateBuffer(workbook, format);
  const timestamp = new Date().toISOString().slice(0, 10);

  return {
    buffer,
    filename: `video_stats_${timestamp}.${format}`,
    mimeType: format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv",
  };
}

/**
 * Export sync logs
 */
export async function exportSyncLogs(options: ExportOptions): Promise<ExportResult> {
  const { format, storeFilter } = options;

  // Fetch data
  let query = db
    .select({
      id: syncLogs.id,
      storeCode: syncLogs.storeCode,
      storeName: stores.storeName,
      jobName: syncLogs.jobName,
      status: syncLogs.status,
      message: syncLogs.message,
      runTime: syncLogs.runTime,
      durationMs: syncLogs.durationMs,
    })
    .from(syncLogs)
    .leftJoin(stores, eq(syncLogs.storeCode, stores.storeCode))
    .orderBy(desc(syncLogs.runTime));

  if (storeFilter && storeFilter.length > 0) {
    query = query.where(inArray(syncLogs.storeCode, storeFilter)) as typeof query;
  }

  const data = await query.limit(5000);

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TikTok Hubs";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Sync Logs");

  // Define columns
  worksheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Store Code", key: "storeCode", width: 15 },
    { header: "Store Name", key: "storeName", width: 25 },
    { header: "Job Name", key: "jobName", width: 20 },
    { header: "Status", key: "status", width: 12 },
    { header: "Message", key: "message", width: 50 },
    { header: "Run Time", key: "runTime", width: 20 },
    { header: "Duration (ms)", key: "durationMs", width: 15 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data
  data.forEach((row) => {
    worksheet.addRow({
      id: row.id,
      storeCode: row.storeCode || "",
      storeName: row.storeName || "",
      jobName: row.jobName,
      status: row.status,
      message: row.message || "",
      runTime: formatDateTime(row.runTime),
      durationMs: row.durationMs || 0,
    });
  });

  // Generate buffer
  const buffer = await generateBuffer(workbook, format);
  const timestamp = new Date().toISOString().slice(0, 10);

  return {
    buffer,
    filename: `sync_logs_${timestamp}.${format}`,
    mimeType: format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv",
  };
}

/**
 * Generate buffer for workbook
 */
async function generateBuffer(workbook: ExcelJS.Workbook, format: ExportFormat): Promise<Buffer> {
  if (format === "csv") {
    // Export first worksheet as CSV
    const worksheet = workbook.worksheets[0];
    const csvBuffer = await workbook.csv.writeBuffer({
      sheetId: worksheet.id,
      formatterOptions: {
        delimiter: ",",
        quote: true,
      },
    });
    return Buffer.from(csvBuffer);
  }

  // Export as XLSX
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(xlsxBuffer);
}

/**
 * Get export template for stores import
 */
export async function getStoresImportTemplate(): Promise<ExportResult> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TikTok Hubs";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Stores Import Template");

  // Define columns
  worksheet.columns = [
    { header: "store_code*", key: "storeCode", width: 20 },
    { header: "store_name*", key: "storeName", width: 30 },
    { header: "pic_name*", key: "picName", width: 25 },
    { header: "pic_contact", key: "picContact", width: 25 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF2CC" },
  };

  // Add example rows
  worksheet.addRow({
    storeCode: "STORE001",
    storeName: "Example Store 1",
    picName: "John Doe",
    picContact: "+62812345678",
  });
  worksheet.addRow({
    storeCode: "STORE002",
    storeName: "Example Store 2",
    picName: "Jane Doe",
    picContact: "jane@example.com",
  });

  // Add instructions sheet
  const instructionsSheet = workbook.addWorksheet("Instructions");
  instructionsSheet.columns = [
    { header: "Field", key: "field", width: 20 },
    { header: "Required", key: "required", width: 10 },
    { header: "Description", key: "description", width: 60 },
  ];
  instructionsSheet.getRow(1).font = { bold: true };

  instructionsSheet.addRow({
    field: "store_code",
    required: "Yes",
    description: "Unique identifier for the store (alphanumeric, underscores, hyphens, max 50 chars)",
  });
  instructionsSheet.addRow({
    field: "store_name",
    required: "Yes",
    description: "Display name of the store (max 255 chars)",
  });
  instructionsSheet.addRow({
    field: "pic_name",
    required: "Yes",
    description: "Person in charge name (max 255 chars)",
  });
  instructionsSheet.addRow({
    field: "pic_contact",
    required: "No",
    description: "Contact information (phone/email)",
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    buffer: Buffer.from(buffer),
    filename: "stores_import_template.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
