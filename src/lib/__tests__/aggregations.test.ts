import { describe, it, expect } from "vitest";
import {
  getTotalNetWorth,
  getNetWorthByPerson,
  getNetWorthByWrapper,
  getNetWorthByAccountType,
  calculateTotalAnnualContributions,
  calculatePersonalAnnualContributions,
} from "../aggregations";
import type { HouseholdData } from "@/types";

function makeHousehold(overrides: Partial<HouseholdData> = {}): HouseholdData {
  return {
    persons: [
      { id: "p1", name: "Alice", relationship: "primary", dateOfBirth: "1980-01-01", plannedRetirementAge: 60, niQualifyingYears: 35 },
      { id: "p2", name: "Bob", relationship: "partner", dateOfBirth: "1982-06-15", plannedRetirementAge: 60, niQualifyingYears: 30 },
    ],
    accounts: [
      { id: "a1", personId: "p1", type: "stocks_and_shares_isa", provider: "AJB", name: "ISA", currentValue: 100000 },
      { id: "a2", personId: "p1", type: "sipp", provider: "AJB", name: "SIPP", currentValue: 200000 },
      { id: "a3", personId: "p2", type: "gia", provider: "HL", name: "GIA", currentValue: 50000 },
      { id: "a4", personId: "p2", type: "cash_savings", provider: "Nat", name: "Cash", currentValue: 30000 },
    ],
    income: [],
    bonusStructures: [],
    contributions: [],
    children: [],
    retirement: { targetAnnualIncome: 50000, withdrawalRate: 0.04, includeStatePension: true, scenarioRates: [0.05, 0.07] },
    emergencyFund: { monthlyEssentialExpenses: 3000, targetMonths: 6, monthlyLifestyleSpending: 1500 },
    iht: { estimatedPropertyValue: 0, passingToDirectDescendants: false, gifts: [] },
    committedOutgoings: [],
    dashboardConfig: { heroMetrics: ["net_worth"] },
    ...overrides,
  };
}

describe("getTotalNetWorth", () => {
  it("sums all account values", () => {
    const household = makeHousehold();
    expect(getTotalNetWorth(household)).toBe(380000);
  });

  it("returns 0 for no accounts", () => {
    const household = makeHousehold({ accounts: [] });
    expect(getTotalNetWorth(household)).toBe(0);
  });
});

describe("getNetWorthByPerson", () => {
  it("groups values by person", () => {
    const household = makeHousehold();
    const result = getNetWorthByPerson(household);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.name === "Alice")?.value).toBe(300000);
    expect(result.find((r) => r.name === "Bob")?.value).toBe(80000);
  });

  it("returns 0 for person with no accounts", () => {
    const household = makeHousehold({ accounts: [] });
    const result = getNetWorthByPerson(household);
    expect(result.every((r) => r.value === 0)).toBe(true);
  });
});

describe("getNetWorthByWrapper", () => {
  it("groups values by tax wrapper", () => {
    const household = makeHousehold();
    const result = getNetWorthByWrapper(household);
    const isa = result.find((r) => r.wrapper === "isa");
    const pension = result.find((r) => r.wrapper === "pension");
    const gia = result.find((r) => r.wrapper === "gia");
    const cash = result.find((r) => r.wrapper === "cash");
    expect(isa?.value).toBe(100000);
    expect(pension?.value).toBe(200000);
    expect(gia?.value).toBe(50000);
    expect(cash?.value).toBe(30000);
  });
});

describe("getNetWorthByAccountType", () => {
  it("groups values by account type", () => {
    const household = makeHousehold();
    const result = getNetWorthByAccountType(household);
    expect(result).toHaveLength(4);
    expect(result.find((r) => r.type === "sipp")?.value).toBe(200000);
    expect(result.find((r) => r.type === "stocks_and_shares_isa")?.value).toBe(100000);
  });
});

describe("calculatePersonalAnnualContributions vs calculateTotalAnnualContributions", () => {
  const income = [
    {
      personId: "p1",
      grossSalary: 100000,
      employerPensionContribution: 10000,
      employeePensionContribution: 5000,
      pensionContributionMethod: "salary_sacrifice" as const,
    },
  ];
  const contributions = [
    { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 1000, frequency: "monthly" as const },
  ];

  it("total includes employer contributions", () => {
    const total = calculateTotalAnnualContributions(contributions, income);
    // ISA: 1000*12 + employee: 5000 + employer: 10000 = 27000
    expect(total).toBe(27000);
  });

  it("personal excludes employer contributions", () => {
    const personal = calculatePersonalAnnualContributions(contributions, income);
    // ISA: 1000*12 + employee: 5000 = 17000
    expect(personal).toBe(17000);
  });

  it("difference is exactly employer contributions", () => {
    const total = calculateTotalAnnualContributions(contributions, income);
    const personal = calculatePersonalAnnualContributions(contributions, income);
    expect(total - personal).toBe(10000);
  });
});
