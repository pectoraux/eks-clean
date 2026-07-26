import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { transitionContract } from "@/lib/modules/contracts/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "contracts:manage");
    const { id } = await ctx.params;
    return { contract: await transitionContract(id, "send", session?.sub) };
  });
}
