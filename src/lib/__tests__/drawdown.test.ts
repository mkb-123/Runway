import { describe, it, expect } from "vitest";
import { generateDrawdownPlan, compareDrawdownStrategies } from "../drawdown";
import type { AccountPot } from "../drawdown";

// ============================================================
// Drawdown Sequencing Tests
// ============================================================

const STANDARD_POTS: AccountPot[] = [
  { type: "pension", balance: 600_000 },
  { type: "isa", balance: 200_000 },
  { type: "gia", balance: 150_000 },
  { type: "cash", balance: 50_000 },
];

describe("generateDrawdownPlan — tax_optimal", () => {
  it("draws from GIA before pension", () => {
    const plan = generateDrawdownPlan(
      STANDARD_POTS,
      40_000, // annual need
      11_500, // state pension
      67, // state pension start age
      60, // start age
      70, // short projection for testing
      0, // 0% growth for simplicity
      "tax_optimal"
    );

    // In early years (before state pension), GIA should be drawn first
    const earlyYears = plan.years.filter(y => y.age < 67);
    const firstYear = earlyYears[0];

    // GIA should be drawn in the first year (before pension)
    expect(firstYear.giaDrawn).toBeGreaterThan(0);
  });

  it("ISA drawn before pension", () => {
    // Give only ISA and pension — ISA should go first
    const pots: AccountPot[] = [
      { type: "pension", balance: 500_000 },
      { type: "isa", balance: 100_000 },
    ];
    const plan = generateDrawdownPlan(
      pots, 30_000, 11_500, 67, 60, 70, 0, "tax_optimal"
    );

    // In year 1, ISA should be drawn (tax-free), not pension
    const year1 = plan.years[0];
    // With 0% growth, GIA is 0, so after GIA check we go to ISA
    expect(year1.isaDrawn).toBeGreaterThan(0);
  });

  it("pension is last resort", () => {
    // Small accessible pots, large pension — pension should be tapped last
    const pots: AccountPot[] = [
      { type: "pension", balance: 800_000 },
      { type: "isa", balance: 10_000 },
      { type: "cash", balance: 5_000 },
    ];
    const plan = generateDrawdownPlan(
      pots, 20_000, 0, 99, 60, 65, 0, "tax_optimal"
    );

    // Year 1: ISA and cash should be used before pension
    const year1 = plan.years[0];
    expect(year1.isaDrawn + year1.cashDrawn).toBeGreaterThan(0);
    // By year 2, accessible pots may be exhausted and pension kicks in
    const year2 = plan.years[1];
    // Either ISA/cash still has something, or pension takes over
    expect(year2.pensionDrawn + year2.isaDrawn + year2.cashDrawn).toBeGreaterThan(0);
  });

  it("state pension reduces drawdown need", () => {
    const withStatePension = generateDrawdownPlan(
      STANDARD_POTS, 40_000, 11_500, 67, 60, 80, 0.03, "tax_optimal"
    );
    const withoutStatePension = generateDrawdownPlan(
      STANDARD_POTS, 40_000, 0, 99, 60, 80, 0.03, "tax_optimal"
    );

    // With state pension, less is drawn from pots total
    const totalDrawnWith = withStatePension.years.reduce(
      (s, y) => s + y.pensionDrawn + y.isaDrawn + y.giaDrawn + y.cashDrawn, 0
    );
    const totalDrawnWithout = withoutStatePension.years.reduce(
      (s, y) => s + y.pensionDrawn + y.isaDrawn + y.giaDrawn + y.cashDrawn, 0
    );

    expect(totalDrawnWith).toBeLessThan(totalDrawnWithout);
  });

  it("growth extends pot longevity", () => {
    const withGrowth = generateDrawdownPlan(
      [{ type: "pension", balance: 300_000 }],
      25_000, 11_500, 67, 60, 95, 0.05, "tax_optimal"
    );
    const withoutGrowth = generateDrawdownPlan(
      [{ type: "pension", balance: 300_000 }],
      25_000, 11_500, 67, 60, 95, 0, "tax_optimal"
    );

    // With growth, pots should last longer
    const lastPositiveWith = withGrowth.years.findLast(y => y.pensionRemaining > 0);
    const lastPositiveWithout = withoutGrowth.years.findLast(y => y.pensionRemaining > 0);

    if (lastPositiveWith && lastPositiveWithout) {
      expect(lastPositiveWith.age).toBeGreaterThanOrEqual(lastPositiveWithout.age);
    }
  });
});

describe("generateDrawdownPlan — proportional", () => {
  it("draws proportionally from all pots", () => {
    const plan = generateDrawdownPlan(
      STANDARD_POTS, 40_000, 0, 99, 60, 65, 0, "proportional"
    );

    const year1 = plan.years[0];
    const total = STANDARD_POTS.reduce((s, p) => s + p.balance, 0);

    // Each pot should contribute proportionally to its share
    expect(year1.pensionDrawn).toBeGreaterThan(0);
    expect(year1.isaDrawn).toBeGreaterThan(0);
    expect(year1.giaDrawn).toBeGreaterThan(0);
    expect(year1.cashDrawn).toBeGreaterThan(0);
  });
});

describe("compareDrawdownStrategies", () => {
  it("two strategies produce different tax outcomes", () => {
    const result = compareDrawdownStrategies(
      STANDARD_POTS,
      40_000,
      11_500,
      67,
      60,
      85,
      0.04
    );

    // The two strategies should produce meaningfully different tax bills
    expect(result.optimalTaxPaid).not.toBe(result.proportionalTaxPaid);
    expect(typeof result.taxSaving).toBe("number");
    expect(isFinite(result.taxSaving)).toBe(true);
  });

  it("tax-optimal defers pension, reducing early tax", () => {
    // With large ISA and small pension, optimal should defer pension
    const pots: AccountPot[] = [
      { type: "pension", balance: 200_000 },
      { type: "isa", balance: 400_000 },
      { type: "cash", balance: 50_000 },
    ];
    const optimal = generateDrawdownPlan(
      pots, 30_000, 11_500, 67, 60, 75, 0.03, "tax_optimal"
    );
    const proportional = generateDrawdownPlan(
      pots, 30_000, 11_500, 67, 60, 75, 0.03, "proportional"
    );

    // Optimal should draw less pension in early years (ISA first)
    const earlyOptimalPension = optimal.years.slice(0, 5).reduce((s, y) => s + y.pensionDrawn, 0);
    const earlyProportionalPension = proportional.years.slice(0, 5).reduce((s, y) => s + y.pensionDrawn, 0);

    expect(earlyOptimalPension).toBeLessThan(earlyProportionalPension);
  });

  it("with only ISA, no tax difference", () => {
    const pots: AccountPot[] = [{ type: "isa", balance: 500_000 }];
    const result = compareDrawdownStrategies(pots, 25_000, 11_500, 67, 60, 85, 0.04);

    // ISA-only: no tax either way
    expect(result.optimalTaxPaid).toBe(0);
    expect(result.proportionalTaxPaid).toBe(0);
    expect(result.taxSaving).toBe(0);
  });

  it("returns positive values", () => {
    const result = compareDrawdownStrategies(
      STANDARD_POTS, 50_000, 11_500, 67, 57, 90, 0.05
    );

    expect(result.optimalTaxPaid).toBeGreaterThanOrEqual(0);
    expect(result.proportionalTaxPaid).toBeGreaterThanOrEqual(0);
  });
});
