// ============================================================
// Financial Independence Diagnostic Engine — Tests
// ============================================================

import { describe, it, expect } from "vitest";
import {
  scoreRetirementReadiness,
  scoreTaxEfficiency,
  scoreEmergencyFund,
  scoreSavingsRate,
  scoreIHTExposure,
  scorePortfolioDiversification,
  scoreCashFlowHealth,
  scorePensionAdequacy,
  scoreRiskAlignment,
  scoreInsuranceProtection,
  generateDiagnosticReport,
} from "@/lib/fi-diagnostic";
import { makeTestHousehold, makeEmptyHousehold, makePerson, makeAccount, makeIncome, makeProperty, makeInsurancePolicy } from "./test-fixtures";
import { buildRiskProfile, calculateRiskScore, RISK_PROFILE_QUESTIONS } from "@/lib/risk-profile";
import type { HouseholdData, RiskProfile, RiskProfileAnswer } from "@/types";

// ============================================================
// 1. Retirement Readiness
// ============================================================

describe("scoreRetirementReadiness", () => {
  it("returns insufficient_data for empty household", () => {
    const h = makeEmptyHousehold();
    const result = scoreRetirementReadiness(h);
    expect(result.dimension).toBe("retirement_readiness");
    expect(result.rating).toBe("insufficient_data");
    expect(result.score).toBe(0);
  });

  it("scores green for well-funded retirement", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 1_200_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "stocks_and_shares_isa", currentValue: 400_000 }),
      ],
    });
    const result = scoreRetirementReadiness(h);
    expect(result.rating).toBe("green");
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it("scores red for severely underfunded retirement with no contributions", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 10_000 }),
      ],
      contributions: [],
      // Zero pension contributions so projection stays low
      income: [makeIncome({
        personId: "p1",
        grossSalary: 30_000,
        employeePensionContribution: 0,
        employerPensionContribution: 0,
      })],
      bonusStructures: [],
    });
    const result = scoreRetirementReadiness(h);
    expect(result.rating).toBe("red");
    expect(result.score).toBeLessThan(40);
  });

  it("includes FIRE progress percentage in details", () => {
    const h = makeTestHousehold();
    const result = scoreRetirementReadiness(h);
    expect(result.details.some((d) => d.includes("FIRE progress"))).toBe(true);
  });

  it("includes projected pot in details", () => {
    const h = makeTestHousehold();
    const result = scoreRetirementReadiness(h);
    expect(result.details.some((d) => d.includes("Projected pot at retirement"))).toBe(true);
  });

  it("provides recommendation for underfunded scenarios", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 50_000 }),
      ],
      contributions: [],
    });
    const result = scoreRetirementReadiness(h);
    expect(result.recommendation).toBeDefined();
  });

  it("does not provide recommendation when on track", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 2_000_000 }),
      ],
    });
    const result = scoreRetirementReadiness(h);
    expect(result.recommendation).toBeUndefined();
  });
});

// ============================================================
// 2. Tax Efficiency
// ============================================================

describe("scoreTaxEfficiency", () => {
  it("returns insufficient_data for no accounts", () => {
    const h = makeEmptyHousehold();
    const result = scoreTaxEfficiency(h);
    expect(result.rating).toBe("insufficient_data");
  });

  it("scores high when most assets are sheltered", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 800_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "stocks_and_shares_isa", currentValue: 200_000 }),
      ],
      contributions: [
        { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 1666, frequency: "monthly" as const },
        { id: "c2", personId: "p2", label: "ISA", target: "isa" as const, amount: 1666, frequency: "monthly" as const },
      ],
    });
    const result = scoreTaxEfficiency(h);
    // 100% sheltered
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("scores low when assets are mostly in GIA/cash", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "gia", currentValue: 500_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "cash_savings", currentValue: 300_000 }),
        makeAccount({ id: "a3", personId: "p1", type: "sipp", currentValue: 50_000 }),
      ],
      contributions: [],
    });
    const result = scoreTaxEfficiency(h);
    expect(result.score).toBeLessThan(50);
    expect(result.recommendation).toBeDefined();
  });

  it("includes per-person ISA usage in details", () => {
    const h = makeTestHousehold();
    const result = scoreTaxEfficiency(h);
    expect(result.details.some((d) => d.includes("ISA usage"))).toBe(true);
  });
});

// ============================================================
// 3. Emergency Fund
// ============================================================

describe("scoreEmergencyFund", () => {
  it("returns insufficient_data when expenses not set", () => {
    const h = makeEmptyHousehold({
      emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6, monthlyLifestyleSpending: 0 },
    });
    const result = scoreEmergencyFund(h);
    expect(result.rating).toBe("insufficient_data");
  });

  it("scores green when fund meets target", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "cash_savings", currentValue: 20_000 }),
      ],
      emergencyFund: { monthlyEssentialExpenses: 3_000, targetMonths: 6, monthlyLifestyleSpending: 2_000 },
    });
    const result = scoreEmergencyFund(h);
    // 20k covers 6.7 months — exceeds 6 month target
    expect(result.rating).toBe("green");
    expect(result.score).toBe(100);
  });

  it("scores red when fund is critically low", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "cash_savings", currentValue: 2_000 }),
      ],
      emergencyFund: { monthlyEssentialExpenses: 5_000, targetMonths: 6, monthlyLifestyleSpending: 2_000 },
    });
    const result = scoreEmergencyFund(h);
    // 2k / 5k = 0.4 months
    expect(result.rating).toBe("red");
    expect(result.score).toBeLessThan(20);
  });

  it("includes cash ISA and premium bonds in emergency fund", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "cash_savings", currentValue: 5_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "cash_isa", currentValue: 10_000 }),
        makeAccount({ id: "a3", personId: "p1", type: "premium_bonds", currentValue: 5_000 }),
      ],
      emergencyFund: { monthlyEssentialExpenses: 3_000, targetMonths: 6, monthlyLifestyleSpending: 0 },
    });
    const result = scoreEmergencyFund(h);
    // 20k total / 3k monthly = 6.7 months
    expect(result.rating).toBe("green");
  });

  it("provides recommendation when below target", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "cash_savings", currentValue: 5_000 }),
      ],
      emergencyFund: { monthlyEssentialExpenses: 3_000, targetMonths: 6, monthlyLifestyleSpending: 0 },
    });
    const result = scoreEmergencyFund(h);
    expect(result.recommendation).toContain("short of the 6-month target");
  });
});

// ============================================================
// 4. Savings Rate
// ============================================================

describe("scoreSavingsRate", () => {
  it("returns insufficient_data for no income", () => {
    const h = makeEmptyHousehold();
    const result = scoreSavingsRate(h);
    expect(result.rating).toBe("insufficient_data");
  });

  it("scores green for 25%+ savings rate", () => {
    const h = makeTestHousehold({
      income: [makeIncome({
        personId: "p1",
        grossSalary: 100_000,
        employeePensionContribution: 10_000,
        employerPensionContribution: 10_000,
      })],
      contributions: [
        { id: "c1", personId: "p1", label: "ISA", target: "isa" as const, amount: 1_666, frequency: "monthly" as const },
      ],
      bonusStructures: [],
    });
    const result = scoreSavingsRate(h);
    // 10k + 10k + ~20k ISA = 40k / 100k = 40%
    expect(result.rating).toBe("green");
  });

  it("scores red for very low savings rate", () => {
    const h = makeTestHousehold({
      income: [makeIncome({
        personId: "p1",
        grossSalary: 100_000,
        employeePensionContribution: 1_000,
        employerPensionContribution: 1_000,
      })],
      contributions: [],
      bonusStructures: [],
    });
    const result = scoreSavingsRate(h);
    // 2k / 100k = 2%
    expect(result.rating).toBe("red");
    expect(result.recommendation).toContain("15%");
  });

  it("includes breakdown in details", () => {
    const h = makeTestHousehold();
    const result = scoreSavingsRate(h);
    expect(result.details.some((d) => d.includes("Employer pension"))).toBe(true);
    expect(result.details.some((d) => d.includes("Discretionary savings"))).toBe(true);
  });
});

// ============================================================
// 5. IHT Exposure
// ============================================================

describe("scoreIHTExposure", () => {
  it("returns insufficient_data for no estate", () => {
    const h = makeEmptyHousehold();
    const result = scoreIHTExposure(h);
    expect(result.rating).toBe("insufficient_data");
  });

  it("scores green when estate is within threshold (couple)", () => {
    const h = makeTestHousehold({
      persons: [makePerson({ id: "p1" }), makePerson({ id: "p2", relationship: "spouse" })],
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "stocks_and_shares_isa", currentValue: 200_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "cash_savings", currentValue: 100_000 }),
      ],
      iht: { estimatedPropertyValue: 0, passingToDirectDescendants: true, gifts: [] },
      properties: [],
    });
    const result = scoreIHTExposure(h);
    // 300k estate, couple with RNRB = £1M threshold
    expect(result.rating).toBe("green");
    expect(result.score).toBe(100);
  });

  it("scores red for large estate single person without RNRB (Eleanor scenario)", () => {
    const h = makeTestHousehold({
      persons: [makePerson({ id: "p1" })],
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "stocks_and_shares_isa", currentValue: 215_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "gia", currentValue: 385_000 }),
        makeAccount({ id: "a3", personId: "p1", type: "cash_savings", currentValue: 70_000 }),
      ],
      properties: [makeProperty({ id: "prop1", estimatedValue: 1_850_000, mortgageBalance: 0, ownerPersonIds: ["p1"] })],
      iht: { estimatedPropertyValue: 0, passingToDirectDescendants: false, gifts: [] },
    });
    const result = scoreIHTExposure(h);
    // Estate ~2.52M, single person, no RNRB = NRB of £325k only
    // IHT liability = (2.52M - 325k) * 40% ≈ £878k
    expect(result.rating).toBe("red");
    expect(result.recommendation).toContain("IHT liability");
  });

  it("excludes pensions from estate calculation", () => {
    const h = makeTestHousehold({
      persons: [makePerson({ id: "p1" })],
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 800_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "cash_savings", currentValue: 50_000 }),
      ],
      iht: { estimatedPropertyValue: 0, passingToDirectDescendants: false, gifts: [] },
      properties: [],
    });
    const result = scoreIHTExposure(h);
    // Only 50k in estate (pension excluded), NRB = 325k
    expect(result.score).toBe(100);
  });

  it("accounts for gifts within 7 years", () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const h = makeTestHousehold({
      persons: [makePerson({ id: "p1" })],
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "stocks_and_shares_isa", currentValue: 500_000 }),
      ],
      iht: {
        estimatedPropertyValue: 0,
        passingToDirectDescendants: false,
        gifts: [
          { id: "g1", date: twoYearsAgo.toISOString().slice(0, 10), amount: 200_000, recipient: "Nephew", description: "Gift" },
        ],
      },
      properties: [],
    });
    const result = scoreIHTExposure(h);
    // 500k estate, single, no RNRB, 200k gifts reduce NRB
    // Effective NRB = 325k - 200k = 125k, taxable = 375k, IHT = 150k
    expect(result.details.some((d) => d.includes("Gifts within 7 years"))).toBe(true);
  });
});

// ============================================================
// 6. Portfolio Diversification
// ============================================================

describe("scorePortfolioDiversification", () => {
  it("returns insufficient_data for no accounts", () => {
    const h = makeEmptyHousehold();
    const result = scorePortfolioDiversification(h);
    expect(result.rating).toBe("insufficient_data");
  });

  it("scores high for well-diversified portfolio", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", provider: "AJ Bell", currentValue: 400_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "stocks_and_shares_isa", provider: "Vanguard", currentValue: 200_000 }),
        makeAccount({ id: "a3", personId: "p1", type: "gia", provider: "Hargreaves", currentValue: 100_000 }),
        makeAccount({ id: "a4", personId: "p1", type: "cash_savings", provider: "Marcus", currentValue: 50_000 }),
      ],
    });
    const result = scorePortfolioDiversification(h);
    // 4 wrappers, 4 providers, no extreme concentration
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("scores low for single-wrapper concentration", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "cash_savings", provider: "Chase", currentValue: 500_000 }),
      ],
    });
    const result = scorePortfolioDiversification(h);
    // Single wrapper, single provider, 100% concentration
    expect(result.score).toBeLessThan(50);
    expect(result.recommendation).toBeDefined();
  });

  it("includes wrapper breakdown in details", () => {
    const h = makeTestHousehold();
    const result = scorePortfolioDiversification(h);
    expect(result.details.some((d) => d.includes("Distinct tax wrappers"))).toBe(true);
    expect(result.details.some((d) => d.includes("Accessible assets"))).toBe(true);
  });
});

// ============================================================
// 7. Cash Flow Health
// ============================================================

describe("scoreCashFlowHealth", () => {
  it("returns insufficient_data for no income", () => {
    const h = makeEmptyHousehold();
    const result = scoreCashFlowHealth(h);
    expect(result.rating).toBe("insufficient_data");
  });

  it("scores green for low committed ratio", () => {
    const h = makeTestHousehold({
      income: [makeIncome({ personId: "p1", grossSalary: 150_000 })],
      bonusStructures: [],
      committedOutgoings: [
        { id: "o1", category: "mortgage" as const, label: "Mortgage", amount: 1_000, frequency: "monthly" as const },
      ],
      emergencyFund: { monthlyEssentialExpenses: 3_000, targetMonths: 6, monthlyLifestyleSpending: 1_000 },
    });
    const result = scoreCashFlowHealth(h);
    // 12k mortgage + 12k lifestyle = 24k / 150k = 16%
    expect(result.rating).toBe("green");
  });

  it("scores red for cash flow deficit", () => {
    const h = makeTestHousehold({
      income: [makeIncome({ personId: "p1", grossSalary: 50_000 })],
      bonusStructures: [],
      committedOutgoings: [
        { id: "o1", category: "mortgage" as const, label: "Mortgage", amount: 3_000, frequency: "monthly" as const },
        { id: "o2", category: "school_fees" as const, label: "School", amount: 6_000, frequency: "termly" as const },
      ],
      emergencyFund: { monthlyEssentialExpenses: 3_000, targetMonths: 6, monthlyLifestyleSpending: 2_000 },
    });
    const result = scoreCashFlowHealth(h);
    // 36k mortgage + 18k school + 24k lifestyle = 78k vs 50k income
    expect(result.rating).toBe("red");
    expect(result.recommendation).toContain("deficit");
  });

  it("excludes expired outgoings", () => {
    const pastDate = "2020-01-01";
    const h = makeTestHousehold({
      committedOutgoings: [
        { id: "o1", category: "mortgage" as const, label: "Old Mortgage", amount: 5_000, frequency: "monthly" as const, endDate: pastDate },
        { id: "o2", category: "utilities" as const, label: "Electric", amount: 100, frequency: "monthly" as const },
      ],
    });
    const result = scoreCashFlowHealth(h);
    // Only the utilities should count (old mortgage has expired)
    expect(result.details.some((d) => d.includes("utilities"))).toBe(true);
  });
});

// ============================================================
// 8. Pension Adequacy
// ============================================================

describe("scorePensionAdequacy", () => {
  it("returns insufficient_data for empty household", () => {
    const h = makeEmptyHousehold();
    const result = scorePensionAdequacy(h);
    expect(result.rating).toBe("insufficient_data");
  });

  it("scores high for substantial pension pot", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 1_000_000 }),
        makeAccount({ id: "a2", personId: "p2", type: "workplace_pension", currentValue: 500_000 }),
        makeAccount({ id: "a3", personId: "p1", type: "stocks_and_shares_isa", currentValue: 200_000 }),
      ],
    });
    const result = scorePensionAdequacy(h);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("scores low for minimal pension provision", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 10_000 }),
      ],
      income: [makeIncome({
        personId: "p1",
        grossSalary: 100_000,
        employeePensionContribution: 1_000,
        employerPensionContribution: 1_000,
      })],
      contributions: [],
    });
    const result = scorePensionAdequacy(h);
    expect(result.score).toBeLessThan(50);
  });

  it("includes pension bridge analysis in details", () => {
    const h = makeTestHousehold({
      persons: [makePerson({ id: "p1", plannedRetirementAge: 55, pensionAccessAge: 57 })],
    });
    const result = scorePensionAdequacy(h);
    expect(result.details.some((d) => d.includes("Pension bridge gap") || d.includes("pension"))).toBe(true);
  });
});

// ============================================================
// Full Diagnostic Report
// ============================================================

describe("generateDiagnosticReport", () => {
  it("produces report with all 10 dimensions", () => {
    const h = makeTestHousehold();
    const report = generateDiagnosticReport(h);
    expect(report.scores).toHaveLength(10);
    expect(report.scores.map((s) => s.dimension)).toEqual([
      "retirement_readiness",
      "tax_efficiency",
      "emergency_fund",
      "savings_rate",
      "iht_exposure",
      "portfolio_diversification",
      "cash_flow_health",
      "pension_adequacy",
      "risk_alignment",
      "insurance_protection",
    ]);
  });

  it("overall score is between 0 and 100", () => {
    const h = makeTestHousehold();
    const report = generateDiagnosticReport(h);
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  it("overall rating is one of green/amber/red", () => {
    const h = makeTestHousehold();
    const report = generateDiagnosticReport(h);
    expect(["green", "amber", "red"]).toContain(report.overallRating);
  });

  it("rating counts sum to 10", () => {
    const h = makeTestHousehold();
    const report = generateDiagnosticReport(h);
    const total = report.ratingCounts.green + report.ratingCounts.amber + report.ratingCounts.red + report.ratingCounts.insufficient_data;
    expect(total).toBe(10);
  });

  it("handles empty household without crashing", () => {
    const h = makeEmptyHousehold();
    const report = generateDiagnosticReport(h);
    expect(report.scores).toHaveLength(10);
    // All should be insufficient_data
    expect(report.ratingCounts.insufficient_data).toBe(10);
    expect(report.overallScore).toBe(0);
  });

  it("includes generatedAt timestamp", () => {
    const h = makeTestHousehold();
    const report = generateDiagnosticReport(h);
    expect(report.generatedAt).toBeTruthy();
    // Should be a valid ISO string
    expect(new Date(report.generatedAt).getTime()).not.toBeNaN();
  });

  it("each score has actionUrl", () => {
    const h = makeTestHousehold();
    const report = generateDiagnosticReport(h);
    for (const score of report.scores) {
      expect(score.actionUrl).toBeTruthy();
      expect(score.actionUrl.startsWith("/")).toBe(true);
    }
  });

  it("well-funded household gets high overall score", () => {
    const h = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 1_200_000 }),
        makeAccount({ id: "a2", personId: "p2", type: "workplace_pension", currentValue: 500_000 }),
        makeAccount({ id: "a3", personId: "p1", type: "stocks_and_shares_isa", currentValue: 300_000 }),
        makeAccount({ id: "a4", personId: "p1", type: "cash_savings", currentValue: 50_000 }),
      ],
      emergencyFund: { monthlyEssentialExpenses: 3_000, targetMonths: 6, monthlyLifestyleSpending: 2_000 },
    });
    const report = generateDiagnosticReport(h);
    expect(report.overallScore).toBeGreaterThanOrEqual(50);
  });

  it("single person household works correctly (Eleanor scenario)", () => {
    const h = makeTestHousehold({
      persons: [makePerson({ id: "p1", name: "Eleanor", plannedRetirementAge: 61, pensionAccessAge: 57, stateRetirementAge: 67 })],
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 490_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "stocks_and_shares_isa", currentValue: 215_000 }),
        makeAccount({ id: "a3", personId: "p1", type: "gia", currentValue: 385_000 }),
        makeAccount({ id: "a4", personId: "p1", type: "cash_savings", currentValue: 70_000 }),
      ],
      income: [makeIncome({ personId: "p1", grossSalary: 320_000, employeePensionContribution: 40_000, employerPensionContribution: 0 })],
      contributions: [],
      bonusStructures: [],
      properties: [makeProperty({ id: "prop1", estimatedValue: 1_850_000, mortgageBalance: 0, ownerPersonIds: ["p1"] })],
      iht: { estimatedPropertyValue: 0, passingToDirectDescendants: false, gifts: [] },
      retirement: { targetAnnualIncome: 75_000, withdrawalRate: 0.04, includeStatePension: true, scenarioRates: [0.04, 0.06, 0.08] },
    });
    const report = generateDiagnosticReport(h);
    expect(report.scores).toHaveLength(10);

    // IHT should be red for Eleanor (single, no RNRB, ~3M estate)
    const ihtScore = report.scores.find((s) => s.dimension === "iht_exposure");
    expect(ihtScore?.rating).toBe("red");
    // Verify single person is noted
    expect(ihtScore?.details.some((d) => d.includes("single"))).toBe(true);
  });
});

// ============================================================
// 9. Risk Alignment
// ============================================================

function makeConservativeProfile(): RiskProfile {
  const answers: RiskProfileAnswer[] = RISK_PROFILE_QUESTIONS.map((q) => ({
    questionId: q.id,
    answer: 1,
  }));
  return buildRiskProfile(answers);
}

function makeAggressiveProfile(): RiskProfile {
  const answers: RiskProfileAnswer[] = RISK_PROFILE_QUESTIONS.map((q) => ({
    questionId: q.id,
    answer: 5,
  }));
  return buildRiskProfile(answers);
}

function makeModerateProfile(): RiskProfile {
  const answers: RiskProfileAnswer[] = RISK_PROFILE_QUESTIONS.map((q) => ({
    questionId: q.id,
    answer: 3,
  }));
  return buildRiskProfile(answers);
}

describe("scoreRiskAlignment", () => {
  it("returns insufficient_data when no risk profile", () => {
    const h = makeTestHousehold();
    const result = scoreRiskAlignment(h);
    expect(result.rating).toBe("insufficient_data");
    expect(result.dimension).toBe("risk_alignment");
  });

  it("returns insufficient_data when no accounts", () => {
    const h = makeEmptyHousehold({ riskProfile: makeModerateProfile() });
    const result = scoreRiskAlignment(h);
    expect(result.rating).toBe("insufficient_data");
  });

  it("scores high for aligned moderate profile with balanced portfolio", () => {
    const h = makeTestHousehold({
      riskProfile: makeModerateProfile(),
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "stocks_and_shares_isa", currentValue: 200_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "cash_savings", currentValue: 100_000 }),
        makeAccount({ id: "a3", personId: "p1", type: "sipp", currentValue: 300_000 }),
      ],
    });
    const result = scoreRiskAlignment(h);
    // Moderate profile, 67% growth / 33% defensive (non-pension) → within range
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("scores low for conservative profile with all-equity portfolio", () => {
    const h = makeTestHousehold({
      riskProfile: makeConservativeProfile(),
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "stocks_and_shares_isa", currentValue: 300_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "gia", currentValue: 200_000 }),
        makeAccount({ id: "a3", personId: "p1", type: "cash_savings", currentValue: 10_000 }),
      ],
    });
    const result = scoreRiskAlignment(h);
    // Conservative profile but 98%+ in growth → misalignment
    expect(result.score).toBeLessThan(70);
    expect(result.recommendation).toBeDefined();
  });

  it("scores low for aggressive profile with all-cash portfolio", () => {
    const h = makeTestHousehold({
      riskProfile: makeAggressiveProfile(),
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "cash_savings", currentValue: 300_000 }),
        makeAccount({ id: "a2", personId: "p1", type: "premium_bonds", currentValue: 50_000 }),
      ],
    });
    const result = scoreRiskAlignment(h);
    // Aggressive profile but all defensive → misalignment
    expect(result.score).toBeLessThan(60);
    expect(result.recommendation).toContain("defensive");
  });

  it("includes tolerance level in details", () => {
    const h = makeTestHousehold({
      riskProfile: makeModerateProfile(),
    });
    const result = scoreRiskAlignment(h);
    expect(result.details.some((d) => d.includes("moderate"))).toBe(true);
  });
});

// ============================================================
// 10. Insurance & Protection
// ============================================================

describe("scoreInsuranceProtection", () => {
  it("returns insufficient_data for empty household", () => {
    const h = makeEmptyHousehold();
    const result = scoreInsuranceProtection(h);
    expect(result.rating).toBe("insufficient_data");
    expect(result.dimension).toBe("insurance_protection");
  });

  it("scores well with comprehensive coverage", () => {
    const h = makeTestHousehold({
      properties: [makeProperty({ mortgageBalance: 300_000 })],
      children: [{ id: "c1", name: "Child", dateOfBirth: "2020-01-01", schoolFeeAnnual: 0, feeInflationRate: 0.05, schoolStartAge: 4, schoolEndAge: 18 }],
      insurancePolicies: [
        makeInsurancePolicy({ id: "ins1", personId: "p1", type: "life", coverageAmount: 2_000_000 }),
        makeInsurancePolicy({ id: "ins2", personId: "p1", type: "critical_illness", coverageAmount: 300_000 }),
        makeInsurancePolicy({ id: "ins3", personId: "p1", type: "income_protection", coverageAmount: 72_000 }),
      ],
    });
    const result = scoreInsuranceProtection(h);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("scores low with no insurance and dependents", () => {
    const h = makeTestHousehold({
      properties: [makeProperty({ mortgageBalance: 300_000 })],
      children: [{ id: "c1", name: "Child", dateOfBirth: "2020-01-01", schoolFeeAnnual: 0, feeInflationRate: 0.05, schoolStartAge: 4, schoolEndAge: 18 }],
      insurancePolicies: [],
    });
    const result = scoreInsuranceProtection(h);
    // No insurance, has dependents and mortgage → red
    expect(result.rating).toBe("red");
    expect(result.recommendation).toBeDefined();
  });

  it("gives higher baseline for no dependents / no mortgage", () => {
    const h = makeTestHousehold({
      persons: [makePerson({ id: "p1" })],
      income: [makeIncome({ personId: "p1" })],
      bonusStructures: [],
      children: [],
      properties: [],
      insurancePolicies: [],
    });
    const result = scoreInsuranceProtection(h);
    // Single person, no dependents, no mortgage — lower need
    // But still has income to protect, so score is moderate
    expect(result.score).toBeGreaterThan(20);
  });

  it("includes coverage breakdown in details", () => {
    const h = makeTestHousehold({
      insurancePolicies: [
        makeInsurancePolicy({ id: "ins1", type: "life", coverageAmount: 500_000 }),
      ],
    });
    const result = scoreInsuranceProtection(h);
    expect(result.details.some((d) => d.includes("Life insurance cover"))).toBe(true);
    expect(result.details.some((d) => d.includes("Income protection cover"))).toBe(true);
  });

  it("values income protection highly", () => {
    const h = makeTestHousehold({
      properties: [makeProperty({ mortgageBalance: 200_000 })],
      insurancePolicies: [
        makeInsurancePolicy({ id: "ins1", type: "income_protection", coverageAmount: 80_000, personId: "p1" }),
      ],
    });
    const result = scoreInsuranceProtection(h);
    // Has income protection, but missing life and CI
    expect(result.score).toBeGreaterThan(20);
  });
});

// ============================================================
// Risk Profile Scoring
// ============================================================

describe("calculateRiskScore", () => {
  it("returns 0 score for empty answers", () => {
    const result = calculateRiskScore([]);
    expect(result.overallScore).toBe(0);
    expect(result.tolerance).toBe("moderate");
  });

  it("returns conservative for all-1 answers", () => {
    const answers: RiskProfileAnswer[] = RISK_PROFILE_QUESTIONS.map((q) => ({
      questionId: q.id,
      answer: 1,
    }));
    const result = calculateRiskScore(answers);
    expect(result.tolerance).toBe("conservative");
    expect(result.overallScore).toBe(20); // 6/30 * 100 = 20
    expect(result.maxDrawdownTolerance).toBe(0.05);
  });

  it("returns aggressive for all-5 answers", () => {
    const answers: RiskProfileAnswer[] = RISK_PROFILE_QUESTIONS.map((q) => ({
      questionId: q.id,
      answer: 5,
    }));
    const result = calculateRiskScore(answers);
    expect(result.tolerance).toBe("aggressive");
    expect(result.overallScore).toBe(100);
    expect(result.maxDrawdownTolerance).toBe(0.40);
  });

  it("returns moderate for all-3 answers", () => {
    const answers: RiskProfileAnswer[] = RISK_PROFILE_QUESTIONS.map((q) => ({
      questionId: q.id,
      answer: 3,
    }));
    const result = calculateRiskScore(answers);
    expect(result.tolerance).toBe("moderate");
    expect(result.overallScore).toBe(60); // 18/30 * 100 = 60
    expect(result.maxDrawdownTolerance).toBe(0.20);
  });

  it("correctly identifies max drawdown from specific question", () => {
    const answers: RiskProfileAnswer[] = RISK_PROFILE_QUESTIONS.map((q) => ({
      questionId: q.id,
      answer: q.id === "max_drawdown" ? 4 : 3,
    }));
    const result = calculateRiskScore(answers);
    expect(result.maxDrawdownTolerance).toBe(0.30);
  });
});

describe("buildRiskProfile", () => {
  it("builds a complete profile from answers", () => {
    const answers: RiskProfileAnswer[] = RISK_PROFILE_QUESTIONS.map((q) => ({
      questionId: q.id,
      answer: 3,
    }));
    const profile = buildRiskProfile(answers);
    expect(profile.answers).toHaveLength(6);
    expect(profile.overallScore).toBe(60);
    expect(profile.tolerance).toBe("moderate");
    expect(profile.lastUpdated).toBeTruthy();
  });
});
