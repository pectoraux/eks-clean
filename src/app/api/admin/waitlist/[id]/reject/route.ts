/**
 * Admin: reject a waitlist entry
 * POST /api/admin/waitlist/:id/reject
 *   body: { reason: string }
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound, conflict, badRequest, auditCtx } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const rejectSchema = z.object({
  reason: z.string().min(1).max(500),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "admin:users");
    const { id } = await ctx.params;
    const body = await parseJson(req, rejectSchema);
    if (!body.reason) throw badRequest("Rejection reason required");

    const entry = await db.waitlistEntry.findUnique({ where: { id } });
    if (!entry) throw notFound("Waitlist entry not found");
    if (entry.status === "APPROVED") throw conflict("Already approved — cannot reject");

    const updated = await db.waitlistEntry.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: body.reason,
        reviewedBy: session!.sub,
        reviewedAt: new Date(),
      },
    });

    await writeAudit({
      ctx: auditCtx(req, session),
      action: "waitlist.reject",
      resourceType: "WaitlistEntry",
      resourceId: id,
      after: { reason: body.reason },
    });

    return { entry: updated };
  });
}
