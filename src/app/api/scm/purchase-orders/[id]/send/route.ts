import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { transitionPO } from "@/lib/modules/scm/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "scm:manage");
    const { id } = await ctx.params;
    return { purchaseOrder: await transitionPO(id, "send", session?.sub) };
  });
}
