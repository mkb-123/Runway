// ============================================================
// Sensitivity Analysis — "What Moves the Needle"
// ============================================================
// Varies each input ±10% (or a specified delta) and measures the
// impact on a target metric. Returns a ranked list of inputs
// sorted by absolute impact magnitude.

import type { HouseholdData, PersonIncome, Contribution } from "@/types";
import { annualiseContribution } from "@/types";
import {
  projectFinalValue,
  calculateAdjustedRequiredPot,
  calculateAge,
  getMidScenarioRate,
} from "@/lib/projections";
import { calculateTotalAnnualContributions, calculateHouseholdStatePension } from "@/lib/aggregations";

// --- Types ---

export interface SensitivityInput {
  /** Human-readable label */
  label: string;
  /** Impact on the target metric (positive = metric increases when input increases) */
  impact: number;
  /** Current value of this input */
  currentValue: number;
  /** Unit for display (£, %, years) */
  unit: string;
}

export interface SensitivityResult {
  /** Sorted by |impact| descending */
  inputs: SensitivityInput[];
  /** The target metric name */
  metricLabel: string;
  /** Baseline metric value */
  baselineValue: number;
}

// --- Main function ---

/**
 * Calculate sensitivity of projected-pot-at-retirement to each input.
 * Varies each input by ±10% (or ±1 for small integers like years/rates)
 * and measures the change in the projected pot at retirement.
 */
export function calculateSensitivity(household: HouseholdData): SensitivityResult {
  const primaryPerson = household.persons.find(p => p.relationship === "self") ?? household.persons[0];
  if (!primaryPerson) {
    return { inputs: [], metricLabel: "Projected Pot at Retirement", baselineValue: 0 };
  }

  const midRate = getMidScenarioRate(household.retirement.scenarioRates);
  const currentAge = calculateAge(primaryPerson.dateOfBirth);
  const yearsToRetirement = Math.max(0, primaryPerson.plannedRetirementAge - currentAge);

  // Baseline
  const currentPot = household.accounts.reduce((s, a) => s + a.currentValue, 0);
  const totalContrib = calculateTotalAnnualContributions(household.contributions, household.income);
  const baselineProjected = projectFinalValue(currentPot, totalContrib, midRate, yearsToRetirement);

  const inputs: SensitivityInput[] = [];

  // 1. Current pot (+10%)
  const potDelta = currentPot * 0.10;
  if (currentPot > 0) {
    const upPot = projectFinalValue(currentPot + potDelta, totalContrib, midRate, yearsToRetirement);
    inputs.push({
      label: "Current pot value",
      impact: upPot - baselineProjected,
      currentValue: currentPot,
      unit: "£",
    });
  }

  // 2. Annual contributions (+10%)
  if (totalContrib > 0) {
    const contribDelta = totalContrib * 0.10;
    const upContrib = projectFinalValue(currentPot, totalContrib + contribDelta, midRate, yearsToRetirement);
    inputs.push({
      label: "Annual contributions",
      impact: upContrib - baselineProjected,
      currentValue: totalContrib,
      unit: "£",
    });
  }

  // 3. Growth rate (+1 percentage point)
  {
    const upRate = projectFinalValue(currentPot, totalContrib, midRate + 0.01, yearsToRetirement);
    inputs.push({
      label: "Investment return rate",
      impact: upRate - baselineProjected,
      currentValue: midRate * 100,
      unit: "%",
    });
  }

  // 4. Retirement age (+1 year)
  if (yearsToRetirement > 0) {
    const upYears = projectFinalValue(currentPot, totalContrib, midRate, yearsToRetirement + 1);
    inputs.push({
      label: "Retirement age",
      impact: upYears - baselineProjected,
      currentValue: primaryPerson.plannedRetirementAge,
      unit: "years",
    });
  }

  // 5. Salary (+10% — affects pension contributions)
  const primaryIncome = household.income.find(i => i.personId === primaryPerson.id);
  if (primaryIncome && primaryIncome.grossSalary > 0) {
    const salaryDelta = primaryIncome.grossSalary * 0.10;
    // Assume pension contributions scale proportionally
    const pensionRatio = (primaryIncome.employeePensionContribution + primaryIncome.employerPensionContribution) / primaryIncome.grossSalary;
    const additionalPension = salaryDelta * pensionRatio;
    const upSalary = projectFinalValue(currentPot, totalContrib + additionalPension, midRate, yearsToRetirement);
    inputs.push({
      label: "Salary",
      impact: upSalary - baselineProjected,
      currentValue: primaryIncome.grossSalary,
      unit: "£",
    });
  }

  // 6. Withdrawal rate (-0.5pp — lower rate means larger required pot)
  {
    const statePension = calculateHouseholdStatePension(household.persons);
    const basePot = calculateAdjustedRequiredPot(
      household.retirement.targetAnnualIncome,
      household.retirement.withdrawalRate,
      household.retirement.includeStatePension,
      statePension
    );
    const tighterPot = calculateAdjustedRequiredPot(
      household.retirement.targetAnnualIncome,
      household.retirement.withdrawalRate - 0.005,
      household.retirement.includeStatePension,
      statePension
    );
    inputs.push({
      label: "Withdrawal rate",
      impact: -(tighterPot - basePot), // negative means tighter rate hurts (larger pot needed)
      currentValue: household.retirement.withdrawalRate * 100,
      unit: "%",
    });
  }

  // 7. Target retirement income (+£5k)
  {
    const statePension = calculateHouseholdStatePension(household.persons);
    const basePot = calculateAdjustedRequiredPot(
      household.retirement.targetAnnualIncome,
      household.retirement.withdrawalRate,
      household.retirement.includeStatePension,
      statePension
    );
    const higherIncomePot = calculateAdjustedRequiredPot(
      household.retirement.targetAnnualIncome + 5_000,
      household.retirement.withdrawalRate,
      household.retirement.includeStatePension,
      statePension
    );
    inputs.push({
      label: "Target retirement income",
      impact: -(higherIncomePot - basePot), // negative: higher target means bigger pot needed
      currentValue: household.retirement.targetAnnualIncome,
      unit: "£",
    });
  }

  // Sort by absolute impact (biggest movers first)
  inputs.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return {
    inputs,
    metricLabel: "Projected Pot at Retirement",
    baselineValue: baselineProjected,
  };
}
