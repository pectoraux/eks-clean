import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { assessSkill } from "@/lib/modules/workforce/service";
import { z } from "zod";

const schema = z.object({
  workerId: z.string(),
  level: z.number().int().min(1).max(10),
  notes: z.string().optional(),
  evidence: z.string().optional(),
  expiresAt: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:performance:review");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { assessment: await assessSkill({
      skillId: id,
      workerId: body.workerId,
      level: body.level,
      notes: body.notes,
      evidence: body.evidence,
      assessorId: session?.sub,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    }) };
  });
}
