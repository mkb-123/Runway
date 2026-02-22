// ============================================================
// Shared Test Fixtures — Single source of truth for HouseholdData test objects
// ============================================================
// Import makeTestHousehold() instead of defining makeHousehold() in each test file.
// When HouseholdData schema changes, update THIS file once — all tests benefit.

import type {
  HouseholdData,
  Person,
  PersonIncome,
  Account,
  BonusStructure,
  Contribution,
  Property,
  NetWorthSnapshot,
} from "@/types";

// ============================================================
// Person factories
// ============================================================

const DEFAULT_PERSON_SELF: Person = {
  id: "p1",
  name: "James",
  relationship: "self",
  dateOfBirth: "1974-06-15",
  plannedRetirementAge: 60,
  pensionAccessAge: 57,
  stateRetirementAge: 67,
  niQualifyingYears: 35,
  studentLoanPlan: "none",
};

const DEFAULT_PERSON_SPOUSE: Person = {
  id: "p2",
  name: "Sarah",
  relationship: "spouse",
  dateOfBirth: "1976-03-20",
  plannedRetirementAge: 62,
  pensionAccessAge: 57,
  stateRetirementAge: 67,
  niQualifyingYears: 28,
  studentLoanPlan: "none",
};

export function makePerson(overrides: Partial<Person> = {}): Person {
  return { ...DEFAULT_PERSON_SELF, ...overrides };
}

export function makeSpouse(overrides: Partial<Person> = {}): Person {
  return { ...DEFAULT_PERSON_SPOUSE, ...overrides };
}

// ============================================================
// Income factories
// ============================================================

export function makeIncome(overrides: Partial<PersonIncome> = {}): PersonIncome {
  return {
    personId: "p1",
    grossSalary: 120000,
    employerPensionContribution: 12000,
    employeePensionContribution: 12000,
    pensionContributionMethod: "salary_sacrifice" as const,
    ...overrides,
  };
}

// ============================================================
// Account factories
// ============================================================

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    personId: "p1",
    type: "stocks_and_shares_isa",
    provider: "Vanguard",
    name: "ISA",
    currentValue: 100000,
    ...overrides,
  };
}

// ============================================================
// Property factories
// ============================================================

export function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "prop-1",
    label: "Primary Residence",
    estimatedValue: 450000,
    ownerPersonIds: ["p1", "p2"],
    mortgageBalance: 0,
    ...overrides,
  };
}

// ============================================================
// Main household factory
// ============================================================

/**
 * Create a full HouseholdData object with sensible defaults.
 * Pass overrides to customize any top-level field.
 *
 * Default household: couple (James & Sarah), 5 accounts, income for both,
 * one bonus structure, ISA contributions, £60k retirement target, one property.
 */
export function makeTestHousehold(overrides: Partial<HouseholdData> = {}): HouseholdData {
  return {
    persons: [DEFAULT_PERSON_SELF, DEFAULT_PERSON_SPOUSE],
    accounts: [
      { id: "a1", personId: "p1", type: "sipp", provider: "AJ Bell", name: "James SIPP", currentValue: 800000 },
      { id: "a2", personId: "p2", type: "workplace_pension", provider: "Aviva", name: "Sarah Pension", currentValue: 320000 },
      { id: "a3", personId: "p1", type: "stocks_and_shares_isa", provider: "Vanguard", name: "James ISA", currentValue: 200000 },
      { id: "a4", personId: "p1", type: "cash_savings", provider: "Marcus", name: "Cash", currentValue: 50000 },
      { id: "a5", personId: "p2", type: "cash_savings", provider: "Chase", name: "Sarah Cash", currentValue: 30000 },
    ],
    income: [
      {
        personId: "p1",
        grossSalary: 120000,
        employerPensionContribution: 12000,
        employeePensionContribution: 12000,
        pensionContributionMethod: "salary_sacrifice" as const,
      },
      {
        personId: "p2",
        grossSalary: 60000,
        employerPensionContribution: 3000,
        employeePensionContribution: 3000,
        pensionContributionMethod: "salary_sacrifice" as const,
      },
    ],
    bonusStructures: [
      {
        personId: "p1",
        totalBonusAnnual: 50000,
        cashBonusAnnual: 20000,
        vestingYears: 3,
        vestingGapYears: 0,
        estimatedAnnualReturn: 0.08,
        bonusPaymentMonth: 2,
      },
    ],
    contributions: [
      { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 1666, frequency: "monthly" as const },
      { id: "c2", personId: "p2", label: "ISA", target: "isa" as const, amount: 500, frequency: "monthly" as const },
    ],
    retirement: {
      targetAnnualIncome: 60000,
      withdrawalRate: 0.04,
      includeStatePension: true,
      scenarioRates: [0.05, 0.07, 0.09],
    },
    emergencyFund: {
      monthlyEssentialExpenses: 3000,
      targetMonths: 6,
      monthlyLifestyleSpending: 2000,
    },
    properties: [],
    iht: {
      estimatedPropertyValue: 0,
      passingToDirectDescendants: true,
      gifts: [],
    },
    committedOutgoings: [
      { id: "o1", category: "mortgage" as const, label: "Mortgage", amount: 2000, frequency: "monthly" as const },
    ],
    children: [],
    dashboardConfig: {
      heroMetrics: ["projected_retirement_income", "cash_position", "retirement_countdown"],
    },
    ...overrides,
  };
}

/**
 * Minimal household for tests that only need the shape but not realistic values.
 * All arrays empty, all numbers zero.
 */
export function makeEmptyHousehold(overrides: Partial<HouseholdData> = {}): HouseholdData {
  return {
    persons: [],
    children: [],
    accounts: [],
    income: [],
    bonusStructures: [],
    contributions: [],
    retirement: { targetAnnualIncome: 0, withdrawalRate: 0.04, includeStatePension: true, scenarioRates: [0.05, 0.07] },
    emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6, monthlyLifestyleSpending: 0 },
    properties: [],
    iht: { estimatedPropertyValue: 0, passingToDirectDescendants: false, gifts: [] },
    committedOutgoings: [],
    dashboardConfig: { heroMetrics: ["projected_retirement_income"] },
    ...overrides,
  };
}

// ============================================================
// Snapshot factories
// ============================================================

export function makeSnapshot(overrides: Partial<NetWorthSnapshot> = {}): NetWorthSnapshot {
  return {
    date: new Date().toISOString().slice(0, 10),
    totalNetWorth: 1400000,
    byPerson: [
      { personId: "p1", name: "James", value: 1050000 },
      { personId: "p2", name: "Sarah", value: 350000 },
    ],
    byType: [],
    byWrapper: [],
    ...overrides,
  };
}
