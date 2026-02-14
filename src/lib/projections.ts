// ============================================================
// Growth Projection & Retirement Planning Functions
// ============================================================

import { roundPence } from "@/lib/format";

// --- Types ---

export interface YearlyProjection {
  year: number;
  value: number;
}

export interface ScenarioProjection {
  rate: number;
  projections: YearlyProjection[];
}

export interface RetirementCountdown {
  years: number;
  months: number;
}

export interface PensionBridgeResult {
  bridgePotRequired: number;
  shortfall: number;
  sufficient: boolean;
}

// --- Compound Growth ---

/**
 * Project compound growth with regular monthly contributions.
 * Returns an array of year-end values.
 *
 * @param currentValue - Starting pot value
 * @param monthlyContribution - Amount added each month
 * @param annualReturnRate - Annual return as a decimal (e.g. 0.07 for 7%)
 * @param years - Number of years to project
 */
export function projectCompoundGrowth(
  currentValue: number,
  monthlyContribution: number,
  annualReturnRate: number,
  years: number
): YearlyProjection[] {
  const projections: YearlyProjection[] = [];
  let value = currentValue;
  const monthlyRate = annualReturnRate / 12;

  for (let year = 1; year <= years; year++) {
    for (let month = 0; month < 12; month++) {
      value = value * (1 + monthlyRate) + monthlyContribution;
    }
    projections.push({
      year,
      value: roundPence(value),
    });
  }

  return projections;
}

/**
 * Project multiple scenarios with different return rates.
 *
 * @param currentValue - Starting pot value
 * @param monthlyContribution - Amount added each month
 * @param rates - Array of annual return rates to model (e.g. [0.04, 0.07, 0.10])
 * @param years - Number of years to project
 */
export function projectScenarios(
  currentValue: number,
  monthlyContribution: number,
  rates: number[],
  years: number
): ScenarioProjection[] {
  return rates.map((rate) => ({
    rate,
    projections: projectCompoundGrowth(currentValue, monthlyContribution, rate, years),
  }));
}

// --- Retirement Countdown ---

/**
 * Calculate how many years and months until a pot reaches a target value,
 * given annual contributions and a return rate.
 *
 * @param currentPot - Current pot value
 * @param annualContribution - Annual amount added (split evenly across months)
 * @param targetPot - Target pot to reach
 * @param annualReturnRate - Annual return as a decimal
 */
export function calculateRetirementCountdown(
  currentPot: number,
  annualContribution: number,
  targetPot: number,
  annualReturnRate: number
): RetirementCountdown {
  if (currentPot >= targetPot) {
    return { years: 0, months: 0 };
  }

  const monthlyContribution = annualContribution / 12;
  const monthlyRate = annualReturnRate / 12;
  let value = currentPot;
  let totalMonths = 0;
  const maxMonths = 100 * 12; // cap at 100 years

  while (value < targetPot && totalMonths < maxMonths) {
    value = value * (1 + monthlyRate) + monthlyContribution;
    totalMonths++;
  }

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
  };
}

// --- Coast FIRE ---

/**
 * Determine whether the current pot, left to grow without further contributions,
 * will reach the target pot by the target age.
 *
 * @param currentPot - Current pot value
 * @param targetPot - Target pot at retirement
 * @param targetAge - Age at which the target pot is needed
 * @param currentAge - Current age
 * @param returnRate - Expected annual return as a decimal
 */
export function calculateCoastFIRE(
  currentPot: number,
  targetPot: number,
  targetAge: number,
  currentAge: number,
  returnRate: number
): boolean {
  const yearsToGrow = targetAge - currentAge;
  if (yearsToGrow <= 0) {
    return currentPot >= targetPot;
  }

  const futureValue = currentPot * Math.pow(1 + returnRate, yearsToGrow);
  return futureValue >= targetPot;
}

// --- Required Savings ---

/**
 * Calculate the monthly savings needed to reach a target pot from the current pot
 * over a given number of years at a given return rate.
 *
 * Uses the future value of annuity formula:
 * FV = PMT * [((1+r)^n - 1) / r]
 * We need: PMT = (targetPot - currentPot * (1+r)^n) / [((1+r)^n - 1) / r]
 *
 * @param targetPot - Target pot to reach
 * @param currentPot - Current pot value
 * @param years - Number of years to save
 * @param returnRate - Expected annual return as a decimal
 */
export function calculateRequiredSavings(
  targetPot: number,
  currentPot: number,
  years: number,
  returnRate: number
): number {
  if (years <= 0) return targetPot - currentPot;

  const monthlyRate = returnRate / 12;
  const totalMonths = years * 12;

  // Future value of current pot
  const fvCurrentPot = currentPot * Math.pow(1 + monthlyRate, totalMonths);

  // Remaining amount needed from contributions
  const remaining = targetPot - fvCurrentPot;

  if (remaining <= 0) return 0;

  // If return rate is effectively 0, simple division
  if (Math.abs(monthlyRate) < 1e-10) {
    return roundPence(remaining / totalMonths);
  }

  // Future value of annuity factor
  const fvAnnuityFactor = (Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate;

  const monthlyAmount = remaining / fvAnnuityFactor;
  return roundPence(monthlyAmount);
}

// --- Pension Bridge ---

/**
 * Calculate whether accessible (non-pension) wealth can bridge the gap
 * between early retirement and pension access age.
 *
 * @param retirementAge - Desired retirement age
 * @param pensionAccessAge - Age at which pension can be accessed
 * @param annualSpend - Annual spending requirement
 * @param accessibleWealth - Total non-pension wealth (ISA, GIA, cash, etc.)
 */
export function calculatePensionBridge(
  retirementAge: number,
  pensionAccessAge: number,
  annualSpend: number,
  accessibleWealth: number
): PensionBridgeResult {
  const bridgeYears = Math.max(0, pensionAccessAge - retirementAge);
  const bridgePotRequired = bridgeYears * annualSpend;
  const shortfall = Math.max(0, bridgePotRequired - accessibleWealth);

  return {
    bridgePotRequired: roundPence(bridgePotRequired),
    shortfall: roundPence(shortfall),
    sufficient: accessibleWealth >= bridgePotRequired,
  };
}

// --- Safe Withdrawal Rate ---

/**
 * Calculate the annual income from a pot at a given withdrawal rate.
 *
 * @param pot - Total pot value
 * @param rate - Annual withdrawal rate as a decimal (e.g. 0.04 for 4%)
 */
export function calculateSWR(pot: number, rate: number): number {
  return roundPence(pot * rate);
}

/**
 * Calculate the pot required to generate a given annual income at a withdrawal rate.
 *
 * @param annualIncome - Desired annual income
 * @param rate - Safe withdrawal rate as a decimal (e.g. 0.04 for 4%)
 */
export function calculateRequiredPot(annualIncome: number, rate: number): number {
  if (rate <= 0) return Infinity;
  return roundPence(annualIncome / rate);
}
