// ============================================================
// Financial Independence Diagnostic Engine
// ============================================================
// Scores the household across 8 dimensions to produce an
// institutional-quality FI diagnostic report. Each scorer is
// a pure function that takes HouseholdData and returns a
// DiagnosticScore. All calculations reuse existing lib functions.
//
// Dimensions:
// 1. Retirement Readiness — FIRE progress + countdown
// 2. Tax Efficiency — wrapper placement + allowance usage
// 3. Emergency Fund — months of coverage
// 4. Savings Rate — gross savings rate
// 5. IHT Exposure — liability relative to estate
// 6. Portfolio Diversification — wrapper concentration + accessibility
// 7. Cash Flow Health — committed outgoings vs income
// 8. Pension Adequacy — pension contributions vs allowance, bridge gap
// 9. Risk Alignment — portfolio composition vs risk tolerance
// 10. Insurance & Protection — life, CI, income protection coverage gaps

import type {
  HouseholdData,
  DiagnosticScore,
  DiagnosticReport,
  DiagnosticRating,
  DiagnosticDimension,
} from "@/types";
import {
  getAccountTaxWrapper,
  isAccountAccessible,
  annualiseOutgoing,
  annualiseContribution,
  getHouseholdGrossIncome,
  getPersonContributionTotals,
  getTotalPropertyEquity,
  getTotalPropertyValue,
  getTotalMortgageBalance,
} from "@/types";
import {
  calculateAdjustedRequiredPot,
  calculateRetirementCountdown,
  calculatePensionBridge,
  calculateAge,
  getMidScenarioRate,
  projectFinalValue,
} from "@/lib/projections";
import {
  calculateTotalAnnualContributions,
  calculateHouseholdStatePension,
  getTotalNetWorth,
  getInvestableNetWorth,
} from "@/lib/aggregations";
import { calculateIHT, yearsSince } from "@/lib/iht";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { formatCurrency } from "@/lib/format";

// ============================================================
// Rating helpers
// ============================================================

function scoreToRating(score: number): DiagnosticRating {
  if (score >= 75) return "green";
  if (score >= 40) return "amber";
  return "red";
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================================
// 1. Retirement Readiness
// ============================================================

export function scoreRetirementReadiness(household: HouseholdData): DiagnosticScore {
  const { retirement, persons, income, contributions, accounts } = household;
  const details: string[] = [];

  if (persons.length === 0 || income.length === 0) {
    return {
      dimension: "retirement_readiness",
      rating: "insufficient_data",
      score: 0,
      summary: "No persons or income data to assess retirement readiness.",
      details: ["Add at least one person with income to enable this diagnostic."],
      actionUrl: "/settings?tab=household",
    };
  }

  const totalNW = getInvestableNetWorth(household);
  const statePension = calculateHouseholdStatePension(persons);
  const requiredPot = calculateAdjustedRequiredPot(
    retirement.targetAnnualIncome,
    retirement.withdrawalRate,
    retirement.includeStatePension,
    statePension
  );

  const fireProgress = requiredPot > 0 ? (totalNW / requiredPot) * 100 : 0;
  details.push(`FIRE progress: ${Math.round(fireProgress)}% (${formatCurrency(totalNW)} of ${formatCurrency(requiredPot)})`);

  // Project forward to retirement using mid scenario rate
  const growthRate = getMidScenarioRate(retirement.scenarioRates);
  const totalContribs = calculateTotalAnnualContributions(contributions, income);

  // Use youngest person's retirement age for household countdown
  const youngestRetirementAge = Math.min(...persons.map((p) => p.plannedRetirementAge));
  const youngestAge = Math.min(...persons.map((p) => calculateAge(p.dateOfBirth)));
  const yearsToRetirement = Math.max(0, youngestRetirementAge - youngestAge);

  const projectedPot = projectFinalValue(totalNW, totalContribs, growthRate, yearsToRetirement);
  const projectedProgress = requiredPot > 0 ? (projectedPot / requiredPot) * 100 : 0;
  details.push(`Projected pot at retirement: ${formatCurrency(projectedPot)} (${Math.round(projectedProgress)}% of target)`);
  details.push(`Years to retirement: ${yearsToRetirement} (age ${youngestRetirementAge})`);
  details.push(`Growth assumption: ${(growthRate * 100).toFixed(1)}% p.a.`);

  // Countdown
  const countdown = calculateRetirementCountdown(totalNW, totalContribs, requiredPot, growthRate);
  if (countdown.years === 0 && countdown.months === 0 && totalNW >= requiredPot) {
    details.push("Already reached FIRE target!");
  } else {
    details.push(`Countdown: ${countdown.years}y ${countdown.months}m at current savings rate`);
  }

  // Score based on projected progress (most relevant)
  let score: number;
  let recommendation: string | undefined;

  if (projectedProgress >= 120) {
    score = 100;
  } else if (projectedProgress >= 100) {
    score = 85 + (projectedProgress - 100) * 0.75;
  } else if (projectedProgress >= 75) {
    score = 65 + (projectedProgress - 75) * 0.8;
    recommendation = `Projected shortfall of ${formatCurrency(requiredPot - projectedPot)}. Consider increasing contributions or adjusting retirement age.`;
  } else if (projectedProgress >= 50) {
    score = 40 + (projectedProgress - 50) * 1;
    recommendation = `Significant gap to target. Increasing savings by ${formatCurrency(Math.round((requiredPot - projectedPot) / Math.max(1, yearsToRetirement)))} per year would close the gap.`;
  } else {
    score = projectedProgress * 0.8;
    recommendation = "Retirement target appears challenging at current trajectory. Review target income, savings rate, and planned retirement age.";
  }

  return {
    dimension: "retirement_readiness",
    rating: scoreToRating(clampScore(score)),
    score: clampScore(score),
    summary: projectedProgress >= 100
      ? `On track for retirement. Projected pot of ${formatCurrency(projectedPot)} exceeds target.`
      : `${Math.round(projectedProgress)}% projected toward retirement target at age ${youngestRetirementAge}.`,
    details,
    actionUrl: "/retirement",
    recommendation,
  };
}

// ============================================================
// 2. Tax Efficiency
// ============================================================

export function scoreTaxEfficiency(household: HouseholdData): DiagnosticScore {
  const { persons, income, contributions, accounts } = household;
  const details: string[] = [];

  if (accounts.length === 0) {
    return {
      dimension: "tax_efficiency",
      rating: "insufficient_data",
      score: 0,
      summary: "No accounts to assess tax efficiency.",
      details: ["Add accounts to enable tax efficiency scoring."],
      actionUrl: "/settings?tab=accounts",
    };
  }

  const totalNW = accounts.reduce((s, a) => s + a.currentValue, 0);
  if (totalNW <= 0) {
    return {
      dimension: "tax_efficiency",
      rating: "insufficient_data",
      score: 0,
      summary: "No account values to assess.",
      details: [],
      actionUrl: "/settings?tab=accounts",
    };
  }

  // 1. Wrapper split — how much is in tax-sheltered accounts?
  let sheltered = 0;
  let unsheltered = 0;
  for (const acc of accounts) {
    const wrapper = getAccountTaxWrapper(acc.type);
    if (wrapper === "pension" || wrapper === "isa") {
      sheltered += acc.currentValue;
    } else {
      unsheltered += acc.currentValue;
    }
  }
  const shelteredPct = (sheltered / totalNW) * 100;
  details.push(`Tax-sheltered assets: ${Math.round(shelteredPct)}% (${formatCurrency(sheltered)} in ISA + pension)`);
  details.push(`Unsheltered assets: ${formatCurrency(unsheltered)} in GIA + cash`);

  // 2. ISA allowance usage per person
  let totalIsaUsed = 0;
  let totalIsaAllowance = 0;
  for (const person of persons) {
    const { isaContribution } = getPersonContributionTotals(contributions, person.id);
    totalIsaUsed += isaContribution;
    totalIsaAllowance += UK_TAX_CONSTANTS.isaAnnualAllowance;
    const pctUsed = Math.round((isaContribution / UK_TAX_CONSTANTS.isaAnnualAllowance) * 100);
    details.push(`${person.name} ISA usage: ${pctUsed}% (${formatCurrency(isaContribution)} of ${formatCurrency(UK_TAX_CONSTANTS.isaAnnualAllowance)})`);
  }

  // 3. Pension contribution vs allowance per person
  let totalPensionUsed = 0;
  for (const person of persons) {
    const personIncome = income.find((i) => i.personId === person.id);
    if (!personIncome) continue;
    const { pensionContribution } = getPersonContributionTotals(contributions, person.id);
    const totalPension = personIncome.employeePensionContribution + personIncome.employerPensionContribution + pensionContribution;
    totalPensionUsed += totalPension;
    const pctUsed = Math.round((totalPension / UK_TAX_CONSTANTS.pensionAnnualAllowance) * 100);
    details.push(`${person.name} pension usage: ${pctUsed}% (${formatCurrency(totalPension)} of ${formatCurrency(UK_TAX_CONSTANTS.pensionAnnualAllowance)})`);
  }

  // Composite score:
  // 40% wrapper efficiency (higher sheltered = better)
  // 30% ISA allowance usage
  // 30% pension allowance usage
  const wrapperScore = Math.min(100, shelteredPct * 1.2); // 83%+ sheltered = 100
  const isaScore = totalIsaAllowance > 0 ? (totalIsaUsed / totalIsaAllowance) * 100 : 50;
  const pensionScore = persons.length > 0
    ? (totalPensionUsed / (persons.length * UK_TAX_CONSTANTS.pensionAnnualAllowance)) * 100
    : 50;

  const score = wrapperScore * 0.4 + isaScore * 0.3 + pensionScore * 0.3;

  let recommendation: string | undefined;
  if (shelteredPct < 60) {
    recommendation = `Only ${Math.round(shelteredPct)}% of assets are tax-sheltered. Prioritise ISA and pension contributions to reduce tax drag.`;
  } else if (totalIsaUsed < totalIsaAllowance * 0.5) {
    recommendation = "ISA allowances are significantly underused. Max out ISAs before contributing to GIA.";
  }

  return {
    dimension: "tax_efficiency",
    rating: scoreToRating(clampScore(score)),
    score: clampScore(score),
    summary: `${Math.round(shelteredPct)}% of investable assets are tax-sheltered.`,
    details,
    actionUrl: "/tax-planning",
    recommendation,
  };
}

// ============================================================
// 3. Emergency Fund
// ============================================================

export function scoreEmergencyFund(household: HouseholdData): DiagnosticScore {
  const { emergencyFund, accounts } = household;
  const details: string[] = [];

  if (emergencyFund.monthlyEssentialExpenses <= 0) {
    return {
      dimension: "emergency_fund",
      rating: "insufficient_data",
      score: 0,
      summary: "Monthly essential expenses not set — cannot assess emergency fund.",
      details: ["Set monthly essential expenses in Settings > Planning."],
      actionUrl: "/settings?tab=planning",
    };
  }

  // Cash-like accounts available for emergencies
  const cashAccounts = accounts.filter((a) =>
    ["cash_savings", "cash_isa", "premium_bonds"].includes(a.type)
  );
  const totalCash = cashAccounts.reduce((s, a) => s + a.currentValue, 0);
  const targetAmount = emergencyFund.monthlyEssentialExpenses * emergencyFund.targetMonths;
  const monthsCovered = totalCash / emergencyFund.monthlyEssentialExpenses;

  details.push(`Cash reserves: ${formatCurrency(totalCash)}`);
  details.push(`Monthly essential expenses: ${formatCurrency(emergencyFund.monthlyEssentialExpenses)}`);
  details.push(`Months covered: ${monthsCovered.toFixed(1)} of ${emergencyFund.targetMonths} target`);
  details.push(`Target amount: ${formatCurrency(targetAmount)}`);

  // Score: 100 at target, scales linearly, bonus for exceeding
  let score: number;
  if (monthsCovered >= emergencyFund.targetMonths) {
    // At or above target — cap at 100
    score = 100;
  } else if (monthsCovered >= 3) {
    // 3+ months but below target — amber territory
    score = 40 + (monthsCovered / emergencyFund.targetMonths) * 60;
  } else {
    // Below 3 months — critical
    score = (monthsCovered / 3) * 40;
  }

  let recommendation: string | undefined;
  if (monthsCovered < emergencyFund.targetMonths) {
    const shortfall = targetAmount - totalCash;
    recommendation = `Emergency fund is ${formatCurrency(shortfall)} short of the ${emergencyFund.targetMonths}-month target. Build cash reserves before investing.`;
  }

  return {
    dimension: "emergency_fund",
    rating: scoreToRating(clampScore(score)),
    score: clampScore(score),
    summary: `${monthsCovered.toFixed(1)} months of essential expenses covered (target: ${emergencyFund.targetMonths}).`,
    details,
    actionUrl: "/settings?tab=planning",
    recommendation,
  };
}

// ============================================================
// 4. Savings Rate
// ============================================================

export function scoreSavingsRate(household: HouseholdData): DiagnosticScore {
  const { income, contributions, bonusStructures } = household;
  const details: string[] = [];

  const grossIncome = getHouseholdGrossIncome(income, bonusStructures);
  if (grossIncome <= 0) {
    return {
      dimension: "savings_rate",
      rating: "insufficient_data",
      score: 0,
      summary: "No income data to assess savings rate.",
      details: ["Add income data in Settings > Household."],
      actionUrl: "/settings?tab=household",
    };
  }

  const totalContribs = calculateTotalAnnualContributions(contributions, income);
  const savingsRate = (totalContribs / grossIncome) * 100;

  details.push(`Gross household income: ${formatCurrency(grossIncome)}`);
  details.push(`Total annual savings: ${formatCurrency(totalContribs)}`);
  details.push(`Savings rate: ${savingsRate.toFixed(1)}%`);

  // Break down by type
  const discretionary = contributions.reduce((s, c) => s + annualiseContribution(c.amount, c.frequency), 0);
  const employeePension = income.reduce((s, i) => s + i.employeePensionContribution, 0);
  const employerPension = income.reduce((s, i) => s + i.employerPensionContribution, 0);
  details.push(`Employee pension: ${formatCurrency(employeePension)}`);
  details.push(`Employer pension: ${formatCurrency(employerPension)}`);
  details.push(`Discretionary savings: ${formatCurrency(discretionary)}`);

  // Scoring: 20%+ = green, 15%+ = high amber, 10%+ = amber, below = red
  // Evidence-based benchmark: 15% minimum recommended, 25%+ for early retirement
  let score: number;
  if (savingsRate >= 30) score = 100;
  else if (savingsRate >= 20) score = 75 + (savingsRate - 20) * 2.5;
  else if (savingsRate >= 15) score = 55 + (savingsRate - 15) * 4;
  else if (savingsRate >= 10) score = 35 + (savingsRate - 10) * 4;
  else score = savingsRate * 3.5;

  let recommendation: string | undefined;
  if (savingsRate < 15) {
    const target15 = Math.round(grossIncome * 0.15);
    const increase = target15 - totalContribs;
    recommendation = `Savings rate of ${savingsRate.toFixed(1)}% is below the 15% minimum recommended for long-term wealth building. Increasing by ${formatCurrency(increase)}/yr would reach the 15% benchmark.`;
  } else if (savingsRate < 20) {
    recommendation = `Good savings rate at ${savingsRate.toFixed(1)}%. For early retirement, aim for 25%+ — consider increasing pension salary sacrifice.`;
  }

  return {
    dimension: "savings_rate",
    rating: scoreToRating(clampScore(score)),
    score: clampScore(score),
    summary: `Household savings rate: ${savingsRate.toFixed(1)}% of gross income.`,
    details,
    actionUrl: "/settings?tab=household",
    recommendation,
  };
}

// ============================================================
// 5. IHT Exposure
// ============================================================

export function scoreIHTExposure(household: HouseholdData): DiagnosticScore {
  const { persons, accounts, iht, properties } = household;
  const details: string[] = [];

  // Estate = all non-pension accounts + property equity
  // Pensions generally fall outside the estate (but may change with upcoming legislation)
  const nonPensionAccounts = accounts.filter((a) => {
    const wrapper = getAccountTaxWrapper(a.type);
    return wrapper !== "pension";
  });
  const financialEstate = nonPensionAccounts.reduce((s, a) => s + a.currentValue, 0);
  const propertyValue = getTotalPropertyValue(properties);
  const propertyEquity = getTotalPropertyEquity(properties);
  const estateValue = financialEstate + propertyEquity;

  if (estateValue <= 0) {
    return {
      dimension: "iht_exposure",
      rating: "insufficient_data",
      score: 0,
      summary: "No estate value to assess IHT exposure.",
      details: ["Add accounts or property to enable IHT assessment."],
      actionUrl: "/iht",
    };
  }

  const numberOfPersons = persons.length >= 2 ? 2 : 1;

  // Calculate gifts within 7 years
  const now = new Date();
  const giftsWithin7Years = iht.gifts
    .filter((g) => yearsSince(g.date, now) < 7)
    .reduce((s, g) => s + g.amount, 0);

  const ihtResult = calculateIHT(
    estateValue,
    numberOfPersons,
    giftsWithin7Years,
    iht.passingToDirectDescendants
  );

  details.push(`Estate value: ${formatCurrency(estateValue)}`);
  details.push(`Property equity: ${formatCurrency(propertyEquity)}`);
  details.push(`Financial assets (non-pension): ${formatCurrency(financialEstate)}`);
  details.push(`Persons: ${numberOfPersons} (${numberOfPersons === 2 ? "couple — transferable NRB" : "single — one NRB only"})`);
  details.push(`RNRB: ${iht.passingToDirectDescendants ? "Applies (direct descendants)" : "Does NOT apply"}`);
  details.push(`Combined threshold: ${formatCurrency(ihtResult.combinedThreshold)}`);
  details.push(`IHT liability: ${formatCurrency(ihtResult.ihtLiability)}`);
  if (giftsWithin7Years > 0) {
    details.push(`Gifts within 7 years: ${formatCurrency(giftsWithin7Years)} (reduces NRB)`);
  }

  // Score: inverted — lower liability = higher score
  // No liability = 100, liability > 40% of estate = 0
  const liabilityPct = estateValue > 0 ? (ihtResult.ihtLiability / estateValue) * 100 : 0;
  let score: number;
  if (ihtResult.ihtLiability <= 0) {
    score = 100;
  } else if (liabilityPct <= 5) {
    score = 85;
  } else if (liabilityPct <= 10) {
    score = 70;
  } else if (liabilityPct <= 20) {
    score = 50;
  } else if (liabilityPct <= 30) {
    score = 30;
  } else {
    score = Math.max(0, 20 - (liabilityPct - 30));
  }

  let recommendation: string | undefined;
  if (ihtResult.ihtLiability > 0) {
    recommendation = `Estimated IHT liability of ${formatCurrency(ihtResult.ihtLiability)} (${liabilityPct.toFixed(1)}% of estate). Consider: gifting (PETs with 7-year rule), pension contributions (outside estate), or charitable bequests.`;
  }

  return {
    dimension: "iht_exposure",
    rating: scoreToRating(clampScore(score)),
    score: clampScore(score),
    summary: ihtResult.ihtLiability > 0
      ? `Estimated IHT liability: ${formatCurrency(ihtResult.ihtLiability)} on a ${formatCurrency(estateValue)} estate.`
      : `Estate of ${formatCurrency(estateValue)} is within the ${formatCurrency(ihtResult.combinedThreshold)} combined threshold — no IHT.`,
    details,
    actionUrl: "/iht",
    recommendation,
  };
}

// ============================================================
// 6. Portfolio Diversification
// ============================================================

export function scorePortfolioDiversification(household: HouseholdData): DiagnosticScore {
  const { accounts } = household;
  const details: string[] = [];

  if (accounts.length === 0) {
    return {
      dimension: "portfolio_diversification",
      rating: "insufficient_data",
      score: 0,
      summary: "No accounts to assess diversification.",
      details: ["Add accounts to enable diversification scoring."],
      actionUrl: "/accounts",
    };
  }

  const totalNW = accounts.reduce((s, a) => s + a.currentValue, 0);
  if (totalNW <= 0) {
    return {
      dimension: "portfolio_diversification",
      rating: "insufficient_data",
      score: 0,
      summary: "No account values to assess.",
      details: [],
      actionUrl: "/accounts",
    };
  }

  // 1. Wrapper diversification — count distinct wrappers
  const wrapperTotals = new Map<string, number>();
  for (const acc of accounts) {
    const wrapper = getAccountTaxWrapper(acc.type);
    wrapperTotals.set(wrapper, (wrapperTotals.get(wrapper) ?? 0) + acc.currentValue);
  }

  const wrapperCount = wrapperTotals.size;
  details.push(`Distinct tax wrappers: ${wrapperCount}`);
  for (const [wrapper, value] of wrapperTotals) {
    const pct = ((value / totalNW) * 100).toFixed(1);
    details.push(`  ${wrapper}: ${formatCurrency(value)} (${pct}%)`);
  }

  // 2. Concentration risk — largest single account as % of total
  const largestAccount = accounts.reduce((max, a) => (a.currentValue > max.currentValue ? a : max), accounts[0]);
  const largestPct = (largestAccount.currentValue / totalNW) * 100;
  details.push(`Largest single account: ${largestAccount.name} (${largestPct.toFixed(1)}% of portfolio)`);

  // 3. Accessible vs locked split
  const accessible = accounts
    .filter((a) => isAccountAccessible(a.type))
    .reduce((s, a) => s + a.currentValue, 0);
  const locked = totalNW - accessible;
  const accessiblePct = (accessible / totalNW) * 100;
  details.push(`Accessible assets: ${formatCurrency(accessible)} (${accessiblePct.toFixed(1)}%)`);
  details.push(`Locked (pension): ${formatCurrency(locked)} (${(100 - accessiblePct).toFixed(1)}%)`);

  // 4. Provider diversification
  const providers = new Set(accounts.map((a) => a.provider).filter(Boolean));
  details.push(`Distinct providers: ${providers.size}`);

  // Composite score:
  // 30% wrapper diversification (3+ wrappers = 100, 1 = 33)
  // 30% concentration risk (no single account > 50% = 100)
  // 20% accessible/locked balance (30-70% accessible = ideal)
  // 20% provider count (2+ providers = 100)
  const wrapperDivScore = Math.min(100, (wrapperCount / 3) * 100);
  const concentrationScore = largestPct <= 30 ? 100 : largestPct <= 50 ? 70 : largestPct <= 70 ? 40 : 20;
  const accessScore = (accessiblePct >= 20 && accessiblePct <= 80) ? 100
    : accessiblePct < 20 ? accessiblePct * 5
    : (100 - accessiblePct) * 5;
  const providerScore = providers.size >= 3 ? 100 : providers.size === 2 ? 80 : 50;

  const score = wrapperDivScore * 0.3 + concentrationScore * 0.3 + accessScore * 0.2 + providerScore * 0.2;

  let recommendation: string | undefined;
  if (wrapperCount === 1) {
    recommendation = "All assets in one wrapper type. Consider diversifying across ISA, pension, and GIA for tax flexibility.";
  } else if (largestPct > 50) {
    recommendation = `${largestAccount.name} represents ${largestPct.toFixed(0)}% of the portfolio — significant concentration risk.`;
  } else if (accessiblePct < 20) {
    recommendation = `Only ${accessiblePct.toFixed(0)}% of assets are accessible before pension age. Consider building ISA or GIA holdings for flexibility.`;
  }

  return {
    dimension: "portfolio_diversification",
    rating: scoreToRating(clampScore(score)),
    score: clampScore(score),
    summary: `${wrapperCount} tax wrapper types, ${accounts.length} accounts across ${providers.size} providers.`,
    details,
    actionUrl: "/accounts",
    recommendation,
  };
}

// ============================================================
// 7. Cash Flow Health
// ============================================================

export function scoreCashFlowHealth(household: HouseholdData): DiagnosticScore {
  const { income, bonusStructures, committedOutgoings, emergencyFund } = household;
  const details: string[] = [];

  const grossIncome = getHouseholdGrossIncome(income, bonusStructures);
  if (grossIncome <= 0) {
    return {
      dimension: "cash_flow_health",
      rating: "insufficient_data",
      score: 0,
      summary: "No income data to assess cash flow.",
      details: ["Add income data to enable cash flow scoring."],
      actionUrl: "/settings?tab=household",
    };
  }

  // Annual committed outgoings (active ones only)
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);
  const activeOutgoings = committedOutgoings.filter((o) => {
    if (o.endDate && o.endDate < nowStr) return false;
    if (o.startDate && o.startDate > nowStr) return false;
    return true;
  });

  const annualCommitted = activeOutgoings.reduce(
    (s, o) => s + annualiseOutgoing(o.amount, o.frequency),
    0
  );

  // Lifestyle spending (monthly * 12)
  const annualLifestyle = emergencyFund.monthlyLifestyleSpending * 12;

  const totalAnnualSpend = annualCommitted + annualLifestyle;
  const committedRatio = (totalAnnualSpend / grossIncome) * 100;
  const surplus = grossIncome - totalAnnualSpend;

  details.push(`Gross household income: ${formatCurrency(grossIncome)}`);
  details.push(`Annual committed outgoings: ${formatCurrency(annualCommitted)}`);
  details.push(`Annual lifestyle spending: ${formatCurrency(annualLifestyle)}`);
  details.push(`Total annual spend: ${formatCurrency(totalAnnualSpend)} (${committedRatio.toFixed(1)}% of gross)`);
  details.push(`Annual surplus: ${formatCurrency(surplus)}`);

  // Break down committed outgoings by category
  const byCat = new Map<string, number>();
  for (const o of activeOutgoings) {
    const ann = annualiseOutgoing(o.amount, o.frequency);
    byCat.set(o.category, (byCat.get(o.category) ?? 0) + ann);
  }
  for (const [cat, val] of Array.from(byCat.entries()).sort((a, b) => b[1] - a[1])) {
    details.push(`  ${cat}: ${formatCurrency(val)}`);
  }

  // Score: lower committed ratio = better
  // <40% committed = green, 40-60% = amber, >60% = red
  let score: number;
  if (committedRatio <= 30) score = 100;
  else if (committedRatio <= 40) score = 80 + (40 - committedRatio) * 2;
  else if (committedRatio <= 50) score = 60 + (50 - committedRatio) * 2;
  else if (committedRatio <= 60) score = 40 + (60 - committedRatio) * 2;
  else if (committedRatio <= 80) score = 10 + (80 - committedRatio) * 1.5;
  else score = Math.max(0, 10 - (committedRatio - 80));

  let recommendation: string | undefined;
  if (surplus < 0) {
    recommendation = `Cash flow deficit of ${formatCurrency(Math.abs(surplus))} per year. Spending exceeds income — review committed outgoings urgently.`;
  } else if (committedRatio > 60) {
    recommendation = `${committedRatio.toFixed(0)}% of gross income committed to outgoings. Limited flexibility for savings or shocks. Review largest commitments.`;
  }

  return {
    dimension: "cash_flow_health",
    rating: scoreToRating(clampScore(score)),
    score: clampScore(score),
    summary: surplus >= 0
      ? `Annual surplus of ${formatCurrency(surplus)} after ${formatCurrency(totalAnnualSpend)} in outgoings.`
      : `Cash flow deficit: spending exceeds income by ${formatCurrency(Math.abs(surplus))}/yr.`,
    details,
    actionUrl: "/cashflow",
    recommendation,
  };
}

// ============================================================
// 8. Pension Adequacy
// ============================================================

export function scorePensionAdequacy(household: HouseholdData): DiagnosticScore {
  const { persons, income, contributions, accounts, retirement } = household;
  const details: string[] = [];

  if (persons.length === 0 || income.length === 0) {
    return {
      dimension: "pension_adequacy",
      rating: "insufficient_data",
      score: 0,
      summary: "No persons or income data to assess pension adequacy.",
      details: ["Add persons and income to enable pension assessment."],
      actionUrl: "/settings?tab=household",
    };
  }

  // Total pension pot
  const pensionAccounts = accounts.filter((a) => {
    const wrapper = getAccountTaxWrapper(a.type);
    return wrapper === "pension";
  });
  const totalPensionPot = pensionAccounts.reduce((s, a) => s + a.currentValue, 0);
  details.push(`Current pension pot: ${formatCurrency(totalPensionPot)}`);

  // Total pension contributions (employee + employer + discretionary)
  let totalPensionContribs = 0;
  for (const person of persons) {
    const personIncome = income.find((i) => i.personId === person.id);
    if (!personIncome) continue;
    const { pensionContribution } = getPersonContributionTotals(contributions, person.id);
    const total = personIncome.employeePensionContribution + personIncome.employerPensionContribution + pensionContribution;
    totalPensionContribs += total;
    details.push(`${person.name}: ${formatCurrency(total)}/yr pension contributions`);
  }

  // Project pension to retirement
  const growthRate = getMidScenarioRate(retirement.scenarioRates);
  const youngestRetirementAge = Math.min(...persons.map((p) => p.plannedRetirementAge));
  const youngestAge = Math.min(...persons.map((p) => calculateAge(p.dateOfBirth)));
  const yearsToRetirement = Math.max(0, youngestRetirementAge - youngestAge);
  const projectedPension = projectFinalValue(totalPensionPot, totalPensionContribs, growthRate, yearsToRetirement);
  details.push(`Projected pension at retirement: ${formatCurrency(projectedPension)} (at ${(growthRate * 100).toFixed(1)}% growth)`);

  // Pension bridge analysis
  const accessibleWealth = accounts
    .filter((a) => isAccountAccessible(a.type))
    .reduce((s, a) => s + a.currentValue, 0);

  // Use earliest person's retirement + pension access for bridge calc
  const earliestRetiree = persons.reduce((min, p) =>
    p.plannedRetirementAge < min.plannedRetirementAge ? p : min, persons[0]);
  const bridge = calculatePensionBridge(
    earliestRetiree.plannedRetirementAge,
    earliestRetiree.pensionAccessAge,
    retirement.targetAnnualIncome,
    accessibleWealth
  );
  if (bridge.bridgePotRequired > 0) {
    details.push(`Pension bridge gap (${earliestRetiree.plannedRetirementAge}-${earliestRetiree.pensionAccessAge}): ${bridge.sufficient ? "Covered" : `Shortfall of ${formatCurrency(bridge.shortfall)}`}`);
  }

  // Gross income for contribution benchmarking
  const grossIncome = getHouseholdGrossIncome(income, household.bonusStructures);
  const pensionContribRate = grossIncome > 0 ? (totalPensionContribs / grossIncome) * 100 : 0;
  details.push(`Pension contribution rate: ${pensionContribRate.toFixed(1)}% of gross income`);

  // Score: composite of projection vs target + contribution rate + bridge
  const statePension = calculateHouseholdStatePension(persons);
  const requiredPot = calculateAdjustedRequiredPot(
    retirement.targetAnnualIncome,
    retirement.withdrawalRate,
    retirement.includeStatePension,
    statePension
  );
  const projectedPct = requiredPot > 0 ? (projectedPension / requiredPot) * 100 : 0;

  // 50% projected pension vs required pot
  // 30% contribution rate (12%+ = 100)
  // 20% bridge (sufficient = 100, shortfall scales down)
  const projScore = Math.min(100, projectedPct);
  const contribScore = Math.min(100, (pensionContribRate / 12) * 100);
  const bridgeScore = bridge.bridgePotRequired <= 0 ? 100
    : bridge.sufficient ? 100
    : Math.max(0, 100 - (bridge.shortfall / Math.max(1, bridge.bridgePotRequired)) * 100);

  const score = projScore * 0.5 + contribScore * 0.3 + bridgeScore * 0.2;

  let recommendation: string | undefined;
  if (projectedPct < 80) {
    recommendation = `Pension projected to cover only ${Math.round(projectedPct)}% of target retirement income. Consider increasing pension contributions — tax relief makes pension saving highly efficient.`;
  } else if (!bridge.sufficient) {
    recommendation = `Pension bridge gap of ${formatCurrency(bridge.shortfall)}. Build accessible wealth (ISA/GIA) to fund the gap between early retirement and pension access.`;
  }

  return {
    dimension: "pension_adequacy",
    rating: scoreToRating(clampScore(score)),
    score: clampScore(score),
    summary: `Pension projected at ${formatCurrency(projectedPension)} by retirement — ${Math.round(projectedPct)}% of target.`,
    details,
    actionUrl: "/retirement",
    recommendation,
  };
}

// ============================================================
// 9. Risk Alignment
// ============================================================

export function scoreRiskAlignment(household: HouseholdData): DiagnosticScore {
  const { riskProfile, accounts } = household;
  const details: string[] = [];

  if (!riskProfile || riskProfile.answers.length === 0) {
    return {
      dimension: "risk_alignment",
      rating: "insufficient_data",
      score: 0,
      summary: "Complete the risk profile questionnaire to assess portfolio alignment.",
      details: ["Go to Settings > Protection to complete the risk questionnaire."],
      actionUrl: "/settings?tab=protection",
    };
  }

  if (accounts.length === 0) {
    return {
      dimension: "risk_alignment",
      rating: "insufficient_data",
      score: 0,
      summary: "No accounts to assess against risk profile.",
      details: ["Add accounts to enable risk alignment scoring."],
      actionUrl: "/settings?tab=accounts",
    };
  }

  const totalNW = accounts.reduce((s, a) => s + a.currentValue, 0);
  if (totalNW <= 0) {
    return {
      dimension: "risk_alignment",
      rating: "insufficient_data",
      score: 0,
      summary: "No account values to assess.",
      details: [],
      actionUrl: "/settings?tab=accounts",
    };
  }

  details.push(`Risk tolerance: ${riskProfile.tolerance} (score: ${riskProfile.overallScore}/100)`);
  details.push(`Max drawdown tolerance: ${(riskProfile.maxDrawdownTolerance * 100).toFixed(0)}%`);

  // Classify accounts into growth (equity-like) vs defensive (cash-like)
  // Pensions excluded from alignment check as they are long-term by nature
  let growthAssets = 0;
  let defensiveAssets = 0;
  let pensionAssets = 0;
  for (const acc of accounts) {
    const wrapper = getAccountTaxWrapper(acc.type);
    if (wrapper === "pension") {
      pensionAssets += acc.currentValue;
    } else if (acc.type === "cash_savings" || acc.type === "cash_isa" || acc.type === "premium_bonds") {
      defensiveAssets += acc.currentValue;
    } else {
      // stocks_and_shares_isa, gia, lifetime_isa → assumed equity/growth
      growthAssets += acc.currentValue;
    }
  }

  const nonPensionTotal = growthAssets + defensiveAssets;
  const growthPct = nonPensionTotal > 0 ? (growthAssets / nonPensionTotal) * 100 : 0;
  const defensivePct = nonPensionTotal > 0 ? (defensiveAssets / nonPensionTotal) * 100 : 0;

  details.push(`Growth assets (non-pension): ${formatCurrency(growthAssets)} (${growthPct.toFixed(0)}%)`);
  details.push(`Defensive assets: ${formatCurrency(defensiveAssets)} (${defensivePct.toFixed(0)}%)`);
  details.push(`Pension (excluded): ${formatCurrency(pensionAssets)}`);

  // Define ideal growth allocation ranges by tolerance
  const idealRanges: Record<string, { min: number; max: number }> = {
    conservative: { min: 20, max: 50 },
    moderate: { min: 40, max: 75 },
    aggressive: { min: 60, max: 95 },
  };

  const range = idealRanges[riskProfile.tolerance];
  const midpoint = (range.min + range.max) / 2;

  let score: number;
  let recommendation: string | undefined;

  if (nonPensionTotal <= 0) {
    // All assets in pension — can't assess alignment meaningfully
    score = 70;
    details.push("All non-pension assets are £0 — alignment check limited to pension.");
  } else if (growthPct >= range.min && growthPct <= range.max) {
    // Within ideal range
    const distanceFromMid = Math.abs(growthPct - midpoint);
    const rangeHalf = (range.max - range.min) / 2;
    score = 100 - (distanceFromMid / rangeHalf) * 15; // 85-100 within range
    details.push(`Growth allocation within ideal range for ${riskProfile.tolerance} profile (${range.min}–${range.max}%).`);
  } else {
    // Outside ideal range — calculate how far
    const overshoot = growthPct > range.max
      ? growthPct - range.max
      : range.min - growthPct;

    score = Math.max(0, 75 - overshoot * 2);

    if (growthPct > range.max) {
      recommendation = `Portfolio is ${(growthPct - range.max).toFixed(0)}% more growth-oriented than your ${riskProfile.tolerance} risk profile suggests. Consider moving ${formatCurrency(Math.round((growthPct - midpoint) / 100 * nonPensionTotal))} to defensive assets.`;
    } else {
      recommendation = `Portfolio is ${(range.min - growthPct).toFixed(0)}% more defensive than your ${riskProfile.tolerance} risk profile suggests. You may be leaving returns on the table — consider increasing equity exposure.`;
    }
  }

  return {
    dimension: "risk_alignment",
    rating: scoreToRating(clampScore(score)),
    score: clampScore(score),
    summary: `${riskProfile.tolerance.charAt(0).toUpperCase() + riskProfile.tolerance.slice(1)} risk profile with ${growthPct.toFixed(0)}% growth allocation.`,
    details,
    actionUrl: "/settings?tab=protection",
    recommendation,
  };
}

// ============================================================
// 10. Insurance & Protection
// ============================================================

export function scoreInsuranceProtection(household: HouseholdData): DiagnosticScore {
  const { persons, income, bonusStructures, insurancePolicies, properties, children } = household;
  const details: string[] = [];

  if (persons.length === 0 || income.length === 0) {
    return {
      dimension: "insurance_protection",
      rating: "insufficient_data",
      score: 0,
      summary: "No persons or income data to assess insurance needs.",
      details: ["Add persons and income to enable insurance assessment."],
      actionUrl: "/settings?tab=household",
    };
  }

  const grossIncome = getHouseholdGrossIncome(income, bonusStructures);
  const totalMortgage = getTotalMortgageBalance(properties);
  const hasDependents = children.length > 0 || persons.length >= 2;

  details.push(`Household gross income: ${formatCurrency(grossIncome)}`);
  details.push(`Outstanding mortgage: ${formatCurrency(totalMortgage)}`);
  details.push(`Dependents: ${hasDependents ? "Yes" : "No"} (${children.length} children, ${persons.length} persons)`);

  // Aggregate insurance coverage by type
  const lifeCover = insurancePolicies
    .filter((p) => p.type === "life")
    .reduce((s, p) => s + p.coverageAmount, 0);
  const ciCover = insurancePolicies
    .filter((p) => p.type === "critical_illness")
    .reduce((s, p) => s + p.coverageAmount, 0);
  const ipCover = insurancePolicies
    .filter((p) => p.type === "income_protection")
    .reduce((s, p) => s + p.coverageAmount, 0);

  details.push(`Life insurance cover: ${formatCurrency(lifeCover)}`);
  details.push(`Critical illness cover: ${formatCurrency(ciCover)}`);
  details.push(`Income protection cover: ${formatCurrency(ipCover)}/yr`);

  // Determine need level based on dependents and mortgage
  const needsLifeInsurance = hasDependents || totalMortgage > 0;
  const needsIncomeProtection = grossIncome > 0;

  // Life insurance benchmark: mortgage + 10x salary for dependents, mortgage only if no dependents
  const lifeTarget = needsLifeInsurance
    ? totalMortgage + (hasDependents ? grossIncome * 10 : 0)
    : 0;

  // Income protection benchmark: 60% of gross salary
  const ipTarget = grossIncome * 0.6;

  if (lifeTarget > 0) {
    const lifePct = (lifeCover / lifeTarget) * 100;
    details.push(`Life cover target: ${formatCurrency(lifeTarget)} (mortgage + ${hasDependents ? "10x" : "0x"} salary)`);
    details.push(`Life cover ratio: ${lifePct.toFixed(0)}% of target`);
  }

  if (ipTarget > 0) {
    const ipPct = (ipCover / ipTarget) * 100;
    details.push(`Income protection target: ${formatCurrency(ipTarget)}/yr (60% of gross)`);
    details.push(`Income protection ratio: ${ipPct.toFixed(0)}% of target`);
  }

  // Scoring:
  // If no insurance needed (single, no dependents, no mortgage) → baseline 80
  // Life insurance: 40% weight
  // Income protection: 35% weight
  // Critical illness: 25% weight (bonus — not essential)

  let score: number;
  let recommendation: string | undefined;

  if (!needsLifeInsurance && !needsIncomeProtection) {
    score = 80;
    details.push("Low insurance needs — no dependents, no mortgage.");
  } else {
    // Life cover score
    let lifeScore: number;
    if (!needsLifeInsurance) {
      lifeScore = 80;
    } else if (lifeTarget <= 0) {
      lifeScore = 80;
    } else {
      const lifePct = (lifeCover / lifeTarget) * 100;
      lifeScore = lifePct >= 100 ? 100
        : lifePct >= 75 ? 75 + (lifePct - 75)
          : lifePct >= 50 ? 50 + (lifePct - 50)
            : lifePct * 1;
    }

    // Income protection score
    let ipScore: number;
    if (ipTarget <= 0) {
      ipScore = 80;
    } else {
      const ipPct = (ipCover / ipTarget) * 100;
      ipScore = ipPct >= 100 ? 100
        : ipPct >= 60 ? 60 + (ipPct - 60) * 1
          : ipPct * 1;
    }

    // Critical illness score (bonus — having any is good)
    const ciScore = ciCover > 0 ? Math.min(100, 60 + (ciCover / grossIncome) * 40) : 30;

    score = lifeScore * 0.4 + ipScore * 0.35 + ciScore * 0.25;

    // Generate recommendation
    if (needsLifeInsurance && lifeCover < lifeTarget * 0.5) {
      recommendation = `Life insurance cover of ${formatCurrency(lifeCover)} is significantly below the ${formatCurrency(lifeTarget)} target. ${hasDependents ? "With dependents, adequate life cover is essential." : "Consider covering your outstanding mortgage at minimum."}`;
    } else if (ipCover < ipTarget * 0.3) {
      recommendation = `No or minimal income protection. If unable to work, ${formatCurrency(ipTarget)}/yr would maintain 60% of income. This is often the most overlooked protection.`;
    } else if (ciCover <= 0) {
      recommendation = "No critical illness cover. A lump sum payout on diagnosis can cover costs during recovery and reduce financial stress.";
    }
  }

  return {
    dimension: "insurance_protection",
    rating: scoreToRating(clampScore(score)),
    score: clampScore(score),
    summary: insurancePolicies.length > 0
      ? `${insurancePolicies.length} protection policies in place covering ${formatCurrency(lifeCover + ciCover)} lump sum + ${formatCurrency(ipCover)}/yr income.`
      : needsLifeInsurance
        ? "No insurance policies recorded — protection gaps likely."
        : "No insurance policies recorded.",
    details,
    actionUrl: "/settings?tab=protection",
    recommendation,
  };
}

// ============================================================
// Orchestrator — generate full diagnostic report
// ============================================================

/** Dimension weights for the overall score */
const DIMENSION_WEIGHTS: Record<DiagnosticDimension, number> = {
  retirement_readiness: 0.22,
  tax_efficiency: 0.13,
  savings_rate: 0.13,
  emergency_fund: 0.10,
  iht_exposure: 0.09,
  portfolio_diversification: 0.09,
  cash_flow_health: 0.09,
  pension_adequacy: 0.05,
  risk_alignment: 0.05,
  insurance_protection: 0.05,
};

/** All dimension scorers in evaluation order */
const SCORERS: Array<(household: HouseholdData) => DiagnosticScore> = [
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
];

/**
 * Generate a complete FI diagnostic report.
 * Pure function — depends only on HouseholdData input.
 */
export function generateDiagnosticReport(household: HouseholdData): DiagnosticReport {
  const scores = SCORERS.map((scorer) => scorer(household));

  // Weighted overall score (only include scored dimensions, not insufficient_data)
  let weightedSum = 0;
  let totalWeight = 0;
  for (const score of scores) {
    if (score.rating !== "insufficient_data") {
      const weight = DIMENSION_WEIGHTS[score.dimension];
      weightedSum += score.score * weight;
      totalWeight += weight;
    }
  }
  const overallScore = totalWeight > 0 ? clampScore(weightedSum / totalWeight) : 0;

  // Count ratings
  const ratingCounts: Record<DiagnosticRating, number> = {
    green: 0,
    amber: 0,
    red: 0,
    insufficient_data: 0,
  };
  for (const score of scores) {
    ratingCounts[score.rating]++;
  }

  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    overallRating: scoreToRating(overallScore),
    scores,
    ratingCounts,
  };
}
