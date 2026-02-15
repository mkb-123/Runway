import { describe, it, expect } from "vitest";
import { generateCashFlowTimeline } from "../cash-flow";
import type { HouseholdData } from "@/types";

/**
 * Build a minimal HouseholdData with a single earner.
 * Defaults produce a straightforward salary-sacrifice pension scenario.
 */
function buildMinimalHousehold(overrides?: {
  grossSalary?: number;
  employeePensionContribution?: number;
  pensionContributionMethod?: "salary_sacrifice" | "net_pay" | "relief_at_source";
}): HouseholdData {
  const grossSalary = overrides?.grossSalary ?? 80000;
  const employeePensionContribution = overrides?.employeePensionContribution ?? 4000;
  const pensionContributionMethod = overrides?.pensionContributionMethod ?? "salary_sacrifice";

  return {
    persons: [
      {
        id: "person-1",
        name: "Test Person",
        relationship: "self",
        dateOfBirth: "1990-01-01",
        plannedRetirementAge: 60,
        pensionAccessAge: 57,
        stateRetirementAge: 67,
        niQualifyingYears: 20,
        studentLoanPlan: "none",
      },
    ],
    accounts: [],
    income: [
      {
        personId: "person-1",
        grossSalary,
        employerPensionContribution: 4000,
        employeePensionContribution,
        pensionContributionMethod,
      },
    ],
    bonusStructures: [
      {
        personId: "person-1",
        cashBonusAnnual: 0,
        deferredBonusAnnual: 0,
        vestingYears: 3,
        estimatedAnnualReturn: 0.08,
      },
    ],
    contributions: [],
    retirement: {
      targetAnnualIncome: 40000,
      withdrawalRate: 0.04,
      includeStatePension: false,
      scenarioRates: [0.04, 0.07, 0.10],
    },
    emergencyFund: {
      monthlyEssentialExpenses: 2000,
      targetMonths: 6,
      monthlyLifestyleSpending: 1500,
    },
    iht: {
      estimatedPropertyValue: 0,
      passingToDirectDescendants: false,
      gifts: [],
    },
    committedOutgoings: [],
    dashboardConfig: {
      heroMetrics: ["net_worth", "fire_progress", "retirement_countdown"],
    },
  };
}

describe("generateCashFlowTimeline", () => {
  it("returns 24 months of data", () => {
    const household = buildMinimalHousehold();
    const timeline = generateCashFlowTimeline(household);
    expect(timeline).toHaveLength(24);
  });

  it("salary field uses take-home pay, not gross salary", () => {
    // An £80k earner with £4k salary sacrifice pension should have
    // monthly salary in the output that is well below gross/12 (£6,666.67),
    // because tax, NI and pension have been deducted.
    const grossSalary = 80000;
    const household = buildMinimalHousehold({ grossSalary });
    const timeline = generateCashFlowTimeline(household);

    const monthlyGross = grossSalary / 12;

    // Every month's salary should be less than the gross monthly figure
    for (const month of timeline) {
      expect(month.salary).toBeLessThan(monthlyGross);
      // And it should still be positive (sanity check)
      expect(month.salary).toBeGreaterThan(0);
    }
  });

  it("higher gross salary still results in salary below gross/12", () => {
    const grossSalary = 150000;
    const household = buildMinimalHousehold({
      grossSalary,
      employeePensionContribution: 7500,
    });
    const timeline = generateCashFlowTimeline(household);

    const monthlyGross = grossSalary / 12;

    // First month (no growth applied yet) should reflect take-home
    expect(timeline[0].salary).toBeLessThan(monthlyGross);
    expect(timeline[0].salary).toBeGreaterThan(0);
  });

  it("net pay pension method also produces salary below gross/12", () => {
    const grossSalary = 60000;
    const household = buildMinimalHousehold({
      grossSalary,
      employeePensionContribution: 3000,
      pensionContributionMethod: "net_pay",
    });
    const timeline = generateCashFlowTimeline(household);

    const monthlyGross = grossSalary / 12;
    expect(timeline[0].salary).toBeLessThan(monthlyGross);
    expect(timeline[0].salary).toBeGreaterThan(0);
  });

  it("relief at source pension method also produces salary below gross/12", () => {
    const grossSalary = 60000;
    const household = buildMinimalHousehold({
      grossSalary,
      employeePensionContribution: 3000,
      pensionContributionMethod: "relief_at_source",
    });
    const timeline = generateCashFlowTimeline(household);

    const monthlyGross = grossSalary / 12;
    expect(timeline[0].salary).toBeLessThan(monthlyGross);
    expect(timeline[0].salary).toBeGreaterThan(0);
  });

  it("salary with zero pension contribution is still net of tax and NI", () => {
    const grossSalary = 50000;
    const household = buildMinimalHousehold({
      grossSalary,
      employeePensionContribution: 0,
    });
    const timeline = generateCashFlowTimeline(household);

    const monthlyGross = grossSalary / 12;

    // Even without pension deductions, tax and NI mean take-home < gross
    expect(timeline[0].salary).toBeLessThan(monthlyGross);
    expect(timeline[0].salary).toBeGreaterThan(0);
  });

  it("each month label follows 'Mon YYYY' format", () => {
    const household = buildMinimalHousehold();
    const timeline = generateCashFlowTimeline(household);
    const monthPattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;
    for (const month of timeline) {
      expect(month.month).toMatch(monthPattern);
    }
  });

  it("totalIncome equals salary + bonus + deferredVesting", () => {
    const household = buildMinimalHousehold();
    const timeline = generateCashFlowTimeline(household);
    for (const month of timeline) {
      expect(month.totalIncome).toBeCloseTo(
        month.salary + month.bonus + month.deferredVesting,
        2
      );
    }
  });

  it("totalOutgoings equals committedOutgoings + lifestyleSpending", () => {
    const household = buildMinimalHousehold();
    const timeline = generateCashFlowTimeline(household);
    for (const month of timeline) {
      expect(month.totalOutgoings).toBeCloseTo(
        month.committedOutgoings + month.lifestyleSpending,
        2
      );
    }
  });
});
