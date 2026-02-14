// ============================================================
// Actionable Recommendations Engine (Enhanced)
// ============================================================
// Analyzes the household's financial position and generates
// prioritised, specific recommendations with concrete numbers,
// plain-English descriptions, and links to relevant pages.
//
// Each analyzer is a pure function that examines one aspect of
// the financial position and returns zero or more recommendations.

import type {
  HouseholdData,
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
  /** Link to the relevant page for taking action */
  actionUrl?: string;
  /** Plain-English action for non-financial users (the "Tom test") */
  plainAction?: string;
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
  const effectiveCost = Math.round(additionalSacrifice - totalSaved);

  return [
    {
      id: `salary-sacrifice-taper-${person.id}`,
      title: `Salary sacrifice to avoid 60% trap`,
      description: `${person.name}'s adjusted income is £${Math.round(adjustedGross).toLocaleString()}, within the personal allowance taper zone (£100k-£125k). Increasing pension contributions by £${Math.round(additionalSacrifice).toLocaleString()} via salary sacrifice would bring adjusted income to £100,000 or below.`,
      impact: `Save £${totalSaved.toLocaleString()}/yr in tax${niSaved > 0 ? ` and NI` : ""}. Effective cost after relief: £${effectiveCost.toLocaleString()}.`,
      priority: "high",
      category: "tax",
      personId: person.id,
      personName: person.name,
      actionUrl: "/tax-planning",
      plainAction: `Ask your employer to increase your pension salary sacrifice by £${Math.round(additionalSacrifice).toLocaleString()} per year. This saves you £${totalSaved.toLocaleString()} in tax — it only costs you £${effectiveCost.toLocaleString()} in take-home pay.`,
    },
  ];
}

/** 2. ISA allowance usage — specific to actual usage */
export function analyzeISAUsage(ctx: PersonContext): Recommendation[] {
  const { person, contributions } = ctx;
  const isaUsed = contributions.isaContribution;
  const isaAllowance = UK_TAX_CONSTANTS.isaAnnualAllowance;
  const isaRemaining = isaAllowance - isaUsed;
  const isaPercent = Math.round((isaUsed / isaAllowance) * 100);

  if (isaRemaining > 0 && isaRemaining <= isaAllowance * 0.5) {
    const monthsLeft = 12 - new Date().getMonth(); // rough estimate to April
    const monthlyNeeded = Math.round(isaRemaining / Math.max(1, monthsLeft));

    return [
      {
        id: `isa-topup-${person.id}`,
        title: `Top up ${person.name}'s ISA — £${isaRemaining.toLocaleString()} remaining`,
        description: `${person.name} has used ${isaPercent}% of their ISA allowance (£${isaUsed.toLocaleString()} of £${isaAllowance.toLocaleString()}). ${monthsLeft > 0 ? `That's roughly £${monthlyNeeded.toLocaleString()}/month to max it out before April.` : `Year-end is approaching — act soon.`}`,
        impact: `Shelter £${isaRemaining.toLocaleString()} from future capital gains and income tax. ISA allowances cannot be carried forward.`,
        priority: isaRemaining >= 10000 ? "high" : "medium",
        category: "isa",
        personId: person.id,
        personName: person.name,
        actionUrl: "/settings",
        plainAction: `Transfer £${isaRemaining.toLocaleString()} into your ISA before 5 April. You can't get this allowance back once the tax year ends.`,
      },
    ];
  }

  if (isaRemaining === isaAllowance) {
    return [
      {
        id: `isa-unused-${person.id}`,
        title: `${person.name} hasn't used any ISA allowance`,
        description: `${person.name}'s full £${isaAllowance.toLocaleString()} ISA allowance is unused this tax year. At a higher rate tax band, ISA shielding saves you tax on dividends, interest, and capital gains indefinitely.`,
        impact: `Full £${isaAllowance.toLocaleString()} of tax-free growth potential — compounding year after year.`,
        priority: "high",
        category: "isa",
        personId: person.id,
        personName: person.name,
        actionUrl: "/settings",
        plainAction: `Open or fund an ISA with up to £${isaAllowance.toLocaleString()}. Everything inside grows tax-free, forever.`,
      },
    ];
  }

  return [];
}

/** 3. Pension allowance headroom */
export function analyzePensionHeadroom(ctx: PersonContext): Recommendation[] {
  const { person, contributions, adjustedGross } = ctx;
  const pensionUsed = contributions.pensionContribution;
  const pensionAllowance = UK_TAX_CONSTANTS.pensionAnnualAllowance;
  const pensionRemaining = pensionAllowance - pensionUsed;
  const pensionPercent = Math.round((pensionUsed / pensionAllowance) * 100);

  if (pensionRemaining <= 20000) return [];

  const reliefRate = adjustedGross > UK_TAX_CONSTANTS.incomeTax.basicRateUpperLimit ? 0.4 : 0.2;
  const taxRelief = Math.round(pensionRemaining * reliefRate);

  return [
    {
      id: `pension-headroom-${person.id}`,
      title: `${person.name}: £${pensionRemaining.toLocaleString()} pension headroom unused`,
      description: `Only ${pensionPercent}% of ${person.name}'s £${pensionAllowance.toLocaleString()} pension annual allowance is used (£${pensionUsed.toLocaleString()} contributed). As a ${reliefRate === 0.4 ? "higher" : "basic"} rate taxpayer, additional contributions get ${(reliefRate * 100).toFixed(0)}% tax relief.`,
      impact: `Tax relief of £${taxRelief.toLocaleString()} on the unused £${pensionRemaining.toLocaleString()} headroom.`,
      priority: pensionRemaining > 40000 ? "high" : "medium",
      category: "pension",
      personId: person.id,
      personName: person.name,
      actionUrl: "/tax-planning",
      plainAction: `You could put up to £${pensionRemaining.toLocaleString()} more into your pension this year. The government adds back £${taxRelief.toLocaleString()} in tax relief — that's free money.`,
    },
  ];
}

/** 4. Bed & ISA opportunity */
export function analyzeBedAndISA(
  ctx: PersonContext
): Recommendation[] {
  const { person, accounts, contributions } = ctx;
  const isaRemaining =
    UK_TAX_CONSTANTS.isaAnnualAllowance - contributions.isaContribution;
  const giaAccounts = accounts.filter((a) => a.type === "gia");
  const giaValue = giaAccounts.reduce((sum, a) => sum + a.currentValue, 0);

  if (giaValue <= 0 || isaRemaining <= 0) return [];

  const unrealisedGains = getUnrealisedGains(giaAccounts);
  const totalGain = unrealisedGains.reduce(
    (sum, ug) => sum + ug.unrealisedGain,
    0
  );

  if (totalGain <= 0 || totalGain > UK_TAX_CONSTANTS.cgt.annualExemptAmount) {
    return [];
  }

  const transferAmount = Math.min(giaValue, isaRemaining);

  return [
    {
      id: `bed-isa-free-${person.id}`,
      title: `Zero-cost Bed & ISA — move £${Math.round(transferAmount).toLocaleString()} to ISA`,
      description: `${person.name}'s GIA has £${Math.round(totalGain).toLocaleString()} of unrealised gains, within the £${UK_TAX_CONSTANTS.cgt.annualExemptAmount.toLocaleString()} CGT annual exempt amount. You can sell and rebuy inside your ISA with zero tax.`,
      impact: `Shelter £${Math.round(transferAmount).toLocaleString()} from future CGT and income tax — completely free.`,
      priority: "high",
      category: "tax",
      personId: person.id,
      personName: person.name,
      actionUrl: "/tax-planning",
      plainAction: `Sell £${Math.round(transferAmount).toLocaleString()} from your general account and buy the same funds inside your ISA. No tax to pay because your gains are below the exempt amount.`,
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

  const giaPercent = ((giaValue / totalNW) * 100).toFixed(0);

  return [
    {
      id: `gia-overweight-${person.id}`,
      title: `GIA is ${giaPercent}% of portfolio — consider rebalancing`,
      description: `${person.name}'s GIA holds £${Math.round(giaValue).toLocaleString()} (${giaPercent}% of household portfolio). GIA assets face CGT on gains and income tax on dividends, unlike ISA or pension.`,
      impact: `Prioritise filling ISA (£${UK_TAX_CONSTANTS.isaAnnualAllowance.toLocaleString()}/yr) and pension (£${UK_TAX_CONSTANTS.pensionAnnualAllowance.toLocaleString()}/yr) before adding to GIA.`,
      priority: "medium",
      category: "investment",
      personId: person.id,
      personName: person.name,
      actionUrl: "/allocation",
      plainAction: `When you next invest, put the money into your ISA or pension first — they're tax-free. Only overflow into your general account.`,
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
  const progressPercent = (progress * 100).toFixed(0);

  if (progress >= 0.5) return [];

  const shortfall = Math.round(requiredPot - totalNW);
  const totalAnnualContribs = household.annualContributions.reduce(
    (s, c) => s + c.isaContribution + c.pensionContribution + c.giaContribution,
    0
  );
  const yearsAtCurrentRate = totalAnnualContribs > 0
    ? Math.ceil(shortfall / totalAnnualContribs)
    : 0;

  return [
    {
      id: "retirement-behind",
      title: `${progressPercent}% to retirement target — £${shortfall.toLocaleString()} shortfall`,
      description: `Your combined net worth is £${totalNW.toLocaleString()} against a target of £${Math.round(requiredPot).toLocaleString()} (based on £${household.retirement.targetAnnualIncome.toLocaleString()}/yr at ${(household.retirement.withdrawalRate * 100).toFixed(0)}% withdrawal rate).${yearsAtCurrentRate > 0 ? ` At your current contribution rate, that's roughly ${yearsAtCurrentRate} years of saving — before investment growth.` : ""}`,
      impact: `Current shortfall: £${shortfall.toLocaleString()}.`,
      priority: "high",
      category: "retirement",
      actionUrl: "/retirement",
      plainAction: `You need to save another £${shortfall.toLocaleString()} to hit your retirement target. Check the retirement page to see how different contribution rates change the timeline.`,
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
  const monthsCovered = household.emergencyFund.monthlyEssentialExpenses > 0
    ? (totalCash / household.emergencyFund.monthlyEssentialExpenses).toFixed(1)
    : "0";

  return [
    {
      id: "emergency-fund-low",
      title: `Emergency fund covers ${monthsCovered} months — target is ${household.emergencyFund.targetMonths}`,
      description: `Your cash savings (£${totalCash.toLocaleString()}) cover ${monthsCovered} months of essential expenses. Your target is ${household.emergencyFund.targetMonths} months (£${emergencyTarget.toLocaleString()}).`,
      impact: `Shortfall of £${Math.round(shortfall).toLocaleString()}. Build cash reserves before investing.`,
      priority: shortfall > emergencyTarget * 0.5 ? "high" : "medium",
      category: "risk",
      actionUrl: "/settings",
      plainAction: `You need £${Math.round(shortfall).toLocaleString()} more in easy-access savings to cover ${household.emergencyFund.targetMonths} months of expenses. Keep this separate from investments.`,
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
      const fundName = fund?.name ?? fundId;
      results.push({
        id: `concentration-${fundId}`,
        title: `${((pct * 100).toFixed(0))}% in ${fundName} — diversification risk`,
        description: `${((pct * 100).toFixed(0))}% of your £${Math.round(totalHoldingsValue).toLocaleString()} invested portfolio is in a single fund. Even good funds can underperform for extended periods.`,
        impact: `Consider diversifying across additional funds or asset classes.`,
        priority: "medium",
        category: "risk",
        actionUrl: "/allocation",
        plainAction: `Almost half your investments are in one fund. Consider spreading across 2-3 different funds to reduce risk.`,
      });
    }
  }

  return results;
}

/** 9. High cash balance — excess above emergency fund */
export function analyzeExcessCash(household: HouseholdData): Recommendation[] {
  const cashAccounts = household.accounts.filter((a) =>
    ["cash_savings", "premium_bonds"].includes(a.type)
  );
  const totalCash = cashAccounts.reduce((s, a) => s + a.currentValue, 0);
  const emergencyTarget =
    household.emergencyFund.monthlyEssentialExpenses *
    household.emergencyFund.targetMonths;

  const excessCash = totalCash - emergencyTarget;
  const totalNW = household.accounts.reduce((s, a) => s + a.currentValue, 0);

  // Only flag if excess is > £10k and > 15% of net worth
  if (excessCash <= 10000 || totalNW <= 0 || excessCash / totalNW <= 0.15) return [];

  const cashPercent = ((totalCash / totalNW) * 100).toFixed(0);

  return [
    {
      id: "excess-cash",
      title: `£${Math.round(excessCash).toLocaleString()} excess cash above emergency fund`,
      description: `You hold £${totalCash.toLocaleString()} in cash (${cashPercent}% of net worth), which is £${Math.round(excessCash).toLocaleString()} above your ${household.emergencyFund.targetMonths}-month emergency target. Cash typically loses value to inflation.`,
      impact: `Consider investing the excess in ISA or pension for long-term growth.`,
      priority: "medium",
      category: "investment",
      actionUrl: "/allocation",
      plainAction: `You have more cash than you need for emergencies. The extra £${Math.round(excessCash).toLocaleString()} could be working harder in an ISA or pension.`,
    },
  ];
}

/** 10. Savings rate tracker */
export function analyzeSavingsRate(household: HouseholdData): Recommendation[] {
  const totalGrossIncome = household.income.reduce((s, i) => s + i.grossSalary, 0);
  if (totalGrossIncome <= 0) return [];

  const totalAnnualContribs = household.annualContributions.reduce(
    (s, c) => s + c.isaContribution + c.pensionContribution + c.giaContribution,
    0
  );
  const savingsRate = totalAnnualContribs / totalGrossIncome;

  if (savingsRate >= 0.15) return []; // 15%+ is reasonable

  const savingsPercent = (savingsRate * 100).toFixed(1);
  const targetContrib = Math.round(totalGrossIncome * 0.15);
  const increase = Math.round(targetContrib - totalAnnualContribs);

  return [
    {
      id: "low-savings-rate",
      title: `Savings rate is ${savingsPercent}% — aim for 15%+`,
      description: `Your household saves £${totalAnnualContribs.toLocaleString()}/yr on gross income of £${totalGrossIncome.toLocaleString()}/yr (${savingsPercent}%). Financial planners typically recommend saving at least 15% of gross income for long-term wealth building.`,
      impact: `Increasing to 15% would mean saving £${targetContrib.toLocaleString()}/yr — an extra £${increase.toLocaleString()}/yr.`,
      priority: savingsRate < 0.05 ? "high" : "medium",
      category: "retirement",
      actionUrl: "/retirement",
      plainAction: `You're saving ${savingsPercent}% of your income. Try to get this to 15% by increasing ISA or pension contributions by £${Math.round(increase / 12).toLocaleString()}/month.`,
    },
  ];
}

// --- Per-person analyzers (applied for each person) ---

const perPersonAnalyzers: ((
  ctx: PersonContext
) => Recommendation[])[] = [
  (ctx) => analyzeSalaryTaper(ctx),
  (ctx) => analyzeISAUsage(ctx),
  (ctx) => analyzePensionHeadroom(ctx),
  (ctx) => analyzeBedAndISA(ctx),
  (ctx) => analyzeGIAOverweight(ctx),
];

// --- Household-level analyzers ---

const householdAnalyzers: ((
  household: HouseholdData
) => Recommendation[])[] = [
  analyzeRetirementProgress,
  analyzeEmergencyFund,
  analyzeConcentrationRisk,
  analyzeExcessCash,
  analyzeSavingsRate,
];

// --- Sort order ---

const priorityOrder: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// --- Public API ---

export function generateRecommendations(
  household: HouseholdData
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
      recommendations.push(...analyze(ctx));
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
