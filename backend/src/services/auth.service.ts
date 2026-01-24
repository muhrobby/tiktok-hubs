/**
 * Authentication Service
 *
 * Handles JWT token generation/verification and password hashing
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq, and, lt, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  users,
  roles,
  userRoles,
  refreshTokens,
  type User,
  type Role,
  type Permission,
  type RoleName,
  ROLE_PERMISSIONS,
} from "../db/schema.js";
import { logger } from "../utils/logger.js";

// ============================================
// TYPES
// ============================================

export interface JWTPayload {
  userId: number;
  username: string;
  roles: RoleName[];
  permissions: Permission[];
  assignedStores: string[]; // For Store role users
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserWithRoles extends User {
  roles: {
    role: Role;
    storeCode: string | null;
  }[];
}

// ============================================
// CONFIGURATION
// ============================================

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 days

// Lazy-load JWT secrets to ensure env vars are loaded
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.TOKEN_ENC_KEY || "";
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET or TOKEN_ENC_KEY must be configured and at least 32 characters");
  }
  return secret;
}

function getJWTRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.STATE_SECRET || "";
  if (!secret || secret.length < 32) {
    throw new Error("JWT_REFRESH_SECRET or STATE_SECRET must be configured and at least 32 characters");
  }
  return secret;
}

// ============================================
// PASSWORD FUNCTIONS
// ============================================

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// JWT FUNCTIONS
// ============================================

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: "HS256",
  });
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(userId: number): string {
  return jwt.sign({ userId, type: "refresh" }, getJWTRefreshSecret(), {
    expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d`,
    algorithm: "HS256",
  });
}

/**
 * Verify JWT access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJWTSecret()) as JWTPayload;
    return decoded;
  } catch (error) {
    logger.debug({ error }, "Access token verification failed");
    return null;
  }
}

/**
 * Verify JWT refresh token
 */
export function verifyRefreshToken(
  token: string
): { userId: number; type: string } | null {
  try {
    const decoded = jwt.verify(token, getJWTRefreshSecret()) as {
      userId: number;
      type: string;
    };
    if (decoded.type !== "refresh") {
      return null;
    }
    return decoded;
  } catch (error) {
    logger.debug({ error }, "Refresh token verification failed");
    return null;
  }
}

// ============================================
// USER AUTHENTICATION
// ============================================

/**
 * Get user with all their roles
 */
export async function getUserWithRoles(
  userId: number
): Promise<UserWithRoles | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return null;
  }

  const userRolesData = await db
    .select({
      roleId: userRoles.roleId,
      storeCode: userRoles.storeCode,
      role: roles,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  return {
    ...user,
    roles: userRolesData.map((ur) => ({
      role: ur.role,
      storeCode: ur.storeCode,
    })),
  };
}

/**
 * Get user by username
 */
export async function getUserByUsername(
  username: string
): Promise<User | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  return user || null;
}

/**
 * Build JWT payload from user with roles
 */
export function buildJWTPayload(user: UserWithRoles): JWTPayload {
  const roleNames = user.roles.map((r) => r.role.name as RoleName);

  // Collect all permissions from all roles
  const allPermissions = new Set<Permission>();
  for (const roleName of roleNames) {
    const rolePerms = ROLE_PERMISSIONS[roleName] || [];
    rolePerms.forEach((p) => allPermissions.add(p));
  }

  // Collect assigned stores (for Store role users)
  const assignedStores = user.roles
    .filter((r) => r.storeCode !== null)
    .map((r) => r.storeCode as string);

  return {
    userId: user.id,
    username: user.username,
    roles: roleNames,
    permissions: Array.from(allPermissions),
    assignedStores,
  };
}

/**
 * Authenticate user and generate token pair
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{ user: UserWithRoles; tokens: TokenPair } | null> {
  // Get user
  const user = await getUserByUsername(username);
  if (!user) {
    logger.info({ username }, "Login failed: user not found");
    return null;
  }

  // Check if user is active - throw specific error
  if (!user.isActive) {
    logger.info({ username, userId: user.id }, "Login failed: user is deactivated");
    throw new Error("USER_INACTIVE");
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    logger.info({ username }, "Login failed: invalid password");
    return null;
  }

  // Get user with roles
  const userWithRoles = await getUserWithRoles(user.id);
  if (!userWithRoles) {
    logger.error({ userId: user.id }, "Failed to get user roles after authentication");
    return null;
  }

  // Generate tokens
  const payload = buildJWTPayload(userWithRoles);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(user.id);

  // Store refresh token in database
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await db.insert(refreshTokens).values({
    userId: user.id,
    token: refreshToken,
    expiresAt,
  });

  // Update last login time
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  logger.info({ userId: user.id, username, roles: payload.roles }, "User authenticated successfully");

  return {
    user: userWithRoles,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    },
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenPair | null> {
  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return null;
  }

  // Check if refresh token exists and is not revoked
  const storedToken = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.token, refreshToken),
      eq(refreshTokens.isRevoked, false),
      gt(refreshTokens.expiresAt, new Date())
    ),
  });

  if (!storedToken) {
    logger.info({ userId: decoded.userId }, "Refresh token not found or expired/revoked");
    return null;
  }

  // Get user with roles
  const userWithRoles = await getUserWithRoles(decoded.userId);
  if (!userWithRoles || !userWithRoles.isActive) {
    logger.info({ userId: decoded.userId }, "User not found or deactivated during token refresh");
    return null;
  }

  // Generate new access token
  const payload = buildJWTPayload(userWithRoles);
  const newAccessToken = generateAccessToken(payload);

  // Optionally rotate refresh token (we'll keep the same one for simplicity)
  logger.info({ userId: decoded.userId }, "Access token refreshed");

  return {
    accessToken: newAccessToken,
    refreshToken, // Return same refresh token
    expiresIn: 15 * 60,
  };
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export async function revokeAllUserTokens(userId: number): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ isRevoked: true, revokedAt: new Date() })
    .where(eq(refreshTokens.userId, userId));

  logger.info({ userId }, "All refresh tokens revoked for user");
}

/**
 * Revoke a specific refresh token (single logout)
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ isRevoked: true, revokedAt: new Date() })
    .where(eq(refreshTokens.token, token));
}

// ============================================
// PERMISSION CHECKS
// ============================================

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  payload: JWTPayload,
  permission: Permission
): boolean {
  return payload.permissions.includes(permission);
}

/**
 * Check if user can access a specific store
 * - Admin and Ops can access all stores
 * - Store role can only access their assigned stores
 */
export function canAccessStore(
  payload: JWTPayload,
  storeCode: string
): boolean {
  // Admin and Ops can access all stores
  if (payload.roles.includes("Admin") || payload.roles.includes("Ops")) {
    return true;
  }

  // Store role can only access assigned stores
  if (payload.roles.includes("Store")) {
    return payload.assignedStores.includes(storeCode);
  }

  return false;
}

/**
 * Get accessible store codes for a user
 * - Admin/Ops: returns null (all stores)
 * - Store: returns assigned stores array
 */
export function getAccessibleStores(payload: JWTPayload): string[] | null {
  if (payload.roles.includes("Admin") || payload.roles.includes("Ops")) {
    return null; // All stores
  }

  return payload.assignedStores;
}

// ============================================
// CLEANUP
// ============================================

/**
 * Clean up expired refresh tokens
 * Should be called periodically
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db
    .delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, new Date()));

  const deletedCount = result.rowCount || 0;
  if (deletedCount > 0) {
    logger.info({ count: deletedCount }, "Cleaned up expired refresh tokens");
  }
  return deletedCount;
}
