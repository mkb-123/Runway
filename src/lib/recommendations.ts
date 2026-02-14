// ============================================================
// Actionable Recommendations Engine
// ============================================================
// Analyzes the household's financial position and generates
// prioritised, specific recommendations with concrete numbers.
//
// Each analyzer is a pure function that examines one aspect of
// the financial position and returns zero or more recommendations.

import type {
  HouseholdData,
  TransactionsData,
  PersonIncome,
  Person,
  Account,
  AnnualContributions,
} from "@/types";
import { calculateIncomeTax, calculateNI } from "@/lib/tax";
import { getUnrealisedGains } from "@/lib/cgt";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";

export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationCategory =
  | "tax"
  | "pension"
  | "isa"
  | "investment"
  | "retirement"
  | "risk";

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  personId?: string;
  personName?: string;
}

// --- Internal helper ---

function getAdjustedGrossForTax(income: PersonIncome): number {
  switch (income.pensionContributionMethod) {
    case "salary_sacrifice":
    case "net_pay":
      return income.grossSalary - income.employeePensionContribution;
    case "relief_at_source":
      return income.grossSalary;
  }
}

// --- Per-person context passed to each analyzer ---

interface PersonContext {
  person: Person;
  income: PersonIncome;
  contributions: AnnualContributions;
  accounts: Account[];
  adjustedGross: number;
  allAccounts: Account[];
}

// --- Individual analyzers ---

/** 1. Salary sacrifice to avoid personal allowance taper (60% trap) */
export function analyzeSalaryTaper(ctx: PersonContext): Recommendation[] {
  const { person, income, contributions, adjustedGross } = ctx;

  if (
    adjustedGross <= UK_TAX_CONSTANTS.personalAllowanceTaperThreshold ||
    adjustedGross > UK_TAX_CONSTANTS.incomeTax.higherRateUpperLimit
  ) {
    return [];
  }

  const excessOverThreshold =
    adjustedGross - UK_TAX_CONSTANTS.personalAllowanceTaperThreshold;
  const additionalSacrifice = Math.min(
    excessOverThreshold,
    UK_TAX_CONSTANTS.pensionAnnualAllowance - contributions.pensionContribution
  );

  if (additionalSacrifice <= 0) return [];

  const currentTax = calculateIncomeTax(
    income.grossSalary,
    income.employeePensionContribution,
    income.pensionContributionMethod
  );
  const newTax = calculateIncomeTax(
    income.grossSalary,
    income.employeePensionContribution + additionalSacrifice,
    income.pensionContributionMethod
  );
  const taxSaved = currentTax.tax - newTax.tax;

  let niSaved = 0;
  if (income.pensionContributionMethod === "salary_sacrifice") {
    const currentNI = calculateNI(
      income.grossSalary,
      income.employeePensionContribution,
      income.pensionContributionMethod
    );
    const newNI = calculateNI(
      income.grossSalary,
      income.employeePensionContribution + additionalSacrifice,
      income.pensionContributionMethod
    );
    niSaved = currentNI.ni - newNI.ni;
  }

  const totalSaved = Math.round(taxSaved + niSaved);

  return [
    {
      id: `salary-sacrifice-taper-${person.id}`,
      title: `Salary sacrifice to avoid 60% trap`,
      description: `${person.name}'s adjusted income is £${Math.round(adjustedGross).toLocaleString()}, within the personal allowance taper zone (£100k-£125k). Increasing pension contributions by £${Math.round(additionalSacrifice).toLocaleString()} via salary sacrifice would bring adjusted income to £100,000 or below.`,
      impact: `Save £${totalSaved.toLocaleString()}/yr in tax${niSaved > 0 ? ` and NI` : ""}. Effective cost after relief: £${Math.round(additionalSacrifice - totalSaved).toLocaleString()}.`,
      priority: "high",
      category: "tax",
      personId: person.id,
      personName: person.name,
    },
  ];
}

/** 2. ISA allowance usage */
export function analyzeISAUsage(ctx: PersonContext): Recommendation[] {
  const { person, contributions } = ctx;
  const isaUsed = contributions.isaContribution;
  const isaRemaining = UK_TAX_CONSTANTS.isaAnnualAllowance - isaUsed;

  if (isaRemaining > 0 && isaRemaining <= UK_TAX_CONSTANTS.isaAnnualAllowance * 0.5) {
    return [
      {
        id: `isa-topup-${person.id}`,
        title: `Top up ISA before year-end`,
        description: `${person.name} has £${isaRemaining.toLocaleString()} of ISA allowance remaining for this tax year. ISA allowances cannot be carried forward — use it or lose it.`,
        impact: `Shelter £${isaRemaining.toLocaleString()} from future capital gains and income tax.`,
        priority: isaRemaining >= 10000 ? "high" : "medium",
        category: "isa",
        personId: person.id,
        personName: person.name,
      },
    ];
  }

  if (isaRemaining === UK_TAX_CONSTANTS.isaAnnualAllowance) {
    return [
      {
        id: `isa-unused-${person.id}`,
        title: `Open/fund ISA for this tax year`,
        description: `${person.name} has not used any of their £${UK_TAX_CONSTANTS.isaAnnualAllowance.toLocaleString()} ISA allowance. This is a significant missed opportunity for tax-efficient savings.`,
        impact: `Full £${UK_TAX_CONSTANTS.isaAnnualAllowance.toLocaleString()} tax-free growth potential.`,
        priority: "high",
        category: "isa",
        personId: person.id,
        personName: person.name,
      },
    ];
  }

  return [];
}

/** 3. Pension allowance headroom */
export function analyzePensionHeadroom(ctx: PersonContext): Recommendation[] {
  const { person, contributions, adjustedGross } = ctx;
  const pensionRemaining =
    UK_TAX_CONSTANTS.pensionAnnualAllowance - contributions.pensionContribution;

  if (pensionRemaining <= 20000) return [];

  return [
    {
      id: `pension-headroom-${person.id}`,
      title: `Use pension allowance headroom`,
      description: `${person.name} has £${pensionRemaining.toLocaleString()} of unused pension annual allowance. Consider increasing contributions to reduce taxable income.`,
      impact: `Tax relief of £${Math.round(pensionRemaining * (adjustedGross > UK_TAX_CONSTANTS.incomeTax.basicRateUpperLimit ? 0.4 : 0.2)).toLocaleString()} on additional contributions.`,
      priority: pensionRemaining > 40000 ? "high" : "medium",
      category: "pension",
      personId: person.id,
      personName: person.name,
    },
  ];
}

/** 4. Bed & ISA opportunity */
export function analyzeBedAndISA(
  ctx: PersonContext,
  transactions: TransactionsData
): Recommendation[] {
  const { person, accounts, contributions } = ctx;
  const isaRemaining =
    UK_TAX_CONSTANTS.isaAnnualAllowance - contributions.isaContribution;
  const giaAccounts = accounts.filter((a) => a.type === "gia");
  const giaValue = giaAccounts.reduce((sum, a) => sum + a.currentValue, 0);

  if (giaValue <= 0 || isaRemaining <= 0) return [];

  const giaTransactions = transactions.transactions.filter((tx) =>
    giaAccounts.some((a) => a.id === tx.accountId)
  );
  const unrealisedGains = getUnrealisedGains(giaAccounts, giaTransactions);
  const totalGain = unrealisedGains.reduce(
    (sum, ug) => sum + ug.unrealisedGain,
    0
  );

  if (totalGain <= 0 || totalGain > UK_TAX_CONSTANTS.cgt.annualExemptAmount) {
    return [];
  }

  return [
    {
      id: `bed-isa-free-${person.id}`,
      title: `Zero-cost Bed & ISA transfer`,
      description: `${person.name}'s GIA unrealised gains (£${Math.round(totalGain).toLocaleString()}) are within the CGT annual exempt amount. Transfer up to £${Math.min(giaValue, isaRemaining).toLocaleString()} to ISA at zero tax cost.`,
      impact: `Shelter £${Math.min(giaValue, isaRemaining).toLocaleString()} from future CGT and income tax — completely free.`,
      priority: "high",
      category: "tax",
      personId: person.id,
      personName: person.name,
    },
  ];
}

/** 5. GIA overweight warning */
export function analyzeGIAOverweight(ctx: PersonContext): Recommendation[] {
  const { person, accounts, allAccounts } = ctx;
  const giaAccounts = accounts.filter((a) => a.type === "gia");
  const giaValue = giaAccounts.reduce((sum, a) => sum + a.currentValue, 0);
  const totalNW = allAccounts.reduce((s, a) => s + a.currentValue, 0);

  if (totalNW <= 0 || giaValue / totalNW <= 0.15) return [];

  return [
    {
      id: `gia-overweight-${person.id}`,
      title: `Reduce GIA exposure`,
      description: `${person.name}'s GIA holdings represent ${((giaValue / totalNW) * 100).toFixed(1)}% of the household portfolio. GIA assets are subject to CGT on gains and income tax on dividends.`,
      impact: `Prioritise ISA and pension contributions to reduce tax drag over time.`,
      priority: "medium",
      category: "investment",
      personId: person.id,
      personName: person.name,
    },
  ];
}

/** 6. Retirement progress */
export function analyzeRetirementProgress(household: HouseholdData): Recommendation[] {
  const totalNW = household.accounts.reduce((s, a) => s + a.currentValue, 0);
  const requiredPot =
    household.retirement.withdrawalRate > 0
      ? household.retirement.targetAnnualIncome / household.retirement.withdrawalRate
      : 0;
  const progress = requiredPot > 0 ? totalNW / requiredPot : 0;

  if (progress >= 0.5) return [];

  return [
    {
      id: "retirement-behind",
      title: "Increase retirement savings rate",
      description: `You're ${(progress * 100).toFixed(0)}% of the way to your £${Math.round(requiredPot).toLocaleString()} retirement target. Consider increasing contributions to close the gap.`,
      impact: `Current shortfall: £${Math.round(requiredPot - totalNW).toLocaleString()}.`,
      priority: "high",
      category: "retirement",
    },
  ];
}

/** 7. Emergency fund check */
export function analyzeEmergencyFund(household: HouseholdData): Recommendation[] {
  const cashAccounts = household.accounts.filter((a) =>
    ["cash_savings"].includes(a.type)
  );
  const totalCash = cashAccounts.reduce((s, a) => s + a.currentValue, 0);
  const emergencyTarget =
    household.emergencyFund.monthlyEssentialExpenses *
    household.emergencyFund.targetMonths;

  if (totalCash >= emergencyTarget) return [];

  const shortfall = emergencyTarget - totalCash;
  return [
    {
      id: "emergency-fund-low",
      title: "Top up emergency fund",
      description: `Your cash savings (£${totalCash.toLocaleString()}) are below your ${household.emergencyFund.targetMonths}-month emergency fund target of £${emergencyTarget.toLocaleString()}.`,
      impact: `Shortfall of £${Math.round(shortfall).toLocaleString()}. Consider building cash reserves before investing.`,
      priority: shortfall > emergencyTarget * 0.5 ? "high" : "medium",
      category: "risk",
    },
  ];
}

/** 8. Concentration risk */
export function analyzeConcentrationRisk(household: HouseholdData): Recommendation[] {
  const allHoldings = household.accounts.flatMap((a) =>
    a.holdings.map((h) => ({ ...h, accountId: a.id, value: h.units * h.currentPrice }))
  );
  const totalHoldingsValue = allHoldings.reduce((s, h) => s + h.value, 0);

  if (totalHoldingsValue <= 0) return [];

  const byFund = new Map<string, number>();
  for (const h of allHoldings) {
    byFund.set(h.fundId, (byFund.get(h.fundId) ?? 0) + h.value);
  }

  const results: Recommendation[] = [];
  for (const [fundId, value] of byFund) {
    const pct = value / totalHoldingsValue;
    if (pct > 0.4) {
      const fund = household.funds.find((f) => f.id === fundId);
      results.push({
        id: `concentration-${fundId}`,
        title: `High concentration in ${fund?.name ?? fundId}`,
        description: `${((pct * 100).toFixed(0))}% of your invested portfolio is in a single fund. This creates significant concentration risk.`,
        impact: `Consider diversifying across additional funds or asset classes.`,
        priority: "medium",
        category: "risk",
      });
    }
  }

  return results;
}

// --- Per-person analyzers (applied for each person) ---

const perPersonAnalyzers: ((
  ctx: PersonContext,
  transactions: TransactionsData
) => Recommendation[])[] = [
  (ctx) => analyzeSalaryTaper(ctx),
  (ctx) => analyzeISAUsage(ctx),
  (ctx) => analyzePensionHeadroom(ctx),
  (ctx, tx) => analyzeBedAndISA(ctx, tx),
  (ctx) => analyzeGIAOverweight(ctx),
];

// --- Household-level analyzers ---

const householdAnalyzers: ((
  household: HouseholdData
) => Recommendation[])[] = [
  analyzeRetirementProgress,
  analyzeEmergencyFund,
  analyzeConcentrationRisk,
];

// --- Sort order ---

const priorityOrder: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// --- Public API ---

export function generateRecommendations(
  household: HouseholdData,
  transactions: TransactionsData
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const { persons, accounts, income, annualContributions } = household;

  // Per-person analysis
  for (const person of persons) {
    const personIncome = income.find((i) => i.personId === person.id);
    const personContributions = annualContributions.find(
      (c) => c.personId === person.id
    );
    const personAccounts = accounts.filter((a) => a.personId === person.id);

    if (!personIncome || !personContributions) continue;

    const ctx: PersonContext = {
      person,
      income: personIncome,
      contributions: personContributions,
      accounts: personAccounts,
      adjustedGross: getAdjustedGrossForTax(personIncome),
      allAccounts: accounts,
    };

    for (const analyze of perPersonAnalyzers) {
      recommendations.push(...analyze(ctx, transactions));
    }
  }

  // Household-level analysis
  for (const analyze of householdAnalyzers) {
    recommendations.push(...analyze(household));
  }

  recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return recommendations;
}
