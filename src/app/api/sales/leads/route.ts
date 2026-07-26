// Sales leads API
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, unauthorized, notFound } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  address: z.string().optional(),
  source: z.enum(["DOOR_TO_DOOR", "REFERRAL", "SOCIAL", "OTHER"]).default("DOOR_TO_DOOR"),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;

    let where: Record<string, unknown> = {};
    if (session.role === "SALES_AGENT") {
      const a = await db.salesAgent.findUnique({ where: { userId: session.sub } });
      if (!a) throw notFound();
      where.salesAgentId = a.id;
    }
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      db.lead.findMany({
        where,
        include: { salesAgent: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.lead.count({ where }),
    ]);
    return { items, total };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "sales:leads:manage");
    const body = await parseJson(req, leadSchema);
    let salesAgentId: string | undefined;
    if (session.role === "SALES_AGENT") {
      const a = await db.salesAgent.findUnique({ where: { userId: session.sub } });
      salesAgentId = a?.id;
    }
    const lead = await db.lead.create({
      data: { ...body, salesAgentId, status: "NEW" },
    });
    if (salesAgentId) {
      await db.salesAgent.update({
        where: { id: salesAgentId },
        data: { totalLeads: { increment: 1 } },
      });
    }
    await writeAudit({
      action: "sales.lead_create",
      resourceType: "Lead",
      resourceId: lead.id,
    });
    return { lead };
  });
}
