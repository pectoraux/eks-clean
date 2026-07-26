// Render a prompt template (returns the prepared prompt — does NOT call the model)
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { renderPrompt } from "@/lib/modules/ai-ready/service";
import { z } from "zod";

const schema = z.object({ variables: z.record(z.string(), z.any()).default({}) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:runs:read");
    const { key } = await ctx.params;
    const body = await parseJson(req, schema);
    return renderPrompt(key, body.variables);
  });
}
