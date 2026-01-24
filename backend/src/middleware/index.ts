/**
 * Middleware Index
 *
 * Re-exports all middleware for easy importing
 */

// Authentication & Authorization
export {
  authMiddleware,
  optionalAuthMiddleware,
  requirePermission,
  requireAllPermissions,
  requireRole,
  adminOnly,
  adminOrOps,
  validateStoreAccess,
  filterStoresByAccess,
  getCurrentUser,
  isAdmin,
  canManageUsers,
  getUserAccessibleStores,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  getRefreshToken,
} from "./auth.js";

// Rate Limiting
export {
  rateLimiter,
  authRateLimiter,
  adminRateLimiter,
  oauthRateLimiter,
  strictRateLimiter,
  getClientIp,
  clearRateLimitStores,
  getRateLimitEntry,
  getAuthRateLimitEntry,
} from "./rateLimiter.js";

// Request ID Tracking
export {
  requestIdMiddleware,
  generateRequestId,
  getRequestId,
  requestLogger,
} from "./requestId.js";

// Security Headers
export {
  enhancedSecurityHeaders,
  customSecurityHeaders,
  httpsRedirect,
  validateCorsConfig,
  getCorsOrigins,
  isPrivateIp,
  validateExternalUrl,
} from "./security.js";

// Audit Logging
export {
  auditLogMiddleware,
  auditLog,
  addAuditLog,
  SecurityLogger,
  getAuditBuffer,
  clearAuditBuffer,
  type AuditLogMiddlewareEntry as AuditLogEntry,
} from "./auditLog.js";
