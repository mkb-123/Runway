// ============================================================
// Data Migration — Transforms old localStorage schemas to current
// ============================================================
// When the HouseholdData schema evolves, users with old data in
// localStorage would fail Zod validation and lose their data.
// This module applies forward migrations before validation.

/**
 * Legacy contribution format (pre-contributions overhaul).
 * Old data stored per-person annual totals instead of individual
 * contribution items.
 */
interface LegacyAnnualContribution {
  personId: string;
  isaContribution?: number;
  pensionContribution?: number;
  giaContribution?: number;
}

/**
 * Migrate raw localStorage JSON to the current HouseholdData shape.
 *
 * Applies each migration in sequence. Migrations are idempotent —
 * running them on already-migrated data is a no-op.
 *
 * @param raw - Parsed JSON from localStorage (unknown shape)
 * @returns Transformed object ready for Zod validation
 */
export function migrateHouseholdData(raw: Record<string, unknown>): Record<string, unknown> {
  let data = { ...raw };
  data = migrateAnnualContributions(data);
  data = migrateEstimatedAnnualExpenses(data);
  data = migrateMonthlyLifestyleSpending(data);
  data = migrateCommittedOutgoingsDefault(data);
  data = migrateDashboardConfigDefault(data);
  data = migratePersonDefaults(data);
  data = migrateDeferredBonusSimplified(data);
  data = migrateChildrenDefault(data);
  data = migrateBonusTotalModel(data);
  return data;
}

/**
 * Migration 1: annualContributions → contributions
 *
 * Old format:
 *   annualContributions: [{ personId, isaContribution, pensionContribution, giaContribution }]
 *
 * New format:
 *   contributions: [{ id, personId, label, target, amount, frequency }]
 */
function migrateAnnualContributions(data: Record<string, unknown>): Record<string, unknown> {
  // Already migrated — has contributions array
  if (Array.isArray(data.contributions)) return data;

  const legacy = data.annualContributions;
  if (!Array.isArray(legacy)) {
    // Neither old nor new format — set empty contributions
    return { ...data, contributions: [] };
  }

  const contributions: Record<string, unknown>[] = [];
  let counter = 0;

  for (const item of legacy as LegacyAnnualContribution[]) {
    if (!item.personId) continue;

    if (item.isaContribution && item.isaContribution > 0) {
      contributions.push({
        id: `migrated-isa-${item.personId}-${counter++}`,
        personId: item.personId,
        label: "ISA (migrated)",
        target: "isa",
        amount: item.isaContribution,
        frequency: "annually",
      });
    }

    if (item.pensionContribution && item.pensionContribution > 0) {
      contributions.push({
        id: `migrated-pension-${item.personId}-${counter++}`,
        personId: item.personId,
        label: "Pension (migrated)",
        target: "pension",
        amount: item.pensionContribution,
        frequency: "annually",
      });
    }

    if (item.giaContribution && item.giaContribution > 0) {
      contributions.push({
        id: `migrated-gia-${item.personId}-${counter++}`,
        personId: item.personId,
        label: "GIA (migrated)",
        target: "gia",
        amount: item.giaContribution,
        frequency: "annually",
      });
    }
  }

  const result = { ...data, contributions };
  delete (result as Record<string, unknown>).annualContributions;
  return result;
}

/**
 * Migration 2: Remove estimatedAnnualExpenses
 *
 * Old format had estimatedAnnualExpenses as a top-level number.
 * This was replaced by committedOutgoings + monthlyLifestyleSpending.
 * We convert it to monthlyLifestyleSpending if no lifestyle spending
 * is already set.
 */
function migrateEstimatedAnnualExpenses(data: Record<string, unknown>): Record<string, unknown> {
  const legacy = data.estimatedAnnualExpenses;
  if (typeof legacy !== "number" || legacy <= 0) return data;

  // Convert annual expenses to monthly lifestyle spending
  // if the emergencyFund doesn't already have it set
  const ef = data.emergencyFund as Record<string, unknown> | undefined;
  const hasLifestyle = ef && typeof ef.monthlyLifestyleSpending === "number" && ef.monthlyLifestyleSpending > 0;

  const result = { ...data };
  if (!hasLifestyle && ef) {
    // Rough heuristic: subtract committed outgoings from total expenses
    // to get lifestyle-only spending
    const committedAnnual = estimateCommittedAnnual(data.committedOutgoings);
    const lifestyleAnnual = Math.max(0, legacy - committedAnnual);
    result.emergencyFund = { ...ef, monthlyLifestyleSpending: Math.round(lifestyleAnnual / 12) };
  }

  delete (result as Record<string, unknown>).estimatedAnnualExpenses;
  return result;
}

/**
 * Migration 3: Ensure monthlyLifestyleSpending exists in emergencyFund
 */
function migrateMonthlyLifestyleSpending(data: Record<string, unknown>): Record<string, unknown> {
  const ef = data.emergencyFund as Record<string, unknown> | undefined;
  if (!ef) return data;
  if (typeof ef.monthlyLifestyleSpending === "number") return data;

  return {
    ...data,
    emergencyFund: { ...ef, monthlyLifestyleSpending: 0 },
  };
}

/**
 * Migration 4: Ensure committedOutgoings array exists
 */
function migrateCommittedOutgoingsDefault(data: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(data.committedOutgoings)) return data;
  return { ...data, committedOutgoings: [] };
}

/**
 * Migration 5: Ensure dashboardConfig exists
 */
function migrateDashboardConfigDefault(data: Record<string, unknown>): Record<string, unknown> {
  if (data.dashboardConfig && typeof data.dashboardConfig === "object") return data;
  return {
    ...data,
    dashboardConfig: { heroMetrics: ["net_worth", "cash_position", "retirement_countdown"] },
  };
}

/**
 * Migration 6: Add default values for person fields added over time.
 * Handles: plannedRetirementAge, niQualifyingYears, studentLoanPlan,
 *          pensionAccessAge, stateRetirementAge.
 * All checks are idempotent — already-set values are preserved.
 */
function migratePersonDefaults(data: Record<string, unknown>): Record<string, unknown> {
  const persons = data.persons;
  if (!Array.isArray(persons)) return data;

  const updated = persons.map((p: unknown) => {
    if (typeof p !== "object" || p === null) return p;
    const person = p as Record<string, unknown>;
    const result = { ...person };

    if (typeof result.plannedRetirementAge !== "number") {
      result.plannedRetirementAge = 60;
    }

    if (typeof result.niQualifyingYears !== "number") {
      result.niQualifyingYears = 35;
    }

    if (typeof result.studentLoanPlan !== "string") {
      result.studentLoanPlan = "none";
    }

    // pensionAccessAge and stateRetirementAge were added later — back-fill UK defaults
    if (typeof result.pensionAccessAge !== "number") {
      result.pensionAccessAge = 57;
    }

    if (typeof result.stateRetirementAge !== "number") {
      result.stateRetirementAge = 67;
    }

    return result;
  });

  return { ...data, persons: updated };
}

/**
 * Migration 7: Convert old deferredTranches[] to simplified deferred bonus model
 *
 * Old format:
 *   bonusStructures[].deferredTranches: [{ grantDate, vestingDate, amount, estimatedAnnualReturn }]
 *
 * New format:
 *   bonusStructures[]: { deferredBonusAnnual, vestingYears, estimatedAnnualReturn }
 */
function migrateDeferredBonusSimplified(data: Record<string, unknown>): Record<string, unknown> {
  const bonusStructures = data.bonusStructures;
  if (!Array.isArray(bonusStructures)) return data;

  const updated = bonusStructures.map((bs: unknown) => {
    if (typeof bs !== "object" || bs === null) return bs;
    const bonus = bs as Record<string, unknown>;

    // Already migrated — has new fields
    if (typeof bonus.deferredBonusAnnual === "number") return bonus;

    // Migrate from old deferredTranches format
    const tranches = bonus.deferredTranches;
    if (!Array.isArray(tranches) || tranches.length === 0) {
      const result: Record<string, unknown> = { ...bonus, deferredBonusAnnual: 0, vestingYears: 3, estimatedAnnualReturn: 0.08 };
      delete result.deferredTranches;
      return result;
    }

    // Sum up tranche amounts to get total deferred bonus
    const totalAmount = tranches.reduce((sum: number, t: unknown) => {
      if (typeof t !== "object" || t === null) return sum;
      const amount = (t as Record<string, unknown>).amount;
      return sum + (typeof amount === "number" ? amount : 0);
    }, 0);

    // Vesting years = number of tranches
    const vestingYears = tranches.length;

    // Use the return rate from the first tranche
    const firstTranche = tranches[0] as Record<string, unknown>;
    const estimatedAnnualReturn = typeof firstTranche.estimatedAnnualReturn === "number"
      ? firstTranche.estimatedAnnualReturn
      : 0.08;

    const result: Record<string, unknown> = { ...bonus, deferredBonusAnnual: totalAmount, vestingYears, estimatedAnnualReturn };
    delete result.deferredTranches;
    return result;
  });

  return { ...data, bonusStructures: updated };
}

/**
 * Migration 8: Ensure children array exists
 */
function migrateChildrenDefault(data: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(data.children)) return data;
  return { ...data, children: [] };
}

// --- Helpers ---

function estimateCommittedAnnual(outgoings: unknown): number {
  if (!Array.isArray(outgoings)) return 0;
  let total = 0;
  for (const o of outgoings) {
    if (typeof o !== "object" || o === null) continue;
    const amount = (o as Record<string, unknown>).amount;
    const frequency = (o as Record<string, unknown>).frequency;
    if (typeof amount !== "number") continue;
    switch (frequency) {
      case "monthly":
        total += amount * 12;
        break;
      case "termly":
        total += amount * 3;
        break;
      case "annually":
        total += amount;
        break;
    }
  }
  return total;
}

/**
 * Migration 9: Convert deferredBonusAnnual → totalBonusAnnual model
 *
 * Old: { cashBonusAnnual, deferredBonusAnnual }
 * New: { totalBonusAnnual, cashBonusAnnual, vestingGapYears }
 *
 * totalBonusAnnual = cashBonusAnnual + deferredBonusAnnual
 * vestingGapYears defaults to 0 (preserving old behaviour)
 */
function migrateBonusTotalModel(data: Record<string, unknown>): Record<string, unknown> {
  const bonusStructures = data.bonusStructures;
  if (!Array.isArray(bonusStructures)) return data;

  const updated = bonusStructures.map((bs: unknown) => {
    if (typeof bs !== "object" || bs === null) return bs;
    const bonus = bs as Record<string, unknown>;

    // Already migrated — has totalBonusAnnual
    if (typeof bonus.totalBonusAnnual === "number") return bonus;

    const cash = typeof bonus.cashBonusAnnual === "number" ? bonus.cashBonusAnnual : 0;
    const deferred = typeof bonus.deferredBonusAnnual === "number" ? bonus.deferredBonusAnnual : 0;

    const result: Record<string, unknown> = {
      ...bonus,
      totalBonusAnnual: cash + deferred,
      vestingGapYears: 0,
    };
    delete result.deferredBonusAnnual;
    return result;
  });

  return { ...data, bonusStructures: updated };
}
