// ============================================================
// Cash Flow Timeline — Monthly income vs outgoings projection
// ============================================================
// Generates 24 months of projected cash flow data, showing when
// income spikes (bonus months) and outgoing crunches (school fees)
// overlap or leave gaps.

import type { HouseholdData, DeferredBonusTranche } from "@/types";
import { annualiseOutgoing } from "@/types";
import type { CashFlowMonth } from "@/components/charts/cash-flow-timeline";

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

    const salary = calculateMonthlySalary(household);
    const bonus = calculateBonusForMonth(household, monthIdx);
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

function calculateMonthlySalary(household: HouseholdData): number {
  return household.income.reduce((sum, inc) => sum + inc.grossSalary / 12, 0);
}

/**
 * Cash bonuses are typically paid in March (end of tax year).
 * Month index 2 = March.
 */
function calculateBonusForMonth(household: HouseholdData, monthIdx: number): number {
  if (monthIdx !== 2) return 0; // March
  return household.bonusStructures.reduce((sum, b) => sum + b.cashBonusAnnual, 0);
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
