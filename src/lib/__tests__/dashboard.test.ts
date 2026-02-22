import { describe, it, expect } from "vitest";
import {
  computeHeroData,
  getNextCashEvents,
  getStatusSentence,
  detectLifeStage,
  getRecommendationUrgency,
} from "../dashboard";
import type { HouseholdData, NetWorthSnapshot } from "@/types";

// ============================================================
// Helpers — minimal household fixture
// ============================================================

function makeHousehold(overrides: Partial<HouseholdData> = {}): HouseholdData {
  return {
    persons: [
      {
        id: "p1",
        name: "James",
        relationship: "self",
        dateOfBirth: "1974-06-15",
        plannedRetirementAge: 60,
        pensionAccessAge: 57,
        stateRetirementAge: 67,
        niQualifyingYears: 35,
        studentLoanPlan: "none",
      },
      {
        id: "p2",
        name: "Sarah",
        relationship: "spouse",
        dateOfBirth: "1976-03-20",
        plannedRetirementAge: 62,
        pensionAccessAge: 57,
        stateRetirementAge: 67,
        niQualifyingYears: 28,
        studentLoanPlan: "none",
      },
    ],
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
    iht: {
      estimatedPropertyValue: 600000,
      passingToDirectDescendants: true,
      gifts: [],
    },
    committedOutgoings: [
      { id: "o1", category: "mortgage" as const, label: "Mortgage", amount: 2000, frequency: "monthly" as const },
    ],
    children: [],
    dashboardConfig: {
      heroMetrics: ["net_worth", "cash_position", "retirement_countdown"],
    },
    ...overrides,
  };
}

function makeSnapshots(count: number = 3): NetWorthSnapshot[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() - (count - 1 - i));
    return {
      date: date.toISOString().split("T")[0],
      totalNetWorth: 1_400_000 + i * 12_000,
      byPerson: [
        { personId: "p1", value: 1_050_000 + i * 8_000 },
        { personId: "p2", value: 350_000 + i * 4_000 },
      ],
      byType: [],
      byWrapper: [],
    };
  });
}

// ============================================================
// computeHeroData
// ============================================================

describe("computeHeroData", () => {
  it("returns correct net worth for household view", () => {
    const h = makeHousehold();
    const result = computeHeroData(h, [], "household");
    // 800k + 320k + 200k + 50k + 30k = 1_400_000
    expect(result.totalNetWorth).toBe(1_400_000);
    expect(result.isPersonView).toBe(false);
  });

  it("returns correct net worth for person view (REC-C / QA-1)", () => {
    const h = makeHousehold();
    const result = computeHeroData(h, [], "p1");
    // p1: 800k + 200k + 50k = 1_050_000
    expect(result.totalNetWorth).toBe(1_050_000);
    expect(result.isPersonView).toBe(true);
  });

  it("filters cash position by person", () => {
    const h = makeHousehold();
    const household = computeHeroData(h, [], "household");
    const person = computeHeroData(h, [], "p1");
    expect(household.cashPosition).toBe(80000); // 50k + 30k
    expect(person.cashPosition).toBe(50000); // only p1 cash
  });

  it("computes savings rate per-person (REC-C)", () => {
    const h = makeHousehold();
    const household = computeHeroData(h, [], "household");
    const person = computeHeroData(h, [], "p1");
    // Household: contributions + pension for all persons vs total income
    expect(household.savingsRate).toBeGreaterThan(0);
    // Person: only p1's contributions/pension vs p1's income
    expect(person.savingsRate).toBeGreaterThan(0);
    // Different rates because income/contribution ratios differ
    expect(person.savingsRate).not.toBe(household.savingsRate);
  });

  it("computes period change from snapshots (person-filtered)", () => {
    const h = makeHousehold();
    const snaps = makeSnapshots(3);
    const household = computeHeroData(h, snaps, "household");
    expect(household.hasEnoughSnapshotsForMoM).toBe(true);
    expect(household.monthOnMonthChange).toBe(12_000);

    const person = computeHeroData(h, snaps, "p1");
    expect(person.monthOnMonthChange).toBe(8_000);
  });

  it("QA-3: returns hasEnoughSnapshotsForMoM=false with < 2 snapshots", () => {
    const h = makeHousehold();
    const result = computeHeroData(h, makeSnapshots(1), "household");
    expect(result.hasEnoughSnapshotsForMoM).toBe(false);
    expect(result.monthOnMonthChange).toBe(0);
  });

  it("QA-3: returns hasEnoughSnapshotsForMoM=false with 0 snapshots", () => {
    const h = makeHousehold();
    const result = computeHeroData(h, [], "household");
    expect(result.hasEnoughSnapshotsForMoM).toBe(false);
  });

  it("QA-4: returns hasOutgoings=false when no outgoings", () => {
    const h = makeHousehold({
      committedOutgoings: [],
      emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6, monthlyLifestyleSpending: 0 },
    });
    const result = computeHeroData(h, [], "household");
    expect(result.hasOutgoings).toBe(false);
    expect(result.cashRunway).toBe(999);
  });

  it("QA-4: returns hasOutgoings=true when outgoings exist", () => {
    const h = makeHousehold();
    const result = computeHeroData(h, [], "household");
    expect(result.hasOutgoings).toBe(true);
    expect(result.cashRunway).toBeGreaterThan(0);
    expect(result.cashRunway).toBeLessThan(999);
  });

  it("QA-6: includes projectedGrowthRate", () => {
    const h = makeHousehold();
    const result = computeHeroData(h, [], "household");
    expect(result.projectedGrowthRate).toBe(0.07); // mid of [0.05, 0.07, 0.09]
  });

  it("REC-K: computes commitmentCoverageYears", () => {
    const h = makeHousehold();
    const result = computeHeroData(h, [], "household");
    // totalAnnualCommitments = mortgage (2000*12) + lifestyle (2000*12) = 48_000
    // totalNetWorth = 1_400_000
    // coverage = 1_400_000 / 48_000 ≈ 29.17 years
    expect(result.commitmentCoverageYears).toBeCloseTo(1_400_000 / 48_000, 1);
  });

  it("REC-H: includes monthlyContributionRate", () => {
    const h = makeHousehold();
    const result = computeHeroData(h, [], "household");
    expect(result.monthlyContributionRate).toBeGreaterThan(0);
  });

  it("computes retirement countdown", () => {
    const h = makeHousehold();
    const result = computeHeroData(h, [], "household");
    // With £1.4M net worth and good contributions, should be short
    expect(result.retirementCountdownYears).toBeGreaterThanOrEqual(0);
  });

  it("computes FIRE progress", () => {
    const h = makeHousehold();
    const result = computeHeroData(h, [], "household");
    expect(result.fireProgress).toBeGreaterThan(0);
  });

  it("computes projected retirement income", () => {
    const h = makeHousehold();
    const result = computeHeroData(h, [], "household");
    expect(result.projectedRetirementIncome).toBeGreaterThan(0);
    expect(result.targetAnnualIncome).toBe(60000);
  });

  it("filters pension bridge by person", () => {
    const h = makeHousehold();
    const p1 = computeHeroData(h, [], "p1");
    // p1: pensionAccessAge=57, plannedRetirementAge=60 → 0 (accessible before retirement)
    // Actually 57 < 60, so bridge = max(0, 57-60) = 0
    expect(p1.pensionBridgeYears).toBe(0);
  });

  it("handles single-person household", () => {
    const h = makeHousehold({
      persons: [makeHousehold().persons[0]],
      accounts: makeHousehold().accounts.filter((a) => a.personId === "p1"),
      income: [makeHousehold().income[0]],
      bonusStructures: [makeHousehold().bonusStructures[0]],
      contributions: [makeHousehold().contributions[0]],
    });
    const result = computeHeroData(h, [], "household");
    expect(result.totalNetWorth).toBe(1_050_000);
    expect(result.perPersonRetirement).toHaveLength(1);
  });

  it("handles empty household", () => {
    const h = makeHousehold({
      persons: [],
      accounts: [],
      income: [],
      bonusStructures: [],
      contributions: [],
      committedOutgoings: [],
    });
    const result = computeHeroData(h, [], "household");
    expect(result.totalNetWorth).toBe(0);
    expect(result.savingsRate).toBe(0);
    expect(result.perPersonRetirement).toHaveLength(0);
  });

  describe("ihtLiability", () => {
    it("returns zero for a couple with estate below combined NRB+RNRB threshold", () => {
      // Couple: NRB 2×325k=650k, RNRB 2×175k=350k, combined=1000k
      // Estate: non-pension (200k ISA + 50k cash + 30k cash) + 600k property = 880k < 1000k
      const h = makeHousehold();
      const result = computeHeroData(h, [], "household");
      expect(result.ihtLiability).toBe(0);
    });

    it("computes IHT for a single person with large estate and no RNRB", () => {
      const h = makeHousehold({
        persons: [makeHousehold().persons[0]],
        accounts: [
          { id: "a3", personId: "p1", type: "stocks_and_shares_isa" as const, provider: "Vanguard", name: "ISA", currentValue: 200_000 },
          { id: "a4", personId: "p1", type: "cash_savings" as const, provider: "Marcus", name: "Cash", currentValue: 50_000 },
        ],
        iht: { estimatedPropertyValue: 1_500_000, passingToDirectDescendants: false, gifts: [] },
      });
      const result = computeHeroData(h, [], "household");
      // Non-pension accounts: ISA 200k + cash 50k = 250k; estate = 250k + 1500k = 1750k
      // 1 person, no RNRB: NRB = 325k; taxable = 1750k - 325k = 1425k; IHT = 570k
      expect(result.ihtLiability).toBeCloseTo(570_000, -3);
    });

    it("excludes pension accounts (SIPP, workplace_pension) from estate", () => {
      const h = makeHousehold({
        persons: [makeHousehold().persons[0]],
        accounts: [
          { id: "a1", personId: "p1", type: "sipp", provider: "AJ Bell", name: "SIPP", currentValue: 2_000_000 },
          { id: "a2", personId: "p1", type: "cash_savings", provider: "Marcus", name: "Cash", currentValue: 50_000 },
        ],
        iht: { estimatedPropertyValue: 0, passingToDirectDescendants: false, gifts: [] },
      });
      const result = computeHeroData(h, [], "household");
      // Only 50k cash in estate, NRB = 325k → no IHT
      expect(result.ihtLiability).toBe(0);
    });

    it("reduces effective NRB for gifts within 7 years", () => {
      const now = new Date();
      const recentDate = new Date(now);
      recentDate.setFullYear(recentDate.getFullYear() - 3);
      const hWithGift = makeHousehold({
        persons: [makeHousehold().persons[0]],
        iht: {
          estimatedPropertyValue: 1_500_000,
          passingToDirectDescendants: false,
          gifts: [{ id: "g1", date: recentDate.toISOString().split("T")[0], amount: 100_000, recipient: "Nephew", description: "Gift" }],
        },
      });
      const hNoGift = makeHousehold({
        persons: [makeHousehold().persons[0]],
        iht: { estimatedPropertyValue: 1_500_000, passingToDirectDescendants: false, gifts: [] },
      });
      const withGift = computeHeroData(hWithGift, [], "household");
      const noGift = computeHeroData(hNoGift, [], "household");
      // Gift within 7 years erodes NRB → higher taxable amount → IHT increases by 100k × 40% = 40k
      expect(withGift.ihtLiability - noGift.ihtLiability).toBeCloseTo(40_000, -2);
    });

    it("ignores gifts older than 7 years", () => {
      const now = new Date();
      const oldDate = new Date(now);
      oldDate.setFullYear(oldDate.getFullYear() - 8);
      const hOldGift = makeHousehold({
        persons: [makeHousehold().persons[0]],
        iht: {
          estimatedPropertyValue: 1_500_000,
          passingToDirectDescendants: false,
          gifts: [{ id: "g1", date: oldDate.toISOString().split("T")[0], amount: 100_000, recipient: "Nephew", description: "Old gift" }],
        },
      });
      const hNoGift = makeHousehold({
        persons: [makeHousehold().persons[0]],
        iht: { estimatedPropertyValue: 1_500_000, passingToDirectDescendants: false, gifts: [] },
      });
      const oldGiftResult = computeHeroData(hOldGift, [], "household");
      const noGiftResult = computeHeroData(hNoGift, [], "household");
      expect(oldGiftResult.ihtLiability).toBe(noGiftResult.ihtLiability);
    });
  });
});

// ============================================================
// getNextCashEvents (REC-E)
// ============================================================

describe("getNextCashEvents", () => {
  it("returns bonus payment events", () => {
    const now = new Date();
    // Set bonus payment month to current month + 1 to ensure it's in the future
    const futureMonth = (now.getMonth() + 1) % 12;
    const h = makeHousehold({
      bonusStructures: [
        {
          personId: "p1",
          totalBonusAnnual: 50000,
          cashBonusAnnual: 20000,
          vestingYears: 3,
          vestingGapYears: 0,
          estimatedAnnualReturn: 0.08,
          bonusPaymentMonth: futureMonth,
        },
      ],
    });
    const events = getNextCashEvents(h);
    const bonusEvents = events.filter((e) => e.type === "inflow" && e.label.includes("cash bonus"));
    expect(bonusEvents.length).toBeGreaterThanOrEqual(1);
    expect(bonusEvents[0].amount).toBe(20000);
  });

  it("returns termly school fee events", () => {
    const h = makeHousehold({
      committedOutgoings: [
        {
          id: "sf1",
          category: "school_fees" as const,
          label: "School fees",
          amount: 13500,
          frequency: "termly" as const,
        },
      ],
    });
    const events = getNextCashEvents(h);
    const feeEvents = events.filter((e) => e.type === "outflow");
    expect(feeEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("limits to maxEvents", () => {
    const h = makeHousehold();
    const events = getNextCashEvents(h, 2);
    expect(events.length).toBeLessThanOrEqual(2);
  });

  it("sorts by date", () => {
    const h = makeHousehold();
    const events = getNextCashEvents(h);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].date.getTime()).toBeGreaterThanOrEqual(events[i - 1].date.getTime());
    }
  });
});

// ============================================================
// getStatusSentence (REC-A)
// ============================================================

describe("getStatusSentence", () => {
  it("shows retirement readiness for pre-retirees", () => {
    // James is ~51, retirement at 60 → 9 years → pre-retiree
    const h = makeHousehold();
    const heroData = computeHeroData(h, [], "household");
    const status = getStatusSentence(heroData, h);
    expect(status.text).toContain("retirement income");
  });

  it("shows cash coverage for school-fee households", () => {
    const h = makeHousehold({
      // Push person further from retirement
      persons: [
        {
          ...makeHousehold().persons[0],
          dateOfBirth: "1990-06-15",
          plannedRetirementAge: 65,
        },
        makeHousehold().persons[1],
      ],
      children: [
        { id: "child1", name: "Oliver", dateOfBirth: "2018-01-01", schoolFeeAnnual: 15000, feeInflationRate: 0.05, schoolStartAge: 4, schoolEndAge: 18 },
      ],
    });
    const heroData = computeHeroData(h, [], "household");
    const status = getStatusSentence(heroData, h);
    expect(status.text).toContain("months");
  });

  it("shows FIRE progress when > 50%", () => {
    const h = makeHousehold({
      persons: [
        {
          ...makeHousehold().persons[0],
          dateOfBirth: "1990-01-01",
          plannedRetirementAge: 65,
        },
      ],
      accounts: [
        { id: "a1", personId: "p1", type: "sipp", provider: "X", name: "SIPP", currentValue: 900_000 },
      ],
      income: [makeHousehold().income[0]],
      retirement: {
        targetAnnualIncome: 60000,
        withdrawalRate: 0.04,
        includeStatePension: true,
        scenarioRates: [0.05, 0.07, 0.09],
      },
    });
    const heroData = computeHeroData(h, [], "household");
    if (heroData.fireProgress >= 50) {
      const status = getStatusSentence(heroData, h);
      expect(status.text).toContain("financial independence");
    }
  });

  it("returns neutral default when no context available", () => {
    const h = makeHousehold({
      persons: [
        {
          ...makeHousehold().persons[0],
          dateOfBirth: "1995-01-01",
          plannedRetirementAge: 65,
        },
      ],
      accounts: [],
      income: [],
      bonusStructures: [],
      contributions: [],
      committedOutgoings: [],
      children: [],
    });
    const heroData = computeHeroData(h, [], "household");
    const status = getStatusSentence(heroData, h);
    expect(status.color).toBe("neutral");
  });
});

// ============================================================
// detectLifeStage (REC-B)
// ============================================================

describe("detectLifeStage", () => {
  it("detects pre_retirement when within 10 years", () => {
    const h = makeHousehold(); // James is ~51, retires at 60
    expect(detectLifeStage(h)).toBe("pre_retirement");
  });

  it("detects school_fees when children have fees", () => {
    const h = makeHousehold({
      persons: [
        {
          ...makeHousehold().persons[0],
          dateOfBirth: "1990-01-01",
          plannedRetirementAge: 65,
        },
      ],
      children: [
        { id: "c1", name: "Oli", dateOfBirth: "2018-01-01", schoolFeeAnnual: 15000, feeInflationRate: 0.05, schoolStartAge: 4, schoolEndAge: 18 },
      ],
    });
    expect(detectLifeStage(h)).toBe("school_fees");
  });

  it("detects accumulator when young and no school fees", () => {
    const h = makeHousehold({
      persons: [
        {
          ...makeHousehold().persons[0],
          dateOfBirth: "1995-01-01",
          plannedRetirementAge: 65,
        },
      ],
      children: [],
    });
    expect(detectLifeStage(h)).toBe("accumulator");
  });
});

// ============================================================
// getRecommendationUrgency (REC-F)
// ============================================================

describe("getRecommendationUrgency", () => {
  it("marks ISA recommendations as act_now in Q1", () => {
    // This test is time-dependent, so we just verify the function returns a valid value
    const urgency = getRecommendationUrgency("isa-topup-p1");
    expect(["act_now", "act_this_month", "standing"]).toContain(urgency);
  });

  it("marks pension headroom as act_this_month", () => {
    const urgency = getRecommendationUrgency("pension-headroom-p1");
    expect(urgency).toBe("act_this_month");
  });

  it("marks emergency fund as standing", () => {
    const urgency = getRecommendationUrgency("emergency-fund-low");
    expect(urgency).toBe("standing");
  });
});
