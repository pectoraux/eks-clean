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
  | "marketplace:approve"
  // CRM
  | "crm:read"
  | "crm:manage"
  | "crm:campaigns:manage"
  // Cleaning Protocols
  | "protocols:read"
  | "protocols:manage"
  | "protocols:execute"
  // LMS
  | "lms:read"
  | "lms:manage"
  | "lms:enroll"
  | "lms:certify"
  // Supply Chain
  | "scm:read"
  | "scm:manage"
  | "scm:approve_po"
  // Fleet
  | "fleet:read"
  | "fleet:manage"
  // Enterprise Contracts
  | "contracts:read"
  | "contracts:manage"
  | "contracts:approve"
  // Workflows
  | "workflows:read"
  | "workflows:manage"
  | "workflows:execute"
  // Advanced Analytics
  | "analytics:views:manage"
  | "analytics:reports:manage"
  // Milestone 2 — Knowledge Base
  | "kb:read"
  | "kb:write"
  | "kb:publish"
  | "kb:admin"
  // Milestone 2 — Advanced Subscriptions
  | "subscriptions:proration:manage"
  | "subscriptions:addons:manage"
  | "subscriptions:dunning:manage"
  // Milestone 2 — Workforce Management
  | "workforce:read"
  | "workforce:schedules:manage"
  | "workforce:paygrades:manage"
  | "workforce:timeoff:approve"
  | "workforce:performance:review"
  // Milestone 2 — Event-Sourced Analytics
  | "analytics:events:read"
  | "analytics:projections:manage"
  | "analytics:queries:manage"
  // Milestone 2 — AI-Ready
  | "ai:prompts:manage"
  | "ai:runs:read"
  | "ai:predictions:read";

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
    "kb:read",
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
    "kb:read",
    "workforce:read",
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
    "crm:read",
    "protocols:read",
    "protocols:manage",
    "protocols:execute",
    "lms:read",
    "lms:manage",
    "lms:enroll",
    "lms:certify",
    "scm:read",
    "fleet:read",
    "fleet:manage",
    "contracts:read",
    "workflows:read",
    "workflows:execute",
    "analytics:views:manage",
    "kb:read",
    "kb:write",
    "kb:publish",
    "subscriptions:addons:manage",
    "workforce:read",
    "workforce:schedules:manage",
    "workforce:paygrades:manage",
    "workforce:timeoff:approve",
    "workforce:performance:review",
    "analytics:events:read",
    "ai:runs:read",
    "ai:predictions:read",
  ],
  SALES_AGENT: [
    "customers:read",
    "services:read",
    "sales:leads:manage",
    "sales:commission:read",
    "analytics:read",
    "crm:read",
    "crm:manage",
    "crm:campaigns:manage",
    "contracts:read",
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
    "analytics:views:manage",
    "analytics:reports:manage",
    "marketplace:register",
    "marketplace:approve",
    "crm:read",
    "crm:manage",
    "crm:campaigns:manage",
    "protocols:read",
    "protocols:manage",
    "protocols:execute",
    "lms:read",
    "lms:manage",
    "lms:enroll",
    "lms:certify",
    "scm:read",
    "scm:manage",
    "scm:approve_po",
    "fleet:read",
    "fleet:manage",
    "contracts:read",
    "contracts:manage",
    "contracts:approve",
    "workflows:read",
    "workflows:manage",
    "workflows:execute",
    "kb:read",
    "kb:write",
    "kb:publish",
    "kb:admin",
    "subscriptions:proration:manage",
    "subscriptions:addons:manage",
    "subscriptions:dunning:manage",
    "workforce:read",
    "workforce:schedules:manage",
    "workforce:paygrades:manage",
    "workforce:timeoff:approve",
    "workforce:performance:review",
    "analytics:events:read",
    "analytics:projections:manage",
    "analytics:queries:manage",
    "ai:prompts:manage",
    "ai:runs:read",
    "ai:predictions:read",
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
