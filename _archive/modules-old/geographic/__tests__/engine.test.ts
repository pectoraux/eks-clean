/**
 * Geographic Intelligence — pure-logic unit tests
 *  - Haversine distance, travel time estimation, zone matching
 */
import { describe, it, expect } from "bun:test";
import { haversineKm, estimateTravelMinutes } from "../service";
import type { TrafficModel } from "../service";

describe("Geographic Intelligence", () => {
  it("computes haversine distance between two points", () => {
    // Accra (5.6, -0.2) to Kumasi (6.7, -1.6) ≈ 190 km
    const dist = haversineKm(5.6, -0.2, 6.7, -1.6);
    expect(dist).toBeGreaterThan(180);
    expect(dist).toBeLessThan(200);
  });

  it("returns 0 for same coordinates", () => {
    expect(haversineKm(5.6, -0.2, 5.6, -0.2)).toBe(0);
  });

  it("estimates travel time based on traffic model", () => {
    const traffic: TrafficModel = { off_peak: 35, morning_peak: 18, evening_peak: 15, night: 40 };
    // 10 km at off-peak (35 km/h) = ~17 min
    expect(estimateTravelMinutes(10, traffic, 12)).toBe(17);
    // 10 km at morning peak (18 km/h) = ~33 min
    expect(estimateTravelMinutes(10, traffic, 8)).toBe(33);
    // 10 km at night (40 km/h) = ~15 min
    expect(estimateTravelMinutes(10, traffic, 23)).toBe(15);
  });
});
