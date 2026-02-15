// ============================================================
// Scenario Override Logic — Pure functions for applying what-if overrides
// ============================================================
// Extracted from scenario-context.tsx for testability.
// Each override type has explicit merge semantics.

import type { HouseholdData, Person, PersonIncome, Contribution } from "@/types";

// --- Override types ---

export interface ContributionOverride {
  personId: string;
  isaContribution?: number;
  pensionContribution?: number;
  giaContribution?: number;
}

export interface ScenarioOverrides {
  /** Partial person-level overrides (e.g. plannedRetirementAge), merged by personId */
  personOverrides?: Partial<Person>[];
  income?: Partial<PersonIncome>[];
  contributionOverrides?: ContributionOverride[];
  retirement?: Partial<HouseholdData["retirement"]>;
  /** Override specific account values by ID */
  accountValues?: Record<string, number>;
  /** Apply a percentage shock to all account values (e.g. -0.30 for a 30% crash) */
  marketShockPercent?: number;
}

// --- Core apply function ---

/**
 * Apply scenario overrides to household data, producing a new HouseholdData
 * with overridden values. The original data is not mutated.
 *
 * Override merge semantics:
 * - personOverrides: spread-merge by personId (e.g. retirement age)
 * - income: spread-merge by personId (partial override)
 * - contributionOverrides: full replacement per person (synthetic contributions)
 * - retirement: spread-merge on top of existing config
 * - accountValues: direct value replacement by account ID
 * - marketShockPercent: multiplicative shock applied before accountValues
 */
export function applyScenarioOverrides(
  household: HouseholdData,
  overrides: ScenarioOverrides
): HouseholdData {
  let result = { ...household };

  result = applyPersonOverrides(result, overrides.personOverrides);
  result = applyIncomeOverrides(result, overrides.income);
  result = applyContributionOverrides(result, overrides.contributionOverrides);
  result = applyRetirementOverrides(result, overrides.retirement);
  result = applyAccountOverrides(result, overrides.accountValues, overrides.marketShockPercent);

  return result;
}

// --- Individual override applicators ---

function applyPersonOverrides(
  household: HouseholdData,
  personOverrides?: Partial<Person>[]
): HouseholdData {
  if (!personOverrides || personOverrides.length === 0) return household;

  return {
    ...household,
    persons: household.persons.map((person) => {
      const override = personOverrides.find((o) => o.id === person.id);
      if (override) {
        return { ...person, ...override } as Person;
      }
      return person;
    }),
  };
}

function applyIncomeOverrides(
  household: HouseholdData,
  incomeOverrides?: Partial<PersonIncome>[]
): HouseholdData {
  if (!incomeOverrides || incomeOverrides.length === 0) return household;

  return {
    ...household,
    income: household.income.map((inc) => {
      const override = incomeOverrides.find((o) => o.personId === inc.personId);
      if (override) {
        return { ...inc, ...override } as PersonIncome;
      }
      return inc;
    }),
  };
}

function applyContributionOverrides(
  household: HouseholdData,
  contributionOverrides?: ContributionOverride[]
): HouseholdData {
  if (!contributionOverrides || contributionOverrides.length === 0) return household;

  const overriddenPersonIds = new Set(contributionOverrides.map((o) => o.personId));
  const kept = household.contributions.filter((c) => !overriddenPersonIds.has(c.personId));

  const synthetic: Contribution[] = [];
  for (const ov of contributionOverrides) {
    if (ov.isaContribution !== undefined && ov.isaContribution > 0) {
      synthetic.push({
        id: `scenario-isa-${ov.personId}`,
        personId: ov.personId,
        label: "ISA (scenario)",
        target: "isa",
        amount: ov.isaContribution,
        frequency: "annually",
      });
    }
    if (ov.pensionContribution !== undefined && ov.pensionContribution > 0) {
      synthetic.push({
        id: `scenario-pension-${ov.personId}`,
        personId: ov.personId,
        label: "Pension (scenario)",
        target: "pension",
        amount: ov.pensionContribution,
        frequency: "annually",
      });
    }
    if (ov.giaContribution !== undefined && ov.giaContribution > 0) {
      synthetic.push({
        id: `scenario-gia-${ov.personId}`,
        personId: ov.personId,
        label: "GIA (scenario)",
        target: "gia",
        amount: ov.giaContribution,
        frequency: "annually",
      });
    }
  }

  return {
    ...household,
    contributions: [...kept, ...synthetic],
  };
}

function applyRetirementOverrides(
  household: HouseholdData,
  retirementOverrides?: Partial<HouseholdData["retirement"]>
): HouseholdData {
  if (!retirementOverrides) return household;
  return {
    ...household,
    retirement: { ...household.retirement, ...retirementOverrides },
  };
}

function applyAccountOverrides(
  household: HouseholdData,
  accountValues?: Record<string, number>,
  marketShockPercent?: number
): HouseholdData {
  if (accountValues === undefined && marketShockPercent === undefined) return household;

  return {
    ...household,
    accounts: household.accounts.map((acc) => {
      let value = acc.currentValue;

      // Apply market shock first (multiplicative)
      if (marketShockPercent !== undefined) {
        value = value * (1 + marketShockPercent);
      }

      // Then apply specific account overrides (absolute)
      if (accountValues?.[acc.id] !== undefined) {
        value = accountValues[acc.id];
      }

      if (value !== acc.currentValue) {
        return { ...acc, currentValue: Math.max(0, value) };
      }
      return acc;
    }),
  };
}
