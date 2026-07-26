/**
 * Admin: approve a waitlist entry — materialises the User + role profile
 * POST /api/admin/waitlist/:id/approve
 *   body: { overrideRole?: "CUSTOMER"|"WORKER"|"SALES_AGENT"|"FIELD_MANAGER", notes?: string }
 *
 * Idempotent: re-approving an APPROVED entry is a no-op.
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound, conflict, auditCtx } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const approveSchema = z.object({
  overrideRole: z.enum(["CUSTOMER", "WORKER", "SALES_AGENT", "FIELD_MANAGER"]).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "admin:users");
    const { id } = await ctx.params;
    const body = await parseJson(req, approveSchema);

    const entry = await db.waitlistEntry.findUnique({ where: { id } });
    if (!entry) throw notFound("Waitlist entry not found");
    if (entry.status === "APPROVED") {
      throw conflict("Already approved");
    }

    const role = body.overrideRole ?? entry.requestedRole;

    // Idempotency: if a User already exists for this email (race), reuse it
    const existingUser = await db.user.findUnique({ where: { email: entry.email } });
    let user;
    if (existingUser) {
      user = existingUser;
    } else {
      user = await db.user.create({
        data: {
          email: entry.email,
          passwordHash: entry.passwordHash, // already hashed at submission
          fullName: entry.fullName,
          phone: entry.phone,
          role,
          status: "ACTIVE",
        },
      });
    }

    // Provision role-specific profile (idempotent — check first)
    if (role === "CUSTOMER") {
      const has = await db.customer.findUnique({ where: { userId: user.id } });
      if (!has) await db.customer.create({ data: { userId: user.id } });
    } else if (role === "WORKER") {
      const has = await db.worker.findUnique({ where: { userId: user.id } });
      if (!has) await db.worker.create({ data: { userId: user.id, onboardingStep: "PROFILE", kycStatus: "NOT_SUBMITTED" } });
    } else if (role === "SALES_AGENT") {
      const has = await db.salesAgent.findUnique({ where: { userId: user.id } });
      if (!has) {
        const code = `EKS-${user.id.slice(0, 6).toUpperCase()}`;
        await db.salesAgent.create({ data: { userId: user.id, referralCode: code } });
      }
    } else if (role === "FIELD_MANAGER") {
      const has = await db.fieldManager.findUnique({ where: { userId: user.id } });
      if (!has) await db.fieldManager.create({ data: { userId: user.id } });
    }

    // Mark entry as approved
    const updated = await db.waitlistEntry.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedBy: session!.sub,
        reviewedAt: new Date(),
        notes: body.notes,
      },
    });

    await writeAudit({
      ctx: auditCtx(req, session),
      action: "waitlist.approve",
      resourceType: "WaitlistEntry",
      resourceId: id,
      after: { email: entry.email, role, userId: user.id },
    });

    return {
      entry: updated,
      user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    };
  });
}
