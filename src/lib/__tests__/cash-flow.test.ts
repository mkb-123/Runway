import { describe, it, expect } from "vitest";
import { generateCashFlowTimeline, calculateCashRunway } from "../cash-flow";
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
        totalBonusAnnual: 0,
        cashBonusAnnual: 0,
        vestingYears: 3,
        vestingGapYears: 0,
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
    properties: [],
    iht: {
      estimatedPropertyValue: 0,
      passingToDirectDescendants: false,
      gifts: [],
    },
    committedOutgoings: [],
    dashboardConfig: {
      heroMetrics: ["projected_retirement_income", "fire_progress", "retirement_countdown"],
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

  it("bonus is paid in configured month, not always March", () => {
    const household = buildMinimalHousehold();
    household.bonusStructures = [
      {
        personId: "person-1",
        totalBonusAnnual: 20000,
        cashBonusAnnual: 20000,
        vestingYears: 0,
        vestingGapYears: 0,
        estimatedAnnualReturn: 0,
        bonusPaymentMonth: 1, // February
      },
    ];
    const timeline = generateCashFlowTimeline(household);

    // Find all months with bonus > 0
    const bonusMonths = timeline.filter((m) => m.bonus > 0);
    expect(bonusMonths.length).toBeGreaterThan(0);

    // All bonus months should be February
    for (const m of bonusMonths) {
      expect(m.month).toMatch(/^Feb /);
    }
  });

  it("bonus income is net of tax (less than gross bonus)", () => {
    const household = buildMinimalHousehold({ grossSalary: 100000 });
    household.bonusStructures = [
      {
        personId: "person-1",
        totalBonusAnnual: 20000,
        cashBonusAnnual: 20000,
        vestingYears: 0,
        vestingGapYears: 0,
        estimatedAnnualReturn: 0,
      },
    ];
    const timeline = generateCashFlowTimeline(household);

    // Find March months (default bonus month)
    const marchMonths = timeline.filter((m) => m.month.startsWith("Mar"));
    expect(marchMonths.length).toBeGreaterThan(0);

    // Bonus should be less than gross (tax + NI deducted)
    for (const m of marchMonths) {
      expect(m.bonus).toBeGreaterThan(0);
      expect(m.bonus).toBeLessThan(20000);
    }
  });
});

describe("calculateCashRunway", () => {
  it("returns runway in months based on cash vs outgoings", () => {
    const household = buildMinimalHousehold();
    household.accounts = [
      {
        id: "cash-1",
        personId: "person-1",
        type: "cash_savings",
        provider: "Bank",
        name: "Current Account",
        currentValue: 30000,
      },
    ];
    household.committedOutgoings = [
      {
        id: "mortgage",
        category: "mortgage",
        label: "Mortgage",
        amount: 2000,
        frequency: "monthly",
      },
    ];
    // Monthly outgoings = mortgage (2000) + lifestyle (1500) = 3500
    const runway = calculateCashRunway(household);
    expect(runway).toBeCloseTo(30000 / 3500, 1);
  });

  it("includes cash ISA and premium bonds in liquid assets", () => {
    const household = buildMinimalHousehold();
    household.accounts = [
      { id: "a1", personId: "person-1", type: "cash_savings", provider: "X", name: "Cash", currentValue: 10000 },
      { id: "a2", personId: "person-1", type: "cash_isa", provider: "X", name: "Cash ISA", currentValue: 15000 },
      { id: "a3", personId: "person-1", type: "premium_bonds", provider: "NS&I", name: "PBonds", currentValue: 5000 },
    ];
    household.committedOutgoings = [];
    // Monthly outgoings = lifestyle only (1500)
    const runway = calculateCashRunway(household);
    expect(runway).toBeCloseTo(30000 / 1500, 1);
  });

  it("returns 999 when no outgoings", () => {
    const household = buildMinimalHousehold();
    household.accounts = [
      { id: "a1", personId: "person-1", type: "cash_savings", provider: "X", name: "Cash", currentValue: 10000 },
    ];
    household.committedOutgoings = [];
    household.emergencyFund.monthlyLifestyleSpending = 0;
    const runway = calculateCashRunway(household);
    expect(runway).toBe(999);
  });

  it("FEAT-018: filters to person's accounts when personId provided", () => {
    const household = buildMinimalHousehold();
    household.persons.push({
      id: "person-2",
      name: "Spouse",
      relationship: "spouse",
      dateOfBirth: "1992-01-01",
      plannedRetirementAge: 60,
      pensionAccessAge: 57,
      stateRetirementAge: 67,
      niQualifyingYears: 15,
      studentLoanPlan: "none",
    });
    household.accounts = [
      { id: "a1", personId: "person-1", type: "cash_savings", provider: "X", name: "Cash", currentValue: 30000 },
      { id: "a2", personId: "person-2", type: "cash_savings", provider: "Y", name: "Cash", currentValue: 10000 },
    ];
    household.committedOutgoings = [
      { id: "o1", category: "mortgage", label: "Mortgage", amount: 2000, frequency: "monthly" },
    ];
    // Monthly outgoings = 2000 (mortgage, household-wide) + 1500 (lifestyle) = 3500

    const householdRunway = calculateCashRunway(household);
    expect(householdRunway).toBeCloseTo(40000 / 3500, 1);

    // Person-1 only has 30000 in cash
    const person1Runway = calculateCashRunway(household, "person-1");
    expect(person1Runway).toBeCloseTo(30000 / 3500, 1);

    // Person-2 only has 10000 in cash
    const person2Runway = calculateCashRunway(household, "person-2");
    expect(person2Runway).toBeCloseTo(10000 / 3500, 1);
  });

  it("FEAT-018: excludes other person's outgoings when filtering", () => {
    const household = buildMinimalHousehold();
    household.accounts = [
      { id: "a1", personId: "person-1", type: "cash_savings", provider: "X", name: "Cash", currentValue: 30000 },
    ];
    household.committedOutgoings = [
      { id: "o1", category: "mortgage", label: "Mortgage", amount: 1000, frequency: "monthly" },
      { id: "o2", category: "insurance", label: "Life Insurance", amount: 100, frequency: "monthly", personId: "person-2" },
    ];
    // Person-1 should NOT include person-2's life insurance
    const person1Runway = calculateCashRunway(household, "person-1");
    expect(person1Runway).toBeCloseTo(30000 / 2500, 1); // 1000 + 1500 lifestyle

    const householdRunway = calculateCashRunway(household);
    expect(householdRunway).toBeCloseTo(30000 / 2600, 1); // 1000 + 100 + 1500 lifestyle
  });
});
