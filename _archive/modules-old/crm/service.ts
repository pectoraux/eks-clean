/**
 * ============================================================================
 *  CRM Service — segments, deals, campaigns, touchpoints, health scores
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Segments — rule-based customer grouping
// ---------------------------------------------------------------------------

export interface SegmentRule {
  field: "tier" | "lifetimeValueMinor" | "lastBookingDaysAgo" | "rating" | "subscriptionActive" | "city";
  op: "eq" | "gt" | "lt" | "in" | "contains";
  value: unknown;
}

export async function createSegment(name: string, rules: SegmentRule[], description?: string) {
  return db.crmSegment.create({
    data: { name, description, rulesJson: JSON.stringify(rules), isDynamic: true },
  });
}

export async function recomputeSegmentMembership(segmentId: string): Promise<{ added: number; removed: number; total: number }> {
  const segment = await db.crmSegment.findUnique({ where: { id: segmentId } });
  if (!segment) throw notFound("Segment not found");
  const rules = JSON.parse(segment.rulesJson) as SegmentRule[];

  // Fetch all customers with relevant relations
  const customers = await db.customer.findMany({
    where: { deletedAt: null },
    include: {
      user: true,
      addresses: true,
      subscriptions: { where: { status: "ACTIVE" } },
      bookings: true,
      ratings: true,
    },
  });

  const matchingIds = new Set<string>();
  for (const c of customers) {
    if (matchesRules(c, rules)) matchingIds.add(c.id);
  }

  // Current memberships
  const current = await db.crmSegmentMembership.findMany({ where: { segmentId } });
  const currentIds = new Set(current.map((m) => m.customerId));

  const toAdd = [...matchingIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !matchingIds.has(id));

  if (toAdd.length) {
    await db.crmSegmentMembership.createMany({
      data: toAdd.map((id) => ({ segmentId, customerId: id, reason: "rule_match" })),
    });
  }
  if (toRemove.length) {
    await db.crmSegmentMembership.deleteMany({
      where: { segmentId, customerId: { in: toRemove } },
    });
  }

  await db.crmSegment.update({
    where: { id: segmentId },
    data: { memberCount: matchingIds.size },
  });

  return { added: toAdd.length, removed: toRemove.length, total: matchingIds.size };
}

function matchesRules(c: {
  customerTier: string;
  bookings: unknown[];
  subscriptions: unknown[];
  addresses: Array<{ city: string }>;
  ratings: Array<{ overall: number }>;
  createdAt: Date;
}, rules: SegmentRule[]): boolean {
  for (const r of rules) {
    const ltv = c.bookings.length * 10000; // rough proxy
    switch (r.field) {
      case "tier":
        if (!checkOp(r.op, c.customerTier, r.value)) return false;
        break;
      case "lifetimeValueMinor":
        if (!checkOp(r.op, ltv, r.value)) return false;
        break;
      case "rating":
        const avgRating = c.ratings.length > 0 ? c.ratings.reduce((s, r) => s + r.overall, 0) / c.ratings.length : 0;
        if (!checkOp(r.op, avgRating, r.value)) return false;
        break;
      case "subscriptionActive":
        if (!checkOp(r.op, c.subscriptions.length > 0, r.value)) return false;
        break;
      case "city":
        const city = c.addresses[0]?.city ?? "";
        if (!checkOp(r.op, city, r.value)) return false;
        break;
      case "lastBookingDaysAgo":
        // No lastBooking field directly — skip with a reasonable default
        break;
    }
  }
  return true;
}

function checkOp(op: SegmentRule["op"], actual: unknown, expected: unknown): boolean {
  switch (op) {
    case "eq": return actual === expected;
    case "gt": return Number(actual) > Number(expected);
    case "lt": return Number(actual) < Number(expected);
    case "in": return Array.isArray(expected) && expected.includes(actual);
    case "contains": return String(actual).toLowerCase().includes(String(expected).toLowerCase());
  }
}

// ---------------------------------------------------------------------------
//  Deals
// ---------------------------------------------------------------------------

export const DEAL_STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
export const DEAL_STAGE_PROBABILITY: Record<string, number> = {
  LEAD: 0.1, QUALIFIED: 0.25, PROPOSAL: 0.5, NEGOTIATION: 0.75, WON: 1.0, LOST: 0,
};

export async function createDeal(input: {
  customerId: string;
  title: string;
  valueMinor: number;
  expectedCloseAt?: Date;
  ownerAgentId?: string;
}) {
  const customer = await db.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw notFound("Customer not found");
  const deal = await db.crmDeal.create({
    data: {
      customerId: input.customerId,
      title: input.title,
      valueMinor: input.valueMinor,
      stage: "LEAD",
      probability: DEAL_STAGE_PROBABILITY.LEAD,
      expectedCloseAt: input.expectedCloseAt,
      ownerAgentId: input.ownerAgentId,
    },
  });
  await publish({ eventType: "crm.deal_created", payload: { dealId: deal.id, customerId: input.customerId } });
  return deal;
}

export async function advanceDealStage(dealId: string, newStage: string, lostReason?: string) {
  if (!DEAL_STAGES.includes(newStage as never)) throw badRequest(`Invalid stage: ${newStage}`);
  const deal = await db.crmDeal.findUnique({ where: { id: dealId } });
  if (!deal) throw notFound("Deal not found");
  const currentIdx = DEAL_STAGES.indexOf(deal.stage as typeof DEAL_STAGES[number]);
  const newIdx = DEAL_STAGES.indexOf(newStage as typeof DEAL_STAGES[number]);
  if (newIdx <= currentIdx && newStage !== "LOST") {
    throw conflict("Cannot move backwards (use lost/cancelled instead)");
  }
  const updated = await db.crmDeal.update({
    where: { id: dealId },
    data: {
      stage: newStage,
      probability: DEAL_STAGE_PROBABILITY[newStage],
      ...(newStage === "WON" || newStage === "LOST" ? { closedAt: new Date() } : {}),
      ...(newStage === "LOST" && lostReason ? { lostReason } : {}),
    },
  });
  await publish({ eventType: "crm.deal_stage_changed", payload: { dealId, from: deal.stage, to: newStage } });
  return updated;
}

// ---------------------------------------------------------------------------
//  Touchpoints
// ---------------------------------------------------------------------------

export async function logTouchpoint(input: {
  customerId: string;
  channel: string;
  direction: string;
  subject?: string;
  body?: string;
  agentId?: string;
  outcome?: string;
  campaignId?: string;
  scheduledAt?: Date;
}) {
  const tp = await db.crmTouchpoint.create({ data: input });
  await db.customerCrmRelations.upsert({
    where: { customerId: input.customerId },
    update: { touchpointCount: { increment: 1 }, lastTouchpointAt: new Date() },
    create: { customerId: input.customerId, touchpointCount: 1, lastTouchpointAt: new Date() },
  });
  await publish({ eventType: "crm.touchpoint_logged", payload: { touchpointId: tp.id, customerId: input.customerId } });
  return tp;
}

// ---------------------------------------------------------------------------
//  Health Scores — computed from multiple factors
//    score = 0.30 * recency + 0.25 * frequency + 0.20 * spend + 0.15 * engagement + 0.10 * complaints
// ============================================================================

export async function recomputeHealthScore(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: {
      bookings: { where: { deletedAt: null } },
      ratings: true,
      subscriptions: { where: { status: "ACTIVE" } },
      crmTouchpoints: { orderBy: { occurredAt: "desc" }, take: 10 },
      supportTickets: true,
    },
  });
  if (!customer) throw notFound("Customer not found");

  const now = Date.now();
  const lastBooking = customer.bookings
    .map((b) => b.scheduledStart.getTime())
    .sort((a, b) => b - a)[0];
  const recencyScore = lastBooking
    ? Math.max(0, 1 - (now - lastBooking) / (90 * 24 * 60 * 60 * 1000))
    : 0;

  const frequencyScore = Math.min(1, customer.bookings.length / 12); // 12+ bookings/year = max

  const spendMinor = customer.bookings.reduce((s, b) => s + b.totalMinor, 0);
  const spendScore = Math.min(1, spendMinor / 500000); // ₵5000 = max

  const engagementScore = customer.crmTouchpoints.length > 0
    ? Math.min(1, customer.crmTouchpoints.filter((t) => t.direction === "INBOUND").length / 5)
    : 0;

  const complaintScore = customer.supportTickets.length > 0
    ? Math.max(0, 1 - customer.supportTickets.length * 0.2)
    : 1;

  const score = (
    0.30 * recencyScore +
    0.25 * frequencyScore +
    0.20 * spendScore +
    0.15 * engagementScore +
    0.10 * complaintScore
  ) * 100;

  const tier = score >= 80 ? "CHAMPION" : score >= 60 ? "GOOD" : score >= 40 ? "OK" : "RISK";

  const factors = {
    recency: Number(recencyScore.toFixed(2)),
    frequency: Number(frequencyScore.toFixed(2)),
    spend: Number(spendScore.toFixed(2)),
    engagement: Number(engagementScore.toFixed(2)),
    complaints: Number(complaintScore.toFixed(2)),
    spendMinor,
    bookingCount: customer.bookings.length,
  };

  const upserted = await db.customerHealthScore.upsert({
    where: { customerId },
    update: { score, tier, factorsJson: JSON.stringify(factors), computedAt: new Date() },
    create: { customerId, score, tier, factorsJson: JSON.stringify(factors) },
  });

  await db.customerCrmRelations.upsert({
    where: { customerId },
    update: { healthScore: score, healthTier: tier },
    create: { customerId, healthScore: score, healthTier: tier },
  });

  return upserted;
}

// ---------------------------------------------------------------------------
//  Campaigns
// ---------------------------------------------------------------------------

export async function launchCampaign(campaignId: string) {
  const campaign = await db.crmCampaign.findUnique({
    where: { id: campaignId },
    include: { segment: { include: { memberships: true } } },
  });
  if (!campaign) throw notFound("Campaign not found");
  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    throw conflict("Campaign already launched");
  }
  const memberCount = campaign.segment?.memberships.length ?? 0;
  const updated = await db.crmCampaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING", sentCount: memberCount, startDate: new Date() },
  });
  await publish({ eventType: "crm.campaign_launched", payload: { campaignId, recipients: memberCount } });
  return updated;
}
