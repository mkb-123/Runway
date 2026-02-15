// ============================================================
// Growth Projection & Retirement Planning Functions
// ============================================================

import { roundPence } from "@/lib/format";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";

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

// --- Helpers ---

/**
 * Get the mid scenario growth rate from scenarioRates array.
 * Returns the middle element, or a fallback if the array is empty.
 */
export function getMidScenarioRate(scenarioRates: number[], fallback = 0.07): number {
  if (scenarioRates.length === 0) return fallback;
  return scenarioRates[Math.floor(scenarioRates.length / 2)] ?? fallback;
}

/**
 * Project compound growth and return only the final value (not the full array).
 * Returns currentValue unchanged if years <= 0.
 */
export function projectFinalValue(
  currentValue: number,
  annualContribution: number,
  growthRate: number,
  years: number
): number {
  if (years <= 0) return currentValue;
  const monthlyContrib = annualContribution / 12;
  const projection = projectCompoundGrowth(currentValue, monthlyContrib, growthRate, years);
  return projection.length > 0 ? projection[projection.length - 1].value : currentValue;
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

// --- Growing Contribution Projections ---

export interface GrowingProjectionParams {
  currentValue: number;
  /** Year-1 annual contribution (salary-driven, will grow YoY) */
  annualContribution: number;
  /** Annual growth rate of contributions (e.g. 0.03 for 3% salary growth) */
  contributionGrowthRate: number;
  /** Annual investment return rate (e.g. 0.07 for 7%) */
  investmentReturnRate: number;
  /** Number of years to project */
  years: number;
}

/**
 * Project compound growth with annually-growing contributions.
 *
 * Models the real-world pattern where salary (and thus savings) increase
 * year-on-year. Each year:
 *   1. The pot grows by the investment return rate
 *   2. The year's contribution (growing each year) is added at year-end
 *
 * @returns Array of year-end values
 */
export function projectCompoundGrowthWithGrowingContributions(
  params: GrowingProjectionParams
): YearlyProjection[] {
  const {
    currentValue,
    annualContribution,
    contributionGrowthRate,
    investmentReturnRate,
    years,
  } = params;

  const projections: YearlyProjection[] = [];
  let value = currentValue;
  let contribution = annualContribution;

  for (let year = 1; year <= years; year++) {
    // Pot grows through the year
    value = value * (1 + investmentReturnRate);
    // Contribution made at year-end (simplified from monthly for clarity)
    value += contribution;
    projections.push({ year, value: roundPence(value) });
    // Contribution grows for next year
    contribution *= 1 + contributionGrowthRate;
  }

  return projections;
}

/**
 * Project multiple growth scenarios with growing contributions.
 */
export function projectScenariosWithGrowth(
  currentValue: number,
  annualContribution: number,
  contributionGrowthRate: number,
  rates: number[],
  years: number
): ScenarioProjection[] {
  return rates.map((rate) => ({
    rate,
    projections: projectCompoundGrowthWithGrowingContributions({
      currentValue,
      annualContribution,
      contributionGrowthRate,
      investmentReturnRate: rate,
      years,
    }),
  }));
}

/**
 * Project salary trajectory over N years with compound growth.
 *
 * Returns an array of {year, salary} showing expected salary at each year.
 * Useful for income trajectory visualization.
 */
export function projectSalaryTrajectory(
  currentSalary: number,
  growthRate: number,
  years: number
): { year: number; salary: number }[] {
  const trajectory: { year: number; salary: number }[] = [];
  let salary = currentSalary;
  for (let year = 0; year <= years; year++) {
    trajectory.push({ year, salary: roundPence(salary) });
    salary *= 1 + growthRate;
  }
  return trajectory;
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

/**
 * Calculate the required pot adjusted for state pension income.
 *
 * When includeStatePension is true, the required pot is reduced by
 * the capitalised value of the household's combined state pension income.
 * E.g. if target is £60k, state pension covers £11.5k, and SWR is 4%,
 * the required pot is (£60k - £11.5k) / 0.04 = £1,212,500 instead of £1,500,000.
 *
 * @param targetAnnualIncome - Desired annual retirement income
 * @param withdrawalRate - Safe withdrawal rate as a decimal
 * @param includeStatePension - Whether to offset by state pension
 * @param totalStatePensionAnnual - Combined household state pension income
 */
export function calculateAdjustedRequiredPot(
  targetAnnualIncome: number,
  withdrawalRate: number,
  includeStatePension: boolean,
  totalStatePensionAnnual: number
): number {
  const incomeFromPortfolio = includeStatePension
    ? Math.max(0, targetAnnualIncome - totalStatePensionAnnual)
    : targetAnnualIncome;
  return calculateRequiredPot(incomeFromPortfolio, withdrawalRate);
}

// --- Pension Tapered Annual Allowance ---

/**
 * Calculate the pension annual allowance after tapering for high earners.
 *
 * For 2024/25:
 * - If adjusted income > £260k, allowance reduces by £1 for every £2 over
 * - Minimum tapered allowance is £10k
 * - If threshold income ≤ £200k, no taper applies regardless of adjusted income
 *
 * HMRC ref: https://www.gov.uk/tax-on-your-private-pension/annual-allowance
 *
 * @param thresholdIncome - Net income before pension contributions (broadly: gross salary)
 * @param adjustedIncome - Threshold income + employer pension contributions
 */
export function calculateTaperedAnnualAllowance(
  thresholdIncome: number,
  adjustedIncome: number
): number {
  const {
    pensionAnnualAllowance,
    pensionTaperThresholdIncome,
    pensionTaperAdjustedIncomeThreshold,
    pensionTaperRate,
    pensionMinimumTaperedAllowance,
  } = UK_TAX_CONSTANTS;

  // No taper if threshold income is at or below £200k
  if (thresholdIncome <= pensionTaperThresholdIncome) {
    return pensionAnnualAllowance;
  }

  // No taper if adjusted income is at or below £260k
  if (adjustedIncome <= pensionTaperAdjustedIncomeThreshold) {
    return pensionAnnualAllowance;
  }

  // Taper: reduce by £1 for every £2 over the adjusted income threshold
  const excess = adjustedIncome - pensionTaperAdjustedIncomeThreshold;
  const reduction = Math.floor(excess * pensionTaperRate);
  const tapered = pensionAnnualAllowance - reduction;

  return Math.max(tapered, pensionMinimumTaperedAllowance);
}

// --- State Pension ---

/**
 * Calculate the pro-rata state pension based on NI qualifying years.
 *
 * - Below minimum qualifying years (10): £0
 * - Between minimum and required (10–35): proportional
 * - At or above required (35+): full pension
 *
 * HMRC/DWP ref: https://www.gov.uk/new-state-pension/what-youll-get
 *
 * @param qualifyingYears - Number of NI qualifying years
 */
export function calculateProRataStatePension(qualifyingYears: number): number {
  const { fullNewStatePensionAnnual, qualifyingYearsRequired, minimumQualifyingYears } =
    UK_TAX_CONSTANTS.statePension;

  if (qualifyingYears < minimumQualifyingYears) return 0;
  const proportion = Math.min(1, qualifyingYears / qualifyingYearsRequired);
  return roundPence(proportion * fullNewStatePensionAnnual);
}

// --- Age Calculation ---

/**
 * Calculate age in whole years from a date of birth.
 *
 * Uses calendar-based calculation (not millisecond division) for
 * correct handling of leap years and month boundaries.
 *
 * @param dateOfBirth - ISO date string (e.g. "1972-03-15")
 * @param now - Reference date (defaults to current date)
 */
export function calculateAge(dateOfBirth: string, now: Date = new Date()): number {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 0;
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

// --- Tax Efficiency ---

/**
 * Calculate the tax efficiency score: proportion of total savings
 * going into tax-advantaged wrappers (ISA + Pension).
 *
 * @param isaContributions - Total ISA contributions
 * @param pensionContributions - Total pension contributions
 * @param giaContributions - Total GIA contributions
 * @returns Score between 0 and 1 (0 = all GIA, 1 = all tax-advantaged)
 */
export function calculateTaxEfficiencyScore(
  isaContributions: number,
  pensionContributions: number,
  giaContributions: number
): number {
  const total = isaContributions + pensionContributions + giaContributions;
  if (total <= 0) return 0;
  return (isaContributions + pensionContributions) / total;
}

// --- Deferred Bonus Projection ---

/**
 * Project the value of a deferred bonus tranche at vesting,
 * using compound growth from grant date to vesting date.
 *
 * @param amount - Original bonus amount
 * @param grantDate - ISO date string of grant
 * @param vestingDate - ISO date string of vesting
 * @param estimatedAnnualReturn - Expected annual return as a decimal
 */
export function projectDeferredBonusValue(
  amount: number,
  grantDate: string,
  vestingDate: string,
  estimatedAnnualReturn: number
): number {
  const grant = new Date(grantDate);
  const vesting = new Date(vestingDate);
  const yearsToVest =
    (vesting.getTime() - grant.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (yearsToVest <= 0) return amount;
  return roundPence(amount * Math.pow(1 + estimatedAnnualReturn, yearsToVest));
}
