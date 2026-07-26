import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound } from "@/lib/utils/api";
import { transferPayoutToWorker } from "@/lib/modules/payments/service";
import { z } from "zod";

const payoutSchema = z.object({
  workerId: z.string(),
  amountMinor: z.number().int().min(1),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "payments:payout");
    const body = await parseJson(req, payoutSchema);
    return transferPayoutToWorker(body.workerId, body.amountMinor);
  });
}
