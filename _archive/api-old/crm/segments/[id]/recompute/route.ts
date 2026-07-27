import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { recomputeSegmentMembership } from "@/lib/modules/crm/service";
import { writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "crm:manage");
    const { id } = await ctx.params;
    const result = await recomputeSegmentMembership(id);
    await writeAudit({ action: "crm.segment_recompute", resourceType: "CrmSegment", resourceId: id, after: result });
    return result;
  });
}
