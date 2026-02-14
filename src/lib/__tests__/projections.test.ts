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
  calculateProRataStatePension,
  calculateAge,
  calculateTaxEfficiencyScore,
  projectDeferredBonusValue,
  calculateTaperedAnnualAllowance,
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

// --- New extracted function tests ---

describe("calculateProRataStatePension", () => {

  it("returns full pension for 35 qualifying years", () => {
    expect(calculateProRataStatePension(35)).toBe(11502.4);
  });

  it("returns full pension for years exceeding 35 (capped)", () => {
    expect(calculateProRataStatePension(40)).toBe(11502.4);
  });

  it("returns zero for fewer than 10 qualifying years", () => {
    expect(calculateProRataStatePension(0)).toBe(0);
    expect(calculateProRataStatePension(5)).toBe(0);
    expect(calculateProRataStatePension(9)).toBe(0);
  });

  it("returns proportional pension for 10 qualifying years (minimum)", () => {
    const result = calculateProRataStatePension(10);
    // 10/35 * 11502.40 = 3286.40
    expect(result).toBeCloseTo(3286.4, 2);
  });

  it("returns proportional pension for 25 qualifying years", () => {
    const result = calculateProRataStatePension(25);
    // 25/35 * 11502.40 = 8216.00
    expect(result).toBeCloseTo(8216.0, 2);
  });

  it("returns proportional pension for 20 qualifying years", () => {
    const result = calculateProRataStatePension(20);
    // 20/35 * 11502.40 = 6572.80
    expect(result).toBeCloseTo(6572.8, 2);
  });
});

describe("calculateAge", () => {

  it("calculates age correctly for a straightforward case", () => {
    const now = new Date("2024-06-15");
    expect(calculateAge("1990-01-01", now)).toBe(34);
  });

  it("handles birthday not yet reached this year", () => {
    const now = new Date("2024-03-01");
    expect(calculateAge("1990-06-15", now)).toBe(33);
  });

  it("handles birthday already passed this year", () => {
    const now = new Date("2024-09-01");
    expect(calculateAge("1990-06-15", now)).toBe(34);
  });

  it("handles exact birthday", () => {
    const now = new Date("2024-06-15");
    expect(calculateAge("1990-06-15", now)).toBe(34);
  });

  it("handles leap year birthday (Feb 29)", () => {
    // Born Feb 29, 1992. On March 1 2024: 32 years old (2024 - 1992 = 32, birthday passed)
    const now = new Date("2024-03-01");
    expect(calculateAge("1992-02-29", now)).toBe(32);
  });

  it("handles leap year birthday on Feb 28 of non-leap year", () => {
    // Born Feb 29, 1992. On Feb 28, 2025: still 32
    const now = new Date("2025-02-28");
    expect(calculateAge("1992-02-29", now)).toBe(32);
  });
});

describe("calculateTaxEfficiencyScore", () => {

  it("returns 1 when all savings are tax-advantaged", () => {
    expect(calculateTaxEfficiencyScore(10000, 5000, 0)).toBe(1);
  });

  it("returns 0 when all savings are GIA", () => {
    expect(calculateTaxEfficiencyScore(0, 0, 10000)).toBe(0);
  });

  it("returns correct ratio for mixed savings", () => {
    // ISA: 10k, Pension: 10k, GIA: 5k = 20k/25k = 0.8
    expect(calculateTaxEfficiencyScore(10000, 10000, 5000)).toBeCloseTo(0.8);
  });

  it("returns 0 when no savings", () => {
    expect(calculateTaxEfficiencyScore(0, 0, 0)).toBe(0);
  });

  it("handles decimal precision", () => {
    // 6000 + 4000 = 10000 / 15000 = 0.6667
    expect(calculateTaxEfficiencyScore(6000, 4000, 5000)).toBeCloseTo(0.6667, 3);
  });
});

describe("projectDeferredBonusValue", () => {

  it("projects value with compound growth", () => {
    // £10,000 at 5% for ~1 year
    const result = projectDeferredBonusValue(
      10000,
      "2023-01-01",
      "2024-01-01",
      0.05
    );
    expect(result).toBeCloseTo(10500, -1); // ~10,500
  });

  it("returns original amount when vesting date equals grant date", () => {
    const result = projectDeferredBonusValue(
      10000,
      "2024-01-01",
      "2024-01-01",
      0.05
    );
    expect(result).toBe(10000);
  });

  it("returns original amount when vesting is before grant", () => {
    const result = projectDeferredBonusValue(
      10000,
      "2024-01-01",
      "2023-01-01",
      0.05
    );
    expect(result).toBe(10000);
  });

  it("handles multi-year growth correctly", () => {
    // £50,000 at 8% for ~3 years (365.25 day year means ~2.9993 years)
    const result = projectDeferredBonusValue(
      50000,
      "2022-01-01",
      "2025-01-01",
      0.08
    );
    // ~50000 * 1.08^3 ≈ 62,985–62,989 depending on exact day count
    expect(result).toBeGreaterThan(62980);
    expect(result).toBeLessThan(63000);
  });

  it("handles zero return rate", () => {
    const result = projectDeferredBonusValue(
      10000,
      "2023-01-01",
      "2025-01-01",
      0
    );
    expect(result).toBe(10000);
  });
});

describe("calculateTaperedAnnualAllowance", () => {
  it("returns full allowance when threshold income <= £200k", () => {
    expect(calculateTaperedAnnualAllowance(200000, 270000)).toBe(60000);
  });

  it("returns full allowance when adjusted income <= £260k", () => {
    expect(calculateTaperedAnnualAllowance(250000, 260000)).toBe(60000);
  });

  it("tapers by £1 for every £2 over £260k adjusted income", () => {
    // Threshold income: £250k (> £200k), adjusted income: £280k
    // Excess: £280k - £260k = £20k, reduction: £10k
    // Tapered: £60k - £10k = £50k
    expect(calculateTaperedAnnualAllowance(250000, 280000)).toBe(50000);
  });

  it("floors at £10k minimum tapered allowance", () => {
    // Adjusted income: £360k, excess: £100k, reduction: £50k
    // Tapered: £60k - £50k = £10k (at minimum)
    expect(calculateTaperedAnnualAllowance(300000, 360000)).toBe(10000);
  });

  it("does not go below £10k even with extreme income", () => {
    expect(calculateTaperedAnnualAllowance(500000, 500000)).toBe(10000);
  });

  it("returns full allowance for typical higher-rate earner", () => {
    // £80k salary, £3k employer pension = £83k adjusted
    expect(calculateTaperedAnnualAllowance(80000, 83000)).toBe(60000);
  });

  it("correctly handles boundary at exactly £260k adjusted income", () => {
    expect(calculateTaperedAnnualAllowance(250000, 260000)).toBe(60000);
  });

  it("tapers by £500 when £1k over threshold", () => {
    // Adjusted income: £261k, excess: £1k, reduction: £500
    expect(calculateTaperedAnnualAllowance(250000, 261000)).toBe(59500);
  });
});
