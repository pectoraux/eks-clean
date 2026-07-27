/**
 * ============================================================================
 *  Dynamic Pricing Engine
 * ============================================================================
 *  Computes a quote from:
 *    base × distance × urgency × demand × scarcity × subscriptionDiscount
 *        × promotion × holiday × nightSurcharge × largeProperty
 *
 *  Every factor is transparent and stored in a PricingQuote for audit.
 *  This is the "Stripe of Household Services" pricing layer — every quote
 *  is explainable, and pricing rules are configurable per org + service.
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, badRequest } from "@/lib/utils/api";
import { haversineKm } from "@/lib/modules/geographic/service";

// ---------------------------------------------------------------------------
//  Pricing rule CRUD
// ---------------------------------------------------------------------------

export async function createPricingRule(input: {
  organizationId: string;
  serviceTypeId: string;
  name: string;
  description?: string;
  basePriceMinor: number;
  priceUnit?: string;
  priority?: number;
  distanceBaseKm?: number;
  distancePerKmMinor?: number;
  urgencyMultiplier?: number;
  demandMultiplier?: number;
  scarcityMultiplier?: number;
  subscriptionDiscount?: number;
  promotionMultiplier?: number;
  holidayMultiplier?: number;
  nightSurchargeMinor?: number;
  largePropertyMultiplier?: number;
  largePropertyThreshold?: number;
  validFrom?: Date;
  validTo?: Date;
}) {
  return db.pricingRule.create({ data: input });
}

export async function listPricingRules(organizationId: string, serviceTypeId?: string) {
  return db.pricingRule.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(serviceTypeId ? { serviceTypeId } : {}),
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });
}

// ---------------------------------------------------------------------------
//  Core pricing computation
// ============================================================================

export interface PricingInput {
  organizationId: string;
  serviceTypeId: string;
  durationHours: number;
  // Distance
  distanceKm?: number;
  // Urgency
  isUrgent?: boolean;          // same-day / next-day
  // Demand
  zoneDemandScore?: number;    // 0..1 from GeoZone.demandScore
  // Scarcity
  workerScarcityScore?: number; // 0..1 (1 = no workers available)
  // Subscription
  isSubscriber?: boolean;
  // Promotion
  promotionMultiplier?: number;
  // Holiday
  isHoliday?: boolean;
  // Night
  isNightJob?: boolean;
  // Property size
  propertySqM?: number;
}

export interface PricingBreakdown {
  basePriceMinor: number;
  distanceChargeMinor: number;
  urgencyChargeMinor: number;
  demandChargeMinor: number;
  scarcityChargeMinor: number;
  subscriptionDiscountMinor: number;
  promotionDiscountMinor: number;
  holidayChargeMinor: number;
  nightSurchargeMinor: number;
  largePropertyChargeMinor: number;
  finalPriceMinor: number;
  currency: string;
  factors: {
    distanceKm?: number;
    isUrgent: boolean;
    zoneDemandScore?: number;
    workerScarcityScore?: number;
    isSubscriber: boolean;
    promotionMultiplier?: number;
    isHoliday: boolean;
    isNightJob: boolean;
    propertySqM?: number;
  };
}

export async function computeQuote(input: PricingInput): Promise<PricingBreakdown> {
  // Find the best pricing rule for this org + service
  const rule = await db.pricingRule.findFirst({
    where: {
      organizationId: input.organizationId,
      serviceTypeId: input.serviceTypeId,
      isActive: true,
      OR: [
        { validFrom: null, validTo: null },
        { validFrom: { lte: new Date() }, validTo: null },
        { validFrom: null, validTo: { gte: new Date() } },
        { validFrom: { lte: new Date() }, validTo: { gte: new Date() } },
      ],
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  if (!rule) throw notFound("No pricing rule found for this service");

  // Get org currency
  const org = await db.organization.findUnique({ where: { id: input.organizationId }, select: { currency: true } });
  const currency = org?.currency ?? "GHS";

  // 1. Base price
  const basePriceMinor = Math.round(rule.basePriceMinor * input.durationHours);

  // 2. Distance charge (per km beyond base radius)
  let distanceChargeMinor = 0;
  if (input.distanceKm && input.distanceKm > rule.distanceBaseKm) {
    const extraKm = input.distanceKm - rule.distanceBaseKm;
    distanceChargeMinor = Math.round(extraKm * rule.distancePerKmMinor);
  }

  // 3. Urgency charge (multiplier on base + distance)
  const urgencyMultiplier = input.isUrgent ? rule.urgencyMultiplier : 1.0;
  const urgencyChargeMinor = Math.round((basePriceMinor + distanceChargeMinor) * (urgencyMultiplier - 1.0));

  // 4. Demand charge (based on zone demand score)
  const demandMultiplier = input.zoneDemandScore != null
    ? 1.0 + (input.zoneDemandScore * (rule.demandMultiplier - 1.0))
    : 1.0;
  const demandChargeMinor = Math.round(basePriceMinor * (demandMultiplier - 1.0));

  // 5. Scarcity charge (worker scarcity)
  const scarcityMultiplier = input.workerScarcityScore != null
    ? 1.0 + (input.workerScarcityScore * (rule.scarcityMultiplier - 1.0))
    : 1.0;
  const scarcityChargeMinor = Math.round(basePriceMinor * (scarcityMultiplier - 1.0));

  // 6. Subscription discount
  const subscriptionDiscountMinor = input.isSubscriber
    ? Math.round(basePriceMinor * rule.subscriptionDiscount)
    : 0;

  // 7. Promotion discount
  const promoMult = input.promotionMultiplier ?? rule.promotionMultiplier;
  const promotionDiscountMinor = promoMult < 1.0
    ? Math.round(basePriceMinor * (1.0 - promoMult))
    : 0;

  // 8. Holiday charge
  const holidayChargeMinor = input.isHoliday
    ? Math.round(basePriceMinor * (rule.holidayMultiplier - 1.0))
    : 0;

  // 9. Night surcharge (flat)
  const nightSurchargeMinor = input.isNightJob ? rule.nightSurchargeMinor : 0;

  // 10. Large property charge
  let largePropertyChargeMinor = 0;
  if (input.propertySqM && input.propertySqM > rule.largePropertyThreshold) {
    largePropertyChargeMinor = Math.round(basePriceMinor * (rule.largePropertyMultiplier - 1.0));
  }

  // Sum: start with base, add all charges, subtract discounts
  const finalPriceMinor = Math.max(0,
    basePriceMinor +
    distanceChargeMinor +
    urgencyChargeMinor +
    demandChargeMinor +
    scarcityChargeMinor +
    holidayChargeMinor +
    nightSurchargeMinor +
    largePropertyChargeMinor -
    subscriptionDiscountMinor -
    promotionDiscountMinor,
  );

  return {
    basePriceMinor,
    distanceChargeMinor,
    urgencyChargeMinor,
    demandChargeMinor,
    scarcityChargeMinor,
    subscriptionDiscountMinor,
    promotionDiscountMinor,
    holidayChargeMinor,
    nightSurchargeMinor,
    largePropertyChargeMinor,
    finalPriceMinor,
    currency,
    factors: {
      distanceKm: input.distanceKm,
      isUrgent: input.isUrgent ?? false,
      zoneDemandScore: input.zoneDemandScore,
      workerScarcityScore: input.workerScarcityScore,
      isSubscriber: input.isSubscriber ?? false,
      promotionMultiplier: input.promotionMultiplier,
      isHoliday: input.isHoliday ?? false,
      isNightJob: input.isNightJob ?? false,
      propertySqM: input.propertySqM,
    },
  };
}

// ---------------------------------------------------------------------------
//  Persist a quote
// ---------------------------------------------------------------------------

export async function saveQuote(input: PricingInput & { customerId?: string; propertyId?: string; bookingId?: string }) {
  const breakdown = await computeQuote(input);
  const quote = await db.pricingQuote.create({
    data: {
      organizationId: input.organizationId,
      customerId: input.customerId,
      serviceTypeId: input.serviceTypeId,
      propertyId: input.propertyId,
      bookingId: input.bookingId,
      ...breakdown,
      breakdownJson: JSON.stringify(breakdown),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h validity
    },
  });
  await publish({ eventType: "pricing.quote_created", payload: { quoteId: quote.id, finalPriceMinor: breakdown.finalPriceMinor } });
  return { quote, breakdown };
}

// ---------------------------------------------------------------------------
//  Pricing metrics
// ---------------------------------------------------------------------------

export async function pricingMetrics(organizationId: string) {
  const [totalRules, activeRules, totalQuotes, avgQuoteValue] = await Promise.all([
    db.pricingRule.count({ where: { organizationId } }),
    db.pricingRule.count({ where: { organizationId, isActive: true } }),
    db.pricingQuote.count({ where: { organizationId } }),
    db.pricingQuote.aggregate({ where: { organizationId }, _avg: { finalPriceMinor: true } }),
  ]);
  return {
    totalRules,
    activeRules,
    totalQuotes,
    avgQuoteValueMinor: avgQuoteValue._avg.finalPriceMinor ?? 0,
  };
}
