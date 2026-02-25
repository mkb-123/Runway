import { describe, it, expect } from "vitest";
import { runMonteCarloSimulation, computeSuccessProbability } from "../monte-carlo";
import type { MonteCarloConfig } from "../monte-carlo";

const BASE_CONFIG: MonteCarloConfig = {
  currentValue: 500_000,
  annualContribution: 20_000,
  expectedReturn: 0.06,
  volatility: 0.15,
  years: 20,
  runs: 500,
  percentiles: [10, 25, 50, 75, 90],
};

describe("runMonteCarloSimulation", () => {
  it("returns timeline with correct number of years", () => {
    const result = runMonteCarloSimulation(BASE_CONFIG);
    expect(result.timeline).toHaveLength(21);
    expect(result.timeline[0].year).toBe(0);
    expect(result.timeline[20].year).toBe(20);
  });

  it("year 0 has all percentiles equal to current value", () => {
    const result = runMonteCarloSimulation(BASE_CONFIG);
    const year0 = result.timeline[0];
    for (const p of [10, 25, 50, 75, 90]) {
      expect(year0.percentiles[p]).toBe(500_000);
    }
  });

  it("percentiles are monotonically ordered within each year", () => {
    const result = runMonteCarloSimulation(BASE_CONFIG);
    for (const yearResult of result.timeline) {
      expect(yearResult.percentiles[10]).toBeLessThanOrEqual(yearResult.percentiles[25]);
      expect(yearResult.percentiles[25]).toBeLessThanOrEqual(yearResult.percentiles[50]);
      expect(yearResult.percentiles[50]).toBeLessThanOrEqual(yearResult.percentiles[75]);
      expect(yearResult.percentiles[75]).toBeLessThanOrEqual(yearResult.percentiles[90]);
    }
  });

  it("median grows over time with positive expected return", () => {
    const result = runMonteCarloSimulation(BASE_CONFIG);
    const median5 = result.timeline[5].percentiles[50];
    const median10 = result.timeline[10].percentiles[50];
    const median20 = result.timeline[20].percentiles[50];
    expect(median5).toBeGreaterThan(BASE_CONFIG.currentValue);
    expect(median10).toBeGreaterThan(median5);
    expect(median20).toBeGreaterThan(median10);
  });

  it("spread widens over time (uncertainty increases)", () => {
    const result = runMonteCarloSimulation(BASE_CONFIG);
    const spread5 = result.timeline[5].percentiles[90] - result.timeline[5].percentiles[10];
    const spread20 = result.timeline[20].percentiles[90] - result.timeline[20].percentiles[10];
    expect(spread20).toBeGreaterThan(spread5);
  });

  it("is deterministic (same config gives same result)", () => {
    const result1 = runMonteCarloSimulation(BASE_CONFIG);
    const result2 = runMonteCarloSimulation(BASE_CONFIG);
    expect(result1.timeline[10].percentiles[50]).toBe(result2.timeline[10].percentiles[50]);
    expect(result1.timeline[20].mean).toBe(result2.timeline[20].mean);
  });

  it("higher contributions lead to higher projections", () => {
    const lowContrib = runMonteCarloSimulation({ ...BASE_CONFIG, annualContribution: 10_000 });
    const highContrib = runMonteCarloSimulation({ ...BASE_CONFIG, annualContribution: 40_000 });
    expect(highContrib.timeline[20].percentiles[50])
      .toBeGreaterThan(lowContrib.timeline[20].percentiles[50]);
  });
});

describe("computeSuccessProbability", () => {
  it("returns near-1.0 when target is already met", () => {
    const prob = computeSuccessProbability(
      { ...BASE_CONFIG, currentValue: 2_000_000 },
      1_000_000
    );
    // With £2M and £20k/yr contributions targeting £1M, success is near-certain
    // but stochastic runs may occasionally dip
    expect(prob).toBeGreaterThanOrEqual(0.99);
  });

  it("returns probability between 0 and 1", () => {
    const prob = computeSuccessProbability(BASE_CONFIG, 1_500_000);
    expect(prob).toBeGreaterThan(0);
    expect(prob).toBeLessThanOrEqual(1);
  });

  it("higher target reduces probability", () => {
    const probLow = computeSuccessProbability(BASE_CONFIG, 1_000_000);
    const probHigh = computeSuccessProbability(BASE_CONFIG, 3_000_000);
    expect(probLow).toBeGreaterThan(probHigh);
  });

  it("is deterministic", () => {
    const prob1 = computeSuccessProbability(BASE_CONFIG, 1_500_000);
    const prob2 = computeSuccessProbability(BASE_CONFIG, 1_500_000);
    expect(prob1).toBe(prob2);
  });
});
