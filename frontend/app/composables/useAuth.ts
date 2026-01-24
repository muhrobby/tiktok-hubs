/**
 * Composable untuk authentication
 * Handles login, logout, session management, dan permission checking
 */

import type { Permission, RoleName } from "~/types/auth";

export interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  fullName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: {
    name: RoleName;
    storeCode: string | null;
  }[];
  permissions: Permission[];
  assignedStores: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Store auth state globally (singleton)
const authState = reactive<AuthState>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
});

export const useAuth = () => {
  const router = useRouter();
  const toast = useToast();

  /**
   * Login dengan username dan password
   */
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    authState.isLoading = true;
    authState.error = null;

    try {
      const response = await $fetch<{
        success: boolean;
        data?: {
          user: {
            id: number;
            username: string;
            email: string | null;
            fullName: string | null;
            roles: { name: RoleName; storeCode: string | null }[];
          };
          expiresIn: number;
        };
        error?: {
          code: string;
          message: string;
        };
      }>("/api/user-auth/login", {
        method: "POST",
        body: credentials,
      });

      if (!response.success || !response.data) {
        authState.error = response.error?.message || "Login failed";
        toast.add({
          title: "Login Failed",
          description: authState.error,
          color: "error",
        });
        return false;
      }

      // Fetch full user info after login
      await fetchUser();

      toast.add({
        title: "Welcome back!",
        description: `Logged in as ${response.data.user.username}`,
        color: "success",
      });

      return true;
    } catch (error: unknown) {
      const err = error as { data?: { error?: { message?: string } } };
      authState.error =
        err?.data?.error?.message || "An error occurred during login";
      toast.add({
        title: "Login Failed",
        description: authState.error,
        color: "error",
      });
      return false;
    } finally {
      authState.isLoading = false;
    }
  };

  /**
   * Logout dari session saat ini
   */
  const logout = async (): Promise<void> => {
    try {
      await $fetch("/api/user-auth/logout", {
        method: "POST",
      });
    } catch {
      // Ignore errors, still clear local state
    }

    // Clear local state
    authState.user = null;
    authState.isAuthenticated = false;
    authState.error = null;

    toast.add({
      title: "Logged out",
      description: "You have been logged out successfully",
      color: "info",
    });

    // Redirect to login
    await router.push("/login");
  };

  /**
   * Logout dari semua devices
   */
  const logoutAll = async (): Promise<void> => {
    try {
      await $fetch("/api/user-auth/logout-all", {
        method: "POST",
      });

      toast.add({
        title: "Logged out from all devices",
        description: "All your sessions have been terminated",
        color: "info",
      });
    } catch {
      toast.add({
        title: "Error",
        description: "Failed to logout from all devices",
        color: "error",
      });
    }

    // Clear local state
    authState.user = null;
    authState.isAuthenticated = false;

    // Redirect to login
    await router.push("/login");
  };

  /**
   * Fetch current user info
   */
  const fetchUser = async (): Promise<AuthUser | null> => {
    try {
      const response = await $fetch<{
        success: boolean;
        data?: AuthUser;
        error?: { code: string; message: string };
      }>("/api/user-auth/me");

      if (response.success && response.data) {
        authState.user = response.data;
        authState.isAuthenticated = true;
        authState.error = null;
        return response.data;
      }

      // Not authenticated
      authState.user = null;
      authState.isAuthenticated = false;
      return null;
    } catch {
      authState.user = null;
      authState.isAuthenticated = false;
      return null;
    }
  };

  /**
   * Refresh access token
   */
  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await $fetch<{
        success: boolean;
        data?: { expiresIn: number };
        error?: { code: string; message: string };
      }>("/api/user-auth/refresh", {
        method: "POST",
      });

      return response.success;
    } catch {
      return false;
    }
  };

  /**
   * Change password
   */
  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    try {
      const response = await $fetch<{
        success: boolean;
        message?: string;
        error?: { code: string; message: string };
      }>("/api/user-auth/password", {
        method: "PUT",
        body: { currentPassword, newPassword },
      });

      if (response.success) {
        toast.add({
          title: "Password Changed",
          description: "Your password has been updated successfully",
          color: "success",
        });
        return true;
      }

      toast.add({
        title: "Error",
        description: response.error?.message || "Failed to change password",
        color: "error",
      });
      return false;
    } catch (error: unknown) {
      const err = error as { data?: { error?: { message?: string } } };
      toast.add({
        title: "Error",
        description:
          err?.data?.error?.message || "Failed to change password",
        color: "error",
      });
      return false;
    }
  };

  /**
   * Initialize auth state - call on app mount
   */
  const initAuth = async (): Promise<void> => {
    authState.isLoading = true;
    await fetchUser();
    authState.isLoading = false;
  };

  // ============================================
  // PERMISSION HELPERS
  // ============================================

  /**
   * Check if user has specific permission
   */
  const hasPermission = (permission: Permission): boolean => {
    return authState.user?.permissions.includes(permission) ?? false;
  };

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = (...permissions: Permission[]): boolean => {
    return permissions.some((p) => hasPermission(p));
  };

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = (...permissions: Permission[]): boolean => {
    return permissions.every((p) => hasPermission(p));
  };

  /**
   * Check if user has specific role
   */
  const hasRole = (role: RoleName): boolean => {
    return authState.user?.roles.some((r) => r.name === role) ?? false;
  };

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = (...roles: RoleName[]): boolean => {
    return roles.some((r) => hasRole(r));
  };

  /**
   * Check if user is admin
   */
  const isAdmin = computed(() => hasRole("Admin"));

  /**
   * Check if user is admin or ops
   */
  const isAdminOrOps = computed(() => hasAnyRole("Admin", "Ops"));

  /**
   * Check if user can access specific store
   */
  const canAccessStore = (storeCode: string): boolean => {
    if (!authState.user) return false;

    // Admin and Ops can access all stores
    if (hasAnyRole("Admin", "Ops")) return true;

    // Store role can only access assigned stores
    return authState.user.assignedStores.includes(storeCode);
  };

  /**
   * Get accessible stores for current user
   * Returns null if user can access all stores (Admin/Ops)
   */
  const accessibleStores = computed(() => {
    if (!authState.user) return [];
    if (hasAnyRole("Admin", "Ops")) return null; // All stores
    return authState.user.assignedStores;
  });

  /**
   * Can manage users (Admin only)
   */
  const canManageUsers = computed(() => hasPermission("manage_users"));

  /**
   * Can view users (Admin only)
   */
  const canViewUsers = computed(() => hasPermission("view_users"));

  return {
    // State (reactive)
    user: computed(() => authState.user),
    isAuthenticated: computed(() => authState.isAuthenticated),
    isLoading: computed(() => authState.isLoading),
    error: computed(() => authState.error),

    // Actions
    login,
    logout,
    logoutAll,
    fetchUser,
    refreshToken,
    changePassword,
    initAuth,

    // Permission helpers
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    isAdmin,
    isAdminOrOps,
    canAccessStore,
    accessibleStores,
    canManageUsers,
    canViewUsers,
  };
};
