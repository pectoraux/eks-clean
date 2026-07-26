import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { recordInspection } from "@/lib/modules/fleet/service";
import { z } from "zod";

const schema = z.object({
  passed: z.boolean(),
  defects: z.array(z.object({ component: z.string(), severity: z.string(), description: z.string() })).optional(),
  photoUrls: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "fleet:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { inspection: await recordInspection(id, { ...body, inspectedBy: session?.sub }) };
  });
}
