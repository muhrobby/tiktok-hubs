/**
 * Custom type declarations for Hono context variables
 *
 * This extends Hono's ContextVariableMap to allow type-safe access
 * to custom variables set via c.set() and c.get()
 */

import "hono";

declare module "hono" {
  interface ContextVariableMap {
    /**
     * Unique request ID for tracing/debugging
     * Set by requestIdMiddleware
     */
    requestId: string;

    /**
     * Flag indicating authentication failed
     * Used by authRateLimiter to track failed attempts
     */
    authFailed: boolean;

    /**
     * Error code for audit logging
     * Set when an error occurs for tracking purposes
     */
    errorCode: string;
  }
}
