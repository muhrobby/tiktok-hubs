/**
 * Authentication & Authorization Middleware
 *
 * JWT validation, RBAC permission checking, and store access control
 */

import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  verifyAccessToken,
  hasPermission,
  canAccessStore,
  getAccessibleStores,
  type JWTPayload,
} from "../services/auth.service.js";
import { type Permission, type RoleName, PERMISSIONS } from "../db/schema.js";
import { logger } from "../utils/logger.js";

// ============================================
// TYPES
// ============================================

// Extend Hono's context with auth data
declare module "hono" {
  interface ContextVariableMap {
    user: JWTPayload | null;
    accessibleStores: string[] | null; // null means all stores
    authMethod?: "api_key" | "jwt";
  }
}

export interface AuthError {
  code: string;
  message: string;
  statusCode: number;
}

// Cookie configuration
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 15 * 60, // 15 minutes for access token
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60, // 7 days for refresh token
  path: "/auth", // Only sent to auth endpoints
};

// ============================================
// COOKIE HELPERS
// ============================================

/**
 * Set access token cookie
 */
export function setAccessTokenCookie(c: Context, token: string): void {
  setCookie(c, "access_token", token, COOKIE_OPTIONS);
}

/**
 * Set refresh token cookie
 */
export function setRefreshTokenCookie(c: Context, token: string): void {
  setCookie(c, "refresh_token", token, REFRESH_COOKIE_OPTIONS);
}

/**
 * Clear auth cookies (logout)
 */
export function clearAuthCookies(c: Context): void {
  deleteCookie(c, "access_token", { path: "/" });
  deleteCookie(c, "refresh_token", { path: "/auth" });
}

/**
 * Get access token from cookie or Authorization header
 */
function getAccessToken(c: Context): string | null {
  // Try cookie first
  const cookieToken = getCookie(c, "access_token");
  if (cookieToken) {
    return cookieToken;
  }

  // Try Authorization header (for API clients)
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Get refresh token from cookie
 */
export function getRefreshToken(c: Context): string | null {
  return getCookie(c, "refresh_token") || null;
}

// ============================================
// AUTH MIDDLEWARE
// ============================================

/**
 * JWT Authentication middleware
 * Validates access token and sets user in context
 */
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const token = getAccessToken(c);
    
    const cookies = c.req.header("Cookie");
    const hasCookie = !!getCookie(c, "access_token");

    if (!token) {
      logger.warn({ 
        path: c.req.path, 
        method: c.req.method,
        hasCookie,
        cookieHeader: cookies ? cookies.substring(0, 100) + '...' : 'none'
      }, "No access token found");
      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401
      );
    }

    const payload = verifyAccessToken(token);

    if (!payload) {
      logger.debug({ path: c.req.path }, "Invalid or expired access token");
      return c.json(
        {
          success: false,
          error: {
            code: "TOKEN_INVALID",
            message: "Invalid or expired token",
          },
        },
        401
      );
    }

    // Set user and accessible stores in context
    c.set("user", payload);
    c.set("accessibleStores", getAccessibleStores(payload));

    await next();
  };
}

/**
 * Optional auth middleware - doesn't fail if no token
 * Sets user in context if token is valid, otherwise continues without user
 */
export function optionalAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const token = getAccessToken(c);

    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        c.set("user", payload);
        c.set("accessibleStores", getAccessibleStores(payload));
      }
    }

    await next();
  };
}

// ============================================
// RBAC MIDDLEWARE
// ============================================

/**
 * Require specific permission(s) middleware
 * User must have at least one of the specified permissions
 */
export function requirePermission(...permissions: Permission[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user");

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401
      );
    }

    // Check if user has any of the required permissions
    const hasRequiredPermission = permissions.some((permission) =>
      hasPermission(user, permission)
    );

    if (!hasRequiredPermission) {
      logger.info(
        {
          userId: user.userId,
          requiredPermissions: permissions,
          userPermissions: user.permissions,
        },
        "Permission denied"
      );
      return c.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to perform this action",
          },
        },
        403
      );
    }

    await next();
  };
}

/**
 * Require all specified permissions middleware
 * User must have ALL of the specified permissions
 */
export function requireAllPermissions(...permissions: Permission[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user");

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401
      );
    }

    // Check if user has all required permissions
    const hasAllPermissions = permissions.every((permission) =>
      hasPermission(user, permission)
    );

    if (!hasAllPermissions) {
      logger.info(
        {
          userId: user.userId,
          requiredPermissions: permissions,
          userPermissions: user.permissions,
        },
        "Permission denied - missing some required permissions"
      );
      return c.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You do not have all required permissions",
          },
        },
        403
      );
    }

    await next();
  };
}

/**
 * Require specific role(s) middleware
 * User must have at least one of the specified roles
 */
export function requireRole(...roles: RoleName[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user");

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401
      );
    }

    // Check if user has any of the required roles
    const hasRequiredRole = roles.some((role) => user.roles.includes(role));

    if (!hasRequiredRole) {
      logger.info(
        {
          userId: user.userId,
          requiredRoles: roles,
          userRoles: user.roles,
        },
        "Role check failed"
      );
      return c.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You do not have the required role for this action",
          },
        },
        403
      );
    }

    await next();
  };
}

/**
 * Admin only middleware - shorthand for requireRole("Admin")
 */
export function adminOnly() {
  return requireRole("Admin");
}

/**
 * Admin or Ops middleware - shorthand for requireRole("Admin", "Ops")
 */
export function adminOrOps() {
  return requireRole("Admin", "Ops");
}

// ============================================
// STORE ACCESS MIDDLEWARE
// ============================================

/**
 * Validate store access middleware
 * Checks if user can access the store specified in the route params
 * @param paramName - The route parameter name containing the store code (default: "storeCode")
 */
export function validateStoreAccess(paramName: string = "storeCode") {
  return async (c: Context, next: Next) => {
    const user = c.get("user");

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401
      );
    }

    const storeCode = c.req.param(paramName);

    if (!storeCode) {
      return c.json(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Store code is required",
          },
        },
        400
      );
    }

    if (!canAccessStore(user, storeCode)) {
      logger.info(
        {
          userId: user.userId,
          storeCode,
          assignedStores: user.assignedStores,
        },
        "Store access denied"
      );
      return c.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You do not have access to this store",
          },
        },
        403
      );
    }

    await next();
  };
}

/**
 * Filter stores by access middleware
 * For list endpoints - adds store filtering based on user's accessible stores
 * Sets accessibleStores in context for use in query
 */
export function filterStoresByAccess() {
  return async (c: Context, next: Next) => {
    const user = c.get("user");

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401
      );
    }

    // accessibleStores is already set by authMiddleware
    // null means all stores (Admin/Ops)
    // array means specific stores (Store role)
    await next();
  };
}

// ============================================
// HELPER FUNCTIONS FOR ROUTES
// ============================================

/**
 * Get current user from context
 */
export function getCurrentUser(c: Context): JWTPayload | null {
  return c.get("user") || null;
}

/**
 * Check if current user is admin
 */
export function isAdmin(c: Context): boolean {
  const user = getCurrentUser(c);
  return user?.roles.includes("Admin") ?? false;
}

/**
 * Check if current user can manage users
 */
export function canManageUsers(c: Context): boolean {
  const user = getCurrentUser(c);
  return user?.permissions.includes(PERMISSIONS.VIEW_USERS) ?? false;
}

/**
 * Get accessible stores for current user
 * Returns null if user can access all stores (Admin/Ops)
 * Returns array of store codes for Store role users
 */
export function getUserAccessibleStores(c: Context): string[] | null {
  return c.get("accessibleStores") ?? null;
}
