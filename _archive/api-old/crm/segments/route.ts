// CRM Segments — list + create
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, auditCtx } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { createSegment, createDeal, logTouchpoint } from "@/lib/modules/crm/service";
import { db } from "@/lib/db";
import { z } from "zod";

const segmentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  rules: z.array(z.object({
    field: z.enum(["tier", "lifetimeValueMinor", "lastBookingDaysAgo", "rating", "subscriptionActive", "city"]),
    op: z.enum(["eq", "gt", "lt", "in", "contains"]),
    value: z.unknown(),
  })),
});

const dealSchema = z.object({
  customerId: z.string(),
  title: z.string(),
  valueMinor: z.number().int().min(0),
  expectedCloseAt: z.string().optional(),
  ownerAgentId: z.string().optional(),
});

const touchpointSchema = z.object({
  customerId: z.string(),
  channel: z.string(),
  direction: z.enum(["OUTBOUND", "INBOUND"]),
  subject: z.string().optional(),
  body: z.string().optional(),
  agentId: z.string().optional(),
  outcome: z.string().optional(),
  campaignId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "crm:read");
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "segments";
    if (type === "segments") {
      const items = await db.crmSegment.findMany({ include: { _count: { select: { memberships: true, campaigns: true } } }, orderBy: { createdAt: "desc" } });
      return { items };
    }
    if (type === "deals") {
      const items = await db.crmDeal.findMany({ include: { customer: { include: { user: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
      return { items };
    }
    if (type === "touchpoints") {
      const items = await db.crmTouchpoint.findMany({ include: { customer: { include: { user: true } } }, orderBy: { occurredAt: "desc" }, take: 50 });
      return { items };
    }
    if (type === "campaigns") {
      const items = await db.crmCampaign.findMany({ include: { segment: true }, orderBy: { createdAt: "desc" } });
      return { items };
    }
    if (type === "health") {
      const items = await db.customerHealthScore.findMany({
        include: { customer: { include: { user: true } } },
        orderBy: { score: "asc" },
        take: 50,
      });
      return { items };
    }
    return { items: [] };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "crm:manage");
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "segments";

    if (type === "segments") {
      const body = await parseJson(req, segmentSchema);
      const seg = await createSegment(body.name, body.rules, body.description);
      await writeAudit({ ctx: auditCtx(req, session), action: "crm.segment_create", resourceType: "CrmSegment", resourceId: seg.id });
      return { segment: seg };
    }
    if (type === "deals") {
      const body = await parseJson(req, dealSchema);
      const deal = await createDeal({
        customerId: body.customerId,
        title: body.title,
        valueMinor: body.valueMinor,
        expectedCloseAt: body.expectedCloseAt ? new Date(body.expectedCloseAt) : undefined,
        ownerAgentId: body.ownerAgentId,
      });
      await writeAudit({ ctx: auditCtx(req, session), action: "crm.deal_create", resourceType: "CrmDeal", resourceId: deal.id });
      return { deal };
    }
    if (type === "touchpoints") {
      const body = await parseJson(req, touchpointSchema);
      const tp = await logTouchpoint(body);
      await writeAudit({ ctx: auditCtx(req, session), action: "crm.touchpoint_log", resourceType: "CrmTouchpoint", resourceId: tp.id });
      return { touchpoint: tp };
    }
    return { error: "Unsupported type" };
  });
}
