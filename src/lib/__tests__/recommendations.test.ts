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
    children: [],
    committedOutgoings: [],
    dashboardConfig: { heroMetrics: ["net_worth", "cash_position", "retirement_countdown"] },
    ...overrides,
  };
}

/** Helper: compute totalPensionContributions for a per-person test context */
function computeTotalPension(
  income: PersonIncome,
  contributions: { pensionContribution: number }
): number {
  return income.employeePensionContribution + income.employerPensionContribution + contributions.pensionContribution;
}

// --- Tests ---

describe("analyzeSalaryTaper", () => {
  it("recommends salary sacrifice when in 60% trap zone", () => {
    const income = makeIncome({
      grossSalary: 115000,
      employeePensionContribution: 5000,
      pensionContributionMethod: "salary_sacrifice",
    });
    const contributions = makeContributionTotals({ pensionContribution: 5000 });
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [],
      adjustedGross: 110000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
    };

    // totalPensionContributions = 5000 (employee) + 3000 (employer) + 5000 (discretionary) = 13000
    // headroom = 60000 - 13000 = 47000; excess over 100k = 10000; additional = min(10000, 47000) = 10000
    const recs = analyzeSalaryTaper(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toContain("salary-sacrifice-taper");
    expect(recs[0].priority).toBe("high");
    expect(recs[0].category).toBe("tax");
  });

  it("returns nothing when income below £100k", () => {
    const income = makeIncome({ grossSalary: 80000 });
    const contributions = makeContributionTotals();
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [],
      adjustedGross: 77000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
    };

    expect(analyzeSalaryTaper(ctx)).toHaveLength(0);
  });

  it("returns nothing when income above higher rate limit", () => {
    const income = makeIncome({ grossSalary: 200000 });
    const contributions = makeContributionTotals();
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [],
      adjustedGross: 197000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
    };

    expect(analyzeSalaryTaper(ctx)).toHaveLength(0);
  });

  it("returns nothing when pension allowance fully used by salary sacrifice", () => {
    // Person already contributing 50k via salary sacrifice + 3k employer = 53k of 60k allowance
    // Plus 7k discretionary pension = 60k total — no headroom left
    const income = makeIncome({
      grossSalary: 115000,
      employeePensionContribution: 50000,
      employerPensionContribution: 3000,
    });
    const contributions = makeContributionTotals({ pensionContribution: 7000 });
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [],
      adjustedGross: 65000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
    };

    // totalPensionContributions = 50000 + 3000 + 7000 = 60000 = allowance
    expect(analyzeSalaryTaper(ctx)).toHaveLength(0);
  });
});

describe("analyzeISAUsage", () => {
  it("recommends topping up ISA when partially used", () => {
    const income = makeIncome();
    const contributions = makeContributionTotals({ isaContribution: 12000 });
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [],
      adjustedGross: 60000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
    };

    const recs = analyzeISAUsage(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toContain("isa-topup");
  });

  it("recommends opening ISA when completely unused", () => {
    const income = makeIncome();
    const contributions = makeContributionTotals({ isaContribution: 0 });
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [],
      adjustedGross: 60000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
    };

    const recs = analyzeISAUsage(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toContain("isa-unused");
    expect(recs[0].priority).toBe("high");
  });

  it("returns nothing when ISA fully used", () => {
    const income = makeIncome();
    const contributions = makeContributionTotals({ isaContribution: 20000 });
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [],
      adjustedGross: 60000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
    };

    expect(analyzeISAUsage(ctx)).toHaveLength(0);
  });
});

describe("analyzePensionHeadroom", () => {
  it("recommends using headroom when > £20k unused", () => {
    const income = makeIncome({
      employeePensionContribution: 3000,
      employerPensionContribution: 3000,
    });
    const contributions = makeContributionTotals({ pensionContribution: 10000 });
    const totalPension = computeTotalPension(income, contributions);
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [],
      adjustedGross: 80000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: totalPension,
      totalAvailableAllowance: 60000,
    };

    // totalPensionContributions = 3000 + 3000 + 10000 = 16000. Remaining = 44000 > 20000.
    const recs = analyzePensionHeadroom(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].category).toBe("pension");
  });

  it("returns nothing when pension nearly fully used", () => {
    const income = makeIncome({
      employeePensionContribution: 20000,
      employerPensionContribution: 5000,
    });
    const contributions = makeContributionTotals({ pensionContribution: 30000 });
    const totalPension = computeTotalPension(income, contributions);
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [],
      adjustedGross: 60000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: totalPension,
      totalAvailableAllowance: 60000,
    };

    // totalPensionContributions = 20000 + 5000 + 30000 = 55000. Remaining = 5000 <= 20000.
    expect(analyzePensionHeadroom(ctx)).toHaveLength(0);
  });

  it("accounts for salary sacrifice in total pension used", () => {
    // Salary sacrifice of £40k means less headroom than discretionary pension alone would suggest
    const income = makeIncome({
      employeePensionContribution: 40000,
      employerPensionContribution: 5000,
    });
    const contributions = makeContributionTotals({ pensionContribution: 0 });
    const totalPension = computeTotalPension(income, contributions);
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [],
      adjustedGross: 80000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: totalPension,
      totalAvailableAllowance: 60000,
    };

    // totalPensionContributions = 40000 + 5000 + 0 = 45000. Remaining = 15000 <= 20000.
    expect(analyzePensionHeadroom(ctx)).toHaveLength(0);
  });

  it("FEAT-002: includes carry-forward in headroom", () => {
    const income = makeIncome({
      employeePensionContribution: 3000,
      employerPensionContribution: 3000,
    });
    const contributions = makeContributionTotals({ pensionContribution: 10000 });
    const totalPension = computeTotalPension(income, contributions);
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [],
      adjustedGross: 80000,
      allAccounts: [],
      effectivePensionAllowance: 60000,
      totalPensionContributions: totalPension,
      totalAvailableAllowance: 180000, // 60k current + 120k carry-forward from 3 unused years
    };

    // totalPensionContributions = 16000. Remaining = 180000 - 16000 = 164000.
    const recs = analyzePensionHeadroom(ctx);
    expect(recs).toHaveLength(1);
    expect(recs[0].description).toContain("carry-forward");
    expect(recs[0].description).toContain("£180,000"); // total available
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

    const income = makeIncome();
    const contributions = makeContributionTotals();
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [giaAccount],
      adjustedGross: 60000,
      allAccounts: [giaAccount, isaAccount],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
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

    const income = makeIncome();
    const contributions = makeContributionTotals();
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [giaAccount],
      adjustedGross: 60000,
      allAccounts: [giaAccount, isaAccount],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
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

    const income = makeIncome();
    const contributions = makeContributionTotals({ isaContribution: 5000 });
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [smallGainAccount],
      adjustedGross: 60000,
      allAccounts: [smallGainAccount],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
    };

    // Unrealised gain: 10300 - 10000 = 300, within CGT allowance
    // ISA remaining: 20000 - 5000 = 15000
    const recs = analyzeBedAndISA(ctx, 15000);
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

    const income = makeIncome();
    const contributions = makeContributionTotals({ isaContribution: 5000 });
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [emptyGia],
      adjustedGross: 60000,
      allAccounts: [emptyGia],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
    };

    expect(analyzeBedAndISA(ctx, 15000)).toHaveLength(0);
  });

  it("returns nothing when ISA fully used", () => {
    const giaAccount = makeAccount({
      id: "gia-1",
      type: "gia",
      currentValue: 10000,
      costBasis: 8000,
    });

    const income = makeIncome();
    const contributions = makeContributionTotals({ isaContribution: 20000 });
    const ctx = {
      person: makePerson(),
      income,
      contributions,
      accounts: [giaAccount],
      adjustedGross: 60000,
      allAccounts: [giaAccount],
      effectivePensionAllowance: 60000,
      totalPensionContributions: computeTotalPension(income, contributions),
    };

    // ISA fully used: 20000 - 20000 = 0 remaining
    expect(analyzeBedAndISA(ctx, 0)).toHaveLength(0);
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
  it("warns when savings rate is below 15% (including employment pension)", () => {
    const household = makeHousehold({
      // Zero employment pension contributions to isolate discretionary
      income: [makeIncome({
        grossSalary: 100000,
        employeePensionContribution: 0,
        employerPensionContribution: 0,
      })],
      contributions: makeContributions("person-1", {
        isaContribution: 5000,
        pensionContribution: 5000,
        giaContribution: 0,
      }),
    });
    // Total contributions: 0 (employment) + 10,000 (discretionary) = 10,000
    // 10,000 / 100,000 = 10% < 15%

    const recs = analyzeSavingsRate(household);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("low-savings-rate");
    expect(recs[0].category).toBe("retirement");
  });

  it("returns nothing when savings rate is >= 15% including salary sacrifice", () => {
    const household = makeHousehold({
      income: [makeIncome({
        grossSalary: 100000,
        employeePensionContribution: 10000,
        employerPensionContribution: 5000,
      })],
      contributions: makeContributions("person-1", {
        isaContribution: 0,
        pensionContribution: 0,
        giaContribution: 0,
      }),
    });
    // Total: 10,000 (employee) + 5,000 (employer) + 0 (discretionary) = 15,000
    // 15,000 / 100,000 = 15% >= 15%

    expect(analyzeSavingsRate(household)).toHaveLength(0);
  });

  it("flags high priority when savings rate is below 5%", () => {
    const household = makeHousehold({
      income: [makeIncome({
        grossSalary: 100000,
        employeePensionContribution: 0,
        employerPensionContribution: 0,
      })],
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

  it("includes salary sacrifice in savings rate calculation", () => {
    const household = makeHousehold({
      income: [makeIncome({
        grossSalary: 100000,
        employeePensionContribution: 8000,
        employerPensionContribution: 5000,
      })],
      contributions: makeContributions("person-1", {
        isaContribution: 3000,
        pensionContribution: 0,
        giaContribution: 0,
      }),
    });
    // Total: 8,000 (employee) + 5,000 (employer) + 3,000 (ISA) = 16,000
    // 16,000 / 100,000 = 16% >= 15%

    expect(analyzeSavingsRate(household)).toHaveLength(0);
  });

  it("includes cash bonus in gross income denominator", () => {
    // Salary: £100k, Cash bonus: £50k → total gross = £150k
    // Contributions: £15k → 15k/150k = 10% < 15% → should flag
    // Without bonus: 15k/100k = 15% → would NOT flag (bug)
    const household = makeHousehold({
      income: [makeIncome({
        grossSalary: 100000,
        employeePensionContribution: 0,
        employerPensionContribution: 0,
      })],
      bonusStructures: [{
        personId: "person-1",
        totalBonusAnnual: 50000,
        cashBonusAnnual: 50000,
        vestingYears: 0,
        vestingGapYears: 0,
        estimatedAnnualReturn: 0.07,
      }],
      contributions: makeContributions("person-1", {
        isaContribution: 10000,
        pensionContribution: 5000,
        giaContribution: 0,
      }),
    });

    const recs = analyzeSavingsRate(household);
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("low-savings-rate");
  });
});

// --- Pension taper with bonus income ---

describe("generateRecommendations — pension taper includes bonus", () => {
  it("tapers pension allowance when salary + bonus exceeds £200k threshold income", () => {
    // Salary £180k alone would NOT trigger taper (threshold income = £180k < £200k)
    // But salary £180k + £30k cash bonus = £210k threshold income > £200k
    // Adjusted income = £210k + £15k employer pension = £225k
    // Still below £260k adjusted income threshold → no actual taper yet, but threshold check triggers
    const household = makeHousehold({
      income: [makeIncome({
        grossSalary: 180000,
        employerPensionContribution: 50000,
        employeePensionContribution: 10000,
        pensionContributionMethod: "salary_sacrifice",
      })],
      bonusStructures: [{
        personId: "person-1",
        totalBonusAnnual: 80000,
        cashBonusAnnual: 80000,
        vestingYears: 0,
        vestingGapYears: 0,
        estimatedAnnualReturn: 0,
      }],
      contributions: makeContributions("person-1", { pensionContribution: 0 }),
    });

    // With bonus: threshold income = 180k + 80k = 260k (> £200k)
    // Adjusted income = 260k + 50k employer = 310k (> £260k)
    // Excess: 310k - 260k = 50k, reduction: 25k
    // Tapered allowance: 60k - 25k = 35k
    // Total pension: employee 10k + employer 50k = 60k
    // This exceeds the tapered 35k allowance → no headroom recommendation
    const recs = generateRecommendations(household);
    const pensionHeadroom = recs.find((r) => r.id === `pension-headroom-${makePerson().id}`);
    // With tapered allowance of 35k and 60k used, there's no headroom — no recommendation
    expect(pensionHeadroom).toBeUndefined();
  });

  it("does not taper when salary alone is below £200k and no bonus", () => {
    const household = makeHousehold({
      income: [makeIncome({
        grossSalary: 180000,
        employerPensionContribution: 15000,
        employeePensionContribution: 10000,
        pensionContributionMethod: "salary_sacrifice",
      })],
      bonusStructures: [],
      contributions: makeContributions("person-1", { pensionContribution: 0 }),
    });

    // Without bonus: threshold income = £180k (< £200k) → no taper
    // Full allowance = £60k, used = employee 10k + employer 15k = 25k
    // Headroom = 35k → recommendation to use more
    const recs = generateRecommendations(household);
    const pensionHeadroom = recs.find((r) => r.id === `pension-headroom-${makePerson().id}`);
    expect(pensionHeadroom).toBeDefined();
    // Description references the full £60k allowance (no taper applied)
    expect(pensionHeadroom?.description).toContain("60,000");
  });

  it("uses tapered allowance that limits pension headroom recommendation", () => {
    // Person with salary £170k + £50k cash bonus = £220k threshold income (> £200k)
    // Adjusted income = £220k + £20k employer = £240k (still below £260k → no actual reduction yet)
    // But now add more employer pension to push adjusted over £260k:
    // Salary £170k + bonus £50k = £220k, employer pension £50k → adjusted = £270k
    // Excess over £260k = £10k, reduction = £5k, tapered allowance = £55k
    const household = makeHousehold({
      income: [makeIncome({
        grossSalary: 170000,
        employerPensionContribution: 50000,
        employeePensionContribution: 5000,
        pensionContributionMethod: "salary_sacrifice",
      })],
      bonusStructures: [{
        personId: "person-1",
        totalBonusAnnual: 50000,
        cashBonusAnnual: 50000,
        vestingYears: 0,
        vestingGapYears: 0,
        estimatedAnnualReturn: 0,
      }],
      contributions: makeContributions("person-1", { pensionContribution: 0 }),
    });

    // Total pension used = employee 5k + employer 50k = 55k
    // Tapered allowance = 55k, headroom = 0 → no recommendation
    const recs = generateRecommendations(household);
    const pensionHeadroom = recs.find((r) => r.id === `pension-headroom-${makePerson().id}`);
    expect(pensionHeadroom).toBeUndefined();
  });
});
