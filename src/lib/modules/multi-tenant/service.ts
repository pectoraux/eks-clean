/**
 * ============================================================================
 *  Multi-Tenant Service — Organization/Branch/Area management
 * ============================================================================
 *  Every entity in the system can be scoped to an Organization.
 *  Eks-Clean itself is one Organization (the first tenant).
 *  Future: other service companies become their own Organizations.
 *
 *  Auth integration: the JWT carries organizationId, and API routes
 *  filter by it (org-scoped queries). Admins can be org-admins
 *  (scoped to their org) or platform-admins (all orgs).
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Organization CRUD
// ---------------------------------------------------------------------------

export async function createOrganization(input: {
  code: string;
  name: string;
  legalName?: string;
  taxId?: string;
  billingEmail?: string;
  billingPhone?: string;
  address?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  plan?: string;
}) {
  const existing = await db.organization.findUnique({ where: { code: input.code } });
  if (existing) throw conflict(`Organization ${input.code} already exists`);
  const org = await db.organization.create({ data: input });
  await publish({ eventType: "organization.created", payload: { orgId: org.id, code: input.code } });
  return org;
}

export async function getOrganization(id: string) {
  const org = await db.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true, customers: true, workers: true,
          branches: true, areas: true, bookings: true,
        },
      },
    },
  });
  if (!org) throw notFound("Organization not found");
  return org;
}

export async function listOrganizations() {
  return db.organization.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
//  Branch + Area
// ---------------------------------------------------------------------------

export async function createBranch(organizationId: string, input: {
  code: string; name: string; address?: string; phone?: string; managerUserId?: string;
}) {
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw notFound("Organization not found");
  return db.branch.create({ data: { ...input, organizationId } });
}

export async function createArea(organizationId: string, input: {
  code: string; name: string; description?: string; branchId?: string; geoZoneId?: string; managerUserId?: string;
}) {
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw notFound("Organization not found");
  return db.area.create({ data: { ...input, organizationId } });
}

// ---------------------------------------------------------------------------
//  Org-scoped query helper
//  All list endpoints should use this to filter by the caller's org
// ---------------------------------------------------------------------------

export function orgFilter(organizationId: string | undefined): Record<string, unknown> {
  if (!organizationId) return {};
  return { organizationId };
}

// ---------------------------------------------------------------------------
//  Assign user to organization (org-admin or platform-admin action)
// ---------------------------------------------------------------------------

export async function assignUserToOrg(userId: string, organizationId: string) {
  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.organization.findUnique({ where: { id: organizationId } }),
  ]);
  if (!user) throw notFound("User not found");
  if (!org) throw notFound("Organization not found");
  return db.user.update({
    where: { id: userId },
    data: { organizationId },
  });
}

// ---------------------------------------------------------------------------
//  Organization metrics
// ---------------------------------------------------------------------------

export async function organizationMetrics(organizationId: string) {
  const [users, customers, workers, branches, areas, bookings, revenue] = await Promise.all([
    db.user.count({ where: { organizationId } }),
    db.customer.count({ where: { organizationId } }),
    db.worker.count({ where: { organizationId, deletedAt: null } }),
    db.branch.count({ where: { organizationId } }),
    db.area.count({ where: { organizationId } }),
    db.booking.count({ where: { organizationId, deletedAt: null } }),
    db.paymentIntent.aggregate({
      where: { booking: { organizationId }, status: "succeeded" },
      _sum: { amountMinor: true },
    }),
  ]);
  return {
    users, customers, workers, branches, areas, bookings,
    revenueMinor: revenue._sum.amountMinor ?? 0,
  };
}
