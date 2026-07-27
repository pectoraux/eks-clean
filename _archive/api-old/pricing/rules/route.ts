// Pricing rules — list + create
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createPricingRule, listPricingRules } from "@/lib/modules/pricing-engine/service";
import { z } from "zod";

const schema = z.object({
  organizationId: z.string(),
  serviceTypeId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  basePriceMinor: z.number().int().min(0),
  priceUnit: z.string().default("PER_HOUR"),
  priority: z.number().int().default(100),
  distanceBaseKm: z.number().default(10),
  distancePerKmMinor: z.number().int().default(0),
  urgencyMultiplier: z.number().default(1.5),
  demandMultiplier: z.number().default(1.0),
  scarcityMultiplier: z.number().default(1.0),
  subscriptionDiscount: z.number().default(0.1),
  promotionMultiplier: z.number().default(1.0),
  holidayMultiplier: z.number().default(2.0),
  nightSurchargeMinor: z.number().int().default(0),
  largePropertyMultiplier: z.number().default(1.2),
  largePropertyThreshold: z.number().default(200),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "analytics:read" as never);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    const serviceTypeId = url.searchParams.get("serviceTypeId") || undefined;
    if (!orgId) return { items: [] };
    return { items: await listPricingRules(orgId, serviceTypeId) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "services:manage" as never);
    const body = await parseJson(req, schema);
    return { rule: await createPricingRule(body) };
  });
}
