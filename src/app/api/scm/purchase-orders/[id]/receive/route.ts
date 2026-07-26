import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { receiveGoods } from "@/lib/modules/scm/service";
import { z } from "zod";

const schema = z.object({
  qualityCheckPassed: z.boolean().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    poLineId: z.string(),
    itemId: z.string(),
    quantityReceived: z.number().int().min(1),
    quantityRejected: z.number().int().optional(),
    rejectionReason: z.string().optional(),
  })),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "scm:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { receipt: await receiveGoods(id, {
      receivedBy: session?.sub ?? "system",
      qualityCheckPassed: body.qualityCheckPassed,
      notes: body.notes,
      lines: body.lines,
    }) };
  });
}
