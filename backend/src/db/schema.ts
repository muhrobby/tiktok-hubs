import {
  pgTable,
  varchar,
  text,
  timestamp,
  date,
  integer,
  bigint,
  serial,
  pgEnum,
  unique,
  index,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// ENUMS
// ============================================

export const accountStatusEnum = pgEnum("account_status", [
  "CONNECTED",
  "NEED_RECONNECT",
  "ERROR",
  "DISABLED",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "SUCCESS",
  "FAILED",
  "SKIPPED",
  "RUNNING",
]);

export const roleNameEnum = pgEnum("role_name", ["Admin", "Ops", "Store"]);

export const auditActionEnum = pgEnum("audit_action", [
  "CREATE",
  "READ",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "EXPORT",
  "IMPORT",
  "SYNC",
  "CONNECT",
  "DISCONNECT",
  "AUTHORIZE",
  "REFRESH_TOKEN",
  "BULK_DELETE",
]);

// ============================================
// TABLES
// ============================================

// ----------------------------------------
// AUTHENTICATION & AUTHORIZATION TABLES
// ----------------------------------------

/**
 * users - User accounts for authentication
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    email: varchar("email", { length: 255 }).unique(),
    fullName: varchar("full_name", { length: 255 }),
    isActive: boolean("is_active").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("users_username_idx").on(table.username),
    index("users_email_idx").on(table.email),
    index("users_is_active_idx").on(table.isActive),
  ]
);

/**
 * roles - Role definitions with permissions
 */
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: roleNameEnum("name").notNull().unique(),
  description: text("description"),
  permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * user_roles - Junction table for user-role assignments
 * For Store role, store_code specifies which store the user can access
 */
export const userRoles = pgTable(
  "user_roles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    storeCode: varchar("store_code", { length: 50 }).references(
      () => stores.storeCode,
      { onDelete: "cascade" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("user_roles_user_role_store_unique").on(
      table.userId,
      table.roleId,
      table.storeCode
    ),
    index("user_roles_user_id_idx").on(table.userId),
    index("user_roles_role_id_idx").on(table.roleId),
    index("user_roles_store_code_idx").on(table.storeCode),
  ]
);

/**
 * refresh_tokens - Store refresh tokens for JWT authentication
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 500 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    isRevoked: boolean("is_revoked").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("refresh_tokens_user_id_idx").on(table.userId),
    index("refresh_tokens_token_idx").on(table.token),
    index("refresh_tokens_expires_at_idx").on(table.expiresAt),
  ]
);

// ----------------------------------------
// TIKTOK HUB TABLES
// ----------------------------------------

/**
 * oauth_state - Temporary storage for OAuth PKCE code_verifier
 */
export const oauthState = pgTable("oauth_state", {
  state: varchar("state", { length: 100 }).primaryKey(),
  codeVerifier: text("code_verifier").notNull(),
  storeCode: varchar("store_code", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * stores - Daftar store yang dikelola
 */
export const stores = pgTable("stores", {
  storeCode: varchar("store_code", { length: 50 }).primaryKey(),
  storeName: varchar("store_name", { length: 255 }).notNull(),
  picName: varchar("pic_name", { length: 255 }).notNull(),
  picContact: varchar("pic_contact", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * store_accounts - Token dan status koneksi TikTok per store
 */
export const storeAccounts = pgTable(
  "store_accounts",
  {
    id: serial("id").primaryKey(),
    storeCode: varchar("store_code", { length: 50 })
      .notNull()
      .references(() => stores.storeCode, { onDelete: "cascade" }),
    openId: varchar("open_id", { length: 255 }).notNull(),
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc").notNull(),
    tokenExpiredAt: timestamp("token_expired_at", {
      withTimezone: true,
    }).notNull(),
    refreshTokenExpiredAt: timestamp("refresh_token_expired_at", {
      withTimezone: true,
    }),
    status: accountStatusEnum("status").default("CONNECTED").notNull(),
    lastSyncTime: timestamp("last_sync_time", { withTimezone: true }),
    connectedAt: timestamp("connected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("store_accounts_store_code_unique").on(table.storeCode),
    index("store_accounts_status_idx").on(table.status),
  ]
);

/**
 * tiktok_user_daily - Snapshot harian statistik akun TikTok
 */
export const tiktokUserDaily = pgTable(
  "tiktok_user_daily",
  {
    id: serial("id").primaryKey(),
    storeCode: varchar("store_code", { length: 50 })
      .notNull()
      .references(() => stores.storeCode, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    followerCount: integer("follower_count").default(0).notNull(),
    followingCount: integer("following_count").default(0).notNull(),
    likesCount: integer("likes_count").default(0).notNull(),
    videoCount: integer("video_count").default(0).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("tiktok_user_daily_store_date_unique").on(
      table.storeCode,
      table.snapshotDate
    ),
    index("tiktok_user_daily_store_code_idx").on(table.storeCode),
    index("tiktok_user_daily_snapshot_date_idx").on(table.snapshotDate),
  ]
);

/**
 * tiktok_video_daily - Snapshot harian statistik video TikTok
 */
export const tiktokVideoDaily = pgTable(
  "tiktok_video_daily",
  {
    id: serial("id").primaryKey(),
    storeCode: varchar("store_code", { length: 50 })
      .notNull()
      .references(() => stores.storeCode, { onDelete: "cascade" }),
    videoId: varchar("video_id", { length: 100 }).notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    viewCount: bigint("view_count", { mode: "number" }).default(0).notNull(),
    likeCount: bigint("like_count", { mode: "number" }).default(0).notNull(),
    commentCount: bigint("comment_count", { mode: "number" })
      .default(0)
      .notNull(),
    shareCount: bigint("share_count", { mode: "number" }).default(0).notNull(),
    createTime: timestamp("create_time", { withTimezone: true }),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    shareUrl: text("share_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("tiktok_video_daily_store_video_date_unique").on(
      table.storeCode,
      table.videoId,
      table.snapshotDate
    ),
    index("tiktok_video_daily_store_code_idx").on(table.storeCode),
    index("tiktok_video_daily_video_id_idx").on(table.videoId),
    index("tiktok_video_daily_snapshot_date_idx").on(table.snapshotDate),
  ]
);

/**
 * sync_logs - Log sinkronisasi
 */
export const syncLogs = pgTable(
  "sync_logs",
  {
    id: serial("id").primaryKey(),
    storeCode: varchar("store_code", { length: 50 }).references(
      () => stores.storeCode,
      { onDelete: "set null" }
    ),
    jobName: varchar("job_name", { length: 100 }).notNull(),
    runTime: timestamp("run_time", { withTimezone: true })
      .defaultNow()
      .notNull(),
    status: syncStatusEnum("status").notNull(),
    message: text("message"),
    rawError: text("raw_error"),
    durationMs: integer("duration_ms"),
  },
  (table) => [
    index("sync_logs_store_code_idx").on(table.storeCode),
    index("sync_logs_job_name_idx").on(table.jobName),
    index("sync_logs_run_time_idx").on(table.runTime),
  ]
);

/**
 * sync_locks - Advisory locks untuk mencegah overlap sync
 */
export const syncLocks = pgTable(
  "sync_locks",
  {
    id: serial("id").primaryKey(),
    lockKey: varchar("lock_key", { length: 100 }).notNull().unique(),
    lockedBy: varchar("locked_by", { length: 255 }),
    lockedAt: timestamp("locked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("sync_locks_lock_key_idx").on(table.lockKey),
    index("sync_locks_expires_at_idx").on(table.expiresAt),
  ]
);

/**
 * audit_logs - System audit trail for all admin operations
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .defaultNow()
      .notNull(),
    requestId: varchar("request_id", { length: 100 }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    username: varchar("username", { length: 50 }),
    action: auditActionEnum("action").notNull(),
    resource: varchar("resource", { length: 100 }).notNull(),
    resourceId: varchar("resource_id", { length: 255 }),
    ipAddress: varchar("ip_address", { length: 45 }), // IPv6 max length
    userAgent: text("user_agent"),
    method: varchar("method", { length: 10 }),
    path: varchar("path", { length: 500 }),
    success: boolean("success").default(true).notNull(),
    errorCode: varchar("error_code", { length: 50 }),
    duration: integer("duration"), // milliseconds
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("audit_logs_timestamp_idx").on(table.timestamp),
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_resource_idx").on(table.resource),
    index("audit_logs_success_idx").on(table.success),
  ]
);

// ============================================
// RELATIONS
// ============================================

// User Relations
export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  refreshTokens: many(refreshTokens),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  store: one(stores, {
    fields: [userRoles.storeCode],
    references: [stores.storeCode],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

// Store Relations
export const storesRelations = relations(stores, ({ one, many }) => ({
  account: one(storeAccounts, {
    fields: [stores.storeCode],
    references: [storeAccounts.storeCode],
  }),
  userDaily: many(tiktokUserDaily),
  videoDaily: many(tiktokVideoDaily),
  syncLogs: many(syncLogs),
  userRoles: many(userRoles),
}));

export const storeAccountsRelations = relations(storeAccounts, ({ one }) => ({
  store: one(stores, {
    fields: [storeAccounts.storeCode],
    references: [stores.storeCode],
  }),
}));

export const tiktokUserDailyRelations = relations(
  tiktokUserDaily,
  ({ one }) => ({
    store: one(stores, {
      fields: [tiktokUserDaily.storeCode],
      references: [stores.storeCode],
    }),
  })
);

export const tiktokVideoDailyRelations = relations(
  tiktokVideoDaily,
  ({ one }) => ({
    store: one(stores, {
      fields: [tiktokVideoDaily.storeCode],
      references: [stores.storeCode],
    }),
  })
);

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  store: one(stores, {
    fields: [syncLogs.storeCode],
    references: [stores.storeCode],
  }),
}));

// ============================================
// TYPES
// ============================================

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

export type StoreAccount = typeof storeAccounts.$inferSelect;
export type NewStoreAccount = typeof storeAccounts.$inferInsert;

export type TiktokUserDaily = typeof tiktokUserDaily.$inferSelect;
export type NewTiktokUserDaily = typeof tiktokUserDaily.$inferInsert;

export type TiktokVideoDaily = typeof tiktokVideoDaily.$inferSelect;
export type NewTiktokVideoDaily = typeof tiktokVideoDaily.$inferInsert;

export type SyncLog = typeof syncLogs.$inferSelect;
export type NewSyncLog = typeof syncLogs.$inferInsert;

export type SyncLock = typeof syncLocks.$inferSelect;
export type NewSyncLock = typeof syncLocks.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type AccountStatus =
  | "CONNECTED"
  | "NEED_RECONNECT"
  | "ERROR"
  | "DISABLED";
export type SyncStatus = "SUCCESS" | "FAILED" | "SKIPPED" | "RUNNING";
export type RoleName = "Admin" | "Ops" | "Store";
export type AuditAction = "CREATE" | "READ" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "EXPORT" | "IMPORT" | "SYNC";

// Permission constants
export const PERMISSIONS = {
  // Store permissions
  VIEW_ALL_STORES: "view_all_stores",
  VIEW_OWN_STORE: "view_own_store",
  CREATE_STORE: "create_store",
  EDIT_STORE: "edit_store",
  DELETE_STORE: "delete_store",

  // Sync permissions
  TRIGGER_SYNC_ALL: "trigger_sync_all",
  TRIGGER_SYNC_OWN: "trigger_sync_own",
  VIEW_SYNC_LOGS_ALL: "view_sync_logs_all",
  VIEW_SYNC_LOGS_OWN: "view_sync_logs_own",

  // User management permissions
  MANAGE_USERS: "manage_users",
  VIEW_USERS: "view_users",

  // Export permissions
  EXPORT_ALL_DATA: "export_all_data",
  EXPORT_OWN_DATA: "export_own_data",

  // Dashboard permissions
  VIEW_DASHBOARD_ALL: "view_dashboard_all",
  VIEW_DASHBOARD_OWN: "view_dashboard_own",

  // Audit permissions
  VIEW_AUDIT_LOGS: "view_audit_logs",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Default permissions for each role
export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  Admin: [
    PERMISSIONS.VIEW_ALL_STORES,
    PERMISSIONS.VIEW_OWN_STORE,
    PERMISSIONS.CREATE_STORE,
    PERMISSIONS.EDIT_STORE,
    PERMISSIONS.DELETE_STORE,
    PERMISSIONS.TRIGGER_SYNC_ALL,
    PERMISSIONS.TRIGGER_SYNC_OWN,
    PERMISSIONS.VIEW_SYNC_LOGS_ALL,
    PERMISSIONS.VIEW_SYNC_LOGS_OWN,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.EXPORT_ALL_DATA,
    PERMISSIONS.EXPORT_OWN_DATA,
    PERMISSIONS.VIEW_DASHBOARD_ALL,
    PERMISSIONS.VIEW_DASHBOARD_OWN,
    PERMISSIONS.VIEW_AUDIT_LOGS,
  ],
  Ops: [
    PERMISSIONS.VIEW_ALL_STORES,
    PERMISSIONS.VIEW_OWN_STORE,
    PERMISSIONS.CREATE_STORE,
    PERMISSIONS.EDIT_STORE,
    PERMISSIONS.TRIGGER_SYNC_ALL,
    PERMISSIONS.TRIGGER_SYNC_OWN,
    PERMISSIONS.VIEW_SYNC_LOGS_ALL,
    PERMISSIONS.VIEW_SYNC_LOGS_OWN,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.EXPORT_ALL_DATA,
    PERMISSIONS.EXPORT_OWN_DATA,
    PERMISSIONS.VIEW_DASHBOARD_ALL,
    PERMISSIONS.VIEW_DASHBOARD_OWN,
  ],
  Store: [
    PERMISSIONS.VIEW_OWN_STORE,
    PERMISSIONS.TRIGGER_SYNC_OWN,
    PERMISSIONS.VIEW_SYNC_LOGS_OWN,
    PERMISSIONS.EXPORT_OWN_DATA,
    PERMISSIONS.VIEW_DASHBOARD_OWN,
  ],
};
