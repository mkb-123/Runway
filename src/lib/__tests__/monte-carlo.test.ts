import { describe, it, expect } from "vitest";
import {
  runMonteCarloSimulation,
  computeSuccessProbability,
  type MonteCarloConfig,
} from "@/lib/monte-carlo";

const baseConfig: MonteCarloConfig = {
  currentValue: 500_000,
  annualContribution: 30_000,
  expectedReturn: 0.05,
  volatility: 0.15,
  years: 30,
  runs: 500,
  percentiles: [10, 25, 50, 75, 90],
};

describe("runMonteCarloSimulation", () => {
  it("returns timeline with correct number of years", () => {
    const result = runMonteCarloSimulation(baseConfig);
    expect(result.timeline).toHaveLength(31); // year 0 to 30
    expect(result.timeline[0].year).toBe(0);
    expect(result.timeline[30].year).toBe(30);
  });

  it("year 0 is always the current value", () => {
    const result = runMonteCarloSimulation(baseConfig);
    const year0 = result.timeline[0];
    // All percentiles at year 0 should equal currentValue
    for (const p of [10, 25, 50, 75, 90]) {
      expect(year0.percentiles[p]).toBe(baseConfig.currentValue);
    }
    expect(year0.mean).toBe(baseConfig.currentValue);
  });

  it("percentiles are ordered correctly (p10 < p25 < p50 < p75 < p90)", () => {
    const result = runMonteCarloSimulation(baseConfig);
    for (const yearResult of result.timeline.slice(1)) {
      expect(yearResult.percentiles[10]).toBeLessThanOrEqual(yearResult.percentiles[25]);
      expect(yearResult.percentiles[25]).toBeLessThanOrEqual(yearResult.percentiles[50]);
      expect(yearResult.percentiles[50]).toBeLessThanOrEqual(yearResult.percentiles[75]);
      expect(yearResult.percentiles[75]).toBeLessThanOrEqual(yearResult.percentiles[90]);
    }
  });

  it("median grows over time with positive expected return", () => {
    const result = runMonteCarloSimulation(baseConfig);
    const median10 = result.timeline[10].percentiles[50];
    const median20 = result.timeline[20].percentiles[50];
    const median30 = result.timeline[30].percentiles[50];
    expect(median10).toBeGreaterThan(baseConfig.currentValue);
    expect(median20).toBeGreaterThan(median10);
    expect(median30).toBeGreaterThan(median20);
  });

  it("higher volatility produces wider spread between p10 and p90", () => {
    const lowVol = runMonteCarloSimulation({ ...baseConfig, volatility: 0.05 });
    const highVol = runMonteCarloSimulation({ ...baseConfig, volatility: 0.25 });

    const lowSpread = lowVol.timeline[30].percentiles[90] - lowVol.timeline[30].percentiles[10];
    const highSpread = highVol.timeline[30].percentiles[90] - highVol.timeline[30].percentiles[10];

    expect(highSpread).toBeGreaterThan(lowSpread);
  });

  it("is deterministic (same inputs → same outputs)", () => {
    const run1 = runMonteCarloSimulation(baseConfig);
    const run2 = runMonteCarloSimulation(baseConfig);

    expect(run1.timeline[30].percentiles[50]).toBe(run2.timeline[30].percentiles[50]);
    expect(run1.timeline[30].mean).toBe(run2.timeline[30].mean);
  });

  it("handles zero current value", () => {
    const result = runMonteCarloSimulation({
      ...baseConfig,
      currentValue: 0,
    });
    expect(result.timeline[0].percentiles[50]).toBe(0);
    // With contributions, should grow
    expect(result.timeline[30].percentiles[50]).toBeGreaterThan(0);
  });

  it("handles zero contribution", () => {
    const result = runMonteCarloSimulation({
      ...baseConfig,
      annualContribution: 0,
    });
    // Should still have value from growth
    expect(result.timeline[30].percentiles[50]).toBeGreaterThan(0);
  });

  it("handles zero volatility (deterministic growth)", () => {
    const result = runMonteCarloSimulation({
      ...baseConfig,
      volatility: 0.001, // Near-zero (can't be exactly 0 due to log)
      runs: 100,
    });
    // All percentiles should be nearly equal when volatility is near zero
    const yr30 = result.timeline[30];
    const spread = yr30.percentiles[90] - yr30.percentiles[10];
    const median = yr30.percentiles[50];
    // Spread should be less than 10% of median
    expect(spread / median).toBeLessThan(0.1);
  });

  it("values never go negative", () => {
    const result = runMonteCarloSimulation({
      ...baseConfig,
      expectedReturn: -0.1,
      volatility: 0.3,
      annualContribution: 0,
    });
    for (const yearResult of result.timeline) {
      expect(yearResult.percentiles[10]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("computeSuccessProbability", () => {
  it("returns a probability between 0 and 1", () => {
    const prob = computeSuccessProbability(baseConfig, 2_000_000);
    expect(prob).toBeGreaterThanOrEqual(0);
    expect(prob).toBeLessThanOrEqual(1);
  });

  it("higher target has lower probability", () => {
    const probLow = computeSuccessProbability(baseConfig, 1_000_000);
    const probHigh = computeSuccessProbability(baseConfig, 5_000_000);
    expect(probLow).toBeGreaterThan(probHigh);
  });

  it("returns ~1.0 for trivially achievable target", () => {
    const prob = computeSuccessProbability(baseConfig, 100_000, 30);
    expect(prob).toBeGreaterThan(0.95);
  });

  it("returns ~0.0 for unreachable target", () => {
    const prob = computeSuccessProbability(
      { ...baseConfig, currentValue: 1000, annualContribution: 0 },
      100_000_000,
      5
    );
    expect(prob).toBeLessThan(0.05);
  });
});
