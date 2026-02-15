import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateSchoolStartDate,
  calculateSchoolEndDate,
  calculateSchoolYearsRemaining,
  calculateTotalSchoolFeeCost,
  generateSchoolFeeOutgoing,
  syncSchoolFeeOutgoings,
} from "../school-fees";
import type { Child, CommittedOutgoing } from "@/types";

// ============================================================
// School Fees Tests
// ============================================================

// Fix "today" so calculateAge is deterministic
const MOCK_NOW = new Date("2026-02-15");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(MOCK_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// --- Test helpers ---

function makeChild(overrides: Partial<Child> = {}): Child {
  return {
    id: "child-1",
    name: "Arjun",
    dateOfBirth: "2018-06-15", // age 7 at MOCK_NOW
    schoolFeeAnnual: 18_000,
    feeInflationRate: 0.05,
    schoolStartAge: 4,
    schoolEndAge: 18,
    ...overrides,
  };
}

function makeManualOutgoing(overrides: Partial<CommittedOutgoing> = {}): CommittedOutgoing {
  return {
    id: "outgoing-manual",
    category: "mortgage",
    label: "Mortgage",
    amount: 1850,
    frequency: "monthly",
    ...overrides,
  };
}

// --- calculateSchoolStartDate ---

describe("calculateSchoolStartDate", () => {
  it("returns September 1st of the year the child turns schoolStartAge", () => {
    const child = makeChild({ dateOfBirth: "2018-06-15", schoolStartAge: 4 });
    expect(calculateSchoolStartDate(child)).toBe("2022-09-01");
  });

  it("handles different start ages", () => {
    const child = makeChild({ dateOfBirth: "2020-03-10", schoolStartAge: 7 });
    expect(calculateSchoolStartDate(child)).toBe("2027-09-01");
  });
});

// --- calculateSchoolEndDate ---

describe("calculateSchoolEndDate", () => {
  it("returns July 31st of the year the child turns schoolEndAge", () => {
    const child = makeChild({ dateOfBirth: "2018-06-15", schoolEndAge: 18 });
    expect(calculateSchoolEndDate(child)).toBe("2036-07-31");
  });

  it("handles different end ages", () => {
    const child = makeChild({ dateOfBirth: "2015-11-20", schoolEndAge: 16 });
    expect(calculateSchoolEndDate(child)).toBe("2031-07-31");
  });
});

// --- calculateSchoolYearsRemaining ---

describe("calculateSchoolYearsRemaining", () => {
  it("returns full school duration if child hasn't started", () => {
    // Born 2024, start age 4, end age 18 => age 1 at MOCK_NOW
    const child = makeChild({ dateOfBirth: "2024-06-15", schoolStartAge: 4, schoolEndAge: 18 });
    expect(calculateSchoolYearsRemaining(child)).toBe(14); // 18 - 4
  });

  it("returns remaining years if child is in school", () => {
    // Born 2018-06-15 => age 7, start 4, end 18 => 18 - 7 = 11
    const child = makeChild();
    expect(calculateSchoolYearsRemaining(child)).toBe(11);
  });

  it("returns 0 if child has finished school", () => {
    // Born 2005-01-01 => age 21, school end 18
    const child = makeChild({ dateOfBirth: "2005-01-01", schoolEndAge: 18 });
    expect(calculateSchoolYearsRemaining(child)).toBe(0);
  });

  it("returns 0 if child is exactly at schoolEndAge", () => {
    // Born 2008-06-15 => age 17 (under 18), schoolEndAge 18 => 18 - 17 = 1
    // Actually let's use someone who IS 18: born 2008-01-01 => age 18
    const child = makeChild({ dateOfBirth: "2008-01-01", schoolEndAge: 18 });
    expect(calculateSchoolYearsRemaining(child)).toBe(0);
  });
});

// --- calculateTotalSchoolFeeCost ---

describe("calculateTotalSchoolFeeCost", () => {
  it("returns 0 if no fee set", () => {
    const child = makeChild({ schoolFeeAnnual: 0 });
    expect(calculateTotalSchoolFeeCost(child)).toBe(0);
  });

  it("returns 0 if child has finished school", () => {
    const child = makeChild({ dateOfBirth: "2005-01-01" });
    expect(calculateTotalSchoolFeeCost(child)).toBe(0);
  });

  it("at 0% inflation, total = fee * years remaining", () => {
    const child = makeChild({ feeInflationRate: 0 });
    const years = calculateSchoolYearsRemaining(child);
    expect(calculateTotalSchoolFeeCost(child)).toBe(18_000 * years);
  });

  it("with 5% inflation, total exceeds simple multiplication", () => {
    const child = makeChild();
    const years = calculateSchoolYearsRemaining(child);
    const simpleTotal = 18_000 * years;
    const inflatedTotal = calculateTotalSchoolFeeCost(child);
    expect(inflatedTotal).toBeGreaterThan(simpleTotal);
  });

  it("matches manual compound calculation", () => {
    // 3 years remaining at £10k with 10% inflation
    // Year 0: 10000, Year 1: 11000, Year 2: 12100
    // Total: 33100
    const child = makeChild({
      dateOfBirth: "2011-06-15", // age 14 at MOCK_NOW
      schoolFeeAnnual: 10_000,
      feeInflationRate: 0.10,
      schoolStartAge: 4,
      schoolEndAge: 18, // 18 - 14 = 4 years remaining
    });
    const years = calculateSchoolYearsRemaining(child);
    expect(years).toBe(4);
    // Year 0: 10000, Year 1: 11000, Year 2: 12100, Year 3: 13310
    // Total: 46410
    expect(calculateTotalSchoolFeeCost(child)).toBe(Math.round(10000 + 11000 + 12100 + 13310));
  });
});

// --- generateSchoolFeeOutgoing ---

describe("generateSchoolFeeOutgoing", () => {
  it("generates a termly outgoing linked to the child", () => {
    const child = makeChild();
    const outgoing = generateSchoolFeeOutgoing(child);

    expect(outgoing.id).toBe("school-fee-child-1");
    expect(outgoing.category).toBe("school_fees");
    expect(outgoing.label).toContain("Arjun");
    expect(outgoing.frequency).toBe("termly");
    expect(outgoing.amount).toBe(18_000 / 3); // 6000 per term
    expect(outgoing.inflationRate).toBe(0.05);
    expect(outgoing.linkedChildId).toBe("child-1");
    expect(outgoing.startDate).toBe("2022-09-01");
    expect(outgoing.endDate).toBe("2036-07-31");
  });

  it("uses the child's specific inflation rate", () => {
    const child = makeChild({ feeInflationRate: 0.08 });
    const outgoing = generateSchoolFeeOutgoing(child);
    expect(outgoing.inflationRate).toBe(0.08);
  });
});

// --- syncSchoolFeeOutgoings ---

describe("syncSchoolFeeOutgoings", () => {
  it("preserves manual outgoings and adds child outgoings", () => {
    const manual = makeManualOutgoing();
    const child = makeChild();

    const result = syncSchoolFeeOutgoings([child], [manual]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(manual);
    expect(result[1].linkedChildId).toBe("child-1");
  });

  it("removes old linked outgoings when child is removed", () => {
    const manual = makeManualOutgoing();
    const oldLinked: CommittedOutgoing = {
      id: "school-fee-child-1",
      category: "school_fees",
      label: "School fees (Arjun)",
      amount: 6000,
      frequency: "termly",
      linkedChildId: "child-1",
    };

    // Sync with no children — old linked outgoing should be removed
    const result = syncSchoolFeeOutgoings([], [manual, oldLinked]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(manual);
  });

  it("updates outgoings when child data changes", () => {
    const manual = makeManualOutgoing();
    const oldLinked: CommittedOutgoing = {
      id: "school-fee-child-1",
      category: "school_fees",
      label: "School fees (Arjun)",
      amount: 6000,
      frequency: "termly",
      linkedChildId: "child-1",
    };

    const updatedChild = makeChild({ schoolFeeAnnual: 24_000 });
    const result = syncSchoolFeeOutgoings([updatedChild], [manual, oldLinked]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(manual); // manual preserved
    expect(result[1].amount).toBe(8_000); // 24000 / 3
    expect(result[1].linkedChildId).toBe("child-1");
  });

  it("handles children with zero fees (no outgoing generated)", () => {
    const child = makeChild({ schoolFeeAnnual: 0 });
    const result = syncSchoolFeeOutgoings([child], []);
    expect(result).toHaveLength(0);
  });

  it("handles multiple children", () => {
    const child1 = makeChild({ id: "c1", name: "Arjun", schoolFeeAnnual: 18_000 });
    const child2 = makeChild({ id: "c2", name: "Maya", schoolFeeAnnual: 15_000, dateOfBirth: "2020-03-10" });

    const result = syncSchoolFeeOutgoings([child1, child2], []);
    expect(result).toHaveLength(2);
    expect(result[0].linkedChildId).toBe("c1");
    expect(result[1].linkedChildId).toBe("c2");
    expect(result[0].amount).toBe(6_000);
    expect(result[1].amount).toBe(5_000);
  });
});
