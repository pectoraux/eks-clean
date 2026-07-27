import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { resolvePrediction } from "@/lib/modules/ai-ready/service";
import { z } from "zod";

const schema = z.object({ actualValue: z.number() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:prompts:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { prediction: await resolvePrediction(id, body.actualValue) };
  });
}
