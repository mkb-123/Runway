import { describe, it, expect } from "vitest";
import {
  generateRecommendations,
  analyzeSalaryTaper,
  analyzeISAUsage,
  analyzePensionHeadroom,
  analyzeEmergencyFund,
  analyzeRetirementProgress,
  analyzeConcentrationRisk,
  analyzeGIAOverweight,
} from "../recommendations";
import type {
  HouseholdData,
  TransactionsData,
  Person,
  PersonIncome,
  AnnualContributions,
  Account,
} from "@/types";

// --- Minimal test fixtures ---

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "person-1",
    name: "Alice",
    relationship: "self",
    dateOfBirth: "1990-01-01",
    pensionAccessAge: 57,
    stateRetirementAge: 67,
    niQualifyingYears: 12,
    studentLoanPlan: "none",
    ...overrides,
  };
}

function makeIncome(overrides: Partial<PersonIncome> = {}): PersonIncome {
  return {
    personId: "person-1",
    grossSalary: 60000,
    employerPensionContribution: 3000,
    employeePensionContribution: 3000,
    pensionContributionMethod: "salary_sacrifice",
    ...overrides,
  };
}

function makeContributions(overrides: Partial<AnnualContributions> = {}): AnnualContributions {
  return {
    personId: "person-1",
    isaContribution: 0,
    pensionContribution: 6000,
    giaContribution: 0,
    ...overrides,
  };
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    personId: "person-1",
    type: "stocks_and_shares_isa",
    provider: "Vanguard",
    name: "Test ISA",
    currentValue: 50000,
    holdings: [],
    ...overrides,
  };
}

function makeHousehold(overrides: Partial<HouseholdData> = {}): HouseholdData {
  return {
    persons: [makePerson()],
    accounts: [makeAccount()],
    funds: [],
    income: [makeIncome()],
    bonusStructures: [],
    annualContributions: [makeContributions()],
    retirement: {
      targetAnnualIncome: 30000,
      withdrawalRate: 0.04,
      includeStatePension: true,
      scenarioRates: [0.05, 0.07, 0.09],
    },
    emergencyFund: {
      monthlyEssentialExpenses: 2000,
      targetMonths: 6,
    },
    iht: {
      estimatedPropertyValue: 0,
      passingToDirectDescendants: false,
      gifts: [],
    },
    estimatedAnnualExpenses: 24000,
    ...overrides,
  };
}

const emptyTransactions: TransactionsData = { transactions: [] };

// --- Tests ---

describe("analyzeSalaryTaper", () => {
  it("recommends salary sacrifice when in 60% trap zone", () => {
    const income = makeIncome({
      grossSalary: 115000,
      employeePensionContribution: 5000,
      pensionContributionMethod: "salary_sacrifice",
    });
    const ctx = {
      person: makePerson(),
      income,
      contributions: makeContributions({ pensionContribution: 5000 }),
      accounts: [],
      adjustedGross: 110000,
      allAccounts: [],
    };

    const recs = analyzeSalaryTaper(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toContain("salary-sacrifice-taper");
    expect(recs[0].priority).toBe("high");
    expect(recs[0].category).toBe("tax");
  });

  it("returns nothing when income below £100k", () => {
    const ctx = {
      person: makePerson(),
      income: makeIncome({ grossSalary: 80000 }),
      contributions: makeContributions(),
      accounts: [],
      adjustedGross: 77000,
      allAccounts: [],
    };

    expect(analyzeSalaryTaper(ctx)).toHaveLength(0);
  });

  it("returns nothing when income above higher rate limit", () => {
    const ctx = {
      person: makePerson(),
      income: makeIncome({ grossSalary: 200000 }),
      contributions: makeContributions(),
      accounts: [],
      adjustedGross: 197000,
      allAccounts: [],
    };

    expect(analyzeSalaryTaper(ctx)).toHaveLength(0);
  });
});

describe("analyzeISAUsage", () => {
  it("recommends topping up ISA when partially used", () => {
    const ctx = {
      person: makePerson(),
      income: makeIncome(),
      contributions: makeContributions({ isaContribution: 12000 }),
      accounts: [],
      adjustedGross: 60000,
      allAccounts: [],
    };

    const recs = analyzeISAUsage(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toContain("isa-topup");
  });

  it("recommends opening ISA when completely unused", () => {
    const ctx = {
      person: makePerson(),
      income: makeIncome(),
      contributions: makeContributions({ isaContribution: 0 }),
      accounts: [],
      adjustedGross: 60000,
      allAccounts: [],
    };

    const recs = analyzeISAUsage(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toContain("isa-unused");
    expect(recs[0].priority).toBe("high");
  });

  it("returns nothing when ISA fully used", () => {
    const ctx = {
      person: makePerson(),
      income: makeIncome(),
      contributions: makeContributions({ isaContribution: 20000 }),
      accounts: [],
      adjustedGross: 60000,
      allAccounts: [],
    };

    expect(analyzeISAUsage(ctx)).toHaveLength(0);
  });
});

describe("analyzePensionHeadroom", () => {
  it("recommends using headroom when > £20k unused", () => {
    const ctx = {
      person: makePerson(),
      income: makeIncome(),
      contributions: makeContributions({ pensionContribution: 10000 }),
      accounts: [],
      adjustedGross: 80000,
      allAccounts: [],
    };

    const recs = analyzePensionHeadroom(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].category).toBe("pension");
  });

  it("returns nothing when pension nearly fully used", () => {
    const ctx = {
      person: makePerson(),
      income: makeIncome(),
      contributions: makeContributions({ pensionContribution: 55000 }),
      accounts: [],
      adjustedGross: 60000,
      allAccounts: [],
    };

    expect(analyzePensionHeadroom(ctx)).toHaveLength(0);
  });
});

describe("analyzeGIAOverweight", () => {
  it("warns when GIA is > 15% of total portfolio", () => {
    const giaAccount = makeAccount({
      id: "gia-1",
      type: "gia",
      currentValue: 30000,
    });
    const isaAccount = makeAccount({
      id: "isa-1",
      type: "stocks_and_shares_isa",
      currentValue: 70000,
    });

    const ctx = {
      person: makePerson(),
      income: makeIncome(),
      contributions: makeContributions(),
      accounts: [giaAccount],
      adjustedGross: 60000,
      allAccounts: [giaAccount, isaAccount],
    };

    const recs = analyzeGIAOverweight(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].category).toBe("investment");
  });

  it("returns nothing when GIA is small fraction", () => {
    const giaAccount = makeAccount({
      id: "gia-1",
      type: "gia",
      currentValue: 5000,
    });
    const isaAccount = makeAccount({
      id: "isa-1",
      type: "stocks_and_shares_isa",
      currentValue: 95000,
    });

    const ctx = {
      person: makePerson(),
      income: makeIncome(),
      contributions: makeContributions(),
      accounts: [giaAccount],
      adjustedGross: 60000,
      allAccounts: [giaAccount, isaAccount],
    };

    expect(analyzeGIAOverweight(ctx)).toHaveLength(0);
  });
});

describe("analyzeRetirementProgress", () => {
  it("warns when < 50% of retirement target reached", () => {
    const household = makeHousehold({
      accounts: [makeAccount({ currentValue: 100000 })],
      retirement: {
        targetAnnualIncome: 30000,
        withdrawalRate: 0.04,
        includeStatePension: true,
        scenarioRates: [0.05, 0.07, 0.09],
      },
    });
    // Required pot = 30000 / 0.04 = 750,000. 100k is ~13%.
    const recs = analyzeRetirementProgress(household);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("retirement-behind");
    expect(recs[0].priority).toBe("high");
  });

  it("returns nothing when on track", () => {
    const household = makeHousehold({
      accounts: [makeAccount({ currentValue: 500000 })],
      retirement: {
        targetAnnualIncome: 30000,
        withdrawalRate: 0.04,
        includeStatePension: true,
        scenarioRates: [0.05, 0.07, 0.09],
      },
    });
    // Required pot = 750k. 500k is 67% -> above 50%.
    expect(analyzeRetirementProgress(household)).toHaveLength(0);
  });
});

describe("analyzeEmergencyFund", () => {
  it("warns when cash below emergency target", () => {
    const household = makeHousehold({
      accounts: [
        makeAccount({
          id: "cash-1",
          type: "cash_savings",
          currentValue: 5000,
        }),
      ],
      emergencyFund: {
        monthlyEssentialExpenses: 2000,
        targetMonths: 6,
      },
    });
    // Target = 12000, have 5000 -> shortfall 7000

    const recs = analyzeEmergencyFund(household);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("emergency-fund-low");
  });

  it("returns nothing when cash exceeds target", () => {
    const household = makeHousehold({
      accounts: [
        makeAccount({
          id: "cash-1",
          type: "cash_savings",
          currentValue: 15000,
        }),
      ],
      emergencyFund: {
        monthlyEssentialExpenses: 2000,
        targetMonths: 6,
      },
    });

    expect(analyzeEmergencyFund(household)).toHaveLength(0);
  });
});

describe("analyzeConcentrationRisk", () => {
  it("warns when single fund exceeds 40% of holdings", () => {
    const household = makeHousehold({
      accounts: [
        makeAccount({
          holdings: [
            { fundId: "fund-a", units: 100, purchasePrice: 10, currentPrice: 90 },
            { fundId: "fund-b", units: 10, purchasePrice: 10, currentPrice: 10 },
          ],
        }),
      ],
      funds: [
        {
          id: "fund-a",
          name: "Big Fund",
          ticker: "BIG",
          isin: "XX",
          ocf: 0.001,
          assetClass: "equity",
          region: "global",
        },
      ],
    });
    // fund-a: 100*90 = 9000, fund-b: 10*10 = 100. total = 9100.
    // fund-a = 98.9% -> triggers

    const recs = analyzeConcentrationRisk(household);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toContain("concentration");
  });

  it("returns nothing with diversified holdings", () => {
    const household = makeHousehold({
      accounts: [
        makeAccount({
          holdings: [
            { fundId: "fund-a", units: 100, purchasePrice: 10, currentPrice: 10 },
            { fundId: "fund-b", units: 100, purchasePrice: 10, currentPrice: 10 },
            { fundId: "fund-c", units: 100, purchasePrice: 10, currentPrice: 10 },
          ],
        }),
      ],
    });
    // Each fund is 33% -> none > 40%

    expect(analyzeConcentrationRisk(household)).toHaveLength(0);
  });
});

describe("generateRecommendations", () => {
  it("returns recommendations sorted by priority (high first)", () => {
    const household = makeHousehold({
      accounts: [
        makeAccount({ currentValue: 50000 }),
        makeAccount({
          id: "cash-1",
          type: "cash_savings",
          currentValue: 1000,
        }),
      ],
    });

    const recs = generateRecommendations(household, emptyTransactions);
    expect(recs.length).toBeGreaterThan(0);

    // Verify sort order
    for (let i = 1; i < recs.length; i++) {
      const prevOrder = recs[i - 1].priority === "high" ? 0 : recs[i - 1].priority === "medium" ? 1 : 2;
      const currOrder = recs[i].priority === "high" ? 0 : recs[i].priority === "medium" ? 1 : 2;
      expect(prevOrder).toBeLessThanOrEqual(currOrder);
    }
  });

  it("includes person name and id on per-person recommendations", () => {
    const household = makeHousehold({
      annualContributions: [makeContributions({ isaContribution: 0 })],
    });

    const recs = generateRecommendations(household, emptyTransactions);
    const personRecs = recs.filter((r) => r.personId);

    for (const rec of personRecs) {
      expect(rec.personName).toBe("Alice");
      expect(rec.personId).toBe("person-1");
    }
  });

  it("skips persons without income data", () => {
    const household = makeHousehold({
      persons: [makePerson(), makePerson({ id: "person-2", name: "Bob" })],
      // Only person-1 has income/contributions
    });

    const recs = generateRecommendations(household, emptyTransactions);
    const bobRecs = recs.filter((r) => r.personId === "person-2");
    expect(bobRecs).toHaveLength(0);
  });
});
