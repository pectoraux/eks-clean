import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { transitionInstance } from "@/lib/modules/workflows/service";
import { z } from "zod";

const schema = z.object({
  transitionKey: z.string(),
  contextUpdate: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workflows:execute");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return transitionInstance(id, body.transitionKey, {
      id: session?.sub,
      type: session?.role,
    }, body.contextUpdate);
  });
}
