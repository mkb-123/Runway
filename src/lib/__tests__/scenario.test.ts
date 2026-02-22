import { describe, it, expect } from "vitest";
import {
  applyScenarioOverrides,
  scaleSavingsRateContributions,
  calculateScenarioImpact,
  buildAvoidTaperPreset,
  generateScenarioDescription,
  type ScenarioOverrides,
} from "@/lib/scenario";
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
    properties: [],
    iht: { estimatedPropertyValue: 400000, passingToDirectDescendants: true, gifts: [] },
    children: [],
    committedOutgoings: [],
    dashboardConfig: { heroMetrics: ["projected_retirement_income", "fire_progress", "retirement_countdown"] },
    ...overrides,
  };
}

describe("applyScenarioOverrides", () => {
  it("returns household unchanged when overrides are empty", () => {
    const h = makeHousehold();
    const result = applyScenarioOverrides(h, {});
    expect(result).toEqual(h);
  });

  describe("person overrides", () => {
    it("merges partial person overrides by id", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        personOverrides: [{ id: "p1", plannedRetirementAge: 55 }],
      };
      const result = applyScenarioOverrides(h, overrides);
      expect(result.persons[0].plannedRetirementAge).toBe(55);
      // Other fields preserved
      expect(result.persons[0].name).toBe("Alice");
      expect(result.persons[0].dateOfBirth).toBe("1990-01-01");
      // Person 2 unchanged
      expect(result.persons[1].plannedRetirementAge).toBe(60);
    });

    it("applies retirement age overrides to multiple persons", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        personOverrides: [
          { id: "p1", plannedRetirementAge: 52 },
          { id: "p2", plannedRetirementAge: 58 },
        ],
      };
      const result = applyScenarioOverrides(h, overrides);
      expect(result.persons[0].plannedRetirementAge).toBe(52);
      expect(result.persons[1].plannedRetirementAge).toBe(58);
    });

    it("does not mutate original persons", () => {
      const h = makeHousehold();
      const original = h.persons[0].plannedRetirementAge;
      applyScenarioOverrides(h, {
        personOverrides: [{ id: "p1", plannedRetirementAge: 50 }],
      });
      expect(h.persons[0].plannedRetirementAge).toBe(original);
    });
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

  describe("combined overrides (integration)", () => {
    it("applies all override types together correctly", () => {
      const h = makeHousehold();
      const overrides: ScenarioOverrides = {
        personOverrides: [{ id: "p1", plannedRetirementAge: 55 }],
        income: [{ personId: "p1", grossSalary: 100000 }],
        contributionOverrides: [
          { personId: "p1", isaContribution: 20000, pensionContribution: 30000 },
        ],
        retirement: { targetAnnualIncome: 50000 },
        marketShockPercent: -0.20,
        accountValues: { a2: 250000 },
      };
      const result = applyScenarioOverrides(h, overrides);

      // Person override
      expect(result.persons[0].plannedRetirementAge).toBe(55);
      expect(result.persons[1].plannedRetirementAge).toBe(60); // unchanged

      // Income override
      expect(result.income[0].grossSalary).toBe(100000);
      expect(result.income[1].grossSalary).toBe(50000); // unchanged

      // Contribution overrides
      const p1Contribs = result.contributions.filter((c) => c.personId === "p1");
      expect(p1Contribs).toHaveLength(2);
      expect(p1Contribs[0].target).toBe("isa");
      expect(p1Contribs[0].amount).toBe(20000);
      expect(p1Contribs[1].target).toBe("pension");
      expect(p1Contribs[1].amount).toBe(30000);

      // P2's contributions unchanged
      const p2Contribs = result.contributions.filter((c) => c.personId === "p2");
      expect(p2Contribs).toHaveLength(1);
      expect(p2Contribs[0].id).toBe("c2");

      // Retirement override
      expect(result.retirement.targetAnnualIncome).toBe(50000);
      expect(result.retirement.withdrawalRate).toBe(0.04); // preserved

      // Market shock: a1 was 100k, -20% = 80k
      expect(result.accounts[0].currentValue).toBe(80000);
      // a2 has explicit override (250k) applied after shock
      expect(result.accounts[1].currentValue).toBe(250000);
    });

    it("preserves immutability across all override types", () => {
      const h = makeHousehold();
      applyScenarioOverrides(h, {
        personOverrides: [{ id: "p1", plannedRetirementAge: 55 }],
        income: [{ personId: "p1", grossSalary: 100000 }],
        contributionOverrides: [{ personId: "p1", isaContribution: 50000 }],
        retirement: { targetAnnualIncome: 80000 },
        marketShockPercent: -0.50,
      });
      expect(h.persons[0].plannedRetirementAge).toBe(60);
      expect(h.income[0].grossSalary).toBe(80000);
      expect(h.contributions).toHaveLength(2);
      expect(h.retirement.targetAnnualIncome).toBe(40000);
      expect(h.accounts[0].currentValue).toBe(100000);
    });
  });
});

describe("scaleSavingsRateContributions", () => {
  const persons = [
    { id: "p1", name: "Alice", relationship: "self" as const, dateOfBirth: "1990-01-01", plannedRetirementAge: 60, pensionAccessAge: 57, stateRetirementAge: 67, niQualifyingYears: 35, studentLoanPlan: "none" as const },
    { id: "p2", name: "Bob", relationship: "spouse" as const, dateOfBirth: "1992-01-01", plannedRetirementAge: 60, pensionAccessAge: 57, stateRetirementAge: 67, niQualifyingYears: 35, studentLoanPlan: "none" as const },
  ];
  const income = [
    { personId: "p1", grossSalary: 80000, employerPensionContribution: 4000, employeePensionContribution: 4000, pensionContributionMethod: "salary_sacrifice" as const },
    { personId: "p2", grossSalary: 50000, employerPensionContribution: 2500, employeePensionContribution: 2500, pensionContributionMethod: "net_pay" as const },
  ];

  it("scales contributions proportionally to achieve target savings rate", () => {
    // p1: 1666/mo ISA = 19992/yr ISA, p2: 10000/yr pension
    // total gross = 130k, current contribs = ~29992
    const contributions = [
      { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 1666, frequency: "monthly" as const },
      { id: "c2", personId: "p2", label: "Pension", target: "pension" as const, amount: 10000, frequency: "annually" as const },
    ];

    const result = scaleSavingsRateContributions(persons, income, [], contributions, 30);

    // Total target = 130k * 0.30 = 39000
    // p1 share = 80k/130k ≈ 61.5%, target ≈ 24k, all ISA
    // p2 share = 50k/130k ≈ 38.5%, target ≈ 15k, all pension
    const p1 = result.find((r) => r.personId === "p1")!;
    const p2 = result.find((r) => r.personId === "p2")!;

    // p1 has only ISA contributions, so all scaling goes to ISA
    expect(p1.isaContribution).toBeGreaterThan(0);
    expect(p1.pensionContribution ?? 0).toBe(0);

    // p2 has only pension contributions, so all scaling goes to pension
    expect(p2.pensionContribution).toBeGreaterThan(0);
    expect(p2.isaContribution ?? 0).toBe(0);

    // Total should approximate 39000
    const total = (p1.isaContribution ?? 0) + (p1.pensionContribution ?? 0) + (p1.giaContribution ?? 0) +
                  (p2.isaContribution ?? 0) + (p2.pensionContribution ?? 0) + (p2.giaContribution ?? 0);
    expect(total).toBeGreaterThanOrEqual(38900);
    expect(total).toBeLessThanOrEqual(39100);
  });

  it("allocates to zero-contrib person based on income share", () => {
    // Only p1 has contributions, p2 has none
    const contributions = [
      { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 20000, frequency: "annually" as const },
    ];

    const result = scaleSavingsRateContributions(persons, income, [], contributions, 20);

    // p2 should get allocation even though they had zero contributions
    const p2 = result.find((r) => r.personId === "p2")!;
    expect(p2.isaContribution).toBeGreaterThan(0);
    // p2's share = 50k/130k * 26000 ≈ 10000
    expect(p2.isaContribution!).toBeCloseTo(10000, -2);
  });

  it("returns empty array when total gross income is zero", () => {
    const zeroIncome = [
      { personId: "p1", grossSalary: 0, employerPensionContribution: 0, employeePensionContribution: 0, pensionContributionMethod: "salary_sacrifice" as const },
      { personId: "p2", grossSalary: 0, employerPensionContribution: 0, employeePensionContribution: 0, pensionContributionMethod: "net_pay" as const },
    ];
    const result = scaleSavingsRateContributions(persons, zeroIncome, [], [], 20);
    expect(result).toHaveLength(0);
  });

  it("handles zero percent savings rate", () => {
    const contributions = [
      { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 20000, frequency: "annually" as const },
    ];
    const result = scaleSavingsRateContributions(persons, income, [], contributions, 0);
    const total = result.reduce((s, r) => s + (r.isaContribution ?? 0) + (r.pensionContribution ?? 0) + (r.giaContribution ?? 0), 0);
    expect(total).toBe(0);
  });

  it("caps ISA contributions at £20,000 per person, spilling excess to GIA", () => {
    const persons = [
      { id: "p1", name: "Alice", relationship: "self" as const, dateOfBirth: "1990-01-01", plannedRetirementAge: 60, pensionAccessAge: 57, stateRetirementAge: 67, niQualifyingYears: 35, studentLoanPlan: "none" as const },
    ];
    const income = [
      { personId: "p1", grossSalary: 200000, employerPensionContribution: 0, employeePensionContribution: 0, pensionContributionMethod: "salary_sacrifice" as const },
    ];
    // Start with £10k ISA. At 50% savings rate, target = £100k. Scaling ISA by 10x → £100k.
    // But ISA should be capped at £20k, with excess £80k going to GIA.
    const contributions = [
      { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 10000, frequency: "annually" as const },
    ];
    const result = scaleSavingsRateContributions(persons, income, [], contributions, 50);
    const p1 = result.find((r) => r.personId === "p1")!;
    expect(p1.isaContribution).toBe(20000);
    expect(p1.giaContribution).toBe(80000);
  });

  it("caps ISA at £20k when no existing contributions (fallback allocation)", () => {
    const persons = [
      { id: "p1", name: "Alice", relationship: "self" as const, dateOfBirth: "1990-01-01", plannedRetirementAge: 60, pensionAccessAge: 57, stateRetirementAge: 67, niQualifyingYears: 35, studentLoanPlan: "none" as const },
    ];
    const income = [
      { personId: "p1", grossSalary: 100000, employerPensionContribution: 0, employeePensionContribution: 0, pensionContributionMethod: "salary_sacrifice" as const },
    ];
    // No existing contributions. Target 50% = £50k. Should cap ISA at £20k, rest to GIA.
    const result = scaleSavingsRateContributions(persons, income, [], [], 50);
    const p1 = result.find((r) => r.personId === "p1")!;
    expect(p1.isaContribution).toBe(20000);
    expect(p1.giaContribution).toBe(30000);
  });
});

describe("calculateScenarioImpact", () => {
  const persons = [
    { id: "p1", name: "Alice", relationship: "self" as const, dateOfBirth: "1990-01-01", plannedRetirementAge: 60, pensionAccessAge: 57, stateRetirementAge: 67, niQualifyingYears: 35, studentLoanPlan: "none" as const },
  ];
  const income = [
    { personId: "p1", grossSalary: 120000, employerPensionContribution: 5000, employeePensionContribution: 5000, pensionContributionMethod: "salary_sacrifice" as const },
  ];

  it("calculates tax and NI saved from pension increase", () => {
    // Increasing pension sacrifice from 5k to 25k should save tax and NI
    const result = calculateScenarioImpact(persons, income, { p1: 25000 });
    const impact = result.get("p1")!;
    expect(impact.taxSaved).toBeGreaterThan(0);
    expect(impact.totalSaved).toBeGreaterThan(0);
    expect(impact.takeHomeChange).toBeLessThan(0); // take-home drops (more goes to pension)
  });

  it("returns zero impact when no pension override", () => {
    const result = calculateScenarioImpact(persons, income, {});
    const impact = result.get("p1")!;
    expect(impact.taxSaved).toBe(0);
    expect(impact.niSaved).toBe(0);
    expect(impact.takeHomeChange).toBe(0);
  });
});

describe("buildAvoidTaperPreset", () => {
  it("adds pension sacrifice to bring income below £100k for affected persons", () => {
    const persons = [
      { id: "p1", name: "Alice", relationship: "self" as const, dateOfBirth: "1990-01-01", plannedRetirementAge: 60, pensionAccessAge: 57, stateRetirementAge: 67, niQualifyingYears: 35, studentLoanPlan: "none" as const },
    ];
    // 120k salary, 5k employee pension via salary sacrifice → adjusted gross = 115k
    // Taper threshold = 100k, excess = 15k → need 15k additional sacrifice
    const income = [
      { personId: "p1", grossSalary: 120000, employerPensionContribution: 5000, employeePensionContribution: 5000, pensionContributionMethod: "salary_sacrifice" as const },
    ];
    const contributions: HouseholdData["contributions"] = [];

    const result = buildAvoidTaperPreset(persons, income, contributions);
    expect(result.income).toHaveLength(1);
    expect(result.income![0].employeePensionContribution).toBe(20000); // 5k + 15k
  });

  it("does nothing for persons below taper threshold", () => {
    const persons = [
      { id: "p1", name: "Alice", relationship: "self" as const, dateOfBirth: "1990-01-01", plannedRetirementAge: 60, pensionAccessAge: 57, stateRetirementAge: 67, niQualifyingYears: 35, studentLoanPlan: "none" as const },
    ];
    const income = [
      { personId: "p1", grossSalary: 80000, employerPensionContribution: 4000, employeePensionContribution: 4000, pensionContributionMethod: "salary_sacrifice" as const },
    ];

    const result = buildAvoidTaperPreset(persons, income, []);
    expect(result.income).toHaveLength(0);
  });
});

describe("target income scenario override (integration)", () => {
  it("changing target income via scenario affects required pot", () => {
    const h = makeHousehold();
    // Base: target £40k at 4% SWR → required pot = £40k / 0.04 = £1M
    // (ignoring state pension offset for simplicity of mental model)
    expect(h.retirement.targetAnnualIncome).toBe(40000);

    // Apply scenario to increase target income
    const result = applyScenarioOverrides(h, {
      retirement: { targetAnnualIncome: 60000 },
    });

    expect(result.retirement.targetAnnualIncome).toBe(60000);
    // Other retirement config preserved
    expect(result.retirement.withdrawalRate).toBe(0.04);
    expect(result.retirement.includeStatePension).toBe(true);
    expect(result.retirement.scenarioRates).toEqual([0.05, 0.07]);
  });

  it("combined target income + contributions override", () => {
    const h = makeHousehold();
    const result = applyScenarioOverrides(h, {
      retirement: { targetAnnualIncome: 50000 },
      contributionOverrides: [
        { personId: "p1", isaContribution: 25000 },
      ],
    });

    expect(result.retirement.targetAnnualIncome).toBe(50000);
    // Contribution override applied
    const p1Contribs = result.contributions.filter((c) => c.personId === "p1");
    expect(p1Contribs).toHaveLength(1);
    expect(p1Contribs[0].amount).toBe(25000);
  });

  it("combined target income + retirement age override", () => {
    const h = makeHousehold();
    const result = applyScenarioOverrides(h, {
      retirement: { targetAnnualIncome: 35000 },
      personOverrides: [{ id: "p1", plannedRetirementAge: 55 }],
    });

    expect(result.retirement.targetAnnualIncome).toBe(35000);
    expect(result.persons[0].plannedRetirementAge).toBe(55);
    // Person 2 unchanged
    expect(result.persons[1].plannedRetirementAge).toBe(60);
  });
});

describe("FEAT-019: generateScenarioDescription", () => {
  it("describes income changes", () => {
    const desc = generateScenarioDescription(
      { income: [{ personId: "p1", grossSalary: 50000 }] },
      makeHousehold()
    );
    expect(desc).toContain("Alice");
    expect(desc).toContain("salary");
    expect(desc).toContain("£50.0k");
  });

  it("describes pension changes", () => {
    const desc = generateScenarioDescription(
      { income: [{ personId: "p1", employeePensionContribution: 20000 }] },
      makeHousehold()
    );
    expect(desc).toContain("Alice");
    expect(desc).toContain("pension");
    expect(desc).toContain("£20.0k");
  });

  it("describes retirement age changes", () => {
    const desc = generateScenarioDescription(
      { personOverrides: [{ id: "p1", plannedRetirementAge: 55 }] },
      makeHousehold()
    );
    expect(desc).toContain("Alice retires at 55");
    expect(desc).toContain("was 60");
  });

  it("describes market shock", () => {
    const desc = generateScenarioDescription(
      { marketShockPercent: -0.3 },
      makeHousehold()
    );
    expect(desc).toContain("Market: -30%");
  });

  it("describes target income", () => {
    const desc = generateScenarioDescription(
      { retirement: { targetAnnualIncome: 50000 } },
      makeHousehold()
    );
    expect(desc).toContain("Target income");
    expect(desc).toContain("£50.0k");
  });

  it("returns 'No changes' for empty overrides", () => {
    const desc = generateScenarioDescription({}, makeHousehold());
    expect(desc).toBe("No changes");
  });

  it("combines multiple changes with separator", () => {
    const desc = generateScenarioDescription(
      {
        marketShockPercent: -0.5,
        retirement: { targetAnnualIncome: 30000 },
      },
      makeHousehold()
    );
    expect(desc).toContain("·");
    expect(desc).toContain("Market: -50%");
    expect(desc).toContain("Target income");
  });
});
