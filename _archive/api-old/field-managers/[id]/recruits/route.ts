// Field Manager: recruit a worker (creates a pending worker)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";

const recruitSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  password: z.string().min(8).default("EksClean123!"),
  region: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "field_managers:recruit");
    const { id } = await ctx.params;
    const fm = await db.fieldManager.findUnique({ where: { id } });
    if (!fm) throw notFound();
    const body = await parseJson(req, recruitSchema);

    const user = await db.user.create({
      data: {
        email: body.email,
        fullName: body.fullName,
        phone: body.phone,
        passwordHash: hashPassword(body.password),
        role: "WORKER",
        status: "ACTIVE",
      },
    });
    const worker = await db.worker.create({
      data: {
        userId: user.id,
        status: "PENDING",
        onboardingStep: "PROFILE",
        kycStatus: "NOT_SUBMITTED",
      },
      include: { user: true },
    });

    await writeAudit({
      action: "field_manager.recruit",
      resourceType: "Worker",
      resourceId: worker.id,
      after: { recruitedBy: session.sub, fieldManagerId: id },
    });
    return { worker };
  });
}
