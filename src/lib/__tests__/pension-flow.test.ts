import { describe, it, expect } from "vitest";
import { getPersonContributionTotals } from "@/types";
import type {
  Contribution,
  HouseholdData,
  Person,
  PersonIncome,
  Account,
} from "@/types";
import {
  generateRecommendations,
  analyzePensionHeadroom,
} from "../recommendations";
import { UK_TAX_CONSTANTS } from "../tax-constants";

// ============================================================
// Pension contribution flow integration tests
// ============================================================
// Verifies that pension contributions from ALL three sources
// (employee, employer, discretionary) flow correctly through
// the recommendation engine, especially for annual allowance checks.

// --- Fixtures ---

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "person-1",
    name: "Alice",
    relationship: "self",
    dateOfBirth: "1985-06-15",
    plannedRetirementAge: 60,
    pensionAccessAge: 57,
    stateRetirementAge: 67,
    niQualifyingYears: 35,
    studentLoanPlan: "none",
    ...overrides,
  };
}

function makeIncome(overrides: Partial<PersonIncome> = {}): PersonIncome {
  return {
    personId: "person-1",
    grossSalary: 85000,
    employerPensionContribution: 8500, // 10% employer match
    employeePensionContribution: 5000, // salary sacrifice
    pensionContributionMethod: "salary_sacrifice",
    ...overrides,
  };
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    personId: "person-1",
    type: "stocks_and_shares_isa",
    provider: "Vanguard",
    name: "ISA",
    currentValue: 100000,
    ...overrides,
  };
}

function makeHousehold(overrides: Partial<HouseholdData> = {}): HouseholdData {
  return {
    persons: [makePerson()],
    accounts: [makeAccount()],
    income: [makeIncome()],
    bonusStructures: [],
    contributions: [],
    retirement: {
      targetAnnualIncome: 30000,
      withdrawalRate: 0.04,
      includeStatePension: true,
      scenarioRates: [0.05, 0.07, 0.09],
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
    children: [],
    committedOutgoings: [],
    dashboardConfig: {
      heroMetrics: ["projected_retirement_income", "cash_position", "retirement_countdown"],
    },
    ...overrides,
  };
}

// --- Tests ---

describe("getPersonContributionTotals — discretionary contributions only", () => {
  it("returns only discretionary pension contributions, not employee/employer", () => {
    const contributions: Contribution[] = [
      {
        id: "c1",
        personId: "person-1",
        label: "SIPP top-up",
        target: "pension",
        amount: 500,
        frequency: "monthly",
      },
      {
        id: "c2",
        personId: "person-1",
        label: "ISA monthly",
        target: "isa",
        amount: 1000,
        frequency: "monthly",
      },
      {
        id: "c3",
        personId: "person-1",
        label: "GIA lump sum",
        target: "gia",
        amount: 5000,
        frequency: "annually",
      },
    ];

    const totals = getPersonContributionTotals(contributions, "person-1");

    // Discretionary pension: 500 * 12 = 6000
    expect(totals.pensionContribution).toBe(6000);
    // ISA: 1000 * 12 = 12000
    expect(totals.isaContribution).toBe(12000);
    // GIA: 5000 annually = 5000
    expect(totals.giaContribution).toBe(5000);
  });

  it("does not include employee or employer pension from income data", () => {
    // Even though the person has income with pension contributions,
    // getPersonContributionTotals only looks at the Contribution[] array
    const contributions: Contribution[] = [];
    const totals = getPersonContributionTotals(contributions, "person-1");

    expect(totals.pensionContribution).toBe(0);
    expect(totals.isaContribution).toBe(0);
    expect(totals.giaContribution).toBe(0);
  });

  it("filters by personId", () => {
    const contributions: Contribution[] = [
      {
        id: "c1",
        personId: "person-1",
        label: "Alice SIPP",
        target: "pension",
        amount: 1000,
        frequency: "monthly",
      },
      {
        id: "c2",
        personId: "person-2",
        label: "Bob SIPP",
        target: "pension",
        amount: 2000,
        frequency: "monthly",
      },
    ];

    const aliceTotals = getPersonContributionTotals(contributions, "person-1");
    const bobTotals = getPersonContributionTotals(contributions, "person-2");

    expect(aliceTotals.pensionContribution).toBe(12000);
    expect(bobTotals.pensionContribution).toBe(24000);
  });
});

describe("total pension against annual allowance", () => {
  it("sums employee + employer + discretionary for annual allowance comparison", () => {
    const employeePension = 5000;
    const employerPension = 8500;
    const discretionaryPension = 6000; // e.g. 500/month SIPP top-up

    const totalPensionContributions =
      employeePension + employerPension + discretionaryPension;

    expect(totalPensionContributions).toBe(19500);
    expect(totalPensionContributions).toBeLessThan(
      UK_TAX_CONSTANTS.pensionAnnualAllowance
    );
  });

  it("detects annual allowance breach when all three sources combined exceed it", () => {
    const employeePension = 25000;
    const employerPension = 15000;
    const discretionaryPension = 25000;

    const totalPensionContributions =
      employeePension + employerPension + discretionaryPension;

    expect(totalPensionContributions).toBe(65000);
    expect(totalPensionContributions).toBeGreaterThan(
      UK_TAX_CONSTANTS.pensionAnnualAllowance
    );
  });
});

describe("generateRecommendations — totalPensionContributions includes all sources", () => {
  it("builds PersonContext.totalPensionContributions from employee + employer + discretionary", () => {
    // Set up a household where:
    //   employee pension = 5,000
    //   employer pension = 8,500
    //   discretionary pension = 500/month = 6,000/year
    //   total = 19,500

    const contributions: Contribution[] = [
      {
        id: "c-pension",
        personId: "person-1",
        label: "SIPP top-up",
        target: "pension",
        amount: 500,
        frequency: "monthly",
      },
    ];

    const household = makeHousehold({
      income: [
        makeIncome({
          grossSalary: 85000,
          employeePensionContribution: 5000,
          employerPensionContribution: 8500,
        }),
      ],
      contributions,
    });

    // Generate recommendations — this internally computes totalPensionContributions
    const recs = generateRecommendations(household);

    // With total pension = 19,500 and allowance = 60,000:
    // headroom = 60,000 - 19,500 = 40,500 which is > 20,000
    // So analyzePensionHeadroom should fire
    const pensionHeadroom = recs.find((r) =>
      r.id.startsWith("pension-headroom")
    );
    expect(pensionHeadroom).toBeDefined();
    // The description should cite the used amount (19,500) and the allowance (60,000)
    expect(pensionHeadroom!.description).toContain("19,500");
    expect(pensionHeadroom!.description).toContain("60,000");
  });

  it("does not recommend headroom when all three sources exhaust the allowance", () => {
    // employee = 20,000; employer = 15,000; discretionary = 25,000 annually
    // total = 60,000 = full allowance
    const contributions: Contribution[] = [
      {
        id: "c-pension",
        personId: "person-1",
        label: "SIPP annual",
        target: "pension",
        amount: 25000,
        frequency: "annually",
      },
    ];

    const household = makeHousehold({
      income: [
        makeIncome({
          grossSalary: 85000,
          employeePensionContribution: 20000,
          employerPensionContribution: 15000,
        }),
      ],
      contributions,
    });

    const recs = generateRecommendations(household);
    const pensionHeadroom = recs.find((r) =>
      r.id.startsWith("pension-headroom")
    );
    // Headroom = 60,000 - 60,000 = 0, which is <= 20,000 threshold
    expect(pensionHeadroom).toBeUndefined();
  });

  it("correctly accounts for monthly discretionary contributions annualised", () => {
    // employee = 3,000; employer = 3,000; discretionary = 200/month = 2,400/year
    // total = 8,400

    const contributions: Contribution[] = [
      {
        id: "c-pension",
        personId: "person-1",
        label: "SIPP drip",
        target: "pension",
        amount: 200,
        frequency: "monthly",
      },
    ];

    const household = makeHousehold({
      income: [
        makeIncome({
          grossSalary: 85000,
          employeePensionContribution: 3000,
          employerPensionContribution: 3000,
        }),
      ],
      contributions,
    });

    const recs = generateRecommendations(household);
    const pensionHeadroom = recs.find((r) =>
      r.id.startsWith("pension-headroom")
    );

    // Headroom = 60,000 - 8,400 = 51,600 > 20,000 -> fires
    expect(pensionHeadroom).toBeDefined();
    expect(pensionHeadroom!.description).toContain("8,400");
  });
});

describe("analyzePensionHeadroom — uses totalPensionContributions correctly", () => {
  it("calculates headroom from totalPensionContributions, not just discretionary", () => {
    const income = makeIncome({
      employeePensionContribution: 10000,
      employerPensionContribution: 8000,
    });
    const discretionaryPension = 12000;
    const totalPension =
      income.employeePensionContribution +
      income.employerPensionContribution +
      discretionaryPension;

    // totalPension = 10,000 + 8,000 + 12,000 = 30,000
    expect(totalPension).toBe(30000);

    const ctx = {
      person: makePerson(),
      income,
      contributions: {
        isaContribution: 0,
        pensionContribution: discretionaryPension,
        giaContribution: 0,
      },
      accounts: [],
      adjustedGross: 80000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: totalPension,
      totalAvailableAllowance: 60000,
    };

    const recs = analyzePensionHeadroom(ctx);

    // Headroom = 60,000 - 30,000 = 30,000 > 20,000 -> fires
    expect(recs).toHaveLength(1);
    expect(recs[0].description).toContain("30,000");
    expect(recs[0].description).toContain("60,000");
  });

  it("returns nothing when all three sources nearly fill the allowance", () => {
    const income = makeIncome({
      employeePensionContribution: 20000,
      employerPensionContribution: 10000,
    });
    const discretionaryPension = 15000;
    const totalPension =
      income.employeePensionContribution +
      income.employerPensionContribution +
      discretionaryPension;

    // totalPension = 45,000. Headroom = 60,000 - 45,000 = 15,000 <= 20,000 -> no recommendation
    const ctx = {
      person: makePerson(),
      income,
      contributions: {
        isaContribution: 0,
        pensionContribution: discretionaryPension,
        giaContribution: 0,
      },
      accounts: [],
      adjustedGross: 80000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: totalPension,
      totalAvailableAllowance: 60000,
    };

    expect(analyzePensionHeadroom(ctx)).toHaveLength(0);
  });

  it("would incorrectly show excess headroom if only discretionary were used", () => {
    // This test documents the correctness requirement:
    // If we only looked at discretionary pension (2,000), we'd think headroom is 58,000
    // But with employee (25,000) + employer (15,000) + discretionary (2,000) = 42,000,
    // headroom is actually only 18,000 (which is <= 20,000 threshold, so no recommendation)

    const income = makeIncome({
      employeePensionContribution: 25000,
      employerPensionContribution: 15000,
    });
    const discretionaryPension = 2000;
    const totalPension =
      income.employeePensionContribution +
      income.employerPensionContribution +
      discretionaryPension;

    // totalPension = 42,000; headroom = 18,000 <= 20,000 -> no recommendation
    expect(totalPension).toBe(42000);

    const ctx = {
      person: makePerson(),
      income,
      contributions: {
        isaContribution: 0,
        pensionContribution: discretionaryPension,
        giaContribution: 0,
      },
      accounts: [],
      adjustedGross: 80000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: totalPension,
      totalAvailableAllowance: 60000,
    };

    // Correctly returns nothing — only 18k headroom
    expect(analyzePensionHeadroom(ctx)).toHaveLength(0);

    // If someone mistakenly used only discretionary, they'd see 58k headroom
    const brokenCtx = {
      ...ctx,
      totalPensionContributions: discretionaryPension, // BUG: missing employee+employer
    };
    const brokenRecs = analyzePensionHeadroom(brokenCtx);
    // This would incorrectly fire (58,000 > 20,000)
    expect(brokenRecs).toHaveLength(1);
  });
});

describe("pension flow — two-person household", () => {
  it("calculates independent pension totals for each person", () => {
    const alice = makePerson({ id: "person-1", name: "Alice" });
    const bob = makePerson({
      id: "person-2",
      name: "Bob",
      relationship: "spouse",
    });

    const contributions: Contribution[] = [
      {
        id: "c1",
        personId: "person-1",
        label: "Alice SIPP",
        target: "pension",
        amount: 1000,
        frequency: "monthly",
      },
      {
        id: "c2",
        personId: "person-2",
        label: "Bob SIPP",
        target: "pension",
        amount: 300,
        frequency: "monthly",
      },
    ];

    const household = makeHousehold({
      persons: [alice, bob],
      income: [
        makeIncome({
          personId: "person-1",
          grossSalary: 85000,
          employeePensionContribution: 5000,
          employerPensionContribution: 8500,
        }),
        makeIncome({
          personId: "person-2",
          grossSalary: 60000,
          employeePensionContribution: 3000,
          employerPensionContribution: 3000,
        }),
      ],
      contributions,
      accounts: [
        makeAccount({ id: "acc-1", personId: "person-1" }),
        makeAccount({ id: "acc-2", personId: "person-2" }),
      ],
    });

    const recs = generateRecommendations(household);
    const aliceHeadroom = recs.find(
      (r) => r.id === "pension-headroom-person-1"
    );
    const bobHeadroom = recs.find(
      (r) => r.id === "pension-headroom-person-2"
    );

    // Alice: 5,000 + 8,500 + 12,000 = 25,500. Headroom = 34,500 > 20,000 -> fires
    expect(aliceHeadroom).toBeDefined();
    expect(aliceHeadroom!.description).toContain("25,500");

    // Bob: 3,000 + 3,000 + 3,600 = 9,600. Headroom = 50,400 > 20,000 -> fires
    expect(bobHeadroom).toBeDefined();
    expect(bobHeadroom!.description).toContain("9,600");
  });
});
