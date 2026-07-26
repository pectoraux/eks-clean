import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { approveTimeOff } from "@/lib/modules/workforce/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:timeoff:approve");
    const { id } = await ctx.params;
    return { request: await approveTimeOff(id, session!.sub) };
  });
}
