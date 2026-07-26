import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, unauthorized, notFound, parseJson, badRequest } from "@/lib/utils/api";
import { z } from "zod";

const kycSchema = z.object({
  action: z.enum(["submit", "verify", "reject"]),
  documentUrl: z.string().optional(),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    const { id } = await ctx.params;
    const body = await parseJson(req, kycSchema);
    const worker = await db.worker.findUnique({ where: { id } });
    if (!worker) throw notFound();

    if (body.action === "submit") {
      if (!session) throw unauthorized();
      // Worker submits own KYC, or admin/manager submits on behalf
      const updated = await db.worker.update({
        where: { id },
        data: {
          kycStatus: "PENDING",
          kycSubmittedAt: new Date(),
          onboardingStep: "TRAINING",
        },
      });
      return { worker: updated };
    }
    // Verify/reject requires permission
    requirePerm(session, "workers:approve");
    if (body.action === "verify") {
      const updated = await db.worker.update({
        where: { id },
        data: { kycStatus: "VERIFIED", kycVerifiedAt: new Date(), onboardingStep: "EQUIPMENT" },
      });
      return { worker: updated };
    }
    if (body.action === "reject") {
      if (!body.reason) throw badRequest("Reason required for rejection");
      const updated = await db.worker.update({
        where: { id },
        data: { kycStatus: "REJECTED" },
      });
      return { worker: updated };
    }
    return { worker };
  });
}
