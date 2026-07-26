import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { completeStep } from "@/lib/modules/protocols/service";
import { z } from "zod";

const schema = z.object({
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
  deviationFlag: z.boolean().optional(),
  deviationReason: z.string().optional(),
  checklistResults: z.array(z.object({ item: z.string(), passed: z.boolean() })).optional(),
  actualDurationMin: z.number().int().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ eid: string; sid: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "protocols:execute");
    const { eid, sid } = await ctx.params;
    const body = await parseJson(req, schema);
    return { stepExecution: await completeStep(eid, sid, body) };
  });
}
