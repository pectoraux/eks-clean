/**
 * ============================================================================
 *  Eks-Clean — RBAC (Role-Based Access Control)
 * ============================================================================
 *  Permission catalog is data-driven (Permission table + RolePermission).
 *  In dev we ship a sensible default mapping; admins can override at runtime.
 * ============================================================================
 */

import type { Role } from "@/lib/types";

export type Permission =
  // bookings
  | "bookings:create"
  | "bookings:read"
  | "bookings:update"
  | "bookings:cancel"
  | "bookings:assign"
  | "bookings:status_update"
  // customers
  | "customers:create"
  | "customers:read"
  | "customers:update"
  | "customers:delete"
  // workers
  | "workers:create"
  | "workers:read"
  | "workers:approve"
  | "workers:suspend"
  | "workers:assign_territory"
  | "workers:review"
  // services
  | "services:read"
  | "services:manage"
  // dispatch
  | "dispatch:read"
  | "dispatch:override"
  // quality
  | "quality:rate"
  | "quality:audit"
  // subscriptions
  | "subscriptions:read"
  | "subscriptions:manage"
  // inventory
  | "inventory:read"
  | "inventory:manage"
  | "inventory:issue"
  // payments (always via gateway)
  | "payments:read"
  | "payments:refund"
  | "payments:payout"
  // sales
  | "sales:leads:manage"
  | "sales:commission:read"
  // field managers
  | "field_managers:recruit"
  | "field_managers:audit"
  // admin
  | "admin:users"
  | "admin:feature_flags"
  | "admin:audit_log:read"
  // analytics
  | "analytics:read"
  | "analytics:global"
  // marketplace
  | "marketplace:register"
  | "marketplace:approve";

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  CUSTOMER: [
    "bookings:create",
    "bookings:read",
    "bookings:cancel",
    "bookings:status_update",
    "customers:read",
    "customers:update",
    "services:read",
    "quality:rate",
    "subscriptions:read",
    "subscriptions:manage",
    "payments:read",
    "analytics:read",
  ],
  WORKER: [
    "bookings:read",
    "bookings:status_update",
    "workers:read",
    "services:read",
    "dispatch:read",
    "inventory:read",
    "payments:read",
    "analytics:read",
  ],
  FIELD_MANAGER: [
    "bookings:read",
    "bookings:assign",
    "bookings:status_update",
    "customers:read",
    "workers:read",
    "workers:approve",
    "workers:suspend",
    "workers:review",
    "services:read",
    "dispatch:read",
    "dispatch:override",
    "quality:audit",
    "inventory:read",
    "inventory:manage",
    "inventory:issue",
    "payments:read",
    "analytics:read",
    "field_managers:recruit",
    "field_managers:audit",
  ],
  SALES_AGENT: [
    "customers:read",
    "services:read",
    "sales:leads:manage",
    "sales:commission:read",
    "analytics:read",
  ],
  ADMIN: [
    "bookings:create",
    "bookings:read",
    "bookings:update",
    "bookings:cancel",
    "bookings:assign",
    "bookings:status_update",
    "customers:create",
    "customers:read",
    "customers:update",
    "customers:delete",
    "workers:create",
    "workers:read",
    "workers:approve",
    "workers:suspend",
    "workers:assign_territory",
    "workers:review",
    "services:read",
    "services:manage",
    "dispatch:read",
    "dispatch:override",
    "quality:rate",
    "quality:audit",
    "subscriptions:read",
    "subscriptions:manage",
    "inventory:read",
    "inventory:manage",
    "inventory:issue",
    "payments:read",
    "payments:refund",
    "payments:payout",
    "sales:leads:manage",
    "sales:commission:read",
    "field_managers:recruit",
    "field_managers:audit",
    "admin:users",
    "admin:feature_flags",
    "admin:audit_log:read",
    "analytics:read",
    "analytics:global",
    "marketplace:register",
    "marketplace:approve",
  ],
};

export function hasPermission(role: Role, perm: Permission): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function requirePermission(role: Role, perm: Permission): void {
  if (!hasPermission(role, perm)) {
    throw new PermissionDeniedError(`Role ${role} lacks permission ${perm}`);
  }
}

export class PermissionDeniedError extends Error {
  readonly code = "PERMISSION_DENIED";
  constructor(message: string) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}
