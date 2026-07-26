import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, unauthorized, notFound, forbidden, parseJson, HttpError } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const approveSchema = z.object({
  action: z.enum(["approve", "suspend", "terminate", "reactivate"]),
  reason: z.string().max(500).optional(),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const { id } = await ctx.params;
    const worker = await db.worker.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, fullName: true, phone: true, status: true, role: true, lastLoginAt: true } },
        skills: true,
        certifications: true,
        trainingRecords: true,
        availabilities: true,
        inventoryItems: { include: { item: true } },
        _count: { select: { ratings: true, assignments: true, performanceReviews: true, qualityAudits: true } },
      },
    });
    if (!worker) throw notFound();
    if (session.role === "WORKER") {
      const w = await db.worker.findUnique({ where: { userId: session.sub } });
      if (w?.id !== id) throw forbidden();
    }
    return { worker };
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workers:approve");
    const { id } = await ctx.params;
    const body = await parseJson(req, approveSchema);
    const worker = await db.worker.findUnique({ where: { id } });
    if (!worker) throw notFound();

    let status = worker.status;
    if (body.action === "approve") {
      if (worker.kycStatus !== "VERIFIED") {
        throw new HttpError(400, "Worker KYC not verified", "KYC_REQUIRED");
      }
      status = "ACTIVE";
    } else if (body.action === "suspend") status = "SUSPENDED";
    else if (body.action === "terminate") status = "TERMINATED";
    else if (body.action === "reactivate") status = "ACTIVE";

    const updated = await db.worker.update({
      where: { id },
      data: { status, ...(body.action === "terminate" ? { terminationDate: new Date() } : {}) },
    });

    await writeAudit({
      action: `worker.${body.action}`,
      resourceType: "Worker",
      resourceId: id,
      after: { status },
    });
    return { worker: updated };
  });
}
