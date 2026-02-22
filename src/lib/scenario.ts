// ============================================================
// Scenario Override Logic — Pure functions for applying what-if overrides
// ============================================================
// Extracted from scenario-context.tsx for testability.
// Each override type has explicit merge semantics.

import type { HouseholdData, Person, PersonIncome, Contribution, BonusStructure } from "@/types";
import { getPersonContributionTotals, getPersonGrossIncome } from "@/types";
import { calculateIncomeTax, calculateNI } from "@/lib/tax";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { formatCurrencyCompact } from "@/lib/format";

// --- Override types ---

/** Person override that requires an id for matching, with all other fields optional */
export type PersonOverride = Pick<Person, "id"> & Partial<Omit<Person, "id">>;

export interface ContributionOverride {
  personId: string;
  isaContribution?: number;
  pensionContribution?: number;
  giaContribution?: number;
}

export interface ScenarioOverrides {
  /** Partial person-level overrides (e.g. plannedRetirementAge), merged by personId */
  personOverrides?: PersonOverride[];
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
  personOverrides?: PersonOverride[]
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

// --- Extracted pure functions (scenario panel helpers) ---

/**
 * Scale household contributions to achieve a target savings rate.
 * Distributes contributions proportionally to each person's income share,
 * maintaining existing ISA/pension/GIA ratio for persons with contributions.
 * Persons with zero contributions receive allocation to ISA.
 */
export function scaleSavingsRateContributions(
  persons: Person[],
  income: PersonIncome[],
  bonusStructures: BonusStructure[],
  contributions: Contribution[],
  targetSavingsRatePercent: number
): ContributionOverride[] {
  let totalGrossIncome = 0;
  const contribsByPerson: Record<string, { isa: number; pension: number; gia: number; total: number }> = {};

  for (const person of persons) {
    const gross = getPersonGrossIncome(income, bonusStructures, person.id);
    totalGrossIncome += gross;
    const totals = getPersonContributionTotals(contributions, person.id);
    const personTotal = totals.isaContribution + totals.pensionContribution + totals.giaContribution;
    contribsByPerson[person.id] = {
      isa: totals.isaContribution,
      pension: totals.pensionContribution,
      gia: totals.giaContribution,
      total: personTotal,
    };
  }

  if (totalGrossIncome <= 0) return [];

  const targetTotalContribs = (targetSavingsRatePercent / 100) * totalGrossIncome;

  return persons.map((person) => {
    const current = contribsByPerson[person.id] ?? { isa: 0, pension: 0, gia: 0, total: 0 };
    const personGross = getPersonGrossIncome(income, bonusStructures, person.id);
    const personShare = totalGrossIncome > 0 ? personGross / totalGrossIncome : 0;
    const personTarget = targetTotalContribs * personShare;

    if (current.total > 0) {
      // Scale maintaining existing ISA/pension/GIA ratio, capping ISA at £20k
      const scale = personTarget / current.total;
      let scaledISA = Math.round(current.isa * scale);
      let scaledGIA = Math.round(current.gia * scale);
      const scaledPension = Math.round(current.pension * scale);

      // Cap ISA at annual allowance, spill excess into GIA
      if (scaledISA > UK_TAX_CONSTANTS.isaAnnualAllowance) {
        const excess = scaledISA - UK_TAX_CONSTANTS.isaAnnualAllowance;
        scaledISA = UK_TAX_CONSTANTS.isaAnnualAllowance;
        scaledGIA += excess;
      }

      return {
        personId: person.id,
        isaContribution: scaledISA,
        pensionContribution: scaledPension,
        giaContribution: scaledGIA,
      };
    }
    // No existing contributions — allocate to ISA (capped) based on income share, excess to GIA
    const isaAmount = Math.min(Math.round(personTarget), UK_TAX_CONSTANTS.isaAnnualAllowance);
    const giaAmount = Math.max(0, Math.round(personTarget) - isaAmount);
    return {
      personId: person.id,
      isaContribution: isaAmount,
      giaContribution: giaAmount > 0 ? giaAmount : undefined,
    };
  });
}

/**
 * Calculate the tax/NI impact of changing pension contributions.
 * Returns a map of personId → impact preview.
 */
export interface ImpactPreview {
  taxSaved: number;
  niSaved: number;
  totalSaved: number;
  newTakeHome: number;
  takeHomeChange: number;
}

export function calculateScenarioImpact(
  persons: Person[],
  income: PersonIncome[],
  pensionOverrides: Record<string, number>
): Map<string, ImpactPreview> {
  const results = new Map<string, ImpactPreview>();

  for (const person of persons) {
    const personIncome = income.find((i) => i.personId === person.id);
    if (!personIncome) continue;

    const newPension = pensionOverrides[person.id] ?? personIncome.employeePensionContribution;

    const currentTax = calculateIncomeTax(
      personIncome.grossSalary,
      personIncome.employeePensionContribution,
      personIncome.pensionContributionMethod
    );
    const newTax = calculateIncomeTax(
      personIncome.grossSalary,
      newPension,
      personIncome.pensionContributionMethod
    );

    const currentNI = calculateNI(
      personIncome.grossSalary,
      personIncome.employeePensionContribution,
      personIncome.pensionContributionMethod
    );
    const newNI = calculateNI(
      personIncome.grossSalary,
      newPension,
      personIncome.pensionContributionMethod
    );

    const taxSaved = currentTax.tax - newTax.tax;
    const niSaved = currentNI.ni - newNI.ni;

    const currentTakeHome =
      personIncome.grossSalary - personIncome.employeePensionContribution - currentTax.tax - currentNI.ni;
    const newTakeHome =
      personIncome.grossSalary - newPension - newTax.tax - newNI.ni;

    results.set(person.id, {
      taxSaved: Math.round(taxSaved),
      niSaved: Math.round(niSaved),
      totalSaved: Math.round(taxSaved + niSaved),
      newTakeHome: Math.round(newTakeHome),
      takeHomeChange: Math.round(newTakeHome - currentTakeHome),
    });
  }

  return results;
}

/**
 * Build scenario overrides that salary-sacrifice enough to bring income
 * below the £100k personal allowance taper threshold.
 */
export function buildAvoidTaperPreset(
  persons: Person[],
  income: PersonIncome[],
  contributions: Contribution[]
): ScenarioOverrides {
  const overrides: ScenarioOverrides = { income: [] };
  for (const person of persons) {
    const personIncome = income.find((i) => i.personId === person.id);
    if (!personIncome) continue;

    const adjustedGross =
      personIncome.pensionContributionMethod === "salary_sacrifice" || personIncome.pensionContributionMethod === "net_pay"
        ? personIncome.grossSalary - personIncome.employeePensionContribution
        : personIncome.grossSalary;

    if (adjustedGross > UK_TAX_CONSTANTS.personalAllowanceTaperThreshold && adjustedGross <= UK_TAX_CONSTANTS.incomeTax.higherRateUpperLimit) {
      const excess = adjustedGross - UK_TAX_CONSTANTS.personalAllowanceTaperThreshold;
      const contribs = getPersonContributionTotals(contributions, person.id);
      const pensionUsed = personIncome.employeePensionContribution + personIncome.employerPensionContribution + contribs.pensionContribution;
      const headroom = UK_TAX_CONSTANTS.pensionAnnualAllowance - pensionUsed;
      const additionalSacrifice = Math.min(excess, headroom);

      if (additionalSacrifice > 0) {
        overrides.income!.push({
          personId: person.id,
          grossSalary: personIncome.grossSalary,
          employeePensionContribution: personIncome.employeePensionContribution + additionalSacrifice,
          employerPensionContribution: personIncome.employerPensionContribution,
          pensionContributionMethod: personIncome.pensionContributionMethod,
        });
      }
    }
  }
  return overrides;
}

/**
 * FEAT-019: Generate a human-readable description of what a scenario changes.
 * Used in saved scenario lists so users can see what changed at a glance.
 */
export function generateScenarioDescription(
  overrides: ScenarioOverrides,
  household: HouseholdData
): string {
  const parts: string[] = [];

  // Income changes
  if (overrides.income) {
    for (const inc of overrides.income) {
      const person = household.persons.find((p) => p.id === inc.personId);
      const base = household.income.find((i) => i.personId === inc.personId);
      if (!person || !base) continue;

      if (inc.grossSalary !== undefined && inc.grossSalary !== base.grossSalary) {
        parts.push(`${person.name} salary: ${formatCurrencyCompact(base.grossSalary)} → ${formatCurrencyCompact(inc.grossSalary)}`);
      }
      if (inc.employeePensionContribution !== undefined && inc.employeePensionContribution !== base.employeePensionContribution) {
        parts.push(`${person.name} pension: ${formatCurrencyCompact(base.employeePensionContribution)} → ${formatCurrencyCompact(inc.employeePensionContribution)}`);
      }
    }
  }

  // Person overrides (retirement age)
  if (overrides.personOverrides) {
    for (const po of overrides.personOverrides) {
      const person = household.persons.find((p) => p.id === po.id);
      if (!person) continue;
      if (po.plannedRetirementAge !== undefined && po.plannedRetirementAge !== person.plannedRetirementAge) {
        parts.push(`${person.name} retires at ${po.plannedRetirementAge} (was ${person.plannedRetirementAge})`);
      }
    }
  }

  // Retirement target
  if (overrides.retirement?.targetAnnualIncome !== undefined) {
    parts.push(`Target income: ${formatCurrencyCompact(overrides.retirement.targetAnnualIncome)}/yr`);
  }

  // Market shock
  if (overrides.marketShockPercent !== undefined) {
    const pct = Math.round(overrides.marketShockPercent * 100);
    parts.push(`Market: ${pct >= 0 ? "+" : ""}${pct}%`);
  }

  // Contribution overrides
  if (overrides.contributionOverrides) {
    for (const co of overrides.contributionOverrides) {
      const person = household.persons.find((p) => p.id === co.personId);
      if (!person) continue;
      const items: string[] = [];
      if (co.isaContribution !== undefined) items.push(`ISA ${formatCurrencyCompact(co.isaContribution)}`);
      if (co.pensionContribution !== undefined) items.push(`Pension ${formatCurrencyCompact(co.pensionContribution)}`);
      if (co.giaContribution !== undefined) items.push(`GIA ${formatCurrencyCompact(co.giaContribution)}`);
      if (items.length > 0) parts.push(`${person.name} contributions: ${items.join(", ")}`);
    }
  }

  return parts.length > 0 ? parts.join(" · ") : "No changes";
}
