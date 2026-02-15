// ============================================================
// Cash Flow Timeline — Monthly income vs outgoings projection
// ============================================================
// Generates 24 months of projected cash flow data, showing when
// income spikes (bonus months) and outgoing crunches (school fees)
// overlap or leave gaps.

import type { HouseholdData, DeferredBonusTranche } from "@/types";
import { annualiseOutgoing } from "@/types";
import type { CashFlowMonth } from "@/components/charts/cash-flow-timeline";
import { calculateTakeHomePay } from "@/lib/tax";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Generate 24 months of projected cash flow from today.
 *
 * Income sources:
 * - Monthly salary (gross / 12 per person)
 * - Cash bonus (assumed paid in month specified, or March if unknown)
 * - Deferred vesting (in the month the tranche vests)
 *
 * Outgoings:
 * - Committed outgoings by frequency (monthly / termly / annually)
 * - Lifestyle spending (monthly)
 */
export function generateCashFlowTimeline(household: HouseholdData): CashFlowMonth[] {
  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth(); // 0-indexed

  const months: CashFlowMonth[] = [];

  for (let i = 0; i < 24; i++) {
    const monthIdx = (startMonth + i) % 12;
    const year = startYear + Math.floor((startMonth + i) / 12);
    const label = `${MONTHS[monthIdx]} ${year}`;

    const salary = calculateMonthlySalaryForMonth(household, i);
    const bonus = calculateBonusForMonth(household, monthIdx, i);
    const deferredVesting = calculateDeferredVestingForMonth(household, year, monthIdx);
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
 * Cash bonuses are typically paid in March (end of tax year).
 * Month index 2 = March. Applies bonus growth rate.
 */
function calculateBonusForMonth(household: HouseholdData, monthIdx: number, monthOffset: number): number {
  if (monthIdx !== 2) return 0; // March
  const yearsElapsed = monthOffset / 12;
  return household.bonusStructures.reduce((sum, b) => {
    const personIncome = household.income.find((i) => i.personId === b.personId);
    const growthRate = personIncome?.bonusGrowthRate ?? 0;
    return sum + b.cashBonusAnnual * Math.pow(1 + growthRate, yearsElapsed);
  }, 0);
}

/**
 * Check if any deferred tranches vest in this specific month.
 */
function calculateDeferredVestingForMonth(
  household: HouseholdData,
  year: number,
  monthIdx: number
): number {
  let total = 0;
  for (const bonus of household.bonusStructures) {
    for (const tranche of bonus.deferredTranches) {
      const vestDate = parseDate(tranche.vestingDate);
      if (vestDate && vestDate.getFullYear() === year && vestDate.getMonth() === monthIdx) {
        total += estimateVestedValue(tranche);
      }
    }
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
