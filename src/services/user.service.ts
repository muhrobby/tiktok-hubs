/**
 * User Service
 *
 * Handles user CRUD operations and role assignment
 * Includes Redis caching for frequently accessed data
 */

import { eq, and, ilike, desc, sql, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  users,
  roles,
  userRoles,
  stores,
  type User,
  type Role,
  type NewUser,
  type RoleName,
  ROLE_PERMISSIONS,
} from "../db/schema.js";
import { hashPassword } from "./auth.service.js";
import { logger } from "../utils/logger.js";
import { get, invalidateUser, CacheKeys, getCacheTTL } from "../cache/index.js";

// ============================================
// TYPES
// ============================================

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  fullName?: string;
  isActive?: boolean;
}

export interface UpdateUserInput {
  email?: string;
  fullName?: string;
  isActive?: boolean;
  password?: string;
}

export interface AssignRoleInput {
  userId: number;
  roleName: RoleName;
  storeCode?: string; // Required for Store role
}

export interface UserListItem {
  id: number;
  username: string;
  email: string | null;
  fullName: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: {
    roleName: RoleName;
    storeCode: string | null;
    storeName: string | null;
  }[];
}

export interface UserFilters {
  search?: string;
  isActive?: boolean;
  roleName?: RoleName;
  page?: number;
  limit?: number;
}

// ============================================
// ROLE OPERATIONS
// ============================================

/**
 * Get all roles (cached)
 */
export async function getRoles(): Promise<Role[]> {
  return get(
    CacheKeys.allRoles(),
    async () => db.select().from(roles).orderBy(roles.id),
    getCacheTTL("long") // Cache for 1 hour - roles rarely change
  );
}

/**
 * Get role by name (cached)
 */
export async function getRoleByName(name: RoleName): Promise<Role | null> {
  const result = await get(
    CacheKeys.roleByName(name),
    async () => {
      const role = await db.query.roles.findFirst({
        where: eq(roles.name, name),
      });
      return role || null;
    },
    getCacheTTL("long") // Cache for 1 hour
  );

  return result;
}

/**
 * Initialize default roles (should be called at startup/seed)
 */
export async function initializeRoles(): Promise<void> {
  const roleNames: RoleName[] = ["Admin", "Ops", "Store"];

  for (const roleName of roleNames) {
    const existingRole = await getRoleByName(roleName);
    if (!existingRole) {
      const permissions = ROLE_PERMISSIONS[roleName];
      await db.insert(roles).values({
        name: roleName,
        description: getDefaultRoleDescription(roleName),
        permissions,
      });
      logger.info(`Created role: ${roleName}`);
    }
  }
}

function getDefaultRoleDescription(roleName: RoleName): string {
  switch (roleName) {
    case "Admin":
      return "Full system access. Can manage users, all stores, and system settings.";
    case "Ops":
      return "Operations role. Can manage stores and sync operations. Cannot manage users.";
    case "Store":
      return "Store-level access. Can only view and manage assigned store.";
  }
}

// ============================================
// USER CRUD OPERATIONS
// ============================================

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  // Check if username already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.username, input.username),
  });

  if (existingUser) {
    throw new Error("Username already exists");
  }

  // Check if email already exists (if provided)
  if (input.email) {
    const existingEmail = await db.query.users.findFirst({
      where: eq(users.email, input.email),
    });
    if (existingEmail) {
      throw new Error("Email already exists");
    }
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      username: input.username,
      passwordHash,
      email: input.email || null,
      fullName: input.fullName || null,
      isActive: input.isActive ?? true,
    })
    .returning();

  logger.info({ userId: newUser.id, username: newUser.username }, "User created");

  return newUser;
}

/**
 * Get user by ID (cached)
 */
export async function getUserById(userId: number): Promise<User | null> {
  const result = await get(
    CacheKeys.user(userId),
    async () => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      return user || null;
    },
    getCacheTTL("default") // Cache for 5 minutes
  );

  return result;
}

/**
 * Update user
 */
export async function updateUser(
  userId: number,
  input: UpdateUserInput
): Promise<User> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const updateData: Partial<NewUser> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (input.email !== undefined) {
    // Check if email already exists (if changing)
    if (input.email && input.email !== user.email) {
      const existingEmail = await db.query.users.findFirst({
        where: eq(users.email, input.email),
      });
      if (existingEmail) {
        throw new Error("Email already exists");
      }
    }
    updateData.email = input.email || null;
  }

  if (input.fullName !== undefined) {
    updateData.fullName = input.fullName || null;
  }

  if (input.isActive !== undefined) {
    updateData.isActive = input.isActive;
  }

  if (input.password) {
    updateData.passwordHash = await hashPassword(input.password);
  }

  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, userId))
    .returning();

  // Invalidate user cache
  await invalidateUser(userId);

  logger.info({ userId, changes: Object.keys(input) }, "User updated");

  return updatedUser;
}

/**
 * Delete user
 */
export async function deleteUser(userId: number): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Prevent deleting the last admin
  const adminRole = await getRoleByName("Admin");
  if (adminRole) {
    const userHasAdmin = await db.query.userRoles.findFirst({
      where: and(
        eq(userRoles.userId, userId),
        eq(userRoles.roleId, adminRole.id)
      ),
    });

    if (userHasAdmin) {
      const adminCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userRoles)
        .where(eq(userRoles.roleId, adminRole.id));

      if (adminCount[0].count <= 1) {
        throw new Error("Cannot delete the last admin user");
      }
    }
  }

  await db.delete(users).where(eq(users.id, userId));

  // Invalidate user cache
  await invalidateUser(userId);

  logger.info({ userId, username: user.username }, "User deleted");
}

/**
 * List users with filters and pagination
 * FIXED: Resolved N+1 query issue by using single query with joins
 */
export async function listUsers(
  filters: UserFilters = {}
): Promise<{ users: UserListItem[]; total: number }> {
  const { search, isActive, roleName, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions: ReturnType<typeof eq>[] = [];

  if (search) {
    conditions.push(
      sql`(${users.username} ILIKE ${`%${search}%`} OR ${users.fullName} ILIKE ${`%${search}%`} OR ${users.email} ILIKE ${`%${search}%`})`
    );
  }

  if (isActive !== undefined) {
    conditions.push(eq(users.isActive, isActive));
  }

  if (roleName) {
    // Subquery to filter by role
    const role = await getRoleByName(roleName);
    if (role) {
      const usersWithRole = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(eq(userRoles.roleId, role.id));

      const userIds = usersWithRole.map((u) => u.userId);
      if (userIds.length > 0) {
        conditions.push(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
      } else {
        // No users with this role
        return { users: [], total: 0 };
      }
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(whereClause);
  const total = countResult[0].count;

  // Get paginated user results
  const usersList = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      fullName: users.fullName,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  if (usersList.length === 0) {
    return { users: [], total };
  }

  // FIXED: Single query to get all user roles with store names
  const userIds = usersList.map((u) => u.id);

  const allUserRoles = await db
    .select({
      userId: userRoles.userId,
      roleName: roles.name,
      storeCode: userRoles.storeCode,
      storeName: stores.storeName,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(stores, eq(userRoles.storeCode, stores.storeCode))
    .where(inArray(userRoles.userId, userIds));

  // Group roles by user ID
  const rolesByUser = new Map<number, UserListItem["roles"]>();
  for (const ur of allUserRoles) {
    if (!rolesByUser.has(ur.userId)) {
      rolesByUser.set(ur.userId, []);
    }
    rolesByUser.get(ur.userId)!.push({
      roleName: ur.roleName as RoleName,
      storeCode: ur.storeCode,
      storeName: ur.storeName,
    });
  }

  // Combine users with their roles
  const usersWithRoles: UserListItem[] = usersList.map((user) => ({
    ...user,
    roles: rolesByUser.get(user.id) || [],
  }));

  return { users: usersWithRoles, total };
}

// ============================================
// ROLE ASSIGNMENT
// ============================================

/**
 * Assign role to user
 */
export async function assignRole(input: AssignRoleInput): Promise<void> {
  const { userId, roleName, storeCode } = input;

  // Get role
  const role = await getRoleByName(roleName);
  if (!role) {
    throw new Error(`Role '${roleName}' not found`);
  }

  // Get user
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Validate store code for Store role
  if (roleName === "Store") {
    if (!storeCode) {
      throw new Error("Store code is required for Store role");
    }

    const store = await db.query.stores.findFirst({
      where: eq(stores.storeCode, storeCode),
    });

    if (!store) {
      throw new Error(`Store '${storeCode}' not found`);
    }
  }

  // Check if role already assigned
  const existingRole = await db.query.userRoles.findFirst({
    where: and(
      eq(userRoles.userId, userId),
      eq(userRoles.roleId, role.id),
      storeCode
        ? eq(userRoles.storeCode, storeCode)
        : sql`${userRoles.storeCode} IS NULL`
    ),
  });

  if (existingRole) {
    throw new Error("Role already assigned to user");
  }

  // Assign role
  await db.insert(userRoles).values({
    userId,
    roleId: role.id,
    storeCode: roleName === "Store" ? storeCode : null,
  });

  // Invalidate user roles cache
  await invalidateUser(userId);

  logger.info({ userId, roleName, storeCode }, "Role assigned to user");
}

/**
 * Remove role from user
 */
export async function removeRole(
  userId: number,
  roleName: RoleName,
  storeCode?: string
): Promise<void> {
  const role = await getRoleByName(roleName);
  if (!role) {
    throw new Error(`Role '${roleName}' not found`);
  }

  // Prevent removing the last admin role
  if (roleName === "Admin") {
    const adminCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userRoles)
      .where(eq(userRoles.roleId, role.id));

    if (adminCount[0].count <= 1) {
      throw new Error("Cannot remove the last admin role");
    }
  }

  await db.delete(userRoles).where(
    and(
      eq(userRoles.userId, userId),
      eq(userRoles.roleId, role.id),
      storeCode
        ? eq(userRoles.storeCode, storeCode)
        : sql`${userRoles.storeCode} IS NULL`
    )
  );

  // Invalidate user roles cache
  await invalidateUser(userId);

  logger.info({ userId, roleName, storeCode }, "Role removed from user");
}

/**
 * Get user's roles (cached)
 * FIXED: Resolved N+1 query by using LEFT JOIN with stores
 */
export async function getUserRoles(
  userId: number
): Promise<{ roleName: RoleName; storeCode: string | null; storeName: string | null }[]> {
  return get(
    CacheKeys.userRoles(userId),
    async () => {
      // FIXED: Single query with LEFT JOIN to get store names
      const userRolesData = await db
        .select({
          roleName: roles.name,
          storeCode: userRoles.storeCode,
          storeName: stores.storeName,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .leftJoin(stores, eq(userRoles.storeCode, stores.storeCode))
        .where(eq(userRoles.userId, userId));

      return userRolesData.map((ur) => ({
        roleName: ur.roleName as RoleName,
        storeCode: ur.storeCode,
        storeName: ur.storeName,
      }));
    },
    getCacheTTL("default") // Cache for 5 minutes
  );
}

// ============================================
// ADMIN CREATION
// ============================================

/**
 * Create default admin user if no admin exists
 */
export async function ensureDefaultAdmin(): Promise<void> {
  // Initialize roles first
  await initializeRoles();

  // Check if any admin exists
  const adminRole = await getRoleByName("Admin");
  if (!adminRole) {
    throw new Error("Admin role not found. Please run initializeRoles first.");
  }

  const adminCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userRoles)
    .where(eq(userRoles.roleId, adminRole.id));

  if (adminCount[0].count > 0) {
    logger.info("Admin user already exists, skipping creation");
    return;
  }

  // Create default admin
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "changeme123";
  
  const adminUser = await createUser({
    username: "admin",
    password: defaultPassword,
    email: "admin@tiktok-hubs.local",
    fullName: "System Administrator",
    isActive: true,
  });

  await assignRole({
    userId: adminUser.id,
    roleName: "Admin",
  });

  logger.warn({ username: "admin", message: "Please change the default password immediately!" }, "Default admin user created");
}
