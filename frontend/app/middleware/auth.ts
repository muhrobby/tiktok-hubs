/**
 * Named middleware for protecting routes that require authentication
 * Usage: definePageMeta({ middleware: 'auth' })
 *
 * Options via route meta:
 * - requiredRoles: RoleName[] - Require specific roles
 * - requiredPermissions: Permission[] - Require specific permissions
 * - requireAnyPermission: boolean - If true, any permission suffices (default: all required)
 */

import type { Permission, RoleName } from "~/types/auth";

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server side - auth check will happen client-side
  if (import.meta.server) return;

  const { isAuthenticated, isLoading, user, hasRole, hasPermission, hasAnyPermission, hasAllPermissions, initAuth } =
    useAuth();

  // Wait for auth to be initialized
  if (isLoading.value) {
    await initAuth();
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated.value) {
    return navigateTo({
      path: "/login",
      query: { redirect: to.fullPath },
    });
  }

  // Check required roles if specified
  const requiredRoles = to.meta.requiredRoles as RoleName[] | undefined;
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some((role) => hasRole(role));
    if (!hasRequiredRole) {
      // User doesn't have any of the required roles
      return navigateTo({
        path: "/unauthorized",
        query: { reason: "role", required: requiredRoles.join(",") },
      });
    }
  }

  // Check required permissions if specified
  const requiredPermissions = to.meta.requiredPermissions as Permission[] | undefined;
  if (requiredPermissions && requiredPermissions.length > 0) {
    const requireAny = to.meta.requireAnyPermission as boolean | undefined;

    const hasRequiredPermissions = requireAny
      ? hasAnyPermission(...requiredPermissions)
      : hasAllPermissions(...requiredPermissions);

    if (!hasRequiredPermissions) {
      // User doesn't have required permissions
      return navigateTo({
        path: "/unauthorized",
        query: { reason: "permission" },
      });
    }
  }

  // All checks passed
});
