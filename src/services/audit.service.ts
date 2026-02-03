/**
 * Audit Log Service
 *
 * Service for creating and querying audit logs
 */

import { db } from "../db/client.js";
import { auditLogs, users, type AuditLog, type NewAuditLog, type AuditAction } from "../db/schema.js";
import { eq, desc, and, gte, lte, like, inArray, sql, count } from "drizzle-orm";
import { logger } from "../utils/logger.js";

// ============================================
// TYPES
// ============================================

export interface AuditLogEntry {
  userId?: number | null;
  username?: string | null;
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  method?: string | null;
  path?: string | null;
  requestId?: string | null;
  success?: boolean;
  errorCode?: string | null;
  duration?: number | null;
  details?: Record<string, unknown> | null;
}

export interface AuditLogFilters {
  userId?: number;
  username?: string;
  action?: AuditAction;
  actions?: AuditAction[];
  resource?: string;
  resourceId?: string;
  success?: boolean;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  search?: string; // Search in resource, resourceId, path
}

export interface PaginatedAuditLogs {
  data: (AuditLog & { user?: { username: string; fullName: string | null } | null })[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Create a new audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<AuditLog | null> {
  try {
    const [result] = await db
      .insert(auditLogs)
      .values({
        timestamp: new Date(),
        userId: entry.userId ?? null,
        username: entry.username ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        method: entry.method ?? null,
        path: entry.path ?? null,
        requestId: entry.requestId ?? null,
        success: entry.success ?? true,
        errorCode: entry.errorCode ?? null,
        duration: entry.duration ?? null,
        details: entry.details ?? null,
      })
      .returning();

    return result;
  } catch (error) {
    logger.error({ error, entry }, "Failed to create audit log");
    return null;
  }
}

/**
 * Create multiple audit log entries (batch insert)
 */
export async function createAuditLogsBatch(entries: AuditLogEntry[]): Promise<number> {
  if (entries.length === 0) return 0;

  try {
    const values = entries.map((entry) => ({
      timestamp: new Date(),
      userId: entry.userId ?? null,
      username: entry.username ?? null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      method: entry.method ?? null,
      path: entry.path ?? null,
      requestId: entry.requestId ?? null,
      success: entry.success ?? true,
      errorCode: entry.errorCode ?? null,
      duration: entry.duration ?? null,
      details: entry.details ?? null,
    }));

    const result = await db.insert(auditLogs).values(values);
    return entries.length;
  } catch (error) {
    logger.error({ error, count: entries.length }, "Failed to create audit logs batch");
    return 0;
  }
}

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs(
  filters: AuditLogFilters = {},
  page: number = 1,
  limit: number = 50
): Promise<PaginatedAuditLogs> {
  const offset = (page - 1) * limit;
  const conditions = [];

  // Build filter conditions
  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }

  if (filters.username) {
    conditions.push(like(auditLogs.username, `%${filters.username}%`));
  }

  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }

  if (filters.actions && filters.actions.length > 0) {
    conditions.push(inArray(auditLogs.action, filters.actions));
  }

  if (filters.resource) {
    conditions.push(eq(auditLogs.resource, filters.resource));
  }

  if (filters.resourceId) {
    conditions.push(eq(auditLogs.resourceId, filters.resourceId));
  }

  if (filters.success !== undefined) {
    conditions.push(eq(auditLogs.success, filters.success));
  }

  if (filters.startDate) {
    conditions.push(gte(auditLogs.timestamp, new Date(filters.startDate)));
  }

  if (filters.endDate) {
    // Add one day to include the entire end date
    const endDate = new Date(filters.endDate);
    endDate.setDate(endDate.getDate() + 1);
    conditions.push(lte(auditLogs.timestamp, endDate));
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    conditions.push(
      sql`(${auditLogs.resource} ILIKE ${searchPattern} OR ${auditLogs.resourceId} ILIKE ${searchPattern} OR ${auditLogs.path} ILIKE ${searchPattern})`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(whereClause);

  const total = countResult?.count ?? 0;

  // Get paginated data with user info
  const data = await db
    .select({
      id: auditLogs.id,
      timestamp: auditLogs.timestamp,
      requestId: auditLogs.requestId,
      userId: auditLogs.userId,
      username: auditLogs.username,
      action: auditLogs.action,
      resource: auditLogs.resource,
      resourceId: auditLogs.resourceId,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      method: auditLogs.method,
      path: auditLogs.path,
      success: auditLogs.success,
      errorCode: auditLogs.errorCode,
      duration: auditLogs.duration,
      details: auditLogs.details,
      user: {
        username: users.username,
        fullName: users.fullName,
      },
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(whereClause)
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit)
    .offset(offset);

  return {
    data: data.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      requestId: row.requestId,
      userId: row.userId,
      username: row.username,
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      method: row.method,
      path: row.path,
      success: row.success,
      errorCode: row.errorCode,
      duration: row.duration,
      details: row.details,
      user: row.user?.username ? row.user : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get audit log by ID
 */
export async function getAuditLogById(id: number): Promise<AuditLog | null> {
  const [result] = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.id, id))
    .limit(1);

  return result || null;
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(
  userId: number,
  page: number = 1,
  limit: number = 50
): Promise<PaginatedAuditLogs> {
  return getAuditLogs({ userId }, page, limit);
}

/**
 * Get recent activity summary (for dashboard)
 */
export async function getAuditSummary(hours: number = 24): Promise<{
  total: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  failedCount: number;
}> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  // Get total and failed count
  const [totals] = await db
    .select({
      total: count(),
      failed: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.success} = false)`,
    })
    .from(auditLogs)
    .where(gte(auditLogs.timestamp, since));

  // Get counts by action
  const byActionResult = await db
    .select({
      action: auditLogs.action,
      count: count(),
    })
    .from(auditLogs)
    .where(gte(auditLogs.timestamp, since))
    .groupBy(auditLogs.action);

  // Get counts by resource
  const byResourceResult = await db
    .select({
      resource: auditLogs.resource,
      count: count(),
    })
    .from(auditLogs)
    .where(gte(auditLogs.timestamp, since))
    .groupBy(auditLogs.resource)
    .orderBy(desc(count()))
    .limit(10);

  const byAction: Record<string, number> = {};
  byActionResult.forEach((r) => {
    byAction[r.action] = r.count;
  });

  const byResource: Record<string, number> = {};
  byResourceResult.forEach((r) => {
    byResource[r.resource] = r.count;
  });

  return {
    total: totals?.total ?? 0,
    byAction,
    byResource,
    failedCount: totals?.failed ?? 0,
  };
}

/**
 * Delete old audit logs (for maintenance/compliance)
 */
export async function deleteOldAuditLogs(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  try {
    const result = await db
      .delete(auditLogs)
      .where(lte(auditLogs.timestamp, cutoffDate));

    logger.info({ daysToKeep, cutoffDate }, "Deleted old audit logs");
    return 0; // Drizzle doesn't return count for delete
  } catch (error) {
    logger.error({ error, daysToKeep }, "Failed to delete old audit logs");
    throw error;
  }
}

/**
 * Get distinct resources for filtering
 */
export async function getDistinctResources(): Promise<string[]> {
  const result = await db
    .selectDistinct({ resource: auditLogs.resource })
    .from(auditLogs)
    .orderBy(auditLogs.resource);

  return result.map((r) => r.resource);
}
