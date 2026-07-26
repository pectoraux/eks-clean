import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { assignPayGrade } from "@/lib/modules/workforce/service";
import { z } from "zod";

const schema = z.object({ workerId: z.string() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:paygrades:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { assignment: await assignPayGrade(body.workerId, id, session?.sub) };
  });
}
