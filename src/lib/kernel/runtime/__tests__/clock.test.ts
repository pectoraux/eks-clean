/**
 * OpsOS RuntimeClock — Determinism tests
 */
import { describe, it, expect } from "bun:test";
import { WallClock, SimulationClock, FixedClock } from "../clock";

describe("RuntimeClock — Determinism", () => {
  it("FixedClock always returns the same time", () => {
    const clock = new FixedClock(new Date("2026-01-15T10:00:00.000Z"));
    expect(clock.now().toISOString()).toBe("2026-01-15T10:00:00.000Z");
    expect(clock.now().toISOString()).toBe("2026-01-15T10:00:00.000Z");
    clock.advance(1000);
    expect(clock.now().toISOString()).toBe("2026-01-15T10:00:00.000Z"); // unchanged
  });

  it("FixedClock tick is monotonic", () => {
    const clock = new FixedClock();
    expect(clock.tick()).toBe(1n);
    expect(clock.tick()).toBe(2n);
    expect(clock.tick()).toBe(3n);
  });

  it("SimulationClock advances by tick duration", () => {
    const clock = new SimulationClock(new Date("2026-01-01T00:00:00Z"), 1000);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00Z");
    clock.tick();
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:01.000Z");
    clock.tick();
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:02.000Z");
  });

  it("SimulationClock advance adds duration", () => {
    const clock = new SimulationClock(new Date("2026-01-01T00:00:00Z"), 1000);
    clock.advance(60000); // 1 minute
    expect(clock.now().toISOString()).toBe("2026-01-01T00:01:00.000Z");
  });

  it("Two FixedClocks with same time produce identical results", () => {
    const c1 = new FixedClock(new Date("2026-06-15T12:00:00Z"));
    const c2 = new FixedClock(new Date("2026-06-15T12:00:00Z"));
    expect(c1.now().getTime()).toBe(c2.now().getTime());
    c1.tick(); c2.tick();
    expect(c1.tick()).toBe(c2.tick());
  });

  it("Clock modes are correct", () => {
    expect(new WallClock().getMode()).toBe("WALL");
    expect(new SimulationClock().getMode()).toBe("SIMULATION");
    expect(new FixedClock().getMode()).toBe("FIXED");
  });
});
