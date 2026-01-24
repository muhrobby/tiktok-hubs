/**
 * Batch Processing Utility
 * 
 * Provides utilities for processing large arrays in parallel with controlled concurrency
 * Essential for syncing 300+ stores efficiently
 */

import { logger } from "./logger.js";

export interface BatchProcessOptions<T> {
  /**
   * Number of items to process in parallel
   * @default 20
   */
  concurrency?: number;

  /**
   * Delay between batches in milliseconds
   * @default 0
   */
  delayBetweenBatches?: number;

  /**
   * Callback for progress updates
   */
  onProgress?: (processed: number, total: number) => void;

  /**
   * Callback for each successful item
   */
  onSuccess?: (item: T, result: any) => void;

  /**
   * Callback for each failed item
   */
  onError?: (item: T, error: Error) => void;
}

export interface BatchProcessResult<T> {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    item: T;
    success: boolean;
    result?: any;
    error?: Error;
  }>;
  duration: number;
}

/**
 * Process array items in parallel batches with controlled concurrency
 * 
 * @example
 * const stores = await getStores();
 * const result = await batchProcess(
 *   stores,
 *   async (store) => syncStore(store),
 *   { concurrency: 20 }
 * );
 */
export async function batchProcess<T, R = any>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: BatchProcessOptions<T> = {}
): Promise<BatchProcessResult<T>> {
  const {
    concurrency = 20,
    delayBetweenBatches = 0,
    onProgress,
    onSuccess,
    onError,
  } = options;

  const startTime = Date.now();
  const results: BatchProcessResult<T>["results"] = [];
  let successful = 0;
  let failed = 0;

  logger.info(
    { totalItems: items.length, concurrency, delayBetweenBatches },
    "Starting batch processing"
  );

  // Split items into batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchNumber = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(items.length / concurrency);

    logger.debug(
      { batch: batchNumber, totalBatches, batchSize: batch.length },
      "Processing batch"
    );

    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map((item) => processFn(item))
    );

    // Process results
    batchResults.forEach((result, index) => {
      const item = batch[index];

      if (result.status === "fulfilled") {
        successful++;
        results.push({
          item,
          success: true,
          result: result.value,
        });
        onSuccess?.(item, result.value);
      } else {
        failed++;
        const error =
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason));
        results.push({
          item,
          success: false,
          error,
        });
        onError?.(item, error);
      }
    });

    // Report progress
    const processed = i + batch.length;
    onProgress?.(processed, items.length);

    logger.debug(
      {
        batch: batchNumber,
        processed,
        total: items.length,
        successful,
        failed,
      },
      "Batch completed"
    );

    // Delay between batches if specified
    if (delayBetweenBatches > 0 && i + concurrency < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  const duration = Date.now() - startTime;

  logger.info(
    {
      total: items.length,
      successful,
      failed,
      duration,
      avgTimePerItem: Math.round(duration / items.length),
    },
    "Batch processing completed"
  );

  return {
    total: items.length,
    successful,
    failed,
    results,
    duration,
  };
}

/**
 * Process array items with retry logic
 */
export async function batchProcessWithRetry<T, R = any>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: BatchProcessOptions<T> & {
    maxRetries?: number;
    retryDelay?: number;
  } = {}
): Promise<BatchProcessResult<T>> {
  const { maxRetries = 2, retryDelay = 1000, ...batchOptions } = options;

  return batchProcess(
    items,
    async (item) => {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await processFn(item);
        } catch (error) {
          lastError =
            error instanceof Error ? error : new Error(String(error));

          if (attempt < maxRetries) {
            logger.warn(
              { attempt, maxRetries, item },
              "Retrying failed item"
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }
        }
      }

      throw lastError || new Error("All retry attempts failed");
    },
    batchOptions
  );
}

/**
 * Split array into chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(
    private maxConcurrent: number,
    private minDelay: number = 0
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.running++;

    try {
      const result = await fn();

      if (this.minDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.minDelay));
      }

      return result;
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
