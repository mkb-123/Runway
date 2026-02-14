import { describe, it, expect } from "vitest";
import {
  generateRecommendations,
  analyzeSalaryTaper,
  analyzeISAUsage,
  analyzePensionHeadroom,
  analyzeBedAndISA,
  analyzeEmergencyFund,
  analyzeRetirementProgress,
  analyzeGIAOverweight,
  analyzeExcessCash,
  analyzeSavingsRate,
} from "../recommendations";
import type {
  HouseholdData,
  Person,
  PersonIncome,
  Contribution,
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

/** Create contribution totals shape used by per-person analyzer contexts */
function makeContributionTotals(overrides: Partial<{ isaContribution: number; pensionContribution: number; giaContribution: number }> = {}) {
  return {
    isaContribution: 0,
    pensionContribution: 6000,
    giaContribution: 0,
    ...overrides,
  };
}

/** Create actual Contribution[] for HouseholdData */
function makeContributions(
  personId: string = "person-1",
  totals: { isaContribution?: number; pensionContribution?: number; giaContribution?: number } = {}
): Contribution[] {
  const result: Contribution[] = [];
  const isa = totals.isaContribution ?? 0;
  const pension = totals.pensionContribution ?? 6000;
  const gia = totals.giaContribution ?? 0;
  if (isa > 0) result.push({ id: `c-isa-${personId}`, personId, label: "ISA", target: "isa", amount: isa, frequency: "annually" });
  if (pension > 0) result.push({ id: `c-pension-${personId}`, personId, label: "Pension", target: "pension", amount: pension, frequency: "annually" });
  if (gia > 0) result.push({ id: `c-gia-${personId}`, personId, label: "GIA", target: "gia", amount: gia, frequency: "annually" });
  return result;
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    personId: "person-1",
    type: "stocks_and_shares_isa",
    provider: "Vanguard",
    name: "Test ISA",
    currentValue: 50000,
    ...overrides,
  };
}

function makeHousehold(overrides: Partial<HouseholdData> = {}): HouseholdData {
  return {
    persons: [makePerson()],
    accounts: [makeAccount()],
    income: [makeIncome()],
    bonusStructures: [],
    contributions: makeContributions(),
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
    committedOutgoings: [],
    dashboardConfig: { heroMetrics: ["net_worth", "cash_position", "retirement_countdown"] },
    ...overrides,
  };
}

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
      contributions: makeContributionTotals({ pensionContribution: 5000 }),
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
      contributions: makeContributionTotals(),
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
      contributions: makeContributionTotals(),
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
      contributions: makeContributionTotals({ isaContribution: 12000 }),
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
      contributions: makeContributionTotals({ isaContribution: 0 }),
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
      contributions: makeContributionTotals({ isaContribution: 20000 }),
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
      contributions: makeContributionTotals({ pensionContribution: 10000 }),
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
      contributions: makeContributionTotals({ pensionContribution: 55000 }),
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
      contributions: makeContributionTotals(),
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
      contributions: makeContributionTotals(),
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

    const recs = generateRecommendations(household);
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
      contributions: makeContributions("person-1", { isaContribution: 0 }),
    });

    const recs = generateRecommendations(household);
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

    const recs = generateRecommendations(household);
    const bobRecs = recs.filter((r) => r.personId === "person-2");
    expect(bobRecs).toHaveLength(0);
  });
});

// --- Previously untested analyzers ---

describe("analyzeBedAndISA", () => {
  it("recommends zero-cost Bed & ISA when gains within CGT allowance", () => {
    const smallGainAccount = makeAccount({
      id: "gia-2",
      type: "gia",
      currentValue: 10300,
      costBasis: 10000,
    });

    const ctx = {
      person: makePerson(),
      income: makeIncome(),
      contributions: makeContributionTotals({ isaContribution: 5000 }),
      accounts: [smallGainAccount],
      adjustedGross: 60000,
      allAccounts: [smallGainAccount],
    };

    // Unrealised gain: 10300 - 10000 = 300, within CGT allowance

    const recs = analyzeBedAndISA(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toContain("bed-isa-free");
    expect(recs[0].priority).toBe("high");
    expect(recs[0].category).toBe("tax");
  });

  it("returns nothing when GIA value is zero", () => {
    const emptyGia = makeAccount({
      id: "gia-1",
      type: "gia",
      currentValue: 0,
    });

    const ctx = {
      person: makePerson(),
      income: makeIncome(),
      contributions: makeContributionTotals({ isaContribution: 5000 }),
      accounts: [emptyGia],
      adjustedGross: 60000,
      allAccounts: [emptyGia],
    };

    expect(analyzeBedAndISA(ctx)).toHaveLength(0);
  });

  it("returns nothing when ISA fully used", () => {
    const giaAccount = makeAccount({
      id: "gia-1",
      type: "gia",
      currentValue: 10000,
      costBasis: 8000,
    });

    const ctx = {
      person: makePerson(),
      income: makeIncome(),
      contributions: makeContributionTotals({ isaContribution: 20000 }),
      accounts: [giaAccount],
      adjustedGross: 60000,
      allAccounts: [giaAccount],
    };

    expect(analyzeBedAndISA(ctx)).toHaveLength(0);
  });
});

describe("analyzeExcessCash", () => {
  it("warns when excess cash is > £10k and > 15% of net worth", () => {
    const household = makeHousehold({
      accounts: [
        makeAccount({
          id: "cash-1",
          type: "cash_savings",
          currentValue: 40000,
        }),
        makeAccount({
          id: "isa-1",
          type: "stocks_and_shares_isa",
          currentValue: 60000,
        }),
      ],
      emergencyFund: {
        monthlyEssentialExpenses: 2000,
        targetMonths: 6,
      },
    });
    // Emergency target: 12,000
    // Total cash: 40,000
    // Excess: 28,000
    // NW: 100,000
    // Excess/NW: 28% > 15% and > 10k

    const recs = analyzeExcessCash(household);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("excess-cash");
    expect(recs[0].priority).toBe("medium");
    expect(recs[0].category).toBe("investment");
  });

  it("returns nothing when cash is just above emergency target but small fraction of NW", () => {
    const household = makeHousehold({
      accounts: [
        makeAccount({
          id: "cash-1",
          type: "cash_savings",
          currentValue: 15000,
        }),
        makeAccount({
          id: "isa-1",
          type: "stocks_and_shares_isa",
          currentValue: 500000,
        }),
      ],
      emergencyFund: {
        monthlyEssentialExpenses: 2000,
        targetMonths: 6,
      },
    });
    // Emergency target: 12,000
    // Excess: 3,000
    // NW: 515,000
    // 3,000/515,000 = 0.6% < 15%

    expect(analyzeExcessCash(household)).toHaveLength(0);
  });

  it("returns nothing when cash is below emergency target", () => {
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

    expect(analyzeExcessCash(household)).toHaveLength(0);
  });
});

describe("analyzeSavingsRate", () => {
  it("warns when savings rate is below 15%", () => {
    const household = makeHousehold({
      income: [makeIncome({ grossSalary: 100000 })],
      contributions: makeContributions("person-1", {
        isaContribution: 5000,
        pensionContribution: 5000,
        giaContribution: 0,
      }),
    });
    // Total contributions: 10,000 / 100,000 = 10% < 15%

    const recs = analyzeSavingsRate(household);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("low-savings-rate");
    expect(recs[0].category).toBe("retirement");
  });

  it("returns nothing when savings rate is >= 15%", () => {
    const household = makeHousehold({
      income: [makeIncome({ grossSalary: 100000 })],
      contributions: makeContributions("person-1", {
        isaContribution: 10000,
        pensionContribution: 6000,
        giaContribution: 0,
      }),
    });
    // Total: 16,000 / 100,000 = 16% > 15%

    expect(analyzeSavingsRate(household)).toHaveLength(0);
  });

  it("flags high priority when savings rate is below 5%", () => {
    const household = makeHousehold({
      income: [makeIncome({ grossSalary: 100000 })],
      contributions: makeContributions("person-1", {
        isaContribution: 2000,
        pensionContribution: 1000,
        giaContribution: 0,
      }),
    });
    // Total: 3,000 / 100,000 = 3% < 5%

    const recs = analyzeSavingsRate(household);
    expect(recs).toHaveLength(1);
    expect(recs[0].priority).toBe("high");
  });

  it("returns nothing when no income", () => {
    const household = makeHousehold({
      income: [makeIncome({ grossSalary: 0 })],
    });

    expect(analyzeSavingsRate(household)).toHaveLength(0);
  });
});
