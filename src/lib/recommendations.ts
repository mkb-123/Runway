// ============================================================
// Actionable Recommendations Engine
// ============================================================
// Analyzes the household's financial position and generates
// prioritised, specific recommendations with concrete numbers.

import type { HouseholdData, TransactionsData, PersonIncome } from "@/types";
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

export function generateRecommendations(
  household: HouseholdData,
  transactions: TransactionsData
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const { persons, accounts, income, annualContributions } = household;

  for (const person of persons) {
    const personIncome = income.find((i) => i.personId === person.id);
    const personContributions = annualContributions.find(
      (c) => c.personId === person.id
    );
    const personAccounts = accounts.filter((a) => a.personId === person.id);

    if (!personIncome || !personContributions) continue;

    // -------------------------------------------------------------------
    // 1. Salary sacrifice to avoid personal allowance taper (60% trap)
    // -------------------------------------------------------------------
    const adjustedGross = getAdjustedGrossForTax(personIncome);
    if (
      adjustedGross > UK_TAX_CONSTANTS.personalAllowanceTaperThreshold &&
      adjustedGross <= UK_TAX_CONSTANTS.incomeTax.higherRateUpperLimit
    ) {
      const excessOverThreshold =
        adjustedGross - UK_TAX_CONSTANTS.personalAllowanceTaperThreshold;
      // Need to sacrifice enough to get to £100k adjusted
      const additionalSacrifice = Math.min(
        excessOverThreshold,
        UK_TAX_CONSTANTS.pensionAnnualAllowance -
          personContributions.pensionContribution
      );

      if (additionalSacrifice > 0) {
        // Calculate tax saved
        const currentTax = calculateIncomeTax(
          personIncome.grossSalary,
          personIncome.employeePensionContribution,
          personIncome.pensionContributionMethod
        );
        const newTax = calculateIncomeTax(
          personIncome.grossSalary,
          personIncome.employeePensionContribution + additionalSacrifice,
          personIncome.pensionContributionMethod
        );
        const taxSaved = currentTax.tax - newTax.tax;

        // NI saved if salary sacrifice
        let niSaved = 0;
        if (personIncome.pensionContributionMethod === "salary_sacrifice") {
          const currentNI = calculateNI(
            personIncome.grossSalary,
            personIncome.employeePensionContribution,
            personIncome.pensionContributionMethod
          );
          const newNI = calculateNI(
            personIncome.grossSalary,
            personIncome.employeePensionContribution + additionalSacrifice,
            personIncome.pensionContributionMethod
          );
          niSaved = currentNI.ni - newNI.ni;
        }

        const totalSaved = Math.round(taxSaved + niSaved);

        recommendations.push({
          id: `salary-sacrifice-taper-${person.id}`,
          title: `Salary sacrifice to avoid 60% trap`,
          description: `${person.name}'s adjusted income is £${Math.round(adjustedGross).toLocaleString()}, within the personal allowance taper zone (£100k-£125k). Increasing pension contributions by £${Math.round(additionalSacrifice).toLocaleString()} via salary sacrifice would bring adjusted income to £100,000 or below.`,
          impact: `Save £${totalSaved.toLocaleString()}/yr in tax${niSaved > 0 ? ` and NI` : ""}. Effective cost after relief: £${Math.round(additionalSacrifice - totalSaved).toLocaleString()}.`,
          priority: "high",
          category: "tax",
          personId: person.id,
          personName: person.name,
        });
      }
    }

    // -------------------------------------------------------------------
    // 2. ISA allowance usage
    // -------------------------------------------------------------------
    const isaUsed = personContributions.isaContribution;
    const isaRemaining = UK_TAX_CONSTANTS.isaAnnualAllowance - isaUsed;

    if (isaRemaining > 0 && isaRemaining <= UK_TAX_CONSTANTS.isaAnnualAllowance * 0.5) {
      recommendations.push({
        id: `isa-topup-${person.id}`,
        title: `Top up ISA before year-end`,
        description: `${person.name} has £${isaRemaining.toLocaleString()} of ISA allowance remaining for this tax year. ISA allowances cannot be carried forward — use it or lose it.`,
        impact: `Shelter £${isaRemaining.toLocaleString()} from future capital gains and income tax.`,
        priority: isaRemaining >= 10000 ? "high" : "medium",
        category: "isa",
        personId: person.id,
        personName: person.name,
      });
    } else if (isaRemaining === UK_TAX_CONSTANTS.isaAnnualAllowance) {
      recommendations.push({
        id: `isa-unused-${person.id}`,
        title: `Open/fund ISA for this tax year`,
        description: `${person.name} has not used any of their £${UK_TAX_CONSTANTS.isaAnnualAllowance.toLocaleString()} ISA allowance. This is a significant missed opportunity for tax-efficient savings.`,
        impact: `Full £${UK_TAX_CONSTANTS.isaAnnualAllowance.toLocaleString()} tax-free growth potential.`,
        priority: "high",
        category: "isa",
        personId: person.id,
        personName: person.name,
      });
    }

    // -------------------------------------------------------------------
    // 3. Pension allowance headroom
    // -------------------------------------------------------------------
    const pensionUsed = personContributions.pensionContribution;
    const pensionRemaining =
      UK_TAX_CONSTANTS.pensionAnnualAllowance - pensionUsed;

    if (pensionRemaining > 20000) {
      recommendations.push({
        id: `pension-headroom-${person.id}`,
        title: `Use pension allowance headroom`,
        description: `${person.name} has £${pensionRemaining.toLocaleString()} of unused pension annual allowance. Consider increasing contributions to reduce taxable income.`,
        impact: `Tax relief of £${Math.round(pensionRemaining * (adjustedGross > UK_TAX_CONSTANTS.incomeTax.basicRateUpperLimit ? 0.4 : 0.2)).toLocaleString()} on additional contributions.`,
        priority: pensionRemaining > 40000 ? "high" : "medium",
        category: "pension",
        personId: person.id,
        personName: person.name,
      });
    }

    // -------------------------------------------------------------------
    // 4. Bed & ISA opportunity
    // -------------------------------------------------------------------
    const giaAccounts = personAccounts.filter((a) => a.type === "gia");
    const giaValue = giaAccounts.reduce(
      (sum, a) => sum + a.currentValue,
      0
    );

    if (giaValue > 0 && isaRemaining > 0) {
      const giaTransactions = transactions.transactions.filter((tx) =>
        giaAccounts.some((a) => a.id === tx.accountId)
      );
      const unrealisedGains = getUnrealisedGains(giaAccounts, giaTransactions);
      const totalGain = unrealisedGains.reduce(
        (sum, ug) => sum + ug.unrealisedGain,
        0
      );

      if (totalGain > 0 && totalGain <= UK_TAX_CONSTANTS.cgt.annualExemptAmount) {
        recommendations.push({
          id: `bed-isa-free-${person.id}`,
          title: `Zero-cost Bed & ISA transfer`,
          description: `${person.name}'s GIA unrealised gains (£${Math.round(totalGain).toLocaleString()}) are within the CGT annual exempt amount. Transfer up to £${Math.min(giaValue, isaRemaining).toLocaleString()} to ISA at zero tax cost.`,
          impact: `Shelter £${Math.min(giaValue, isaRemaining).toLocaleString()} from future CGT and income tax — completely free.`,
          priority: "high",
          category: "tax",
          personId: person.id,
          personName: person.name,
        });
      }
    }

    // -------------------------------------------------------------------
    // 5. GIA overweight warning
    // -------------------------------------------------------------------
    const totalNW = accounts.reduce((s, a) => s + a.currentValue, 0);
    if (totalNW > 0 && giaValue / totalNW > 0.15) {
      recommendations.push({
        id: `gia-overweight-${person.id}`,
        title: `Reduce GIA exposure`,
        description: `${person.name}'s GIA holdings represent ${((giaValue / totalNW) * 100).toFixed(1)}% of the household portfolio. GIA assets are subject to CGT on gains and income tax on dividends.`,
        impact: `Prioritise ISA and pension contributions to reduce tax drag over time.`,
        priority: "medium",
        category: "investment",
        personId: person.id,
        personName: person.name,
      });
    }
  }

  // -------------------------------------------------------------------
  // 6. Retirement progress
  // -------------------------------------------------------------------
  const totalNW = accounts.reduce((s, a) => s + a.currentValue, 0);
  const requiredPot =
    household.retirement.withdrawalRate > 0
      ? household.retirement.targetAnnualIncome / household.retirement.withdrawalRate
      : 0;
  const progress = requiredPot > 0 ? totalNW / requiredPot : 0;

  if (progress < 0.5) {
    recommendations.push({
      id: "retirement-behind",
      title: "Increase retirement savings rate",
      description: `You're ${(progress * 100).toFixed(0)}% of the way to your £${Math.round(requiredPot).toLocaleString()} retirement target. Consider increasing contributions to close the gap.`,
      impact: `Current shortfall: £${Math.round(requiredPot - totalNW).toLocaleString()}.`,
      priority: "high",
      category: "retirement",
    });
  }

  // -------------------------------------------------------------------
  // 7. Emergency fund check
  // -------------------------------------------------------------------
  const cashAccounts = accounts.filter((a) =>
    ["cash_savings"].includes(a.type)
  );
  const totalCash = cashAccounts.reduce((s, a) => s + a.currentValue, 0);
  const emergencyTarget =
    household.emergencyFund.monthlyEssentialExpenses *
    household.emergencyFund.targetMonths;

  if (totalCash < emergencyTarget) {
    const shortfall = emergencyTarget - totalCash;
    recommendations.push({
      id: "emergency-fund-low",
      title: "Top up emergency fund",
      description: `Your cash savings (£${totalCash.toLocaleString()}) are below your ${household.emergencyFund.targetMonths}-month emergency fund target of £${emergencyTarget.toLocaleString()}.`,
      impact: `Shortfall of £${Math.round(shortfall).toLocaleString()}. Consider building cash reserves before investing.`,
      priority: shortfall > emergencyTarget * 0.5 ? "high" : "medium",
      category: "risk",
    });
  }

  // -------------------------------------------------------------------
  // 8. Concentration risk
  // -------------------------------------------------------------------
  const allHoldings = accounts.flatMap((a) =>
    a.holdings.map((h) => ({ ...h, accountId: a.id, value: h.units * h.currentPrice }))
  );
  const totalHoldingsValue = allHoldings.reduce((s, h) => s + h.value, 0);
  if (totalHoldingsValue > 0) {
    // Group by fund
    const byFund = new Map<string, number>();
    for (const h of allHoldings) {
      byFund.set(h.fundId, (byFund.get(h.fundId) ?? 0) + h.value);
    }
    for (const [fundId, value] of byFund) {
      const pct = value / totalHoldingsValue;
      if (pct > 0.4) {
        const fund = household.funds.find((f) => f.id === fundId);
        recommendations.push({
          id: `concentration-${fundId}`,
          title: `High concentration in ${fund?.name ?? fundId}`,
          description: `${((pct * 100).toFixed(0))}% of your invested portfolio is in a single fund. This creates significant concentration risk.`,
          impact: `Consider diversifying across additional funds or asset classes.`,
          priority: "medium",
          category: "risk",
        });
      }
    }
  }

  // Sort by priority
  const priorityOrder: Record<RecommendationPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return recommendations;
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
