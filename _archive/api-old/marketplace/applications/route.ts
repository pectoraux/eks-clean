// Marketplace applications (future-ready, gated behind feature flag)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, forbidden, notFound } from "@/lib/utils/api";
import { isFeatureEnabled, FLAGS } from "@/lib/feature-flags";
import { getPaymentGateway } from "@/lib/payment/payswap-gateway";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const applySchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  password: z.string().min(8).default("EksClean123!"),
  skills: z.array(z.string()).default([]),
  serviceArea: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!(await isFeatureEnabled(FLAGS.MARKETPLACE_OPEN, session ? { role: session.role as never } : undefined))) {
      throw forbidden("Marketplace is not currently accepting applications");
    }
    const body = await parseJson(req, applySchema);
    const { hashPassword } = await import("@/lib/auth");
    const user = await db.user.create({
      data: {
        email: body.email,
        passwordHash: hashPassword(body.password),
        fullName: body.fullName,
        phone: body.phone,
        role: "WORKER",
        status: "PENDING",
      },
    });
    const worker = await db.worker.create({
      data: {
        userId: user.id,
        status: "PENDING",
        onboardingStep: "KYC",
        kycStatus: "NOT_SUBMITTED",
      },
      include: { user: true },
    });
    // Provision a Payswap connected account for marketplace payouts
    const gateway = getPaymentGateway();
    const acct = await gateway.createConnectedAccount({
      email: body.email,
      country: "GH",
      workerId: worker.id,
    });
    await db.worker.update({
      where: { id: worker.id },
      data: { payswapAccountId: acct.payswapAccountId },
    });
    await writeAudit({
      action: "marketplace.apply",
      resourceType: "Worker",
      resourceId: worker.id,
      after: { payswapAccountId: acct.payswapAccountId },
    });
    return { worker, onboardingUrl: acct.onboardingUrl };
  });
}
