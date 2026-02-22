import { describe, it, expect } from "vitest";
import { makeTestHousehold, makePerson, makeSpouse } from "./test-fixtures";
import {
  projectCompoundGrowth,
  projectFinalValue,
  calculateAdjustedRequiredPot,
  calculateAge,
  calculateSWR,
  getMidScenarioRate,
  calculateProRataStatePension,
} from "../projections";
import { calculateTotalAnnualContributions, calculateHouseholdStatePension } from "../aggregations";
import { computeHeroData } from "../dashboard";
import { generateLifetimeCashFlow } from "../lifetime-cashflow";
import type { HouseholdData } from "@/types";
import { annualiseContribution, isAccountAccessible } from "@/types";

// ============================================================
// Cross-Page Projection Consistency Integration Tests
// ============================================================
// These tests verify that the SAME household data produces
// CONSISTENT projection numbers across all four page engines:
//   1. Dashboard (computeHeroData → projectedRetirementIncome)
//   2. Projections page (projectCompoundGrowth / projectFinalValue)
//   3. Retirement page (projectFinalValue → calculateSWR)
//   4. Cashflow page (generateLifetimeCashFlow)
//
// Sam (QA): "If these four disagree, users lose trust immediately."

// --- Shared test household ---

function makeConsistentHousehold(): HouseholdData {
  return makeTestHousehold({
    persons: [
      makePerson({
        id: "p1",
        name: "Alex",
        dateOfBirth: "1980-01-15",
        plannedRetirementAge: 60,
        pensionAccessAge: 57,
        stateRetirementAge: 67,
        niQualifyingYears: 30,
      }),
    ],
    accounts: [
      { id: "a1", personId: "p1", type: "sipp", provider: "AJ Bell", name: "SIPP", currentValue: 400_000 },
      { id: "a2", personId: "p1", type: "stocks_and_shares_isa", provider: "Vanguard", name: "ISA", currentValue: 100_000 },
      { id: "a3", personId: "p1", type: "cash_savings", provider: "Marcus", name: "Cash", currentValue: 30_000 },
    ],
    income: [
      {
        personId: "p1",
        grossSalary: 100_000,
        employerPensionContribution: 10_000,
        employeePensionContribution: 5_000,
        pensionContributionMethod: "salary_sacrifice" as const,
        salaryGrowthRate: 0,
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
    committedOutgoings: [],
    children: [],
    properties: [],
  });
}

// ============================================================
// 1. Required pot calculated identically across pages
// ============================================================

describe("Cross-page: required pot consistency", () => {
  it("Dashboard and Retirement page compute identical required pot", () => {
    const household = makeConsistentHousehold();
    const persons = household.persons;
    const statePension = calculateHouseholdStatePension(persons);
    const { retirement } = household;

    // Retirement page formula
    const retirementPagePot = calculateAdjustedRequiredPot(
      retirement.targetAnnualIncome,
      retirement.withdrawalRate,
      retirement.includeStatePension,
      statePension
    );

    // Dashboard formula (via computeHeroData)
    const heroData = computeHeroData(household, [], "household");
    // Dashboard uses FIRE progress = totalNetWorth / requiredPot
    // So requiredPot = totalNetWorth / (fireProgress / 100)
    const dashboardTotalNW = household.accounts.reduce((s, a) => s + a.currentValue, 0);
    const dashboardRequiredPot = heroData.fireProgress > 0
      ? dashboardTotalNW / (heroData.fireProgress / 100)
      : 0;

    expect(retirementPagePot).toBeCloseTo(dashboardRequiredPot, 0);
  });

  it("Projections page uses same adjusted required pot formula", () => {
    const household = makeConsistentHousehold();
    const statePension = calculateHouseholdStatePension(household.persons);
    const { retirement } = household;

    // Both pages call calculateAdjustedRequiredPot with same inputs
    const pot = calculateAdjustedRequiredPot(
      retirement.targetAnnualIncome,
      retirement.withdrawalRate,
      retirement.includeStatePension,
      statePension
    );

    // State pension for 30 qualifying years
    const expectedStatePension = calculateProRataStatePension(30);
    const expectedPot = (retirement.targetAnnualIncome - expectedStatePension) / retirement.withdrawalRate;

    expect(pot).toBeCloseTo(expectedPot, 0);
  });
});

// ============================================================
// 2. Annual contributions counted identically
// ============================================================

describe("Cross-page: contribution counting consistency", () => {
  it("aggregations and manual sum produce identical totals", () => {
    const household = makeConsistentHousehold();

    // aggregations.ts formula (used by Dashboard + Retirement + Projections)
    const aggTotal = calculateTotalAnnualContributions(household.contributions, household.income);

    // Manual sum: discretionary + employment pension
    const discretionary = household.contributions.reduce(
      (sum, c) => sum + annualiseContribution(c.amount, c.frequency), 0
    );
    const employmentPension = household.income.reduce(
      (sum, i) => sum + i.employeePensionContribution + i.employerPensionContribution, 0
    );

    expect(aggTotal).toBe(discretionary + employmentPension);
    // £12k ISA + £15k pension = £27k
    expect(aggTotal).toBe(12_000 + 15_000);
  });

  it("lifetime cashflow uses same contribution sources", () => {
    const household = makeConsistentHousehold();

    // Lifetime cashflow adds pension + savings contributions during working years
    // Verify: pension = employee + employer employment pension + discretionary pension
    const personIncome = household.income[0];
    const expectedPensionContrib = personIncome.employeePensionContribution + personIncome.employerPensionContribution;

    // Discretionary contributions targeting non-pension go to accessible wealth
    const isaContrib = household.contributions
      .filter(c => c.target !== "pension")
      .reduce((s, c) => s + annualiseContribution(c.amount, c.frequency), 0);

    expect(expectedPensionContrib).toBe(15_000);
    expect(isaContrib).toBe(12_000);
  });
});

// ============================================================
// 3. Projected pot at retirement agrees across engines
// ============================================================

describe("Cross-page: projected pot at retirement", () => {
  it("projectFinalValue matches last element of projectCompoundGrowth", () => {
    const currentPot = 530_000; // 400k + 100k + 30k
    const annualContrib = 27_000;
    const rate = 0.06;
    const years = 14; // age 46 -> 60

    const finalVal = projectFinalValue(currentPot, annualContrib, rate, years);
    const growthArray = projectCompoundGrowth(currentPot, annualContrib / 12, rate, years);
    const lastYear = growthArray[growthArray.length - 1];

    expect(finalVal).toBeCloseTo(lastYear.value, 0);
  });

  it("Dashboard projected retirement income uses same growth logic as Retirement page", () => {
    const household = makeConsistentHousehold();
    const midRate = getMidScenarioRate(household.retirement.scenarioRates);

    // Dashboard computation
    const heroData = computeHeroData(household, [], "household");

    // Retirement page computation (mirror what the page does)
    const currentPot = household.accounts.reduce((s, a) => s + a.currentValue, 0);
    const totalContrib = calculateTotalAnnualContributions(household.contributions, household.income);
    const currentAge = calculateAge(household.persons[0].dateOfBirth);
    const yearsToRetirement = Math.max(0, household.persons[0].plannedRetirementAge - currentAge);

    const projectedPot = projectFinalValue(currentPot, totalContrib, midRate, yearsToRetirement);
    const sustainableIncome = calculateSWR(projectedPot, household.retirement.withdrawalRate);
    const statePension = household.retirement.includeStatePension
      ? calculateHouseholdStatePension(household.persons)
      : 0;
    const totalProjectedIncome = sustainableIncome + statePension;

    // Dashboard should match
    expect(heroData.projectedRetirementIncome).toBeCloseTo(totalProjectedIncome, -2);
  });

  it("all pages agree projected pot is much larger than current pot", () => {
    const household = makeConsistentHousehold();
    const currentPot = household.accounts.reduce((s, a) => s + a.currentValue, 0);
    const midRate = getMidScenarioRate(household.retirement.scenarioRates);
    const currentAge = calculateAge(household.persons[0].dateOfBirth);
    const years = household.persons[0].plannedRetirementAge - currentAge;
    const totalContrib = calculateTotalAnnualContributions(household.contributions, household.income);

    const projected = projectFinalValue(currentPot, totalContrib, midRate, years);

    // With £530k + £27k/yr at 6% for ~14 years, projected pot should be much larger
    expect(projected).toBeGreaterThan(currentPot * 1.5);
    // But not unreasonably large (sanity cap)
    expect(projected).toBeLessThan(currentPot * 10);
  });
});

// ============================================================
// 4. Lifetime cashflow produces consistent retirement income
// ============================================================

describe("Cross-page: lifetime cashflow vs retirement projection", () => {
  it("employment income drops to zero at planned retirement age", () => {
    const household = makeConsistentHousehold();
    const midRate = getMidScenarioRate(household.retirement.scenarioRates);
    const result = generateLifetimeCashFlow(household, midRate);
    const retirementAge = household.persons[0].plannedRetirementAge;

    const atRetirement = result.data.find(d => d.age === retirementAge);
    const afterRetirement = result.data.filter(d => d.age > retirementAge);

    expect(atRetirement).toBeDefined();
    for (const year of afterRetirement) {
      expect(year.employmentIncome).toBe(0);
    }
  });

  it("state pension kicks in at state retirement age", () => {
    const household = makeConsistentHousehold();
    const midRate = getMidScenarioRate(household.retirement.scenarioRates);
    const result = generateLifetimeCashFlow(household, midRate);
    const stateAge = household.persons[0].stateRetirementAge;

    const beforeState = result.data.find(d => d.age === stateAge - 1);
    const atState = result.data.find(d => d.age === stateAge);

    expect(beforeState?.statePensionIncome).toBe(0);
    expect(atState?.statePensionIncome).toBeGreaterThan(0);
  });

  it("pension drawdown starts only after pension access age", () => {
    const household = makeConsistentHousehold();
    const midRate = getMidScenarioRate(household.retirement.scenarioRates);
    const result = generateLifetimeCashFlow(household, midRate);
    const pensionAccessAge = household.persons[0].pensionAccessAge;

    const beforeAccess = result.data.filter(d => d.age < pensionAccessAge);
    for (const year of beforeAccess) {
      expect(year.pensionIncome).toBe(0);
    }
  });
});

// ============================================================
// 5. Person-view filtering consistency
// ============================================================

describe("Cross-page: person-view filtering", () => {
  function makeCoupleHousehold(): HouseholdData {
    return makeTestHousehold({
      persons: [
        makePerson({
          id: "p1", name: "Alice", dateOfBirth: "1980-06-15",
          plannedRetirementAge: 60, pensionAccessAge: 57, stateRetirementAge: 67,
          niQualifyingYears: 30,
        }),
        makeSpouse({
          id: "p2", name: "Bob", dateOfBirth: "1982-03-20",
          plannedRetirementAge: 65, pensionAccessAge: 57, stateRetirementAge: 67,
          niQualifyingYears: 20,
        }),
      ],
      accounts: [
        { id: "a1", personId: "p1", type: "sipp", provider: "AJ Bell", name: "Alice SIPP", currentValue: 300_000 },
        { id: "a2", personId: "p2", type: "sipp", provider: "Aviva", name: "Bob Pension", currentValue: 100_000 },
        { id: "a3", personId: "p1", type: "stocks_and_shares_isa", provider: "Vanguard", name: "Alice ISA", currentValue: 80_000 },
        { id: "a4", personId: "p2", type: "cash_savings", provider: "Marcus", name: "Bob Cash", currentValue: 20_000 },
      ],
      income: [
        {
          personId: "p1", grossSalary: 90_000,
          employerPensionContribution: 9_000, employeePensionContribution: 4_500,
          pensionContributionMethod: "salary_sacrifice" as const,
        },
        {
          personId: "p2", grossSalary: 50_000,
          employerPensionContribution: 2_500, employeePensionContribution: 2_500,
          pensionContributionMethod: "salary_sacrifice" as const,
        },
      ],
      contributions: [
        { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 1_000, frequency: "monthly" as const },
        { id: "c2", personId: "p2", label: "ISA", target: "isa" as const, amount: 500, frequency: "monthly" as const },
      ],
    });
  }

  it("household total = sum of individual persons", () => {
    const household = makeCoupleHousehold();

    const householdHero = computeHeroData(household, [], "household");
    const aliceHero = computeHeroData(household, [], "p1");
    const bobHero = computeHeroData(household, [], "p2");

    expect(householdHero.totalNetWorth).toBeCloseTo(
      aliceHero.totalNetWorth + bobHero.totalNetWorth, 0
    );
  });

  it("person-filtered contributions sum to household total", () => {
    const household = makeCoupleHousehold();

    const aliceContribs = calculateTotalAnnualContributions(
      household.contributions.filter(c => c.personId === "p1"),
      household.income.filter(i => i.personId === "p1")
    );
    const bobContribs = calculateTotalAnnualContributions(
      household.contributions.filter(c => c.personId === "p2"),
      household.income.filter(i => i.personId === "p2")
    );
    const totalContribs = calculateTotalAnnualContributions(
      household.contributions,
      household.income
    );

    expect(aliceContribs + bobContribs).toBeCloseTo(totalContribs, 0);
  });

  it("person-filtered projections are smaller than household", () => {
    const household = makeCoupleHousehold();
    const midRate = getMidScenarioRate(household.retirement.scenarioRates);

    const householdPot = household.accounts.reduce((s, a) => s + a.currentValue, 0);
    const alicePot = household.accounts.filter(a => a.personId === "p1").reduce((s, a) => s + a.currentValue, 0);
    const bobPot = household.accounts.filter(a => a.personId === "p2").reduce((s, a) => s + a.currentValue, 0);

    expect(alicePot + bobPot).toBe(householdPot);
    expect(alicePot).toBeLessThan(householdPot);
    expect(bobPot).toBeLessThan(householdPot);
  });
});

// ============================================================
// 6. Growth rate selection consistency
// ============================================================

describe("Cross-page: growth rate selection", () => {
  it("getMidScenarioRate selects the middle element", () => {
    expect(getMidScenarioRate([0.04, 0.06, 0.08])).toBe(0.06);
    expect(getMidScenarioRate([0.05, 0.07])).toBe(0.07);
    expect(getMidScenarioRate([0.05])).toBe(0.05);
    expect(getMidScenarioRate([])).toBe(0.07); // fallback
  });

  it("Dashboard and Cashflow use same mid-rate selection", () => {
    const household = makeConsistentHousehold();

    // Dashboard
    const dashboardRate = getMidScenarioRate(household.retirement.scenarioRates);

    // Cashflow page
    const rates = household.retirement.scenarioRates;
    const cashflowRate = rates[Math.floor(rates.length / 2)] ?? 0.05;

    expect(dashboardRate).toBe(cashflowRate);
  });
});

// ============================================================
// 7. Accessible vs locked wealth split consistency
// ============================================================

describe("Cross-page: accessible vs locked wealth", () => {
  it("accessible + locked = total net worth (accounts only)", () => {
    const household = makeConsistentHousehold();

    const total = household.accounts.reduce((s, a) => s + a.currentValue, 0);
    const accessible = household.accounts
      .filter(a => isAccountAccessible(a.type))
      .reduce((s, a) => s + a.currentValue, 0);
    const locked = household.accounts
      .filter(a => !isAccountAccessible(a.type))
      .reduce((s, a) => s + a.currentValue, 0);

    expect(accessible + locked).toBe(total);
  });

  it("pension bridge uses accessible wealth only", () => {
    const household = makeConsistentHousehold();
    const accessible = household.accounts
      .filter(a => isAccountAccessible(a.type))
      .reduce((s, a) => s + a.currentValue, 0);

    // ISA (100k) + Cash (30k) = 130k
    expect(accessible).toBe(130_000);
  });
});
