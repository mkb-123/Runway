import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateSchoolStartDate,
  calculateSchoolEndDate,
  calculateSchoolYearsRemaining,
  calculateTotalSchoolFeeCost,
  generateSchoolFeeOutgoing,
  syncSchoolFeeOutgoings,
  generateSchoolFeeTimeline,
  calculateTotalEducationCommitment,
  findLastSchoolFeeYear,
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

// --- generateSchoolFeeTimeline ---

describe("generateSchoolFeeTimeline", () => {
  it("returns empty array for no children", () => {
    expect(generateSchoolFeeTimeline([])).toEqual([]);
  });

  it("returns empty array for children with zero fees", () => {
    const child = makeChild({ schoolFeeAnnual: 0 });
    expect(generateSchoolFeeTimeline([child])).toEqual([]);
  });

  it("generates a timeline entry for each year of school fees", () => {
    // Child born 2018-06-15, start 4, end 18 => school years 2022-2036
    // Current year is 2026, so timeline starts at 2026 and ends at 2036
    const child = makeChild();
    const timeline = generateSchoolFeeTimeline([child]);

    expect(timeline.length).toBe(11); // 2026 to 2036 inclusive
    expect(timeline[0].calendarYear).toBe(2026);
    expect(timeline[timeline.length - 1].calendarYear).toBe(2036);
  });

  it("first year has today's fee (no inflation)", () => {
    const child = makeChild({ feeInflationRate: 0.05 });
    const timeline = generateSchoolFeeTimeline([child]);

    // Year 0 (2026): no inflation yet
    expect(timeline[0][child.id]).toBe(18_000);
  });

  it("subsequent years have inflated fees", () => {
    const child = makeChild({ feeInflationRate: 0.05 });
    const timeline = generateSchoolFeeTimeline([child]);

    // Year 1 (2027): 18000 * 1.05^1 = 18900
    expect(timeline[1][child.id]).toBe(Math.round(18_000 * 1.05));
    // Year 2 (2028): 18000 * 1.05^2 = 19845
    expect(timeline[2][child.id]).toBe(Math.round(18_000 * 1.05 * 1.05));
  });

  it("total equals sum of per-child amounts", () => {
    const child1 = makeChild({ id: "c1", name: "Arjun", schoolFeeAnnual: 18_000 });
    const child2 = makeChild({
      id: "c2", name: "Maya", schoolFeeAnnual: 15_000,
      dateOfBirth: "2020-03-10", // age 5, school started at 4
      schoolStartAge: 4, schoolEndAge: 18,
    });

    const timeline = generateSchoolFeeTimeline([child1, child2]);

    for (const year of timeline) {
      const childTotal = (year["c1"] ?? 0) + (year["c2"] ?? 0);
      expect(year.total).toBe(childTotal);
    }
  });

  it("handles children with different school year ranges", () => {
    // child1: school 2022-2036 (born 2018, ages 4-18)
    // child2: school 2028-2038 (born 2024, ages 4-14, i.e. ends at 14)
    const child1 = makeChild({ id: "c1", schoolFeeAnnual: 18_000 });
    const child2 = makeChild({
      id: "c2", schoolFeeAnnual: 12_000,
      dateOfBirth: "2024-01-01", schoolStartAge: 4, schoolEndAge: 14,
    });

    const timeline = generateSchoolFeeTimeline([child1, child2]);

    // Timeline should start at 2026 (max of current year and earliest start)
    // and end at 2038 (latest end)
    expect(timeline[0].calendarYear).toBe(2026);
    expect(timeline[timeline.length - 1].calendarYear).toBe(2038);

    // In 2026, only child1 is in school (child2 starts 2028)
    const year2026 = timeline.find((t) => t.calendarYear === 2026)!;
    expect(year2026["c1"]).toBe(18_000);
    expect(year2026["c2"]).toBeUndefined();

    // In 2029, both children are in school
    const year2029 = timeline.find((t) => t.calendarYear === 2029)!;
    expect(year2029["c1"]).toBeGreaterThan(0);
    expect(year2029["c2"]).toBeGreaterThan(0);

    // In 2037, only child2 is in school (child1 finished 2036)
    const year2037 = timeline.find((t) => t.calendarYear === 2037);
    if (year2037) {
      expect(year2037["c1"]).toBeUndefined();
      expect(year2037["c2"]).toBeGreaterThan(0);
    }
  });
});

// --- calculateTotalEducationCommitment ---

describe("calculateTotalEducationCommitment", () => {
  it("returns 0 for no children", () => {
    expect(calculateTotalEducationCommitment([])).toBe(0);
  });

  it("returns sum of individual projected costs", () => {
    const child1 = makeChild({ id: "c1", schoolFeeAnnual: 18_000 });
    const child2 = makeChild({
      id: "c2", schoolFeeAnnual: 15_000,
      dateOfBirth: "2020-03-10",
    });

    const total = calculateTotalEducationCommitment([child1, child2]);
    const expected = calculateTotalSchoolFeeCost(child1) + calculateTotalSchoolFeeCost(child2);
    expect(total).toBe(expected);
  });

  it("excludes children with zero fees", () => {
    const child1 = makeChild({ id: "c1", schoolFeeAnnual: 18_000 });
    const child2 = makeChild({ id: "c2", schoolFeeAnnual: 0 });

    const total = calculateTotalEducationCommitment([child1, child2]);
    expect(total).toBe(calculateTotalSchoolFeeCost(child1));
  });
});

// --- findLastSchoolFeeYear ---

describe("findLastSchoolFeeYear", () => {
  it("returns null for no children", () => {
    expect(findLastSchoolFeeYear([])).toBeNull();
  });

  it("returns null for children with zero fees", () => {
    const child = makeChild({ schoolFeeAnnual: 0 });
    expect(findLastSchoolFeeYear([child])).toBeNull();
  });

  it("returns the last school end year for a single child", () => {
    const child = makeChild({ dateOfBirth: "2018-06-15", schoolEndAge: 18 });
    // end year = 2018 + 18 = 2036
    expect(findLastSchoolFeeYear([child])).toBe(2036);
  });

  it("returns the latest end year across multiple children", () => {
    const child1 = makeChild({ id: "c1", dateOfBirth: "2018-06-15", schoolEndAge: 18 }); // 2036
    const child2 = makeChild({ id: "c2", dateOfBirth: "2022-01-01", schoolEndAge: 18 }); // 2040

    expect(findLastSchoolFeeYear([child1, child2])).toBe(2040);
  });
});
