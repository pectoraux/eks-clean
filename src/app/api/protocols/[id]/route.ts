import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { getProtocol } from "@/lib/modules/protocols/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "protocols:read");
    const { id } = await ctx.params;
    return { protocol: await getProtocol(id) };
  });
}
