import { describe, it, expect } from "vitest";
import { calculateSensitivity } from "../sensitivity";
import { makeTestHousehold, makePerson, makeEmptyHousehold } from "./test-fixtures";

// ============================================================
// Sensitivity Analysis Tests
// ============================================================

describe("calculateSensitivity", () => {
  it("returns ranked inputs sorted by absolute impact", () => {
    const household = makeTestHousehold({
      persons: [
        makePerson({
          id: "p1",
          dateOfBirth: "1980-01-15",
          plannedRetirementAge: 60,
          niQualifyingYears: 30,
        }),
      ],
      accounts: [
        { id: "a1", personId: "p1", type: "sipp", provider: "AJ Bell", name: "SIPP", currentValue: 500_000 },
        { id: "a2", personId: "p1", type: "stocks_and_shares_isa", provider: "V", name: "ISA", currentValue: 100_000 },
      ],
      income: [
        {
          personId: "p1",
          grossSalary: 100_000,
          employerPensionContribution: 10_000,
          employeePensionContribution: 5_000,
          pensionContributionMethod: "salary_sacrifice" as const,
        },
      ],
      contributions: [
        { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 1_000, frequency: "monthly" as const },
      ],
    });

    const result = calculateSensitivity(household);

    expect(result.inputs.length).toBeGreaterThanOrEqual(5);
    expect(result.baselineValue).toBeGreaterThan(0);
    expect(result.metricLabel).toBe("Projected Pot at Retirement");

    // Sorted by absolute impact
    for (let i = 1; i < result.inputs.length; i++) {
      expect(Math.abs(result.inputs[i - 1].impact)).toBeGreaterThanOrEqual(
        Math.abs(result.inputs[i].impact)
      );
    }
  });

  it("growth rate has significant impact", () => {
    const household = makeTestHousehold({
      persons: [
        makePerson({
          id: "p1",
          dateOfBirth: "1980-01-15",
          plannedRetirementAge: 60,
          niQualifyingYears: 30,
        }),
      ],
      accounts: [
        { id: "a1", personId: "p1", type: "sipp", provider: "AJ Bell", name: "SIPP", currentValue: 500_000 },
      ],
      income: [
        {
          personId: "p1",
          grossSalary: 100_000,
          employerPensionContribution: 10_000,
          employeePensionContribution: 5_000,
          pensionContributionMethod: "salary_sacrifice" as const,
        },
      ],
      contributions: [],
    });

    const result = calculateSensitivity(household);
    const growthInput = result.inputs.find(i => i.label === "Investment return rate");

    expect(growthInput).toBeDefined();
    expect(growthInput!.impact).toBeGreaterThan(0); // higher rate -> higher pot
  });

  it("retirement age extension has positive impact", () => {
    const household = makeTestHousehold({
      persons: [
        makePerson({
          id: "p1",
          dateOfBirth: "1980-01-15",
          plannedRetirementAge: 60,
          niQualifyingYears: 30,
        }),
      ],
      accounts: [
        { id: "a1", personId: "p1", type: "sipp", provider: "AJ Bell", name: "SIPP", currentValue: 300_000 },
      ],
      income: [
        {
          personId: "p1",
          grossSalary: 80_000,
          employerPensionContribution: 4_000,
          employeePensionContribution: 4_000,
          pensionContributionMethod: "salary_sacrifice" as const,
        },
      ],
      contributions: [
        { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 500, frequency: "monthly" as const },
      ],
    });

    const result = calculateSensitivity(household);
    const retAge = result.inputs.find(i => i.label === "Retirement age");

    expect(retAge).toBeDefined();
    expect(retAge!.impact).toBeGreaterThan(0); // extra year -> bigger pot
  });

  it("handles empty household gracefully", () => {
    const household = makeEmptyHousehold();
    const result = calculateSensitivity(household);
    expect(result.inputs).toHaveLength(0);
    expect(result.baselineValue).toBe(0);
  });

  it("all inputs have labels and units", () => {
    const household = makeTestHousehold({
      persons: [
        makePerson({ id: "p1", dateOfBirth: "1985-06-15", plannedRetirementAge: 65, niQualifyingYears: 25 }),
      ],
    });
    const result = calculateSensitivity(household);
    for (const input of result.inputs) {
      expect(input.label).toBeTruthy();
      expect(input.unit).toBeTruthy();
      expect(typeof input.impact).toBe("number");
      expect(typeof input.currentValue).toBe("number");
    }
  });
});
