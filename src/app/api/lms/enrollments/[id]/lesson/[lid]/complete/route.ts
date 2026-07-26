import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { markLessonComplete } from "@/lib/modules/lms/service";
import { z } from "zod";

const schema = z.object({ scorePercent: z.number().min(0).max(100).optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; lid: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "lms:enroll");
    const { id, lid } = await ctx.params;
    const body = await parseJson(req, schema);
    return { ok: await markLessonComplete(id, lid, body.scorePercent) };
  });
}
