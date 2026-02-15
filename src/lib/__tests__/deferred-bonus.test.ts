import { describe, it, expect } from "vitest";
import { generateDeferredTranches, totalProjectedDeferredValue } from "@/lib/deferred-bonus";
import type { BonusStructure } from "@/types";

function makeBonus(overrides: Partial<BonusStructure> = {}): BonusStructure {
  return {
    personId: "p1",
    cashBonusAnnual: 25000,
    deferredBonusAnnual: 45000,
    vestingYears: 3,
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

  it("splits amount equally across tranches", () => {
    const bonus = makeBonus({ deferredBonusAnnual: 45000, vestingYears: 3 });
    const tranches = generateDeferredTranches(bonus);
    for (const tranche of tranches) {
      expect(tranche.amount).toBe(15000);
    }
  });

  it("vests in January each year", () => {
    const bonus = makeBonus();
    const ref = new Date(2025, 5, 15); // June 2025
    const tranches = generateDeferredTranches(bonus, ref);
    expect(tranches[0].vestingDate).toBe("2026-01-01");
    expect(tranches[1].vestingDate).toBe("2027-01-01");
    expect(tranches[2].vestingDate).toBe("2028-01-01");
  });

  it("grant date is January 1st of the reference year", () => {
    const bonus = makeBonus();
    const ref = new Date(2025, 8, 1); // Sep 2025
    const tranches = generateDeferredTranches(bonus, ref);
    for (const tranche of tranches) {
      expect(tranche.grantDate).toBe("2025-01-01");
    }
  });

  it("returns empty array when deferredBonusAnnual is 0", () => {
    const bonus = makeBonus({ deferredBonusAnnual: 0 });
    expect(generateDeferredTranches(bonus)).toHaveLength(0);
  });

  it("returns empty array when vestingYears is 0", () => {
    const bonus = makeBonus({ vestingYears: 0 });
    expect(generateDeferredTranches(bonus)).toHaveLength(0);
  });

  it("returns empty array when deferredBonusAnnual is negative", () => {
    const bonus = makeBonus({ deferredBonusAnnual: -1000 });
    expect(generateDeferredTranches(bonus)).toHaveLength(0);
  });

  it("handles single year vesting", () => {
    const bonus = makeBonus({ deferredBonusAnnual: 30000, vestingYears: 1 });
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

  it("first tranche vests in the next year, not skipping", () => {
    const bonus = makeBonus({ vestingYears: 3 });
    const ref = new Date(2025, 0, 1); // Jan 2025
    const tranches = generateDeferredTranches(bonus, ref);
    // First tranche should vest Jan 2026 (1 year out), not Jan 2027
    expect(tranches[0].vestingDate).toBe("2026-01-01");
  });
});

describe("totalProjectedDeferredValue", () => {
  it("projects growth over vesting period", () => {
    const bonus = makeBonus({ deferredBonusAnnual: 30000, vestingYears: 3, estimatedAnnualReturn: 0.10 });
    const ref = new Date(2025, 0, 1);
    const total = totalProjectedDeferredValue(bonus, ref);
    // Approximate: 10000 growing at 10% for 1, 2, and 3 years
    // Slight variance because year calculation uses 365.25-day convention
    expect(total).toBeGreaterThan(45000 * 0.8);
    expect(total).toBeLessThan(45000 * 1.0);
    // More precise check: each tranche grows
    expect(total).toBeGreaterThan(30000);
  });

  it("returns 0 for zero deferred bonus", () => {
    const bonus = makeBonus({ deferredBonusAnnual: 0 });
    expect(totalProjectedDeferredValue(bonus)).toBe(0);
  });

  it("projected value exceeds nominal amount due to growth", () => {
    const bonus = makeBonus({ deferredBonusAnnual: 45000, estimatedAnnualReturn: 0.08 });
    const total = totalProjectedDeferredValue(bonus);
    expect(total).toBeGreaterThan(45000);
  });
});
