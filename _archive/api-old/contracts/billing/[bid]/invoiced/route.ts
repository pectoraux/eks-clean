import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { markBillingInvoiced, markBillingPaid } from "@/lib/modules/contracts/service";
import { z } from "zod";

const schema = z.object({ invoiceId: z.string() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ bid: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "contracts:manage");
    const { bid } = await ctx.params;
    const body = await parseJson(req, schema);
    return { billing: await markBillingInvoiced(bid, body.invoiceId) };
  });
}
