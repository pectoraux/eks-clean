import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { advanceDealStage } from "@/lib/modules/crm/service";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  stage: z.string(),
  lostReason: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "crm:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    const deal = await advanceDealStage(id, body.stage, body.lostReason);
    await writeAudit({ action: "crm.deal_stage_change", resourceType: "CrmDeal", resourceId: id, after: body });
    return { deal };
  });
}
