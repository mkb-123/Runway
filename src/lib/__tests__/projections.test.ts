import { describe, it, expect } from "vitest";
import {
  projectCompoundGrowth,
  projectScenarios,
  calculateRetirementCountdown,
  calculateCoastFIRE,
  calculateRequiredSavings,
  calculatePensionBridge,
  calculateSWR,
  calculateRequiredPot,
} from "../projections";

describe("projectCompoundGrowth", () => {
  it("returns correct number of years", () => {
    const result = projectCompoundGrowth(100000, 1000, 0.07, 10);
    expect(result).toHaveLength(10);
    expect(result[0].year).toBe(1);
    expect(result[9].year).toBe(10);
  });

  it("grows the pot with compound interest", () => {
    const result = projectCompoundGrowth(100000, 0, 0.07, 10);
    // Each year should be larger than the previous
    for (let i = 1; i < result.length; i++) {
      expect(result[i].value).toBeGreaterThan(result[i - 1].value);
    }
  });

  it("includes monthly contributions", () => {
    const withContrib = projectCompoundGrowth(100000, 1000, 0.07, 10);
    const withoutContrib = projectCompoundGrowth(100000, 0, 0.07, 10);
    expect(withContrib[9].value).toBeGreaterThan(withoutContrib[9].value);
  });

  it("returns initial value-ish for zero rate and zero contributions", () => {
    const result = projectCompoundGrowth(100000, 0, 0, 5);
    // With 0% return, value should stay at 100000
    expect(result[4].value).toBeCloseTo(100000, 0);
  });

  it("doubles roughly at 7% over 10 years", () => {
    const result = projectCompoundGrowth(100000, 0, 0.07, 10);
    // Rule of 72: 72/7 ≈ 10.3 years to double
    expect(result[9].value).toBeGreaterThan(190000);
    expect(result[9].value).toBeLessThan(210000);
  });

  it("handles zero starting value with contributions", () => {
    const result = projectCompoundGrowth(0, 1000, 0.07, 10);
    expect(result[9].value).toBeGreaterThan(0);
  });
});

describe("projectScenarios", () => {
  it("returns one projection per rate", () => {
    const result = projectScenarios(100000, 500, [0.05, 0.07, 0.09], 10);
    expect(result).toHaveLength(3);
    expect(result[0].rate).toBe(0.05);
    expect(result[1].rate).toBe(0.07);
    expect(result[2].rate).toBe(0.09);
  });

  it("higher rates produce higher final values", () => {
    const result = projectScenarios(100000, 500, [0.05, 0.07, 0.09], 20);
    const finalValues = result.map((s) => s.projections[19].value);
    expect(finalValues[0]).toBeLessThan(finalValues[1]);
    expect(finalValues[1]).toBeLessThan(finalValues[2]);
  });
});

describe("calculateRetirementCountdown", () => {
  it("returns 0 years and 0 months if already at target", () => {
    const result = calculateRetirementCountdown(1000000, 50000, 1000000, 0.07);
    expect(result.years).toBe(0);
    expect(result.months).toBe(0);
  });

  it("returns 0 if current pot exceeds target", () => {
    const result = calculateRetirementCountdown(2000000, 50000, 1000000, 0.07);
    expect(result.years).toBe(0);
    expect(result.months).toBe(0);
  });

  it("calculates a reasonable timeline", () => {
    // £500k pot, £50k/yr contributions, 7% return, target £1.5m
    const result = calculateRetirementCountdown(500000, 50000, 1500000, 0.07);
    // Should take roughly 10-12 years
    expect(result.years).toBeGreaterThanOrEqual(8);
    expect(result.years).toBeLessThanOrEqual(15);
  });

  it("higher contributions reduce time", () => {
    const low = calculateRetirementCountdown(500000, 20000, 1500000, 0.07);
    const high = calculateRetirementCountdown(500000, 80000, 1500000, 0.07);
    const lowTotal = low.years * 12 + low.months;
    const highTotal = high.years * 12 + high.months;
    expect(highTotal).toBeLessThan(lowTotal);
  });

  it("higher return rate reduces time", () => {
    const low = calculateRetirementCountdown(500000, 50000, 1500000, 0.04);
    const high = calculateRetirementCountdown(500000, 50000, 1500000, 0.10);
    const lowTotal = low.years * 12 + low.months;
    const highTotal = high.years * 12 + high.months;
    expect(highTotal).toBeLessThan(lowTotal);
  });
});

describe("calculateCoastFIRE", () => {
  it("returns true when pot can grow to target without contributions", () => {
    // £500k growing at 7% for 20 years = £500k * 1.07^20 ≈ £1.93m
    const result = calculateCoastFIRE(500000, 1500000, 55, 35, 0.07);
    expect(result).toBe(true);
  });

  it("returns false when pot cannot reach target", () => {
    // £100k growing at 5% for 10 years = £100k * 1.05^10 ≈ £162k
    const result = calculateCoastFIRE(100000, 1500000, 65, 55, 0.05);
    expect(result).toBe(false);
  });

  it("returns true when already at target", () => {
    const result = calculateCoastFIRE(1500000, 1500000, 65, 55, 0.05);
    expect(result).toBe(true);
  });

  it("returns correct result when target age equals current age", () => {
    // No time to grow, so only true if already at target
    expect(calculateCoastFIRE(1500000, 1500000, 55, 55, 0.07)).toBe(true);
    expect(calculateCoastFIRE(1000000, 1500000, 55, 55, 0.07)).toBe(false);
  });
});

describe("calculateRequiredSavings", () => {
  it("returns zero when current pot already reaches target", () => {
    const result = calculateRequiredSavings(1000000, 2000000, 10, 0.07);
    expect(result).toBe(0);
  });

  it("calculates required monthly savings", () => {
    // Starting at £0, target £100k, 10 years, 0% return
    // Need: £100k / 120 months ≈ £833.33/month
    const result = calculateRequiredSavings(100000, 0, 10, 0);
    expect(result).toBeCloseTo(833.33, 0);
  });

  it("lower savings needed with existing pot", () => {
    const fromZero = calculateRequiredSavings(1000000, 0, 20, 0.07);
    const fromHalf = calculateRequiredSavings(1000000, 500000, 20, 0.07);
    expect(fromHalf).toBeLessThan(fromZero);
  });

  it("lower savings needed with higher return rate", () => {
    const lowRate = calculateRequiredSavings(1000000, 100000, 20, 0.03);
    const highRate = calculateRequiredSavings(1000000, 100000, 20, 0.10);
    expect(highRate).toBeLessThan(lowRate);
  });

  it("handles zero years", () => {
    const result = calculateRequiredSavings(1000000, 500000, 0, 0.07);
    expect(result).toBe(500000); // full shortfall immediately
  });
});

describe("calculatePensionBridge", () => {
  it("calculates bridge pot correctly", () => {
    // Retire at 50, pension access at 57, £40k/yr spend
    // Bridge: 7 years * £40k = £280k
    const result = calculatePensionBridge(50, 57, 40000, 300000);
    expect(result.bridgePotRequired).toBe(280000);
    expect(result.sufficient).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  it("identifies shortfall", () => {
    const result = calculatePensionBridge(50, 57, 40000, 200000);
    expect(result.bridgePotRequired).toBe(280000);
    expect(result.sufficient).toBe(false);
    expect(result.shortfall).toBe(80000);
  });

  it("returns zero bridge for retirement after pension access age", () => {
    const result = calculatePensionBridge(60, 57, 40000, 100000);
    expect(result.bridgePotRequired).toBe(0);
    expect(result.sufficient).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  it("handles equal retirement and pension access ages", () => {
    const result = calculatePensionBridge(57, 57, 40000, 0);
    expect(result.bridgePotRequired).toBe(0);
    expect(result.sufficient).toBe(true);
  });
});

describe("calculateSWR", () => {
  it("calculates annual income from pot at 4%", () => {
    expect(calculateSWR(1000000, 0.04)).toBe(40000);
  });

  it("handles zero pot", () => {
    expect(calculateSWR(0, 0.04)).toBe(0);
  });

  it("handles different rates", () => {
    expect(calculateSWR(1000000, 0.03)).toBe(30000);
    expect(calculateSWR(1000000, 0.05)).toBe(50000);
  });
});

describe("calculateRequiredPot", () => {
  it("calculates pot needed for desired income at 4%", () => {
    expect(calculateRequiredPot(40000, 0.04)).toBe(1000000);
  });

  it("higher income requires larger pot", () => {
    expect(calculateRequiredPot(60000, 0.04)).toBe(1500000);
  });

  it("lower withdrawal rate requires larger pot", () => {
    const at4 = calculateRequiredPot(40000, 0.04);
    const at3 = calculateRequiredPot(40000, 0.03);
    expect(at3).toBeGreaterThan(at4);
  });

  it("handles zero rate", () => {
    expect(calculateRequiredPot(40000, 0)).toBe(Infinity);
  });
});
