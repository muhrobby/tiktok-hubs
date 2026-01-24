/**
 * Cron Scheduler
 *
 * Schedules background jobs using node-cron
 */

import cron from "node-cron";
import { logger, jobLogger } from "../utils/logger.js";
import { refreshTokensJob } from "./refreshTokens.job.js";
import { syncUserDailyJob } from "./syncUserDaily.job.js";
import { syncVideoDailyJob } from "./syncVideoDaily.job.js";

const log = jobLogger("scheduler");

// Default schedules (cron format)
// Can be overridden via environment variables
const DEFAULT_SCHEDULES = {
  refreshTokens: "30 1 * * *", // 01:30 daily
  syncUserDaily: "0 2 * * *", // 02:00 daily
  syncVideoDaily: "30 2 * * *", // 02:30 daily
};

let scheduledTasks: cron.ScheduledTask[] = [];

/**
 * Get schedule from env or use default
 */
function getSchedule(key: keyof typeof DEFAULT_SCHEDULES): string {
  const envKey = `CRON_${key.toUpperCase().replace(/([A-Z])/g, "_$1")}`;
  return process.env[envKey] || DEFAULT_SCHEDULES[key];
}

/**
 * Wrap job execution with error handling
 */
async function safeExecute(
  jobName: string,
  jobFn: () => Promise<unknown>
): Promise<void> {
  const jobLog = jobLogger(jobName);
  jobLog.info("Job started");

  try {
    await jobFn();
    jobLog.info("Job completed successfully");
  } catch (error) {
    jobLog.error({ error }, "Job failed with error");
  }
}

/**
 * Initialize and start all scheduled jobs
 */
export function initScheduler(): void {
  const cronEnabled = process.env.CRON_ENABLED !== "false";

  if (!cronEnabled) {
    log.info("Cron jobs are disabled via CRON_ENABLED=false");
    return;
  }

  log.info("Initializing cron scheduler");

  // Schedule refresh tokens job
  const refreshTokensSchedule = getSchedule("refreshTokens");
  log.info(
    { schedule: refreshTokensSchedule },
    "Scheduling refresh_tokens job"
  );

  const refreshTokensTask = cron.schedule(
    refreshTokensSchedule,
    () => {
      safeExecute("refresh_tokens", refreshTokensJob);
    },
    { timezone: process.env.TZ || "UTC" }
  );
  scheduledTasks.push(refreshTokensTask);

  // Schedule user daily sync job
  const syncUserDailySchedule = getSchedule("syncUserDaily");
  log.info(
    { schedule: syncUserDailySchedule },
    "Scheduling sync_user_daily job"
  );

  const syncUserDailyTask = cron.schedule(
    syncUserDailySchedule,
    () => {
      safeExecute("sync_user_daily", syncUserDailyJob);
    },
    { timezone: process.env.TZ || "UTC" }
  );
  scheduledTasks.push(syncUserDailyTask);

  // Schedule video daily sync job
  const syncVideoDailySchedule = getSchedule("syncVideoDaily");
  log.info(
    { schedule: syncVideoDailySchedule },
    "Scheduling sync_video_daily job"
  );

  const syncVideoDailyTask = cron.schedule(
    syncVideoDailySchedule,
    () => {
      safeExecute("sync_video_daily", syncVideoDailyJob);
    },
    { timezone: process.env.TZ || "UTC" }
  );
  scheduledTasks.push(syncVideoDailyTask);

  log.info("Cron scheduler initialized with all jobs");
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler(): void {
  log.info("Stopping cron scheduler");

  for (const task of scheduledTasks) {
    task.stop();
  }

  scheduledTasks = [];
  log.info("All scheduled jobs stopped");
}

/**
 * Get status of scheduled jobs
 */
export function getSchedulerStatus(): {
  enabled: boolean;
  jobs: Array<{
    name: string;
    schedule: string;
    nextRun?: string;
  }>;
} {
  const cronEnabled = process.env.CRON_ENABLED !== "false";

  return {
    enabled: cronEnabled,
    jobs: [
      {
        name: "refresh_tokens",
        schedule: getSchedule("refreshTokens"),
      },
      {
        name: "sync_user_daily",
        schedule: getSchedule("syncUserDaily"),
      },
      {
        name: "sync_video_daily",
        schedule: getSchedule("syncVideoDaily"),
      },
    ],
  };
}
