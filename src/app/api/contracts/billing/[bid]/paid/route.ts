import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { markBillingPaid } from "@/lib/modules/contracts/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ bid: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "contracts:manage");
    const { bid } = await ctx.params;
    return { billing: await markBillingPaid(bid) };
  });
}
