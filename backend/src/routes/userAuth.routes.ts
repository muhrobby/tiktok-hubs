/**
 * User Authentication Routes
 *
 * Handles user login, logout, refresh token, and session management
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { logger } from "../utils/logger.js";
import {
  authenticateUser,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  getUserWithRoles,
  buildJWTPayload,
} from "../services/auth.service.js";
import {
  authMiddleware,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  getRefreshToken,
  getCurrentUser,
} from "../middleware/auth.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";

const userAuth = new Hono();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(50),
  password: z.string().min(1, "Password is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters"),
});

const updateProfileSchema = z.object({
  email: z.string().email("Invalid email format").optional().nullable(),
  fullName: z.string().max(100, "Full name must not exceed 100 characters").optional().nullable(),
});

// ============================================
// HELPER: Format Zod errors
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatZodError(error: any): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (error?.issues && Array.isArray(error.issues)) {
    for (const issue of error.issues) {
      const path = (issue.path || []).map(String).join(".") || "_root";
      if (!result[path]) {
        result[path] = [];
      }
      result[path].push(issue.message || "Invalid value");
    }
  }
  return result;
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /user-auth/login
 * Authenticate user and set auth cookies
 */
userAuth.post(
  "/login",
  authRateLimiter({
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 5 * 60 * 1000, // 5 minute block (reduced from 30 minutes)
  }),
  zValidator("json", loginSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid login credentials format",
            details: formatZodError(result.error),
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const { username, password } = c.req.valid("json");

    try {
      const result = await authenticateUser(username, password);

      if (!result) {
        // Set flag for rate limiter
        c.set("authFailed", true);
        
        // Generic error message for security (don't reveal whether user exists)
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_CREDENTIALS",
              message: "Invalid username or password",
            },
          },
          401
        );
      }

      const { user, tokens } = result;

      // Set auth cookies
      setAccessTokenCookie(c, tokens.accessToken);
      setRefreshTokenCookie(c, tokens.refreshToken);

      // Return user info (without sensitive data)
      return c.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            roles: user.roles.map((r) => ({
              name: r.role.name,
              storeCode: r.storeCode,
            })),
          },
          expiresIn: tokens.expiresIn,
        },
      });
    } catch (error) {
      // Check for USER_INACTIVE error
      if (error instanceof Error && error.message === "USER_INACTIVE") {
        c.set("authFailed", true);
        return c.json(
          {
            success: false,
            error: {
              code: "USER_INACTIVE",
              message: "Your account has been deactivated. Please contact an administrator for assistance.",
            },
          },
          403
        );
      }
      
      logger.error({ error, message: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined }, "Login error");
      return c.json(
        {
          success: false,
          error: {
            code: "LOGIN_FAILED",
            message: "An error occurred during login",
          },
        },
        500
      );
    }
  }
);

/**
 * POST /user-auth/logout
 * Logout user and clear auth cookies
 */
userAuth.post("/logout", authMiddleware(), async (c) => {
  const user = getCurrentUser(c);
  const refreshToken = getRefreshToken(c);

  try {
    // Revoke refresh token if present
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    // Clear cookies
    clearAuthCookies(c);

    logger.info({ userId: user?.userId }, "User logged out");

    return c.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    logger.error({ error }, "Logout error");
    // Still clear cookies even if revoke fails
    clearAuthCookies(c);
    return c.json({
      success: true,
      message: "Logged out successfully",
    });
  }
});

/**
 * POST /user-auth/logout-all
 * Logout from all devices (revoke all refresh tokens)
 */
userAuth.post("/logout-all", authMiddleware(), async (c) => {
  const user = getCurrentUser(c);

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

  try {
    // Revoke all refresh tokens for user
    await revokeAllUserTokens(user.userId);

    // Clear cookies
    clearAuthCookies(c);

    logger.info({ userId: user.userId }, "User logged out from all devices");

    return c.json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  } catch (error) {
    logger.error({ error }, "Logout all error");
    return c.json(
      {
        success: false,
        error: {
          code: "LOGOUT_FAILED",
          message: "An error occurred during logout",
        },
      },
      500
    );
  }
});

/**
 * POST /user-auth/refresh
 * Refresh access token using refresh token
 */
userAuth.post("/refresh", async (c) => {
  const refreshToken = getRefreshToken(c);

  if (!refreshToken) {
    return c.json(
      {
        success: false,
        error: {
          code: "REFRESH_TOKEN_REQUIRED",
          message: "Refresh token is required",
        },
      },
      401
    );
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);

    if (!tokens) {
      clearAuthCookies(c);
      return c.json(
        {
          success: false,
          error: {
            code: "REFRESH_FAILED",
            message: "Invalid or expired refresh token",
          },
        },
        401
      );
    }

    // Set new access token cookie
    setAccessTokenCookie(c, tokens.accessToken);

    return c.json({
      success: true,
      data: {
        expiresIn: tokens.expiresIn,
      },
    });
  } catch (error) {
    logger.error({ error }, "Token refresh error");
    return c.json(
      {
        success: false,
        error: {
          code: "REFRESH_FAILED",
          message: "An error occurred during token refresh",
        },
      },
      500
    );
  }
});

/**
 * GET /user-auth/me
 * Get current user info
 */
userAuth.get("/me", authMiddleware(), async (c) => {
  const user = getCurrentUser(c);

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

  try {
    // Get fresh user data with roles
    const userWithRoles = await getUserWithRoles(user.userId);

    if (!userWithRoles) {
      clearAuthCookies(c);
      return c.json(
        {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "User no longer exists",
          },
        },
        401
      );
    }

    // Build payload to get current permissions
    const payload = buildJWTPayload(userWithRoles);

    return c.json({
      success: true,
      data: {
        id: userWithRoles.id,
        username: userWithRoles.username,
        email: userWithRoles.email,
        fullName: userWithRoles.fullName,
        isActive: userWithRoles.isActive,
        lastLoginAt: userWithRoles.lastLoginAt,
        roles: userWithRoles.roles.map((r) => ({
          name: r.role.name,
          storeCode: r.storeCode,
        })),
        permissions: payload.permissions,
        assignedStores: payload.assignedStores,
      },
    });
  } catch (error) {
    logger.error({ error }, "Get user error");
    return c.json(
      {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: "An error occurred while fetching user data",
        },
      },
      500
    );
  }
});

/**
 * PUT /user-auth/password
 * Change current user's password
 */
userAuth.put(
  "/password",
  authMiddleware(),
  zValidator(
    "json",
    changePasswordSchema,
    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid password format",
              details: formatZodError(result.error),
            },
          },
          400
        );
      }
    }
  ),
  async (c) => {
    const user = getCurrentUser(c);
    const { currentPassword, newPassword } = c.req.valid("json");

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

    try {
      // Import here to avoid circular dependency
      const { verifyPassword, hashPassword } = await import(
        "../services/auth.service.js"
      );
      const { getUserById, updateUser } = await import(
        "../services/user.service.js"
      );

      // Get current user
      const dbUser = await getUserById(user.userId);
      if (!dbUser) {
        return c.json(
          {
            success: false,
            error: {
              code: "USER_NOT_FOUND",
              message: "User not found",
            },
          },
          404
        );
      }

      // Verify current password
      const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
      if (!isValid) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_PASSWORD",
              message: "Current password is incorrect",
            },
          },
          400
        );
      }

      // Update password
      await updateUser(user.userId, { password: newPassword });

      // Revoke all refresh tokens (logout other devices)
      await revokeAllUserTokens(user.userId);

      logger.info({ userId: user.userId }, "User password changed");

      return c.json({
        success: true,
        message: "Password changed successfully. Please login again on other devices.",
      });
    } catch (error) {
      logger.error({ error }, "Password change error");
      return c.json(
        {
          success: false,
          error: {
            code: "PASSWORD_CHANGE_FAILED",
            message: "An error occurred while changing password",
          },
        },
        500
      );
    }
  }
);

/**
 * PUT /user-auth/profile
 * Update current user's profile (email, fullName)
 */
userAuth.put(
  "/profile",
  authMiddleware(),
  zValidator(
    "json",
    updateProfileSchema,
    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid profile data",
              details: formatZodError(result.error),
            },
          },
          400
        );
      }
    }
  ),
  async (c) => {
    const user = getCurrentUser(c);
    const { email, fullName } = c.req.valid("json");

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

    try {
      const { updateUser, getUserById } = await import(
        "../services/user.service.js"
      );

      // Build update data - convert null to undefined for service compatibility
      const updateData: { email?: string; fullName?: string } = {};
      if (email !== undefined && email !== null) updateData.email = email;
      if (fullName !== undefined && fullName !== null) updateData.fullName = fullName;

      // Update user
      const updatedUser = await updateUser(user.userId, updateData);

      if (!updatedUser) {
        return c.json(
          {
            success: false,
            error: {
              code: "USER_NOT_FOUND",
              message: "User not found",
            },
          },
          404
        );
      }

      logger.info({ userId: user.userId }, "User profile updated");

      return c.json({
        success: true,
        data: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
        },
        message: "Profile updated successfully",
      });
    } catch (error) {
      logger.error({ error }, "Profile update error");
      return c.json(
        {
          success: false,
          error: {
            code: "PROFILE_UPDATE_FAILED",
            message: "An error occurred while updating profile",
          },
        },
        500
      );
    }
  }
);

export default userAuth;
