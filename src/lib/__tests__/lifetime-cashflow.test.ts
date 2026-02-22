import { describe, it, expect } from "vitest";
import {
  generateLifetimeCashFlow,
  calculateExpenditure,
} from "@/lib/lifetime-cashflow";
import type { HouseholdData, CommittedOutgoing } from "@/types";

// --- Test Helpers ---

function makeHousehold(overrides: Partial<HouseholdData> = {}): HouseholdData {
  return {
    persons: [
      {
        id: "p1",
        name: "Alex",
        relationship: "self",
        dateOfBirth: "1990-06-15",
        plannedRetirementAge: 60,
        pensionAccessAge: 57,
        stateRetirementAge: 67,
        niQualifyingYears: 20,
        studentLoanPlan: "none",
      },
    ],
    accounts: [
      { id: "a1", personId: "p1", type: "workplace_pension", provider: "Aviva", name: "Pension", currentValue: 200_000 },
      { id: "a2", personId: "p1", type: "stocks_and_shares_isa", provider: "Vanguard", name: "ISA", currentValue: 80_000 },
      { id: "a3", personId: "p1", type: "cash_savings", provider: "Marcus", name: "Cash", currentValue: 30_000 },
    ],
    income: [
      {
        personId: "p1",
        grossSalary: 80_000,
        employerPensionContribution: 4_000,
        employeePensionContribution: 3_200,
        pensionContributionMethod: "salary_sacrifice" as const,
        salaryGrowthRate: 0.03,
        bonusGrowthRate: 0,
      },
    ],
    bonusStructures: [],
    contributions: [
      { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 1_000, frequency: "monthly" as const },
    ],
    retirement: {
      targetAnnualIncome: 40_000,
      withdrawalRate: 0.04,
      includeStatePension: true,
      scenarioRates: [0.04, 0.06, 0.08],
    },
    emergencyFund: {
      monthlyEssentialExpenses: 2_000,
      targetMonths: 6,
      monthlyLifestyleSpending: 2_500,
    },
    iht: { estimatedPropertyValue: 0, passingToDirectDescendants: false, gifts: [] },
    children: [],
    committedOutgoings: [
      {
        id: "o1",
        category: "mortgage" as const,
        label: "Mortgage",
        amount: 1_500,
        frequency: "monthly" as const,
      },
    ],
    dashboardConfig: { heroMetrics: ["net_worth", "cash_position", "retirement_countdown"] },
    ...overrides,
  };
}

function makeCoupleHousehold(): HouseholdData {
  return makeHousehold({
    persons: [
      {
        id: "p1",
        name: "Alex",
        relationship: "self",
        dateOfBirth: "1975-03-10",
        plannedRetirementAge: 57,
        pensionAccessAge: 57,
        stateRetirementAge: 67,
        niQualifyingYears: 30,
        studentLoanPlan: "none",
      },
      {
        id: "p2",
        name: "Jordan",
        relationship: "spouse",
        dateOfBirth: "1978-07-20",
        plannedRetirementAge: 55,
        pensionAccessAge: 57,
        stateRetirementAge: 67,
        niQualifyingYears: 25,
        studentLoanPlan: "none",
      },
    ],
    income: [
      {
        personId: "p1",
        grossSalary: 120_000,
        employerPensionContribution: 6_000,
        employeePensionContribution: 4_800,
        pensionContributionMethod: "salary_sacrifice" as const,
      },
      {
        personId: "p2",
        grossSalary: 60_000,
        employerPensionContribution: 3_000,
        employeePensionContribution: 2_400,
        pensionContributionMethod: "salary_sacrifice" as const,
      },
    ],
    accounts: [
      { id: "a1", personId: "p1", type: "workplace_pension", provider: "P", name: "Pension", currentValue: 500_000 },
      { id: "a2", personId: "p2", type: "sipp", provider: "P", name: "SIPP", currentValue: 200_000 },
      { id: "a3", personId: "p1", type: "stocks_and_shares_isa", provider: "V", name: "ISA", currentValue: 150_000 },
      { id: "a4", personId: "p2", type: "cash_savings", provider: "M", name: "Cash", currentValue: 50_000 },
    ],
    contributions: [],
  });
}

// --- Tests ---

describe("generateLifetimeCashFlow", () => {
  it("returns empty result for empty household", () => {
    const household = makeHousehold({ persons: [] });
    const result = generateLifetimeCashFlow(household, 0.05);
    expect(result.data).toHaveLength(0);
    expect(result.events).toHaveLength(0);
    expect(result.primaryPersonName).toBe("");
  });

  it("generates data from current age to 95", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    const currentAge = new Date().getFullYear() - 1990;
    const expectedAges = 95 - currentAge + 1;
    expect(result.data.length).toBeGreaterThanOrEqual(expectedAges - 1); // account for month rounding
    expect(result.data[0].age).toBeGreaterThanOrEqual(currentAge - 1);
    expect(result.data[result.data.length - 1].age).toBe(95);
  });

  it("respects custom endAge", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05, 80);
    expect(result.data[result.data.length - 1].age).toBe(80);
  });

  it("shows employment income during working years", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    const workingYears = result.data.filter((d) => d.age < 60);
    for (const year of workingYears) {
      expect(year.employmentIncome).toBeGreaterThan(0);
    }
  });

  it("shows zero employment income after retirement", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    // After retirement age (60), employment income should be 0
    const retiredYears = result.data.filter((d) => d.age >= 61);
    for (const year of retiredYears) {
      expect(year.employmentIncome).toBe(0);
    }
  });

  it("shows state pension from state retirement age", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    const beforeStatePension = result.data.filter((d) => d.age < 67);
    const afterStatePension = result.data.filter((d) => d.age >= 67);
    for (const year of beforeStatePension) {
      expect(year.statePensionIncome).toBe(0);
    }
    for (const year of afterStatePension) {
      expect(year.statePensionIncome).toBeGreaterThan(0);
    }
  });

  it("shows pension drawdown from pension access age when needed", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    // After retirement (60) but before pension access (57), person is retired
    // but since pensionAccessAge=57 < retirementAge=60, pension is accessible at retirement
    const postRetirement = result.data.filter((d) => d.age >= 60 && d.age < 67);
    // At least some of these years should show pension drawdown (to cover expenditure)
    const hasDrawdown = postRetirement.some((d) => d.pensionIncome > 0);
    expect(hasDrawdown).toBe(true);
  });

  it("total income equals sum of income components", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    for (const year of result.data) {
      const expected = year.employmentIncome + year.pensionIncome + year.statePensionIncome + year.investmentIncome;
      expect(year.totalIncome).toBe(expected);
    }
  });

  it("surplus equals total income minus total expenditure", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    for (const year of result.data) {
      expect(year.surplus).toBe(year.totalIncome - year.totalExpenditure);
    }
  });

  it("generates events for retirement, pension access, and state pension", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    const eventLabels = result.events.map((e) => e.label);
    expect(eventLabels).toContain("Alex retires");
    expect(eventLabels).toContain("Alex pension access");
    expect(eventLabels).toContain("Alex state pension");
  });

  it("handles two-person household", () => {
    const household = makeCoupleHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.primaryPersonName).toBe("Alex");
    // Should have events for both persons
    const names = result.events.map((e) => e.label);
    expect(names.some((n) => n.includes("Alex"))).toBe(true);
    expect(names.some((n) => n.includes("Jordan"))).toBe(true);
  });

  it("applies salary growth over time", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    const year0 = result.data[0];
    const year5 = result.data[5];
    // With 3% salary growth, employment income should be higher in year 5
    if (year0.employmentIncome > 0 && year5.employmentIncome > 0) {
      expect(year5.employmentIncome).toBeGreaterThan(year0.employmentIncome);
    }
  });

  it("pension pot grows during working years", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    // After retirement, pension drawdown should be available
    // This indirectly tests that pots grew (otherwise they'd be too small)
    const retirementData = result.data.filter((d) => d.age >= 60 && d.age <= 70);
    const totalPensionDrawn = retirementData.reduce((sum, d) => sum + d.pensionIncome, 0);
    expect(totalPensionDrawn).toBeGreaterThan(0);
  });

  it("all numeric values are non-negative", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    for (const year of result.data) {
      expect(year.employmentIncome).toBeGreaterThanOrEqual(0);
      expect(year.pensionIncome).toBeGreaterThanOrEqual(0);
      expect(year.statePensionIncome).toBeGreaterThanOrEqual(0);
      expect(year.investmentIncome).toBeGreaterThanOrEqual(0);
      expect(year.totalIncome).toBeGreaterThanOrEqual(0);
      expect(year.totalExpenditure).toBeGreaterThanOrEqual(0);
      // surplus can be negative
    }
  });
});

describe("calculateExpenditure", () => {
  it("calculates monthly outgoings correctly", () => {
    const outgoings: CommittedOutgoing[] = [
      { id: "1", category: "mortgage", label: "Mortgage", amount: 1500, frequency: "monthly" },
    ];
    const result = calculateExpenditure(outgoings, 2000, 2025);
    // 1500 * 12 (mortgage) + 2000 * 12 (lifestyle)
    expect(result).toBe(1500 * 12 + 2000 * 12);
  });

  it("calculates termly outgoings correctly", () => {
    const outgoings: CommittedOutgoing[] = [
      { id: "1", category: "school_fees", label: "School", amount: 6000, frequency: "termly" },
    ];
    const result = calculateExpenditure(outgoings, 0, 2025);
    // 6000 * 3 (termly = 3x/year)
    expect(result).toBe(18000);
  });

  it("respects start date", () => {
    const outgoings: CommittedOutgoing[] = [
      { id: "1", category: "other", label: "Club", amount: 100, frequency: "monthly", startDate: "2026-01-01" },
    ];
    expect(calculateExpenditure(outgoings, 0, 2025)).toBe(0);
    expect(calculateExpenditure(outgoings, 0, 2026)).toBe(1200);
    expect(calculateExpenditure(outgoings, 0, 2027)).toBe(1200);
  });

  it("respects end date", () => {
    const outgoings: CommittedOutgoing[] = [
      { id: "1", category: "school_fees", label: "Fees", amount: 6000, frequency: "termly", endDate: "2030-12-31" },
    ];
    expect(calculateExpenditure(outgoings, 0, 2030)).toBe(18000);
    expect(calculateExpenditure(outgoings, 0, 2031)).toBe(0);
  });

  it("respects both start and end dates", () => {
    const outgoings: CommittedOutgoing[] = [
      {
        id: "1",
        category: "childcare",
        label: "Nursery",
        amount: 1000,
        frequency: "monthly",
        startDate: "2025-01-01",
        endDate: "2028-12-31",
      },
    ];
    expect(calculateExpenditure(outgoings, 0, 2024)).toBe(0);
    expect(calculateExpenditure(outgoings, 0, 2026)).toBe(12000);
    expect(calculateExpenditure(outgoings, 0, 2029)).toBe(0);
  });

  it("sums multiple outgoings", () => {
    const outgoings: CommittedOutgoing[] = [
      { id: "1", category: "mortgage", label: "Mortgage", amount: 1500, frequency: "monthly" },
      { id: "2", category: "school_fees", label: "Fees", amount: 5000, frequency: "termly" },
      { id: "3", category: "insurance", label: "Life", amount: 2400, frequency: "annually" },
    ];
    const result = calculateExpenditure(outgoings, 1000, 2025);
    // 1500*12 + 5000*3 + 2400 + 1000*12
    expect(result).toBe(18000 + 15000 + 2400 + 12000);
  });

  it("handles empty outgoings", () => {
    const result = calculateExpenditure([], 2000, 2025);
    expect(result).toBe(24000); // just lifestyle
  });

  it("handles zero lifestyle spending", () => {
    const result = calculateExpenditure([], 0, 2025);
    expect(result).toBe(0);
  });
});

describe("generateLifetimeCashFlow events", () => {
  it("includes outgoing end events", () => {
    const household = makeHousehold({
      committedOutgoings: [
        {
          id: "o1",
          category: "school_fees",
          label: "School Fees",
          amount: 6000,
          frequency: "termly",
          endDate: "2035-12-31",
        },
      ],
    });
    const result = generateLifetimeCashFlow(household, 0.05);
    const endEvents = result.events.filter((e) => e.label.includes("ends"));
    expect(endEvents.length).toBeGreaterThan(0);
    expect(endEvents[0].label).toBe("School Fees ends");
  });

  it("deduplicates events with same age and label", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    const seen = new Set<string>();
    for (const event of result.events) {
      const key = `${event.age}-${event.label}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("generateLifetimeCashFlow deferred bonus", () => {
  it("includes deferred bonus in employment income during working years", () => {
    const withoutBonus = makeHousehold({ bonusStructures: [] });
    const withBonus = makeHousehold({
      bonusStructures: [
        {
          personId: "p1",
          totalBonusAnnual: 45_000,
          cashBonusAnnual: 0,
          vestingYears: 3,
          vestingGapYears: 0,
          estimatedAnnualReturn: 0.08,
        },
      ],
    });

    const resultWithout = generateLifetimeCashFlow(withoutBonus, 0.05);
    const resultWith = generateLifetimeCashFlow(withBonus, 0.05);

    // During working years, employment income should be higher with deferred bonus
    const yearIdx = 5; // well into working years
    expect(resultWith.data[yearIdx].employmentIncome).toBeGreaterThan(
      resultWithout.data[yearIdx].employmentIncome
    );
  });

  it("includes cash bonus in employment income during working years", () => {
    const withoutBonus = makeHousehold({ bonusStructures: [] });
    const withBonus = makeHousehold({
      bonusStructures: [
        {
          personId: "p1",
          totalBonusAnnual: 25_000,
          cashBonusAnnual: 25_000,
          vestingYears: 3,
          vestingGapYears: 0,
          estimatedAnnualReturn: 0.08,
        },
      ],
    });

    const resultWithout = generateLifetimeCashFlow(withoutBonus, 0.05);
    const resultWith = generateLifetimeCashFlow(withBonus, 0.05);

    const yearIdx = 5;
    expect(resultWith.data[yearIdx].employmentIncome).toBeGreaterThan(
      resultWithout.data[yearIdx].employmentIncome
    );
  });

  it("deferred bonus stops at retirement", () => {
    const household = makeHousehold({
      bonusStructures: [
        {
          personId: "p1",
          totalBonusAnnual: 45_000,
          cashBonusAnnual: 0,
          vestingYears: 3,
          vestingGapYears: 0,
          estimatedAnnualReturn: 0.08,
        },
      ],
    });
    const result = generateLifetimeCashFlow(household, 0.05);
    const retiredYears = result.data.filter((d) => d.age >= 61);
    for (const year of retiredYears) {
      expect(year.employmentIncome).toBe(0);
    }
  });
});

describe("calculateExpenditure with inflation", () => {
  it("applies inflation when baseYear is provided and year > baseYear", () => {
    const outgoings: CommittedOutgoing[] = [
      { id: "1", category: "school_fees", label: "Fees", amount: 6000, frequency: "termly", inflationRate: 0.05 },
    ];
    // Base year 2025, calendar year 2030 => 5 years of 5% inflation
    const base = calculateExpenditure(outgoings, 0, 2025, 2025);
    const inflated = calculateExpenditure(outgoings, 0, 2030, 2025);
    expect(base).toBe(18_000); // 6000 * 3
    // 18000 * 1.05^5 = 22977 (approx)
    expect(inflated).toBeCloseTo(18_000 * Math.pow(1.05, 5), 0);
    expect(inflated).toBeGreaterThan(base);
  });

  it("no inflation in the base year (yearOffset = 0)", () => {
    const outgoings: CommittedOutgoing[] = [
      { id: "1", category: "school_fees", label: "Fees", amount: 6000, frequency: "termly", inflationRate: 0.05 },
    ];
    const result = calculateExpenditure(outgoings, 0, 2025, 2025);
    expect(result).toBe(18_000);
  });

  it("items without inflationRate are unaffected", () => {
    const outgoings: CommittedOutgoing[] = [
      { id: "1", category: "mortgage", label: "Mortgage", amount: 1500, frequency: "monthly" },
    ];
    const base = calculateExpenditure(outgoings, 0, 2025, 2025);
    const later = calculateExpenditure(outgoings, 0, 2035, 2025);
    expect(base).toBe(later); // no inflation
  });

  it("mixes inflated and non-inflated outgoings correctly", () => {
    const outgoings: CommittedOutgoing[] = [
      { id: "1", category: "mortgage", label: "Mortgage", amount: 1500, frequency: "monthly" },
      { id: "2", category: "school_fees", label: "Fees", amount: 6000, frequency: "termly", inflationRate: 0.10 },
    ];
    // Year 0: mortgage 18000 + fees 18000 = 36000
    const year0 = calculateExpenditure(outgoings, 0, 2025, 2025);
    expect(year0).toBe(36_000);
    // Year 1: mortgage 18000 (no inflation) + fees 18000 * 1.10 = 19800 => total 37800
    const year1 = calculateExpenditure(outgoings, 0, 2026, 2025);
    expect(year1).toBeCloseTo(18_000 + 18_000 * 1.10, 0);
  });
});

describe("generateLifetimeCashFlow with inflated outgoings", () => {
  it("expenditure increases over time when outgoings have inflation", () => {
    const household = makeHousehold({
      committedOutgoings: [
        {
          id: "o1",
          category: "school_fees" as const,
          label: "School fees",
          amount: 6_000,
          frequency: "termly" as const,
          inflationRate: 0.05,
        },
      ],
    });
    const result = generateLifetimeCashFlow(household, 0.05);
    const year0 = result.data[0];
    const year10 = result.data[10];
    // School fees inflate at 5%/yr, so expenditure at year 10 should be higher
    // (lifestyle spending is the same, so the difference comes from inflated fees)
    expect(year10.totalExpenditure).toBeGreaterThan(year0.totalExpenditure);
  });
});

describe("generateLifetimeCashFlow person filtering", () => {
  it("filters to a single person when household is pre-filtered", () => {
    const household = makeCoupleHousehold();
    const fullResult = generateLifetimeCashFlow(household, 0.05);

    // Filter household to just Jordan (p2)
    const jordanHousehold: HouseholdData = {
      ...household,
      persons: household.persons.filter((p) => p.id === "p2"),
      income: household.income.filter((i) => i.personId === "p2"),
      accounts: household.accounts.filter((a) => a.personId === "p2"),
      bonusStructures: household.bonusStructures.filter((b) => b.personId === "p2"),
      contributions: household.contributions.filter((c) => c.personId === "p2"),
    };
    const jordanResult = generateLifetimeCashFlow(jordanHousehold, 0.05);

    expect(jordanResult.primaryPersonName).toBe("Jordan");
    expect(jordanResult.data.length).toBeGreaterThan(0);
    // Events should only mention Jordan
    for (const event of jordanResult.events) {
      expect(event.label).toContain("Jordan");
    }
    // Jordan's solo income should be less than the full household
    expect(jordanResult.data[0].employmentIncome).toBeLessThan(fullResult.data[0].employmentIncome);
  });

  it("shows only the selected person's accounts for drawdown", () => {
    const household = makeCoupleHousehold();

    // Alex has 500k pension + 150k ISA, Jordan has 200k SIPP + 50k cash
    const alexHousehold: HouseholdData = {
      ...household,
      persons: household.persons.filter((p) => p.id === "p1"),
      income: household.income.filter((i) => i.personId === "p1"),
      accounts: household.accounts.filter((a) => a.personId === "p1"),
      bonusStructures: household.bonusStructures.filter((b) => b.personId === "p1"),
      contributions: household.contributions.filter((c) => c.personId === "p1"),
    };
    const jordanHousehold: HouseholdData = {
      ...household,
      persons: household.persons.filter((p) => p.id === "p2"),
      income: household.income.filter((i) => i.personId === "p2"),
      accounts: household.accounts.filter((a) => a.personId === "p2"),
      bonusStructures: household.bonusStructures.filter((b) => b.personId === "p2"),
      contributions: household.contributions.filter((c) => c.personId === "p2"),
    };

    const alexResult = generateLifetimeCashFlow(alexHousehold, 0.05);
    const jordanResult = generateLifetimeCashFlow(jordanHousehold, 0.05);

    // Post-retirement drawdown: Alex has much larger pots so should have more drawdown
    const alexPostRetirement = alexResult.data.filter((d) => d.age >= 60);
    const jordanPostRetirement = jordanResult.data.filter((d) => d.age >= 60);

    const alexTotalDrawdown = alexPostRetirement.reduce(
      (sum, d) => sum + d.pensionIncome + d.investmentIncome, 0
    );
    const jordanTotalDrawdown = jordanPostRetirement.reduce(
      (sum, d) => sum + d.pensionIncome + d.investmentIncome, 0
    );

    expect(alexTotalDrawdown).toBeGreaterThan(jordanTotalDrawdown);
  });

  it("single-person result has no events for the other person", () => {
    const household = makeCoupleHousehold();

    const alexHousehold: HouseholdData = {
      ...household,
      persons: household.persons.filter((p) => p.id === "p1"),
      income: household.income.filter((i) => i.personId === "p1"),
      accounts: household.accounts.filter((a) => a.personId === "p1"),
      bonusStructures: [],
      contributions: [],
    };
    const result = generateLifetimeCashFlow(alexHousehold, 0.05);

    expect(result.primaryPersonName).toBe("Alex");
    for (const event of result.events) {
      expect(event.label).not.toContain("Jordan");
    }
  });
});

describe("generateLifetimeCashFlow property: income consistency", () => {
  it("during working years, employment income is the dominant source", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    const workingYears = result.data.filter((d) => d.age < 55);
    for (const year of workingYears) {
      if (year.totalIncome > 0) {
        expect(year.employmentIncome).toBeGreaterThan(year.pensionIncome);
        expect(year.employmentIncome).toBeGreaterThan(year.investmentIncome);
      }
    }
  });

  it("employment income grows monotonically during working years when growth rate > 0", () => {
    const household = makeHousehold();
    const result = generateLifetimeCashFlow(household, 0.05);
    const workingYears = result.data.filter((d) => d.employmentIncome > 0);
    for (let i = 1; i < workingYears.length; i++) {
      // Allow for rounding: employment income should be non-decreasing
      expect(workingYears[i].employmentIncome).toBeGreaterThanOrEqual(
        workingYears[i - 1].employmentIncome - 1 // rounding tolerance
      );
    }
  });
});
