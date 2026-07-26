/**
 * ============================================================================
 *  Eks-Clean — Audit Log
 * ============================================================================
 *  Every state-changing API call writes an audit entry:
 *    { actor, action, resourceType, resourceId, before, after, outcome }
 *  Soft-deleted records are kept; entries are append-only and never deleted.
 * ============================================================================
 */

import { db } from "@/lib/db";
import type { AuditContext } from "@/lib/types";

export async function writeAudit(args: {
  ctx?: AuditContext;
  action: string;
  resourceType?: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  outcome?: "SUCCESS" | "FAILURE" | "DENIED";
  reason?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: args.ctx?.userId,
        action: args.action,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        beforeJson: args.before ? JSON.stringify(args.before) : null,
        afterJson: args.after ? JSON.stringify(args.after) : null,
        ipAddress: args.ctx?.ipAddress,
        userAgent: args.ctx?.userAgent,
        outcome: args.outcome ?? "SUCCESS",
        reason: args.reason,
      },
    });
  } catch (e) {
    console.error("[audit] write failed", args.action, e);
  }
}
