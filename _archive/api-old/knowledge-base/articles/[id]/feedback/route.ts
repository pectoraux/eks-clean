import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { recordFeedback } from "@/lib/modules/knowledge-base/service";
import { z } from "zod";

const schema = z.object({ helpful: z.boolean(), comment: z.string().max(500).optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "kb:read");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return recordFeedback(id, body.helpful, body.comment, session?.sub);
  });
}
