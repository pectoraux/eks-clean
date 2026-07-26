import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { denyTimeOff } from "@/lib/modules/workforce/service";
import { z } from "zod";

const schema = z.object({ denialReason: z.string().min(1).max(500) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:timeoff:approve");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { request: await denyTimeOff(id, session!.sub, body.denialReason) };
  });
}
