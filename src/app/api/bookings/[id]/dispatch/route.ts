import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, notFound } from "@/lib/utils/api";
import { autoDispatch, manualAssign } from "@/lib/modules/dispatch/service";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    const s = requirePerm(session, "dispatch:override");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({})) as { workerId?: string };
    let result;
    if (body.workerId) {
      result = await manualAssign(id, body.workerId, s.sub);
      await writeAudit({
        action: "dispatch.manual",
        resourceType: "Booking",
        resourceId: id,
        after: { workerId: body.workerId },
      });
    } else {
      result = await autoDispatch(id);
      await writeAudit({
        action: "dispatch.auto",
        resourceType: "Booking",
        resourceId: id,
        after: { chosen: result.chosen, offered: result.offered.length },
      });
    }
    return result;
  });
}
