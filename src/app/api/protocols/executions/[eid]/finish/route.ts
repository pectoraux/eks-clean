import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { finishExecution } from "@/lib/modules/protocols/service";
import { z } from "zod";

const schema = z.object({ customerFeedback: z.string().optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ eid: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "protocols:execute");
    const { eid } = await ctx.params;
    const body = await parseJson(req, schema);
    return { execution: await finishExecution(eid, body.customerFeedback) };
  });
}
