import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { launchCampaign } from "@/lib/modules/crm/service";
import { writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "crm:campaigns:manage");
    const { id } = await ctx.params;
    const campaign = await launchCampaign(id);
    await writeAudit({ action: "crm.campaign_launch", resourceType: "CrmCampaign", resourceId: id });
    return { campaign };
  });
}
