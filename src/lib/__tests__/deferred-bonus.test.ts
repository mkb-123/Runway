import { describe, it, expect } from "vitest";
import { generateDeferredTranches, totalProjectedDeferredValue } from "@/lib/deferred-bonus";
import type { BonusStructure } from "@/types";

function makeBonus(overrides: Partial<BonusStructure> = {}): BonusStructure {
  return {
    personId: "p1",
    totalBonusAnnual: 70000,
    cashBonusAnnual: 25000,
    vestingYears: 3,
    vestingGapYears: 0,
    estimatedAnnualReturn: 0.08,
    ...overrides,
  };
}

describe("generateDeferredTranches", () => {
  it("generates correct number of tranches", () => {
    const bonus = makeBonus();
    const tranches = generateDeferredTranches(bonus);
    expect(tranches).toHaveLength(3);
  });

  it("splits deferred amount equally across tranches", () => {
    // deferred = 70000 - 25000 = 45000, split 3 ways = 15000
    const bonus = makeBonus({ totalBonusAnnual: 70000, cashBonusAnnual: 25000, vestingYears: 3 });
    const tranches = generateDeferredTranches(bonus);
    for (const tranche of tranches) {
      expect(tranche.amount).toBe(15000);
    }
  });

  it("vests in January each year (no gap)", () => {
    const bonus = makeBonus({ vestingGapYears: 0 });
    const ref = new Date(2025, 5, 15); // June 2025
    const tranches = generateDeferredTranches(bonus, ref);
    expect(tranches[0].vestingDate).toBe("2026-01-01");
    expect(tranches[1].vestingDate).toBe("2027-01-01");
    expect(tranches[2].vestingDate).toBe("2028-01-01");
  });

  it("respects vestingGapYears (1-year gap)", () => {
    const bonus = makeBonus({ vestingGapYears: 1 });
    const ref = new Date(2025, 0, 1);
    const tranches = generateDeferredTranches(bonus, ref);
    // gap=1: first vest at year 2, then 3, then 4
    expect(tranches[0].vestingDate).toBe("2027-01-01");
    expect(tranches[1].vestingDate).toBe("2028-01-01");
    expect(tranches[2].vestingDate).toBe("2029-01-01");
  });

  it("grant date is January 1st of the reference year", () => {
    const bonus = makeBonus();
    const ref = new Date(2025, 8, 1); // Sep 2025
    const tranches = generateDeferredTranches(bonus, ref);
    for (const tranche of tranches) {
      expect(tranche.grantDate).toBe("2025-01-01");
    }
  });

  it("returns empty array when deferred amount is 0 (total == cash)", () => {
    const bonus = makeBonus({ totalBonusAnnual: 25000, cashBonusAnnual: 25000 });
    expect(generateDeferredTranches(bonus)).toHaveLength(0);
  });

  it("returns empty array when vestingYears is 0", () => {
    const bonus = makeBonus({ vestingYears: 0 });
    expect(generateDeferredTranches(bonus)).toHaveLength(0);
  });

  it("returns empty array when totalBonusAnnual is 0", () => {
    const bonus = makeBonus({ totalBonusAnnual: 0, cashBonusAnnual: 0 });
    expect(generateDeferredTranches(bonus)).toHaveLength(0);
  });

  it("clamps deferred to 0 when cash exceeds total", () => {
    const bonus = makeBonus({ totalBonusAnnual: 20000, cashBonusAnnual: 25000 });
    expect(generateDeferredTranches(bonus)).toHaveLength(0);
  });

  it("handles single year vesting", () => {
    const bonus = makeBonus({ totalBonusAnnual: 55000, cashBonusAnnual: 25000, vestingYears: 1 });
    const tranches = generateDeferredTranches(bonus);
    expect(tranches).toHaveLength(1);
    expect(tranches[0].amount).toBe(30000);
  });

  it("carries estimated annual return to all tranches", () => {
    const bonus = makeBonus({ estimatedAnnualReturn: 0.12 });
    const tranches = generateDeferredTranches(bonus);
    for (const tranche of tranches) {
      expect(tranche.estimatedAnnualReturn).toBe(0.12);
    }
  });

  it("first tranche vests in the next year when gap is 0", () => {
    const bonus = makeBonus({ vestingYears: 3, vestingGapYears: 0 });
    const ref = new Date(2025, 0, 1); // Jan 2025
    const tranches = generateDeferredTranches(bonus, ref);
    expect(tranches[0].vestingDate).toBe("2026-01-01");
  });
});

describe("totalProjectedDeferredValue", () => {
  it("projects growth over vesting period", () => {
    const bonus = makeBonus({ totalBonusAnnual: 55000, cashBonusAnnual: 25000, vestingYears: 3, estimatedAnnualReturn: 0.10 });
    const ref = new Date(2025, 0, 1);
    const total = totalProjectedDeferredValue(bonus, ref);
    // deferred = 30000, split 3 ways = 10000 per tranche
    expect(total).toBeGreaterThan(30000);
  });

  it("returns 0 when no deferred bonus", () => {
    const bonus = makeBonus({ totalBonusAnnual: 25000, cashBonusAnnual: 25000 });
    expect(totalProjectedDeferredValue(bonus)).toBe(0);
  });

  it("projected value exceeds nominal amount due to growth", () => {
    const bonus = makeBonus({ totalBonusAnnual: 70000, cashBonusAnnual: 25000, estimatedAnnualReturn: 0.08 });
    const total = totalProjectedDeferredValue(bonus);
    expect(total).toBeGreaterThan(45000);
  });

  it("projects higher value with vestingGapYears (more time to compound)", () => {
    const noGap = makeBonus({ vestingGapYears: 0 });
    const withGap = makeBonus({ vestingGapYears: 1 });
    const ref = new Date(2025, 0, 1);
    const valueNoGap = totalProjectedDeferredValue(noGap, ref);
    const valueWithGap = totalProjectedDeferredValue(withGap, ref);
    // With gap, each tranche has an extra year to compound
    expect(valueWithGap).toBeGreaterThan(valueNoGap);
  });
});
