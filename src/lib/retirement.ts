// ============================================================
// Retirement Calculation Functions
// ============================================================
// Extracted from chart components per design principle:
// "All financial math lives in src/lib/"
//
// Includes:
// - buildIncomeTimeline: Multi-person income source projection
// - buildDrawdownData: Pot depletion with tax-aware withdrawals
// - estimatePensionWithdrawalTax: Income tax on pension drawdown

import { calculateIncomeTax } from "@/lib/tax";
import { UK_TAX_CONSTANTS, PENSION_TAX_FREE_LUMP_SUM_FRACTION } from "@/lib/tax-constants";

// ============================================================
// Types
// ============================================================

export interface PersonRetirementInput {
  name: string;
  pensionAccessAge: number;
  stateRetirementAge: number;
  /** Total DC pension pot at retirement */
  pensionPot: number;
  /** Accessible (non-pension) wealth */
  accessibleWealth: number;
  /** Annual state pension entitlement */
  statePensionAnnual: number;
}

export interface IncomeTimelineDataPoint {
  age: number;
  [key: string]: number;
}

export interface DrawdownDataPoint {
  age: number;
  [key: string]: number;
}

// ============================================================
// Pension Withdrawal Tax Estimation
// ============================================================

/**
 * Estimate the income tax on a pension withdrawal in retirement.
 *
 * Pension drawdown is taxed as income. The 25% PCLS (Pension
 * Commencement Lump Sum) is tax-free; the remaining 75% is
 * subject to income tax at marginal rates.
 *
 * For simplicity, we model the tax-free portion as spread evenly
 * across all withdrawal years (rather than taken upfront).
 *
 * @param grossWithdrawal - Total amount drawn from pension pot
 * @param otherIncome - Other taxable income (e.g. state pension)
 * @returns The estimated income tax on the pension withdrawal
 */
export function estimatePensionWithdrawalTax(
  grossWithdrawal: number,
  otherIncome: number = 0
): number {
  if (grossWithdrawal <= 0) return 0;

  // 25% is tax-free (PCLS), 75% is taxable
  const taxableWithdrawal = grossWithdrawal * (1 - PENSION_TAX_FREE_LUMP_SUM_FRACTION);
  const totalTaxableIncome = otherIncome + taxableWithdrawal;

  // Tax on total income minus tax on other income alone
  const taxOnTotal = calculateIncomeTax(totalTaxableIncome).tax;
  const taxOnOtherOnly = otherIncome > 0 ? calculateIncomeTax(otherIncome).tax : 0;

  return taxOnTotal - taxOnOtherOnly;
}

/**
 * Calculate the gross pension withdrawal needed to achieve a target
 * net (after-tax) amount, accounting for 25% PCLS tax-free portion.
 *
 * @param targetNet - The desired net income from pension
 * @param otherIncome - Other taxable income in the same year
 * @returns The gross amount to withdraw from the pension pot
 */
export function calculateGrossPensionWithdrawal(
  targetNet: number,
  otherIncome: number = 0
): number {
  if (targetNet <= 0) return 0;

  // Binary search for the gross amount that yields the target net
  let lo = targetNet;
  let hi = targetNet * 2; // Tax can't be more than 45%+

  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const tax = estimatePensionWithdrawalTax(mid, otherIncome);
    const net = mid - tax;

    if (Math.abs(net - targetNet) < 1) return Math.round(mid);

    if (net < targetNet) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return Math.round((lo + hi) / 2);
}

// ============================================================
// Income Timeline (extracted from retirement-income-timeline.tsx)
// ============================================================

/**
 * Build a year-by-year income timeline for retirement.
 *
 * Models income from three sources per person:
 * 1. State pension (guaranteed, paid in full once eligible)
 * 2. DC pension drawdown (proportional across persons)
 * 3. ISA/accessible wealth drawdown (bridge or supplement)
 *
 * Uses draw-first-then-grow convention throughout.
 * Tracks shortfall separately (not stacked with income).
 */
export function buildIncomeTimeline(
  persons: PersonRetirementInput[],
  targetAnnualIncome: number,
  retirementAge: number,
  endAge: number,
  growthRate: number
): IncomeTimelineDataPoint[] {
  const data: IncomeTimelineDataPoint[] = [];

  // Track mutable pots
  const pots = persons.map((p) => ({
    name: p.name,
    pensionPot: p.pensionPot,
    accessibleWealth: p.accessibleWealth,
    pensionAccessAge: p.pensionAccessAge,
    stateRetirementAge: p.stateRetirementAge,
    statePensionAnnual: p.statePensionAnnual,
  }));

  for (let age = retirementAge; age <= endAge; age++) {
    const point: IncomeTimelineDataPoint = { age };

    // State pensions paid in full (not capped to target).
    let totalIncome = 0;

    // 1. State pensions first (guaranteed income, paid in full)
    for (const p of pots) {
      const key = `${p.name} State Pension`;
      if (age >= p.stateRetirementAge) {
        point[key] = Math.round(p.statePensionAnnual);
        totalIncome += p.statePensionAnnual;
      } else {
        point[key] = 0;
      }
    }

    // 2. DC Pension drawdown (once accessible)
    // Proportional drawdown across persons
    const remainingNeedAfterStatePension = Math.max(0, targetAnnualIncome - totalIncome);

    const availablePensionPots = pots
      .filter((p) => age >= p.pensionAccessAge && p.pensionPot > 0)
      .map((p) => ({ p, available: p.pensionPot }));
    const totalAvailablePension = availablePensionPots.reduce((s, x) => s + x.available, 0);

    for (const p of pots) {
      const key = `${p.name} Pension`;
      if (age >= p.pensionAccessAge && p.pensionPot > 0) {
        const share = totalAvailablePension > 0
          ? (p.pensionPot / totalAvailablePension) * remainingNeedAfterStatePension
          : 0;
        // Draw first, then grow
        const draw = Math.min(share, p.pensionPot);
        p.pensionPot -= draw;
        p.pensionPot *= 1 + growthRate;
        point[key] = Math.round(draw);
        totalIncome += draw;
      } else {
        if (p.pensionPot > 0) {
          p.pensionPot *= 1 + growthRate;
        }
        point[key] = 0;
      }
    }

    // 3. ISA/Accessible drawdown (bridge before pension, or supplement after)
    const remainingNeedAfterPension = Math.max(0, targetAnnualIncome - totalIncome);

    const availableISAPots = pots
      .filter((p) => p.accessibleWealth > 0)
      .map((p) => ({ p, available: p.accessibleWealth }));
    const totalAvailableISA = availableISAPots.reduce((s, x) => s + x.available, 0);

    for (const p of pots) {
      const key = `${p.name} ISA/Savings`;
      if (p.accessibleWealth > 0 && remainingNeedAfterPension > 0) {
        const share = totalAvailableISA > 0
          ? (p.accessibleWealth / totalAvailableISA) * remainingNeedAfterPension
          : 0;
        // Draw first, then grow
        const draw = Math.min(share, p.accessibleWealth);
        p.accessibleWealth -= draw;
        p.accessibleWealth *= 1 + growthRate;
        point[key] = Math.round(draw);
        totalIncome += draw;
      } else {
        if (p.accessibleWealth > 0) {
          p.accessibleWealth *= 1 + growthRate;
        }
        point[key] = 0;
      }
    }

    // Shortfall tracked separately (not in income stack)
    point["Shortfall"] = Math.round(Math.max(0, targetAnnualIncome - totalIncome));

    data.push(point);
  }

  return data;
}

// ============================================================
// Drawdown Data (extracted from retirement-drawdown-chart.tsx)
// ============================================================

/**
 * Build pot drawdown projection data across multiple growth scenarios.
 *
 * Models pension pot depletion over retirement, accounting for:
 * - State pension reducing the withdrawal needed from the pot
 * - Income tax on pension withdrawals (25% PCLS tax-free)
 * - Draw-first-then-grow convention (conservative)
 *
 * @param startingPot - Pension pot value at retirement
 * @param annualSpend - Target annual spending (net, after tax)
 * @param retirementAge - Age at retirement start
 * @param endAge - End age for projection (default 95)
 * @param scenarioRates - Array of annual growth rates to model
 * @param statePensionAge - Age state pension begins
 * @param statePensionAnnual - Annual state pension amount
 * @param includeTax - Whether to gross up withdrawals for income tax
 */
export function buildDrawdownData(
  startingPot: number,
  annualSpend: number,
  retirementAge: number,
  endAge: number,
  scenarioRates: number[],
  statePensionAge: number,
  statePensionAnnual: number,
  includeTax: boolean = true
): DrawdownDataPoint[] {
  const data: DrawdownDataPoint[] = [];

  // Track pot for each scenario
  const pots = scenarioRates.map(() => startingPot);

  for (let age = retirementAge; age <= endAge; age++) {
    const point: DrawdownDataPoint = { age };

    for (let i = 0; i < scenarioRates.length; i++) {
      const label = `${(scenarioRates[i] * 100).toFixed(0)}%`;

      // State pension reduces withdrawal from pot
      const statePension = age >= statePensionAge ? statePensionAnnual : 0;
      const netNeedFromPot = Math.max(0, annualSpend - statePension);

      // Gross up for tax if enabled (25% PCLS is tax-free)
      let withdrawalFromPot: number;
      if (includeTax && netNeedFromPot > 0) {
        withdrawalFromPot = calculateGrossPensionWithdrawal(netNeedFromPot, statePension);
      } else {
        withdrawalFromPot = netNeedFromPot;
      }

      // Draw first, then grow (conservative convention)
      pots[i] = (pots[i] - withdrawalFromPot) * (1 + scenarioRates[i]);
      if (pots[i] < 0) pots[i] = 0;

      point[label] = Math.round(pots[i]);
    }

    data.push(point);
  }

  return data;
}
