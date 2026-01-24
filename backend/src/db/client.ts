import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

// Singleton pool instance
let pool: pg.Pool | null = null;

/**
 * Get PostgreSQL connection pool
 */
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    // Optimized for high concurrency (300+ stores)
    // Increased pool size to handle parallel sync operations
    const poolSize = parseInt(process.env.DB_POOL_SIZE || "100", 10);
    const poolMin = parseInt(process.env.DB_POOL_MIN || "20", 10);

    pool = new Pool({
      connectionString,
      max: poolSize, // Increased from 20 to 100 for parallel processing
      min: poolMin, // Maintain minimum idle connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: false,
    });

    pool.on("error", (err: Error) => {
      logger.error({ err }, "Unexpected error on idle client");
    });

    pool.on("connect", () => {
      logger.debug("New client connected to PostgreSQL");
    });

    // Log pool statistics periodically in production
    if (process.env.NODE_ENV === "production") {
      const poolRef = pool; // Capture pool reference for closure
      setInterval(() => {
        logger.info(
          {
            totalCount: poolRef.totalCount,
            idleCount: poolRef.idleCount,
            waitingCount: poolRef.waitingCount,
          },
          "Database pool statistics"
        );
      }, 60000); // Every minute
    }
  }

  return pool;
}

/**
 * Get Drizzle ORM instance
 */
export function getDb() {
  return drizzle({
    client: getPool(),
    schema,
    logger: process.env.DB_LOGGING === "true",
  });
}

// Type for the database instance
export type Database = ReturnType<typeof getDb>;

// Singleton database instance - lazy initialization
let dbInstance: Database | null = null;

/**
 * Get singleton database instance (lazy-loaded)
 */
export const db = new Proxy({} as Database, {
  get(target, prop) {
    if (!dbInstance) {
      dbInstance = getDb();
    }
    return (dbInstance as any)[prop];
  },
});

/**
 * Close database connection pool
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
    logger.info("Database connection pool closed");
  }
}

/**
 * Health check for database connection
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch (error) {
    logger.error({ error }, "Database health check failed");
    return false;
  }
}

/**
 * Execute raw SQL query (for advisory locks, etc.)
 */
export async function executeRawQuery<T = unknown>(
  query: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(query, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}
