/**
 * Eks-Clean protocol API: get a dynamic quote for a cleaning service
 * Uses the pricing models registered by the protocol
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { eksCleanProtocol } from "@/protocols/eks-clean";
import { z } from "zod";

export const maxDuration = 60;

const quoteSchema = z.object({
  organizationId: z.string(),
  capabilityCode: z.string(),
  durationHours: z.number().min(0.5).default(2),
  distanceKm: z.number().optional(),
  isUrgent: z.boolean().optional(),
  isSubscriber: z.boolean().optional(),
  isHoliday: z.boolean().optional(),
  propertySqM: z.number().optional(),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const body = await parseJson(req, quoteSchema);

    // Find the pricing model from the protocol definition
    const pricingModels = eksCleanProtocol.registerPricing();
    const model = pricingModels.find(p => p.capabilityCode === body.capabilityCode);
    if (!model) throw new Error("No pricing model for this capability");

    // Compute the quote using the protocol's pricing factors
    let basePrice = model.basePriceMinor * body.durationHours;
    let breakdown: Record<string, number> = { base: basePrice };

    for (const factor of model.factors) {
      if (factor.name === "distance" && body.distanceKm && body.distanceKm > 10) {
        const charge = (body.distanceKm - 10) * (factor.perKmCharge || 0);
        breakdown.distance = charge;
        basePrice += charge;
      }
      if (factor.name === "urgency" && body.isUrgent) {
        const charge = Math.round(breakdown.base * (factor.multiplier - 1));
        breakdown.urgency = charge;
        basePrice += charge;
      }
      if (factor.name === "demand" && body.isUrgent) {
        const charge = Math.round(breakdown.base * (factor.multiplier - 1));
        breakdown.demand = charge;
        basePrice += charge;
      }
      if (factor.name === "subscription" && body.isSubscriber) {
        const discount = Math.round(breakdown.base * (factor.discount || 0));
        breakdown.subscriptionDiscount = -discount;
        basePrice -= discount;
      }
      if (factor.name === "holiday" && body.isHoliday) {
        const charge = Math.round(breakdown.base * (factor.multiplier - 1));
        breakdown.holiday = charge;
        basePrice += charge;
      }
      if (factor.name === "largeProperty" && body.propertySqM && body.propertySqM > (factor.threshold || 200)) {
        const charge = Math.round(breakdown.base * (factor.multiplier - 1));
        breakdown.largeProperty = charge;
        basePrice += charge;
      }
    }

    return {
      capabilityCode: body.capabilityCode,
      breakdown,
      totalMinor: Math.max(0, basePrice),
      currency: "USD",
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  });
}
