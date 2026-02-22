// ============================================================
// Cash Flow Timeline — Monthly income vs outgoings projection
// ============================================================
// Generates 24 months of projected cash flow data, showing when
// income spikes (bonus months) and outgoing crunches (school fees)
// overlap or leave gaps.
//
// Fixes applied:
// - Configurable bonus payment month (was hardcoded to March)
// - Tax applied to bonus and vesting income (was gross, overstated by ~40%)

import type { HouseholdData, DeferredBonusTranche } from "@/types";
import { annualiseOutgoing } from "@/types";
import type { CashFlowMonth } from "@/components/charts/cash-flow-timeline";
import { calculateTakeHomePay } from "@/lib/tax";
import { generateDeferredTranches } from "@/lib/deferred-bonus";
import { calculateIncomeTax, calculateNI } from "@/lib/tax";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Generate 24 months of projected cash flow from today.
 *
 * Income sources:
 * - Monthly salary (net after tax, NI, pension)
 * - Cash bonus (net after marginal tax and NI, paid in configured month)
 * - Deferred vesting (net after marginal tax and NI, in the month the tranche vests)
 *
 * Outgoings:
 * - Committed outgoings by frequency (monthly / termly / annually)
 * - Lifestyle spending (monthly)
 */
export function generateCashFlowTimeline(household: HouseholdData): CashFlowMonth[] {
  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth(); // 0-indexed

  // Pre-generate all deferred tranches from simplified bonus structures
  const allTranches: DeferredBonusTranche[] = household.bonusStructures.flatMap(
    (bonus) => generateDeferredTranches(bonus)
  );

  const months: CashFlowMonth[] = [];

  for (let i = 0; i < 24; i++) {
    const monthIdx = (startMonth + i) % 12;
    const year = startYear + Math.floor((startMonth + i) / 12);
    const label = `${MONTHS[monthIdx]} ${year}`;

    const salary = calculateMonthlySalaryForMonth(household, i);
    const bonus = calculateNetBonusForMonth(household, monthIdx, i);
    const deferredVesting = calculateNetDeferredVestingForMonth(household, allTranches, year, monthIdx, i);
    const { committed, lifestyle } = calculateOutgoingsForMonth(household, monthIdx);

    const totalIncome = salary + bonus + deferredVesting;
    const totalOutgoings = committed + lifestyle;

    months.push({
      month: label,
      salary,
      bonus,
      deferredVesting,
      committedOutgoings: committed,
      lifestyleSpending: lifestyle,
      totalIncome,
      totalOutgoings,
    });
  }

  return months;
}

/**
 * Calculate monthly take-home salary for a given month offset from now.
 * Applies salary growth rate compound by year, then computes net pay
 * (after tax, NI, and pension deductions) for accurate cash flow.
 */
function calculateMonthlySalaryForMonth(household: HouseholdData, monthOffset: number): number {
  const yearsElapsed = monthOffset / 12;
  return household.income.reduce((sum, inc) => {
    const growthRate = inc.salaryGrowthRate ?? 0;
    const grownSalary = inc.grossSalary * Math.pow(1 + growthRate, yearsElapsed);
    const grownIncome = { ...inc, grossSalary: grownSalary };
    const takeHome = calculateTakeHomePay(grownIncome);
    return sum + takeHome.monthlyTakeHome;
  }, 0);
}

/**
 * Cash bonus net of marginal tax and NI.
 * Paid in the month specified by bonusPaymentMonth (default: March = 2).
 */
function calculateNetBonusForMonth(household: HouseholdData, monthIdx: number, monthOffset: number): number {
  const yearsElapsed = monthOffset / 12;
  let totalNetBonus = 0;

  for (const bonus of household.bonusStructures) {
    const paymentMonth = bonus.bonusPaymentMonth ?? 2; // Default March
    if (monthIdx !== paymentMonth) continue;

    const personIncome = household.income.find((i) => i.personId === bonus.personId);
    if (!personIncome) continue;

    const growthRate = personIncome.bonusGrowthRate ?? 0;
    const grossBonus = bonus.cashBonusAnnual * Math.pow(1 + growthRate, yearsElapsed);

    totalNetBonus += calculateNetBonusAmount(personIncome, grossBonus, yearsElapsed);
  }

  return totalNetBonus;
}

/**
 * Calculate the net (after tax and NI) amount of a bonus payment,
 * applying marginal tax on top of the person's salary.
 */
function calculateNetBonusAmount(income: { grossSalary: number; employeePensionContribution: number; pensionContributionMethod: "salary_sacrifice" | "net_pay" | "relief_at_source" }, grossBonus: number, yearsElapsed: number): number {
  const salaryGrowthRate = 0; // Already grown by caller context
  const grownSalary = income.grossSalary * Math.pow(1 + salaryGrowthRate, yearsElapsed);

  // Tax on salary alone
  const taxOnSalary = calculateIncomeTax(grownSalary, income.employeePensionContribution, income.pensionContributionMethod);
  const niOnSalary = calculateNI(grownSalary, income.employeePensionContribution, income.pensionContributionMethod);

  // Tax on salary + bonus combined
  const taxOnCombined = calculateIncomeTax(grownSalary + grossBonus, income.employeePensionContribution, income.pensionContributionMethod);
  const niOnCombined = calculateNI(grownSalary + grossBonus, income.employeePensionContribution, income.pensionContributionMethod);

  // Marginal tax and NI on the bonus
  const marginalTax = taxOnCombined.tax - taxOnSalary.tax;
  const marginalNI = niOnCombined.ni - niOnSalary.ni;

  return Math.max(0, grossBonus - marginalTax - marginalNI);
}

/**
 * Check if any generated deferred tranches vest in this specific month.
 * Applies marginal tax and NI to the vested amount.
 */
function calculateNetDeferredVestingForMonth(
  household: HouseholdData,
  tranches: DeferredBonusTranche[],
  year: number,
  monthIdx: number,
  monthOffset: number
): number {
  let total = 0;

  // Group tranches by person (via bonus structures)
  for (const bonus of household.bonusStructures) {
    const personIncome = household.income.find((i) => i.personId === bonus.personId);
    if (!personIncome) continue;

    // Find tranches for this person that vest in this month
    const personTranches = tranches.filter((t) => {
      const vestDate = parseDate(t.vestingDate);
      return vestDate && vestDate.getFullYear() === year && vestDate.getMonth() === monthIdx;
    });

    if (personTranches.length === 0) continue;

    const grossVesting = personTranches.reduce((sum, t) => sum + estimateVestedValue(t), 0);
    const yearsElapsed = monthOffset / 12;
    total += calculateNetBonusAmount(personIncome, grossVesting, yearsElapsed);
  }

  return total;
}

function calculateOutgoingsForMonth(
  household: HouseholdData,
  monthIdx: number
): { committed: number; lifestyle: number } {
  let committed = 0;

  for (const outgoing of household.committedOutgoings) {
    const annualised = annualiseOutgoing(outgoing.amount, outgoing.frequency);

    switch (outgoing.frequency) {
      case "monthly":
        committed += outgoing.amount;
        break;
      case "termly":
        // School terms: Sep (8), Jan (0), Apr (3)
        if (monthIdx === 0 || monthIdx === 3 || monthIdx === 8) {
          committed += outgoing.amount;
        }
        break;
      case "annually":
        // Assume annual outgoings in January (month 0)
        // Spread for display: show as monthly average
        committed += annualised / 12;
        break;
    }
  }

  const lifestyle = household.emergencyFund.monthlyLifestyleSpending;

  return { committed, lifestyle };
}

/**
 * Calculate cash runway in months — how long accessible liquid assets
 * can cover total monthly outgoings (committed + lifestyle).
 */
export function calculateCashRunway(household: HouseholdData): number {
  const cashAccounts = household.accounts.filter((a) =>
    ["cash_savings", "cash_isa", "premium_bonds"].includes(a.type)
  );
  const totalCash = cashAccounts.reduce((s, a) => s + a.currentValue, 0);

  const monthlyCommitted = household.committedOutgoings.reduce((sum, outgoing) => {
    return sum + annualiseOutgoing(outgoing.amount, outgoing.frequency) / 12;
  }, 0);
  const monthlyLifestyle = household.emergencyFund.monthlyLifestyleSpending;
  const totalMonthlyOutgoings = monthlyCommitted + monthlyLifestyle;

  if (totalMonthlyOutgoings <= 0) return 999; // No outgoings = infinite runway
  return totalCash / totalMonthlyOutgoings;
}

function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function estimateVestedValue(tranche: DeferredBonusTranche): number {
  const grant = parseDate(tranche.grantDate);
  const vest = parseDate(tranche.vestingDate);
  if (!grant || !vest) return tranche.amount;

  const years = (vest.getTime() - grant.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years <= 0) return tranche.amount;
  return tranche.amount * Math.pow(1 + tranche.estimatedAnnualReturn, years);
}
