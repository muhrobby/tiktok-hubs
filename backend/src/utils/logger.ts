import pino from "pino";

const logLevel = process.env.LOG_LEVEL || "info";

/**
 * Pino logger instance with structured logging
 */
export const logger = pino({
  level: logLevel,
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  formatters: {
    level: (label: string) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
      service: "tiktok-hubs",
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "accessToken",
      "refreshToken",
      "access_token",
      "refresh_token",
      "password",
      "token",
      "authorization",
      "Authorization",
      "*.accessToken",
      "*.refreshToken",
      "*.access_token",
      "*.refresh_token",
    ],
    censor: "[REDACTED]",
  },
});

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log with store context
 */
export function storeLogger(storeCode: string) {
  return logger.child({ storeCode });
}

/**
 * Log with job context
 */
export function jobLogger(jobName: string) {
  return logger.child({ job: jobName });
}
