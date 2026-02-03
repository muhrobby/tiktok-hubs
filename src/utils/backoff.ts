import { logger } from "./logger.js";

export interface BackoffOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: unknown) => boolean;
}

const defaultOptions: BackoffOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: isRetryableError,
};

/**
 * Check if an error is retryable (network/transient errors)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("socket hang up") ||
      message.includes("network") ||
      message.includes("timeout")
    ) {
      return true;
    }

    // HTTP status based errors
    if ("status" in error) {
      const status = (error as { status: number }).status;
      // Retry on 429 (rate limit), 500, 502, 503, 504
      return status === 429 || (status >= 500 && status < 600);
    }

    // TikTok specific retryable errors
    if ("code" in error) {
      const code = (error as { code: number | string }).code;
      // Add TikTok error codes that are retryable
      const retryableCodes = [
        "rate_limit_exceeded",
        "internal_error",
        "service_unavailable",
      ];
      if (typeof code === "string" && retryableCodes.includes(code)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  options: BackoffOptions
): number {
  const exponentialDelay =
    options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);

  // Add jitter (±20% randomness)
  const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1);

  return Math.floor(cappedDelay + jitter);
}

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<BackoffOptions> = {},
  context?: string
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const shouldRetry = opts.retryableErrors?.(error) ?? false;
      const hasMoreRetries = attempt < opts.maxRetries;

      if (shouldRetry && hasMoreRetries) {
        const delay = calculateBackoffDelay(attempt, opts);
        logger.warn(
          {
            attempt: attempt + 1,
            maxRetries: opts.maxRetries,
            delayMs: delay,
            context,
            error: error instanceof Error ? error.message : String(error),
          },
          "Retrying after error"
        );
        await sleep(delay);
      } else {
        break;
      }
    }
  }

  logger.error(
    {
      context,
      maxRetries: opts.maxRetries,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    },
    "All retries exhausted"
  );

  throw lastError;
}

/**
 * Create a rate limiter for API calls
 */
export function createRateLimiter(requestsPerSecond: number) {
  const minInterval = 1000 / requestsPerSecond;
  let lastRequest = 0;

  return async function rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastRequest;

    if (elapsed < minInterval) {
      await sleep(minInterval - elapsed);
    }

    lastRequest = Date.now();
  };
}

/**
 * Batch process with concurrency control
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
  } = {}
): Promise<R[]> {
  const { batchSize = 5, delayBetweenBatches = 1000 } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    // Add delay between batches (except for the last batch)
    if (i + batchSize < items.length) {
      await sleep(delayBetweenBatches);
    }
  }

  return results;
}
