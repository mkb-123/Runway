import { describe, it, expect } from "vitest";
import {
  projectPropertyEquity,
  projectMortgageBalance,
  generateAmortizationSchedule,
  projectTotalPropertyEquity,
  calculateMortgagePayoffYears,
} from "@/lib/property";
import {
  getMortgageRemainingMonths,
  getAnnualMortgagePayment,
} from "@/types";
import { makeProperty, makeTestHousehold } from "./test-fixtures";
import { calculateYearsUntilIHTExceeded } from "@/lib/iht";

// ============================================================
// Property Appreciation
// ============================================================

describe("projectPropertyEquity — appreciation only", () => {
  it("projects property value growth with no mortgage", () => {
    const p = makeProperty({ estimatedValue: 500000, mortgageBalance: 0, appreciationRate: 0.03 });
    const result = projectPropertyEquity(p, 10);
    expect(result).toHaveLength(11);
    expect(result[0].propertyValue).toBe(500000);
    expect(result[0].equity).toBe(500000);
    // After 10 years at 3%: 500000 * 1.03^10 ≈ 671958
    expect(result[10].propertyValue).toBeCloseTo(671958, -1);
    expect(result[10].equity).toBeCloseTo(671958, -1);
  });

  it("uses 0% appreciation by default", () => {
    const p = makeProperty({ estimatedValue: 500000, mortgageBalance: 0 });
    const result = projectPropertyEquity(p, 5);
    expect(result[5].propertyValue).toBe(500000);
  });

  it("handles negative appreciation (depreciation)", () => {
    const p = makeProperty({ estimatedValue: 500000, mortgageBalance: 0, appreciationRate: -0.05 });
    const result = projectPropertyEquity(p, 1);
    expect(result[1].propertyValue).toBe(475000);
  });
});

// ============================================================
// Mortgage Amortization
// ============================================================

describe("projectMortgageBalance", () => {
  it("returns static balance when no rate/term provided", () => {
    const p = makeProperty({ mortgageBalance: 200000 });
    const result = projectMortgageBalance(p, 5);
    expect(result).toHaveLength(6);
    expect(result.every((b) => b === 200000)).toBe(true);
  });

  it("returns all zeros for no mortgage", () => {
    const p = makeProperty({ mortgageBalance: 0 });
    const result = projectMortgageBalance(p, 5);
    expect(result.every((b) => b === 0)).toBe(true);
  });

  it("amortizes mortgage over time with rate/term/start", () => {
    // 200k mortgage at 4% over 25 years, started 5 years ago
    const now = new Date("2026-02-22");
    const startDate = "2021-02-22"; // 5 years ago, 20 years remaining
    const p = makeProperty({
      mortgageBalance: 200000,
      mortgageRate: 0.04,
      mortgageTerm: 25,
      mortgageStartDate: startDate,
    });
    const result = projectMortgageBalance(p, 20, now);
    expect(result[0]).toBe(200000);
    // After 5 years, balance should have reduced
    expect(result[5]).toBeLessThan(200000);
    expect(result[5]).toBeGreaterThan(100000);
    // At year 20 (end of mortgage), balance should be ~0
    expect(result[20]).toBeLessThan(100);
  });

  it("returns 0 when mortgage term has expired", () => {
    const now = new Date("2026-02-22");
    const p = makeProperty({
      mortgageBalance: 200000,
      mortgageRate: 0.04,
      mortgageTerm: 5,
      mortgageStartDate: "2020-01-01", // 6+ years ago, term expired
    });
    const result = projectMortgageBalance(p, 5, now);
    expect(result.every((b) => b === 0)).toBe(true);
  });
});

describe("getMortgageRemainingMonths", () => {
  it("returns remaining months correctly", () => {
    const now = new Date("2026-02-22");
    const p = makeProperty({
      mortgageTerm: 25,
      mortgageStartDate: "2021-02-22", // 5 years ago
    });
    expect(getMortgageRemainingMonths(p, now)).toBe(240); // 20 years = 240 months
  });

  it("returns 0 when no start date", () => {
    const p = makeProperty({ mortgageTerm: 25 });
    expect(getMortgageRemainingMonths(p)).toBe(0);
  });

  it("returns 0 when past term end", () => {
    const now = new Date("2060-01-01");
    const p = makeProperty({
      mortgageTerm: 25,
      mortgageStartDate: "2020-01-01",
    });
    expect(getMortgageRemainingMonths(p, now)).toBe(0);
  });
});

describe("getAnnualMortgagePayment", () => {
  it("calculates annual payment for a standard mortgage", () => {
    const now = new Date("2026-02-22");
    const p = makeProperty({
      mortgageBalance: 200000,
      mortgageRate: 0.04,
      mortgageTerm: 25,
      mortgageStartDate: "2021-02-22",
    });
    const annual = getAnnualMortgagePayment(p, now);
    // Monthly payment for 200k at 4% over 20 remaining years ≈ £1,212
    // Annual ≈ £14,544
    expect(annual).toBeGreaterThan(14000);
    expect(annual).toBeLessThan(16000);
  });

  it("returns 0 when no rate", () => {
    const p = makeProperty({ mortgageBalance: 200000 });
    expect(getAnnualMortgagePayment(p)).toBe(0);
  });

  it("returns 0 when no balance", () => {
    const p = makeProperty({ mortgageBalance: 0, mortgageRate: 0.04 });
    expect(getAnnualMortgagePayment(p)).toBe(0);
  });
});

describe("generateAmortizationSchedule", () => {
  it("generates monthly schedule", () => {
    const now = new Date("2026-02-22");
    const p = makeProperty({
      mortgageBalance: 200000,
      mortgageRate: 0.04,
      mortgageTerm: 25,
      mortgageStartDate: "2021-02-22", // 20 years remaining = 240 months
    });
    const schedule = generateAmortizationSchedule(p, now);
    expect(schedule).toHaveLength(240);
    expect(schedule[0].openingBalance).toBe(200000);
    // First month: interest = 200000 * 0.04/12 ≈ 667
    expect(schedule[0].interestPayment).toBeCloseTo(667, -1);
    // Last month closing balance should be 0
    expect(schedule[239].closingBalance).toBe(0);
  });

  it("returns empty for incomplete mortgage data", () => {
    const p = makeProperty({ mortgageBalance: 200000 });
    expect(generateAmortizationSchedule(p)).toEqual([]);
  });
});

// ============================================================
// Combined property + appreciation + amortization
// ============================================================

describe("projectPropertyEquity — with mortgage amortization", () => {
  it("shows equity growing from both appreciation and mortgage paydown", () => {
    const now = new Date("2026-02-22");
    const p = makeProperty({
      estimatedValue: 500000,
      mortgageBalance: 200000,
      appreciationRate: 0.03,
      mortgageRate: 0.04,
      mortgageTerm: 25,
      mortgageStartDate: "2021-02-22",
    });
    const result = projectPropertyEquity(p, 10, now);
    // Year 0: equity = 500k - 200k = 300k
    expect(result[0].equity).toBe(300000);
    // After 10 years: value ~672k, mortgage ~110k, equity ~562k
    expect(result[10].equity).toBeGreaterThan(500000);
    expect(result[10].mortgageBalance).toBeLessThan(200000);
    expect(result[10].propertyValue).toBeGreaterThan(500000);
  });
});

describe("projectTotalPropertyEquity", () => {
  it("sums equity across multiple properties with different growth rates", () => {
    const now = new Date("2026-02-22");
    const properties = [
      makeProperty({ id: "p1", estimatedValue: 500000, mortgageBalance: 0, appreciationRate: 0.03 }),
      makeProperty({ id: "p2", estimatedValue: 300000, mortgageBalance: 100000, appreciationRate: 0.05 }),
    ];
    const equity = projectTotalPropertyEquity(properties, 5, now);
    // p1: 500k * 1.03^5 ≈ 579637
    // p2: value 300k * 1.05^5 ≈ 382884, mortgage static (no rate/term) ≈ 100k, equity ≈ 282884
    expect(equity).toBeGreaterThan(800000);
  });
});

describe("calculateMortgagePayoffYears", () => {
  it("returns years to payoff", () => {
    const now = new Date("2026-02-22");
    const p = makeProperty({
      mortgageBalance: 200000,
      mortgageRate: 0.04,
      mortgageTerm: 25,
      mortgageStartDate: "2021-02-22",
    });
    expect(calculateMortgagePayoffYears(p, now)).toBe(20);
  });

  it("returns 0 when no mortgage", () => {
    const p = makeProperty({ mortgageBalance: 0 });
    expect(calculateMortgagePayoffYears(p)).toBe(0);
  });

  it("returns null when no rate/term info", () => {
    const p = makeProperty({ mortgageBalance: 200000 });
    expect(calculateMortgagePayoffYears(p)).toBeNull();
  });
});

// ============================================================
// IHT integration with property appreciation
// ============================================================

describe("calculateYearsUntilIHTExceeded with property appreciation", () => {
  it("returns sooner when property appreciation is included", () => {
    // Estate: 400k non-property + 600k property = 1M
    // Threshold: 1M
    // Without property growth: already at threshold
    const yearsWithoutGrowth = calculateYearsUntilIHTExceeded(
      1_000_000, 1_000_000, 0, 0
    );
    expect(yearsWithoutGrowth).toBe(0);

    // Estate: 300k non-property + 600k property = 900k, threshold 1M
    // With property growing at 5%: property reaches ~776k in year 5 (total ~400k if non-property grows at 3%)
    const yearsWithPropertyGrowth = calculateYearsUntilIHTExceeded(
      900_000,
      1_000_000,
      0,
      0.03,
      (year: number) => 600_000 * Math.pow(1.05, year),
      600_000
    );
    // Should reach threshold relatively quickly due to combined growth
    expect(yearsWithPropertyGrowth).not.toBeNull();
    expect(yearsWithPropertyGrowth!).toBeGreaterThan(0);
    expect(yearsWithPropertyGrowth!).toBeLessThan(10);
  });

  it("works without property appreciation function (backward compatible)", () => {
    const years = calculateYearsUntilIHTExceeded(
      500_000, 1_000_000, 50_000, 0.05
    );
    expect(years).not.toBeNull();
    expect(years!).toBeGreaterThan(0);
  });
});
