/**
 * Auth-related types
 */

// Role names
export type RoleName = "Admin" | "Ops" | "Store";

// Permission constants (must match backend)
export type Permission =
  | "view_all_stores"
  | "view_own_store"
  | "create_store"
  | "edit_store"
  | "delete_store"
  | "trigger_sync_all"
  | "trigger_sync_own"
  | "view_sync_logs_all"
  | "view_sync_logs_own"
  | "manage_users"
  | "view_users"
  | "export_all_data"
  | "export_own_data"
  | "view_dashboard_all"
  | "view_dashboard_own"
  | "view_audit_logs";

// Permission constants for easy reference
export const PERMISSIONS = {
  VIEW_ALL_STORES: "view_all_stores",
  VIEW_OWN_STORE: "view_own_store",
  CREATE_STORE: "create_store",
  EDIT_STORE: "edit_store",
  DELETE_STORE: "delete_store",
  TRIGGER_SYNC_ALL: "trigger_sync_all",
  TRIGGER_SYNC_OWN: "trigger_sync_own",
  VIEW_SYNC_LOGS_ALL: "view_sync_logs_all",
  VIEW_SYNC_LOGS_OWN: "view_sync_logs_own",
  MANAGE_USERS: "manage_users",
  VIEW_USERS: "view_users",
  EXPORT_ALL_DATA: "export_all_data",
  EXPORT_OWN_DATA: "export_own_data",
  VIEW_DASHBOARD_ALL: "view_dashboard_all",
  VIEW_DASHBOARD_OWN: "view_dashboard_own",
  VIEW_AUDIT_LOGS: "view_audit_logs",
} as const;
