import { describe, it, expect } from "vitest";
import { applyScenarioOverrides, type ScenarioOverrides } from "@/lib/scenario";
import type { HouseholdData } from "@/types";

function makeHousehold(overrides?: Partial<HouseholdData>): HouseholdData {
  return {
    persons: [
      { id: "p1", name: "Alice", relationship: "self", dateOfBirth: "1990-01-01", plannedRetirementAge: 60, pensionAccessAge: 57, stateRetirementAge: 67, niQualifyingYears: 35, studentLoanPlan: "none" },
      { id: "p2", name: "Bob", relationship: "spouse", dateOfBirth: "1992-01-01", plannedRetirementAge: 60, pensionAccessAge: 57, stateRetirementAge: 67, niQualifyingYears: 35, studentLoanPlan: "none" },
    ],
    accounts: [
      { id: "a1", personId: "p1", type: "stocks_and_shares_isa", provider: "V", name: "ISA", currentValue: 100000 },
      { id: "a2", personId: "p2", type: "workplace_pension", provider: "F", name: "Pension", currentValue: 200000 },
    ],
    income: [
      { personId: "p1", grossSalary: 80000, employerPensionContribution: 4000, employeePensionContribution: 4000, pensionContributionMethod: "salary_sacrifice" },
      { personId: "p2", grossSalary: 50000, employerPensionContribution: 2500, employeePensionContribution: 2500, pensionContributionMethod: "net_pay" },
    ],
    bonusStructures: [],
    contributions: [
      { id: "c1", personId: "p1", label: "Monthly ISA", target: "isa", amount: 1666, frequency: "monthly" },
      { id: "c2", personId: "p2", label: "Annual Pension", target: "pension", amount: 10000, frequency: "annually" },
    ],
    retirement: { targetAnnualIncome: 40000, withdrawalRate: 0.04, includeStatePension: true, scenarioRates: [0.05, 0.07] },
    emergencyFund: { monthlyEssentialExpenses: 2000, targetMonths: 6, monthlyLifestyleSpending: 1500 },
    iht: { estimatedPropertyValue: 400000, passingToDirectDescendants: true, gifts: [] },
    children: [],
    committedOutgoings: [],
    dashboardConfig: { heroMetrics: ["net_worth", "fire_progress", "retirement_countdown"] },
    ...overrides,
  };
}

describe("applyScenarioOverrides", () => {
  it("returns household unchanged when overrides are empty", () => {
    const h = makeHousehold();
    const result = applyScenarioOverrides(h, {});
    expect(result).toEqual(h);
  });

  describe("income overrides", () => {
    it("merges partial income overrides by personId", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        income: [{ personId: "p1", grossSalary: 100000 }],
      };
      const result = applyScenarioOverrides(h, overrides);
      expect(result.income[0].grossSalary).toBe(100000);
      // Other fields unchanged
      expect(result.income[0].employerPensionContribution).toBe(4000);
      // Person 2 unchanged
      expect(result.income[1].grossSalary).toBe(50000);
    });

    it("applies salary and pension overrides for the same person", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        income: [{ personId: "p1", grossSalary: 120000, employeePensionContribution: 20000 }],
      };
      const result = applyScenarioOverrides(h, overrides);
      expect(result.income[0].grossSalary).toBe(120000);
      expect(result.income[0].employeePensionContribution).toBe(20000);
      // Other fields preserved
      expect(result.income[0].employerPensionContribution).toBe(4000);
      expect(result.income[0].pensionContributionMethod).toBe("salary_sacrifice");
    });

    it("applies overrides to different persons independently", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        income: [
          { personId: "p1", employeePensionContribution: 20000 },
          { personId: "p2", grossSalary: 70000 },
        ],
      };
      const result = applyScenarioOverrides(h, overrides);
      // P1: pension changed, salary preserved
      expect(result.income[0].employeePensionContribution).toBe(20000);
      expect(result.income[0].grossSalary).toBe(80000);
      // P2: salary changed, pension preserved
      expect(result.income[1].grossSalary).toBe(70000);
      expect(result.income[1].employeePensionContribution).toBe(2500);
    });

    it("allows zero salary for redundancy scenario", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        income: [{ personId: "p1", grossSalary: 0 }],
      };
      const result = applyScenarioOverrides(h, overrides);
      expect(result.income[0].grossSalary).toBe(0);
      // Other fields preserved
      expect(result.income[0].employerPensionContribution).toBe(4000);
    });
  });

  describe("contribution overrides", () => {
    it("replaces contributions for overridden persons with synthetic ones", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        contributionOverrides: [
          { personId: "p1", isaContribution: 20000, pensionContribution: 30000 },
        ],
      };
      const result = applyScenarioOverrides(h, overrides);
      // P1's original contribution removed, replaced by 2 synthetic
      const p1Contribs = result.contributions.filter((c) => c.personId === "p1");
      expect(p1Contribs).toHaveLength(2);
      expect(p1Contribs[0].target).toBe("isa");
      expect(p1Contribs[0].amount).toBe(20000);
      expect(p1Contribs[1].target).toBe("pension");
      // P2's contributions preserved
      const p2Contribs = result.contributions.filter((c) => c.personId === "p2");
      expect(p2Contribs).toHaveLength(1);
      expect(p2Contribs[0].id).toBe("c2");
    });

    it("skips zero-value contribution overrides", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        contributionOverrides: [
          { personId: "p1", isaContribution: 0, pensionContribution: 10000 },
        ],
      };
      const result = applyScenarioOverrides(h, overrides);
      const p1Contribs = result.contributions.filter((c) => c.personId === "p1");
      expect(p1Contribs).toHaveLength(1);
      expect(p1Contribs[0].target).toBe("pension");
    });
  });

  describe("retirement overrides", () => {
    it("spread-merges retirement config", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        retirement: { targetAnnualIncome: 60000 },
      };
      const result = applyScenarioOverrides(h, overrides);
      expect(result.retirement.targetAnnualIncome).toBe(60000);
      // Other fields preserved
      expect(result.retirement.withdrawalRate).toBe(0.04);
    });
  });

  describe("market shock", () => {
    it("applies percentage shock to all accounts", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        marketShockPercent: -0.30,
      };
      const result = applyScenarioOverrides(h, overrides);
      expect(result.accounts[0].currentValue).toBe(70000); // 100k * 0.7
      expect(result.accounts[1].currentValue).toBe(140000); // 200k * 0.7
    });

    it("floors account values at 0", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        marketShockPercent: -1.5, // -150%
      };
      const result = applyScenarioOverrides(h, overrides);
      expect(result.accounts[0].currentValue).toBe(0);
    });
  });

  describe("account value overrides", () => {
    it("overrides specific account values by ID", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        accountValues: { a1: 50000 },
      };
      const result = applyScenarioOverrides(h, overrides);
      expect(result.accounts[0].currentValue).toBe(50000);
      expect(result.accounts[1].currentValue).toBe(200000); // unchanged
    });

    it("applies shock before specific overrides", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        marketShockPercent: -0.50,
        accountValues: { a1: 90000 }, // explicit override after shock
      };
      const result = applyScenarioOverrides(h, overrides);
      expect(result.accounts[0].currentValue).toBe(90000); // specific override wins
      expect(result.accounts[1].currentValue).toBe(100000); // 200k * 0.5
    });
  });

  it("does not mutate the original household", () => {
    const h = makeHousehold();
    const originalIncome = h.income[0].grossSalary;
    applyScenarioOverrides(h, { income: [{ personId: "p1", grossSalary: 999999 }] });
    expect(h.income[0].grossSalary).toBe(originalIncome);
  });
});
