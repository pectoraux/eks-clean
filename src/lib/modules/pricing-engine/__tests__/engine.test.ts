/**
 * Dynamic Pricing Engine — pure-logic unit tests
 *  - All 10 pricing factors, transparency of breakdown
 */
import { describe, it, expect } from "bun:test";

// Mirror of computeQuote logic (simplified, no DB)
interface PricingRule {
  basePriceMinor: number;
  distanceBaseKm: number;
  distancePerKmMinor: number;
  urgencyMultiplier: number;
  demandMultiplier: number;
  scarcityMultiplier: number;
  subscriptionDiscount: number;
  promotionMultiplier: number;
  holidayMultiplier: number;
  nightSurchargeMinor: number;
  largePropertyMultiplier: number;
  largePropertyThreshold: number;
}

interface PricingInput {
  durationHours: number;
  distanceKm?: number;
  isUrgent?: boolean;
  zoneDemandScore?: number;
  workerScarcityScore?: number;
  isSubscriber?: boolean;
  promotionMultiplier?: number;
  isHoliday?: boolean;
  isNightJob?: boolean;
  propertySqM?: number;
}

function computeQuotePure(rule: PricingRule, input: PricingInput) {
  const base = Math.round(rule.basePriceMinor * input.durationHours);
  let distance = 0;
  if (input.distanceKm && input.distanceKm > rule.distanceBaseKm) {
    distance = Math.round((input.distanceKm - rule.distanceBaseKm) * rule.distancePerKmMinor);
  }
  const urgency = input.isUrgent ? Math.round((base + distance) * (rule.urgencyMultiplier - 1.0)) : 0;
  const demand = input.zoneDemandScore != null ? Math.round(base * (input.zoneDemandScore * (rule.demandMultiplier - 1.0))) : 0;
  const scarcity = input.workerScarcityScore != null ? Math.round(base * (input.workerScarcityScore * (rule.scarcityMultiplier - 1.0))) : 0;
  const subDiscount = input.isSubscriber ? Math.round(base * rule.subscriptionDiscount) : 0;
  const promoMult = input.promotionMultiplier ?? rule.promotionMultiplier;
  const promoDiscount = promoMult < 1.0 ? Math.round(base * (1.0 - promoMult)) : 0;
  const holiday = input.isHoliday ? Math.round(base * (rule.holidayMultiplier - 1.0)) : 0;
  const night = input.isNightJob ? rule.nightSurchargeMinor : 0;
  let largeProperty = 0;
  if (input.propertySqM && input.propertySqM > rule.largePropertyThreshold) {
    largeProperty = Math.round(base * (rule.largePropertyMultiplier - 1.0));
  }
  const final = Math.max(0, base + distance + urgency + demand + scarcity + holiday + night + largeProperty - subDiscount - promoDiscount);
  return { base, distance, urgency, demand, scarcity, subDiscount, promoDiscount, holiday, night, largeProperty, final };
}

describe("Dynamic Pricing Engine", () => {
  const rule: PricingRule = {
    basePriceMinor: 5000, // ₵50/hour
    distanceBaseKm: 10,
    distancePerKmMinor: 500, // ₵5/km
    urgencyMultiplier: 1.5,
    demandMultiplier: 1.3,
    scarcityMultiplier: 1.4,
    subscriptionDiscount: 0.1,
    promotionMultiplier: 1.0,
    holidayMultiplier: 2.0,
    nightSurchargeMinor: 2000,
    largePropertyMultiplier: 1.2,
    largePropertyThreshold: 200,
  };

  it("computes base price from duration", () => {
    const q = computeQuotePure(rule, { durationHours: 3 });
    expect(q.base).toBe(15000); // 5000 × 3
    expect(q.final).toBe(15000);
  });

  it("charges distance beyond base radius", () => {
    const q = computeQuotePure(rule, { durationHours: 2, distanceKm: 25 });
    // base = 10000, distance = (25-10) × 500 = 7500
    expect(q.distance).toBe(7500);
    expect(q.final).toBe(17500);
  });

  it("does not charge distance within base radius", () => {
    const q = computeQuotePure(rule, { durationHours: 2, distanceKm: 8 });
    expect(q.distance).toBe(0);
  });

  it("applies urgency multiplier", () => {
    const q = computeQuotePure(rule, { durationHours: 2, isUrgent: true });
    // urgency = 10000 × 0.5 = 5000
    expect(q.urgency).toBe(5000);
    expect(q.final).toBe(15000);
  });

  it("applies demand charge based on zone demand score", () => {
    const q = computeQuotePure(rule, { durationHours: 2, zoneDemandScore: 1.0 });
    // demand = 10000 × (1.0 × 0.3) = 3000
    expect(q.demand).toBe(3000);
  });

  it("applies scarcity charge", () => {
    const q = computeQuotePure(rule, { durationHours: 2, workerScarcityScore: 1.0 });
    // scarcity = 10000 × (1.0 × 0.4) = 4000
    expect(q.scarcity).toBe(4000);
  });

  it("applies subscription discount", () => {
    const q = computeQuotePure(rule, { durationHours: 2, isSubscriber: true });
    // subDiscount = 10000 × 0.1 = 1000
    expect(q.subDiscount).toBe(1000);
    expect(q.final).toBe(9000);
  });

  it("applies promotion discount", () => {
    const q = computeQuotePure(rule, { durationHours: 2, promotionMultiplier: 0.9 });
    // promoDiscount = 10000 × 0.1 = 1000
    expect(q.promoDiscount).toBe(1000);
  });

  it("applies holiday multiplier", () => {
    const q = computeQuotePure(rule, { durationHours: 2, isHoliday: true });
    // holiday = 10000 × 1.0 = 10000
    expect(q.holiday).toBe(10000);
  });

  it("applies night surcharge", () => {
    const q = computeQuotePure(rule, { durationHours: 2, isNightJob: true });
    expect(q.night).toBe(2000);
  });

  it("applies large property multiplier", () => {
    const q = computeQuotePure(rule, { durationHours: 2, propertySqM: 300 });
    // largeProperty = 10000 × 0.2 = 2000
    expect(q.largeProperty).toBe(2000);
  });

  it("does not apply large property charge below threshold", () => {
    const q = computeQuotePure(rule, { durationHours: 2, propertySqM: 150 });
    expect(q.largeProperty).toBe(0);
  });

  it("combines all factors correctly", () => {
    const q = computeQuotePure(rule, {
      durationHours: 3, distanceKm: 20, isUrgent: true, zoneDemandScore: 0.8,
      workerScarcityScore: 0.5, isSubscriber: true, isHoliday: false, isNightJob: true, propertySqM: 250,
    });
    // base = 15000
    // distance = (20-10) × 500 = 5000
    // urgency = (15000+5000) × 0.5 = 10000
    // demand = 15000 × (0.8 × 0.3) = 3600
    // scarcity = 15000 × (0.5 × 0.4) = 3000
    // subDiscount = 15000 × 0.1 = 1500
    // holiday = 0
    // night = 2000
    // largeProperty = 15000 × 0.2 = 3000
    // final = 15000 + 5000 + 10000 + 3600 + 3000 + 0 + 2000 + 3000 - 1500 - 0 = 40100
    expect(q.final).toBe(40100);
  });

  it("never returns negative price", () => {
    const q = computeQuotePure(rule, { durationHours: 1, isSubscriber: true, promotionMultiplier: 0.1 });
    expect(q.final).toBeGreaterThanOrEqual(0);
  });
});
