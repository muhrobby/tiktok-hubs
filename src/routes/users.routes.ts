/**
 * User Management Routes
 *
 * Admin-only routes for managing users and roles
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { logger } from "../utils/logger.js";
import {
  createUser,
  updateUser,
  deleteUser,
  getUserById,
  listUsers,
  assignRole,
  removeRole,
  getUserRoles,
  getRoles,
} from "../services/user.service.js";
import {
  authMiddleware,
  requirePermission,
  adminOnly,
  getCurrentUser,
} from "../middleware/auth.js";
import { PERMISSIONS, type RoleName } from "../db/schema.js";

const users = new Hono();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must not exceed 50 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens"
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters"),
  email: z.string().email("Invalid email format").optional().nullable(),
  fullName: z.string().max(100).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  email: z.string().email("Invalid email format").optional().nullable(),
  fullName: z.string().max(100).optional().nullable(),
  isActive: z.boolean().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .optional(),
});

const assignRoleSchema = z.object({
  roleName: z.enum(["Admin", "Ops", "Store"]),
  storeCode: z.string().optional(),
});

const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  roleName: z.enum(["Admin", "Ops", "Store"]).optional(),
  page: z
    .string()
    .default("1")
    .transform(Number)
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .default("20")
    .transform(Number)
    .pipe(z.number().int().positive().max(100)),
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
// MIDDLEWARE - Apply to all routes
// ============================================

// All routes require authentication and user management permission
users.use("*", authMiddleware());
users.use("*", requirePermission(PERMISSIONS.VIEW_USERS));

// ============================================
// ROUTES
// ============================================

/**
 * GET /admin/users
 * List all users with filters and pagination
 */
users.get(
  "/",
  zValidator("query", listUsersQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: formatZodError(result.error),
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const query = c.req.valid("query");

    try {
      const result = await listUsers({
        search: query.search,
        isActive: query.isActive,
        roleName: query.roleName as RoleName | undefined,
        page: query.page,
        limit: query.limit,
      });

      return c.json({
        success: true,
        data: result.users,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        },
      });
    } catch (error) {
      logger.error({ error }, "List users error");
      return c.json(
        {
          success: false,
          error: {
            code: "LIST_FAILED",
            message: "An error occurred while listing users",
          },
        },
        500
      );
    }
  }
);

/**
 * GET /admin/users/roles
 * List all available roles
 */
users.get("/roles", async (c) => {
  try {
    const rolesList = await getRoles();

    return c.json({
      success: true,
      data: rolesList.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      })),
    });
  } catch (error) {
    logger.error({ error }, "List roles error");
    return c.json(
      {
        success: false,
        error: {
          code: "LIST_FAILED",
          message: "An error occurred while listing roles",
        },
      },
      500
    );
  }
});

/**
 * GET /admin/users/:id
 * Get a specific user by ID
 */
users.get("/:id", async (c) => {
  const userId = parseInt(c.req.param("id"), 10);

  if (isNaN(userId)) {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_ID",
          message: "Invalid user ID",
        },
      },
      400
    );
  }

  try {
    const user = await getUserById(userId);

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "User not found",
          },
        },
        404
      );
    }

    const userRolesData = await getUserRoles(userId);

    return c.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roles: userRolesData,
      },
    });
  } catch (error) {
    logger.error({ error, userId }, "Get user error");
    return c.json(
      {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: "An error occurred while fetching user",
        },
      },
      500
    );
  }
});

/**
 * POST /admin/users
 * Create a new user (Admin only)
 */
users.post(
  "/",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  zValidator("json", createUserSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid user data",
            details: formatZodError(result.error),
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const data = c.req.valid("json");
    const currentUser = getCurrentUser(c);

    try {
      const newUser = await createUser({
        username: data.username,
        password: data.password,
        email: data.email || undefined,
        fullName: data.fullName || undefined,
        isActive: data.isActive,
      });

      logger.info(
        { userId: newUser.id, createdBy: currentUser?.userId },
        "User created by admin"
      );

      return c.json(
        {
          success: true,
          data: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            fullName: newUser.fullName,
            isActive: newUser.isActive,
            createdAt: newUser.createdAt,
          },
        },
        201
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";

      if (
        message.includes("already exists")
      ) {
        return c.json(
          {
            success: false,
            error: {
              code: "DUPLICATE_ERROR",
              message,
            },
          },
          409
        );
      }

      logger.error({ error }, "Create user error");
      return c.json(
        {
          success: false,
          error: {
            code: "CREATE_FAILED",
            message: "An error occurred while creating user",
          },
        },
        500
      );
    }
  }
);

/**
 * PUT /admin/users/:id
 * Update a user (Admin only)
 */
users.put(
  "/:id",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  zValidator("json", updateUserSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid user data",
            details: formatZodError(result.error),
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const userId = parseInt(c.req.param("id"), 10);
    const data = c.req.valid("json");
    const currentUser = getCurrentUser(c);

    if (isNaN(userId)) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_ID",
            message: "Invalid user ID",
          },
        },
        400
      );
    }

    try {
      const updatedUser = await updateUser(userId, {
        email: data.email === null ? "" : data.email,
        fullName: data.fullName === null ? "" : data.fullName,
        isActive: data.isActive,
        password: data.password,
      });

      logger.info(
        { userId, updatedBy: currentUser?.userId },
        "User updated by admin"
      );

      return c.json({
        success: true,
        data: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          isActive: updatedUser.isActive,
          updatedAt: updatedUser.updatedAt,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";

      if (message === "User not found") {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "User not found",
            },
          },
          404
        );
      }

      if (message.includes("already exists")) {
        return c.json(
          {
            success: false,
            error: {
              code: "DUPLICATE_ERROR",
              message,
            },
          },
          409
        );
      }

      logger.error({ error, userId }, "Update user error");
      return c.json(
        {
          success: false,
          error: {
            code: "UPDATE_FAILED",
            message: "An error occurred while updating user",
          },
        },
        500
      );
    }
  }
);

/**
 * DELETE /admin/users/:id
 * Delete a user (Admin only)
 */
users.delete("/:id", requirePermission(PERMISSIONS.MANAGE_USERS), async (c) => {
  const userId = parseInt(c.req.param("id"), 10);
  const currentUser = getCurrentUser(c);

  if (isNaN(userId)) {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_ID",
          message: "Invalid user ID",
        },
      },
      400
    );
  }

  // Prevent self-deletion
  if (currentUser?.userId === userId) {
    return c.json(
      {
        success: false,
        error: {
          code: "SELF_DELETE",
          message: "You cannot delete your own account",
        },
      },
      400
    );
  }

  try {
    await deleteUser(userId);

    logger.info(
      { userId, deletedBy: currentUser?.userId },
      "User deleted by admin"
    );

    return c.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An error occurred";

    if (message === "User not found") {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "User not found",
          },
        },
        404
      );
    }

    if (message.includes("last admin")) {
      return c.json(
        {
          success: false,
          error: {
            code: "LAST_ADMIN",
            message: "Cannot delete the last admin user",
          },
        },
        400
      );
    }

    logger.error({ error, userId }, "Delete user error");
    return c.json(
      {
        success: false,
        error: {
          code: "DELETE_FAILED",
          message: "An error occurred while deleting user",
        },
      },
      500
    );
  }
});

/**
 * POST /admin/users/:id/roles
 * Assign a role to a user (Admin only)
 */
users.post(
  "/:id/roles",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  zValidator("json", assignRoleSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid role data",
            details: formatZodError(result.error),
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const userId = parseInt(c.req.param("id"), 10);
    const { roleName, storeCode } = c.req.valid("json");
    const currentUser = getCurrentUser(c);

    if (isNaN(userId)) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_ID",
            message: "Invalid user ID",
          },
        },
        400
      );
    }

    try {
      await assignRole({
        userId,
        roleName,
        storeCode,
      });

      logger.info(
        { userId, roleName, storeCode, assignedBy: currentUser?.userId },
        "Role assigned to user"
      );

      // Get updated roles
      const userRolesData = await getUserRoles(userId);

      return c.json({
        success: true,
        message: `Role '${roleName}' assigned successfully`,
        data: {
          roles: userRolesData,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";

      if (message === "User not found") {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "User not found",
            },
          },
          404
        );
      }

      if (message.includes("not found")) {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message,
            },
          },
          404
        );
      }

      if (message.includes("already assigned") || message.includes("required")) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_REQUEST",
              message,
            },
          },
          400
        );
      }

      logger.error({ error, userId, roleName }, "Assign role error");
      return c.json(
        {
          success: false,
          error: {
            code: "ASSIGN_FAILED",
            message: "An error occurred while assigning role",
          },
        },
        500
      );
    }
  }
);

/**
 * DELETE /admin/users/:id/roles/:roleName
 * Remove a role from a user (Admin only)
 */
users.delete(
  "/:id/roles/:roleName",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  async (c) => {
    const userId = parseInt(c.req.param("id"), 10);
    const roleName = c.req.param("roleName") as RoleName;
    const storeCode = c.req.query("storeCode");
    const currentUser = getCurrentUser(c);

    if (isNaN(userId)) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_ID",
            message: "Invalid user ID",
          },
        },
        400
      );
    }

    if (!["Admin", "Ops", "Store"].includes(roleName)) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_ROLE",
            message: "Invalid role name",
          },
        },
        400
      );
    }

    // Prevent removing own Admin role
    if (currentUser?.userId === userId && roleName === "Admin") {
      return c.json(
        {
          success: false,
          error: {
            code: "SELF_DEMOTE",
            message: "You cannot remove your own Admin role",
          },
        },
        400
      );
    }

    try {
      await removeRole(userId, roleName, storeCode || undefined);

      logger.info(
        { userId, roleName, storeCode, removedBy: currentUser?.userId },
        "Role removed from user"
      );

      // Get updated roles
      const userRolesData = await getUserRoles(userId);

      return c.json({
        success: true,
        message: `Role '${roleName}' removed successfully`,
        data: {
          roles: userRolesData,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";

      if (message.includes("not found")) {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message,
            },
          },
          404
        );
      }

      if (message.includes("last admin")) {
        return c.json(
          {
            success: false,
            error: {
              code: "LAST_ADMIN",
              message: "Cannot remove the last admin role",
            },
          },
          400
        );
      }

      logger.error({ error, userId, roleName }, "Remove role error");
      return c.json(
        {
          success: false,
          error: {
            code: "REMOVE_FAILED",
            message: "An error occurred while removing role",
          },
        },
        500
      );
    }
  }
);

export default users;
