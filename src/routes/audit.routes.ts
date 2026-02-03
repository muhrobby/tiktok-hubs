/**
 * Audit Logs API Routes
 * Endpoints for viewing and managing audit logs
 */

import { Hono } from "hono";
import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { eq, desc, and, gte, lte, or, like, sql } from "drizzle-orm";
import { logger } from "../utils/logger.js";

const app = new Hono();

// Protect all routes - Admin and Ops only
app.use("*", authMiddleware(["Admin", "Ops"]));

/**
 * GET /api/audit-logs
 * Get audit logs with filtering and pagination
 */
app.get("/", async (c) => {
  try {
    const {
      page = "1",
      limit = "50",
      action,
      resource,
      username,
      success,
      startDate,
      endDate,
      search,
    } = c.req.query();

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    const conditions = [];

    if (action) {
      conditions.push(eq(auditLogs.action, action as any));
    }

    if (resource) {
      conditions.push(eq(auditLogs.resource, resource));
    }

    if (username) {
      conditions.push(eq(auditLogs.username, username));
    }

    if (success !== undefined) {
      conditions.push(eq(auditLogs.success, success === "true"));
    }

    if (startDate) {
      conditions.push(gte(auditLogs.timestamp, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.timestamp, new Date(endDate)));
    }

    if (search) {
      conditions.push(
        or(
          like(auditLogs.username, `%${search}%`),
          like(auditLogs.resource, `%${search}%`),
          like(auditLogs.resourceId, `%${search}%`),
          like(auditLogs.path, `%${search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause);

    // Get paginated data
    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limitNum)
      .offset(offset);

    return c.json({
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch audit logs");
    return c.json({ error: "Failed to fetch audit logs" }, 500);
  }
});

/**
 * GET /api/audit-logs/stats
 * Get audit log statistics
 */
app.get("/stats", async (c) => {
  try {
    const { days = "7" } = c.req.query();
    const daysNum = parseInt(days);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Total logs in period
    const [{ totalLogs }] = await db
      .select({ totalLogs: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(gte(auditLogs.timestamp, startDate));

    // Logs by action
    const logsByAction = await db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.timestamp, startDate))
      .groupBy(auditLogs.action)
      .orderBy(desc(sql`count(*)`));

    // Success vs Failed
    const [{ successCount }] = await db
      .select({ successCount: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(gte(auditLogs.timestamp, startDate), eq(auditLogs.success, true)));

    const [{ failedCount }] = await db
      .select({ failedCount: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(gte(auditLogs.timestamp, startDate), eq(auditLogs.success, false)));

    // Top users
    const topUsers = await db
      .select({
        username: auditLogs.username,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.timestamp, startDate))
      .groupBy(auditLogs.username)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Top resources
    const topResources = await db
      .select({
        resource: auditLogs.resource,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.timestamp, startDate))
      .groupBy(auditLogs.resource)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Average response time
    const [{ avgDuration }] = await db
      .select({ avgDuration: sql<number>`avg(duration)::int` })
      .from(auditLogs)
      .where(gte(auditLogs.timestamp, startDate));

    return c.json({
      totalLogs,
      successCount,
      failedCount,
      successRate: totalLogs > 0 ? ((successCount / totalLogs) * 100).toFixed(2) : "0",
      avgDuration: avgDuration || 0,
      logsByAction,
      topUsers: topUsers.filter((u) => u.username),
      topResources,
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch audit log stats");
    return c.json({ error: "Failed to fetch audit log stats" }, 500);
  }
});

/**
 * GET /api/audit-logs/:id
 * Get single audit log by ID
 */
app.get("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));

    const [log] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id))
      .limit(1);

    if (!log) {
      return c.json({ error: "Audit log not found" }, 404);
    }

    return c.json(log);
  } catch (error) {
    logger.error({ error }, "Failed to fetch audit log");
    return c.json({ error: "Failed to fetch audit log" }, 500);
  }
});

/**
 * DELETE /api/audit-logs/cleanup
 * Clean up old audit logs (Admin only)
 */
app.delete("/cleanup", authMiddleware(["Admin"]), async (c) => {
  try {
    const { days = "90" } = c.req.query();
    const daysNum = parseInt(days);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    const result = await db
      .delete(auditLogs)
      .where(lte(auditLogs.timestamp, cutoffDate));

    logger.info(
      { cutoffDate, days: daysNum },
      "Audit logs cleaned up"
    );

    return c.json({
      message: `Audit logs older than ${daysNum} days have been deleted`,
      cutoffDate,
    });
  } catch (error) {
    logger.error({ error }, "Failed to cleanup audit logs");
    return c.json({ error: "Failed to cleanup audit logs" }, 500);
  }
});

export default app;
