// Approve a marketplace application
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, notFound, forbidden } from "@/lib/utils/api";
import { isFeatureEnabled, FLAGS } from "@/lib/feature-flags";
import { writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "marketplace:approve");
    if (!(await isFeatureEnabled(FLAGS.MARKETPLACE_OPEN, { role: "ADMIN" }))) {
      throw forbidden("Marketplace not enabled");
    }
    const { id } = await ctx.params;
    const worker = await db.worker.findUnique({ where: { id } });
    if (!worker) throw notFound();
    const updated = await db.worker.update({
      where: { id },
      data: { status: "ACTIVE", kycStatus: "VERIFIED", kycVerifiedAt: new Date() },
    });
    await db.user.update({
      where: { id: worker.userId },
      data: { status: "ACTIVE" },
    });
    await writeAudit({
      action: "marketplace.approve",
      resourceType: "Worker",
      resourceId: id,
    });
    return { worker: updated };
  });
}
