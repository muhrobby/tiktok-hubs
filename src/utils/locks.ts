import { db, executeRawQuery } from "../db/client.js";
import { syncLocks } from "../db/schema.js";
import { eq, lt } from "drizzle-orm";
import { logger } from "./logger.js";

const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface LockOptions {
  ttlMs?: number;
  waitForLock?: boolean;
  waitTimeoutMs?: number;
}

/**
 * Acquire a distributed lock for a store sync operation
 * Uses PostgreSQL advisory locks + table-based locks for redundancy
 */
export async function acquireLock(
  lockKey: string,
  options: LockOptions = {}
): Promise<boolean> {
  const { ttlMs = DEFAULT_LOCK_TTL_MS } = options;
  const lockedBy = `${process.pid}-${Date.now()}`;
  const expiresAt = new Date(Date.now() + ttlMs);

  try {
    // First, clean up expired locks
    await db.delete(syncLocks).where(lt(syncLocks.expiresAt, new Date()));

    // Try to insert a new lock (will fail if exists due to unique constraint)
    await db
      .insert(syncLocks)
      .values({
        lockKey,
        lockedBy,
        lockedAt: new Date(),
        expiresAt,
      })
      .onConflictDoNothing();

    // Check if we got the lock
    const [lock] = await db
      .select()
      .from(syncLocks)
      .where(eq(syncLocks.lockKey, lockKey));

    if (lock?.lockedBy === lockedBy) {
      logger.debug({ lockKey, expiresAt }, "Lock acquired");
      return true;
    }

    // Lock exists, check if expired
    if (lock && lock.expiresAt < new Date()) {
      // Try to take over expired lock
      const result = await db
        .update(syncLocks)
        .set({
          lockedBy,
          lockedAt: new Date(),
          expiresAt,
        })
        .where(eq(syncLocks.lockKey, lockKey));

      if (result) {
        logger.debug({ lockKey }, "Took over expired lock");
        return true;
      }
    }

    logger.debug({ lockKey }, "Lock not acquired - already held");
    return false;
  } catch (error) {
    logger.error({ error, lockKey }, "Error acquiring lock");
    return false;
  }
}

/**
 * Release a distributed lock
 */
export async function releaseLock(lockKey: string): Promise<void> {
  try {
    await db.delete(syncLocks).where(eq(syncLocks.lockKey, lockKey));

    logger.debug({ lockKey }, "Lock released");
  } catch (error) {
    logger.error({ error, lockKey }, "Error releasing lock");
  }
}

/**
 * Execute a function with a lock
 * Automatically releases lock when done
 */
export async function withLock<T>(
  lockKey: string,
  operation: () => Promise<T>,
  options: LockOptions = {}
): Promise<{ success: boolean; result?: T; error?: Error; skipped?: boolean }> {
  const locked = await acquireLock(lockKey, options);

  if (!locked) {
    return { success: false, skipped: true };
  }

  try {
    const result = await operation();
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  } finally {
    await releaseLock(lockKey);
  }
}

/**
 * Acquire PostgreSQL advisory lock (session-level)
 * More reliable for preventing concurrent access
 */
export async function acquireAdvisoryLock(lockId: number): Promise<boolean> {
  try {
    const result = await executeRawQuery<{ pg_try_advisory_lock: boolean }>(
      "SELECT pg_try_advisory_lock($1)",
      [lockId]
    );
    return result[0]?.pg_try_advisory_lock ?? false;
  } catch (error) {
    logger.error({ error, lockId }, "Error acquiring advisory lock");
    return false;
  }
}

/**
 * Release PostgreSQL advisory lock
 */
export async function releaseAdvisoryLock(lockId: number): Promise<void> {
  try {
    await executeRawQuery("SELECT pg_advisory_unlock($1)", [lockId]);
  } catch (error) {
    logger.error({ error, lockId }, "Error releasing advisory lock");
  }
}

/**
 * Generate a consistent lock ID from a store code
 * Uses a hash to convert string to number for advisory locks
 */
export function storeCodeToLockId(storeCode: string): number {
  let hash = 0;
  for (let i = 0; i < storeCode.length; i++) {
    const char = storeCode.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Execute a function with advisory lock for a specific store
 */
export async function withStoreLock<T>(
  storeCode: string,
  operation: () => Promise<T>
): Promise<{ success: boolean; result?: T; error?: Error; skipped?: boolean }> {
  const lockKey = `store:${storeCode}`;
  const tableLocked = await acquireLock(lockKey);

  if (!tableLocked) {
    logger.warn({ storeCode }, "Could not acquire table lock - sync running");
    return { success: false, skipped: true };
  }

  const lockId = storeCodeToLockId(storeCode);
  const advisoryLocked = await acquireAdvisoryLock(lockId);

  if (!advisoryLocked) {
    logger.warn(
      { storeCode, lockId },
      "Could not acquire advisory lock - sync already running"
    );
    await releaseLock(lockKey);
    return { success: false, skipped: true };
  }

  try {
    const result = await operation();
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  } finally {
    await releaseAdvisoryLock(lockId);
    await releaseLock(lockKey);
  }
}
