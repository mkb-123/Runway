import { describe, it, expect } from "vitest";
import { migrateHouseholdData } from "@/lib/migration";

describe("migrateHouseholdData", () => {
  describe("annualContributions → contributions", () => {
    it("converts legacy annualContributions to individual contribution items", () => {
      const legacy = {
        persons: [{ id: "p1", name: "Alice" }],
        accounts: [],
        income: [],
        bonusStructures: [],
        annualContributions: [
          {
            personId: "p1",
            isaContribution: 20000,
            pensionContribution: 30000,
            giaContribution: 5000,
          },
        ],
        retirement: { targetAnnualIncome: 60000, withdrawalRate: 0.04, includeStatePension: true, scenarioRates: [0.07] },
        emergencyFund: { monthlyEssentialExpenses: 3000, targetMonths: 6 },
        iht: { estimatedPropertyValue: 0, passingToDirectDescendants: false, gifts: [] },
      };

      const migrated = migrateHouseholdData(legacy);
      const contributions = migrated.contributions as Array<Record<string, unknown>>;

      expect(contributions).toHaveLength(3);
      expect(contributions[0]).toMatchObject({
        personId: "p1",
        label: "ISA (migrated)",
        target: "isa",
        amount: 20000,
        frequency: "annually",
      });
      expect(contributions[1]).toMatchObject({
        personId: "p1",
        target: "pension",
        amount: 30000,
      });
      expect(contributions[2]).toMatchObject({
        personId: "p1",
        target: "gia",
        amount: 5000,
      });
      // Old field removed
      expect(migrated.annualContributions).toBeUndefined();
    });

    it("skips zero-value contributions", () => {
      const legacy = {
        annualContributions: [
          { personId: "p1", isaContribution: 20000, pensionContribution: 0, giaContribution: 0 },
        ],
        emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6 },
      };

      const migrated = migrateHouseholdData(legacy);
      expect(migrated.contributions).toHaveLength(1);
    });

    it("is idempotent — does not modify already-migrated data", () => {
      const current = {
        contributions: [
          { id: "c1", personId: "p1", label: "Monthly ISA", target: "isa", amount: 1666, frequency: "monthly" },
        ],
        emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6, monthlyLifestyleSpending: 0 },
      };

      const migrated = migrateHouseholdData(current);
      expect(migrated.contributions).toEqual(current.contributions);
    });

    it("handles missing annualContributions by setting empty array", () => {
      const data = {
        emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6 },
      };

      const migrated = migrateHouseholdData(data);
      expect(migrated.contributions).toEqual([]);
    });
  });

  describe("estimatedAnnualExpenses removal", () => {
    it("converts estimatedAnnualExpenses to monthlyLifestyleSpending", () => {
      const legacy = {
        contributions: [],
        estimatedAnnualExpenses: 48000,
        committedOutgoings: [
          { amount: 1850, frequency: "monthly" }, // £22,200/yr
        ],
        emergencyFund: { monthlyEssentialExpenses: 3000, targetMonths: 6 },
      };

      const migrated = migrateHouseholdData(legacy);
      const ef = migrated.emergencyFund as Record<string, unknown>;

      // £48,000 - £22,200 committed = £25,800 lifestyle → £2,150/month
      expect(ef.monthlyLifestyleSpending).toBe(2150);
      expect(migrated.estimatedAnnualExpenses).toBeUndefined();
    });

    it("does not overwrite existing monthlyLifestyleSpending", () => {
      const data = {
        contributions: [],
        estimatedAnnualExpenses: 48000,
        committedOutgoings: [],
        emergencyFund: { monthlyEssentialExpenses: 3000, targetMonths: 6, monthlyLifestyleSpending: 2500 },
      };

      const migrated = migrateHouseholdData(data);
      const ef = migrated.emergencyFund as Record<string, unknown>;
      expect(ef.monthlyLifestyleSpending).toBe(2500);
    });
  });

  describe("monthlyLifestyleSpending default", () => {
    it("adds monthlyLifestyleSpending: 0 when missing from emergencyFund", () => {
      const data = {
        contributions: [],
        emergencyFund: { monthlyEssentialExpenses: 3000, targetMonths: 6 },
      };

      const migrated = migrateHouseholdData(data);
      const ef = migrated.emergencyFund as Record<string, unknown>;
      expect(ef.monthlyLifestyleSpending).toBe(0);
    });
  });

  describe("default arrays", () => {
    it("adds empty committedOutgoings if missing", () => {
      const data = {
        contributions: [],
        emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6 },
      };

      const migrated = migrateHouseholdData(data);
      expect(migrated.committedOutgoings).toEqual([]);
    });

    it("adds default dashboardConfig if missing", () => {
      const data = {
        contributions: [],
        emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6 },
      };

      const migrated = migrateHouseholdData(data);
      const dc = migrated.dashboardConfig as Record<string, unknown>;
      expect(dc.heroMetrics).toEqual(["net_worth", "cash_position", "retirement_countdown"]);
    });
  });

  describe("multi-person migration", () => {
    it("migrates annualContributions for multiple persons", () => {
      const legacy = {
        annualContributions: [
          { personId: "p1", isaContribution: 20000, pensionContribution: 10000 },
          { personId: "p2", isaContribution: 15000, giaContribution: 5000 },
        ],
        emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6 },
      };

      const migrated = migrateHouseholdData(legacy);
      const contributions = migrated.contributions as Array<Record<string, unknown>>;

      expect(contributions).toHaveLength(4);
      expect(contributions.filter((c) => c.personId === "p1")).toHaveLength(2);
      expect(contributions.filter((c) => c.personId === "p2")).toHaveLength(2);
    });
  });

  describe("person field defaults (migration 6)", () => {
    it("back-fills pensionAccessAge and stateRetirementAge if missing", () => {
      const legacy = {
        persons: [
          { id: "p1", name: "Alice", relationship: "self", dateOfBirth: "1980-01-01", plannedRetirementAge: 60 },
        ],
        contributions: [],
        emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6 },
      };

      const migrated = migrateHouseholdData(legacy);
      const persons = migrated.persons as Array<Record<string, unknown>>;
      expect(persons[0].pensionAccessAge).toBe(57);
      expect(persons[0].stateRetirementAge).toBe(67);
    });

    it("preserves existing pensionAccessAge and stateRetirementAge", () => {
      const current = {
        persons: [
          {
            id: "p1",
            name: "Bob",
            relationship: "self",
            dateOfBirth: "1975-06-01",
            plannedRetirementAge: 55,
            pensionAccessAge: 55,
            stateRetirementAge: 68,
            niQualifyingYears: 35,
            studentLoanPlan: "plan1",
          },
        ],
        contributions: [],
        emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6 },
      };

      const migrated = migrateHouseholdData(current);
      const persons = migrated.persons as Array<Record<string, unknown>>;
      // Custom values must be preserved (idempotent)
      expect(persons[0].pensionAccessAge).toBe(55);
      expect(persons[0].stateRetirementAge).toBe(68);
    });

    it("back-fills studentLoanPlan with 'none' if missing", () => {
      const legacy = {
        persons: [
          { id: "p1", name: "Carol", relationship: "self", dateOfBirth: "1985-01-01" },
        ],
        contributions: [],
        emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6 },
      };

      const migrated = migrateHouseholdData(legacy);
      const persons = migrated.persons as Array<Record<string, unknown>>;
      expect(persons[0].studentLoanPlan).toBe("none");
    });
  });
});
