/**
 * ============================================================================
 *  OpsOS RuntimeClock — Deterministic Time Abstraction
 * ============================================================================
 *  The runtime MUST be deterministic. Given identical inputs, it produces
 *  identical outputs. No Date.now(), no Math.random(), no hidden state.
 *
 *  Modes:
 *    WALL       — uses real wall-clock time (production)
 *    SIMULATION — uses a simulated clock that advances manually
 *    FIXED      — frozen at a specific instant (testing)
 * ============================================================================
 */

export type ClockMode = "WALL" | "SIMULATION" | "FIXED";

export interface RuntimeClock {
  now(): Date;
  tick(): bigint;
  advance(durationMs: number): void;
  getMode(): ClockMode;
  getTickDurationMs(): number;
}

export class WallClock implements RuntimeClock {
  private currentTick: bigint = 0n;
  private readonly tickDurationMs: number;

  constructor(tickDurationMs: number = 1000) {
    this.tickDurationMs = tickDurationMs;
  }

  now(): Date { return new Date(); }
  tick(): bigint { this.currentTick += 1n; return this.currentTick; }
  advance(_durationMs: number): void { /* wall clock advances on its own */ }
  getMode(): ClockMode { return "WALL"; }
  getTickDurationMs(): number { return this.tickDurationMs; }
}

export class SimulationClock implements RuntimeClock {
  private simulatedTime: Date;
  private currentTick: bigint = 0n;
  private readonly tickDurationMs: number;

  constructor(startTime: Date = new Date("2026-01-01T00:00:00Z"), tickDurationMs: number = 1000) {
    this.simulatedTime = new Date(startTime);
    this.tickDurationMs = tickDurationMs;
  }

  now(): Date { return new Date(this.simulatedTime); }
  tick(): bigint { this.currentTick += 1n; this.simulatedTime = new Date(this.simulatedTime.getTime() + this.tickDurationMs); return this.currentTick; }
  advance(durationMs: number): void { this.simulatedTime = new Date(this.simulatedTime.getTime() + durationMs); }
  getMode(): ClockMode { return "SIMULATION"; }
  getTickDurationMs(): number { return this.tickDurationMs; }
}

export class FixedClock implements RuntimeClock {
  private readonly fixedTime: Date;
  private currentTick: bigint = 0n;

  constructor(fixedTime: Date = new Date("2026-01-01T00:00:00Z")) {
    this.fixedTime = new Date(fixedTime);
  }

  now(): Date { return new Date(this.fixedTime); }
  tick(): bigint { this.currentTick += 1n; return this.currentTick; }
  advance(_durationMs: number): void { /* fixed clock never advances */ }
  getMode(): ClockMode { return "FIXED"; }
  getTickDurationMs(): number { return 0; }
}

// Singleton factory — the runtime always uses one clock per organization
const clocks = new Map<string, RuntimeClock>();

export function getClock(organizationId: string, mode: ClockMode = "WALL"): RuntimeClock {
  if (!clocks.has(organizationId)) {
    switch (mode) {
      case "SIMULATION": clocks.set(organizationId, new SimulationClock()); break;
      case "FIXED": clocks.set(organizationId, new FixedClock()); break;
      default: clocks.set(organizationId, new WallClock()); break;
    }
  }
  return clocks.get(organizationId)!;
}

export function setClock(organizationId: string, clock: RuntimeClock): void {
  clocks.set(organizationId, clock);
}
