// ============================================================
// Deferred Bonus — Tranche Generation
// ============================================================
// Generates DeferredBonusTranche[] from the bonus structure.
// The deferred amount is derived: totalBonusAnnual - cashBonusAnnual.
// Tranches vest in January each year after a configurable gap.

import type { BonusStructure, DeferredBonusTranche } from "@/types";
import { getDeferredBonus } from "@/types";

/**
 * Generate deferred bonus tranches from the bonus structure.
 *
 * The deferred amount (totalBonusAnnual - cashBonusAnnual) vests equally
 * over `vestingYears` tranches, starting after `vestingGapYears`.
 *
 * Example: £270,000 over 3 years with 1-year gap, granted in 2025 →
 *   - £90,000 vests Jan 2027 (gap=1, then year 1 of 3)
 *   - £90,000 vests Jan 2028
 *   - £90,000 vests Jan 2029
 *
 * @param bonus - Bonus structure
 * @param referenceDate - Optional reference date for grant (defaults to today)
 */
export function generateDeferredTranches(
  bonus: BonusStructure,
  referenceDate: Date = new Date()
): DeferredBonusTranche[] {
  const deferredAmount = getDeferredBonus(bonus);
  if (deferredAmount <= 0 || bonus.vestingYears <= 0) return [];

  const amountPerTranche = deferredAmount / bonus.vestingYears;
  const grantYear = referenceDate.getFullYear();
  const grantDate = `${grantYear}-01-01`;
  const gap = bonus.vestingGapYears ?? 0;

  const tranches: DeferredBonusTranche[] = [];
  for (let i = 1; i <= bonus.vestingYears; i++) {
    // Vest in January: after gap + i years from grant
    const vestYear = grantYear + gap + i;
    const vestDate = `${vestYear}-01-01`;
    tranches.push({
      grantDate,
      vestingDate: vestDate,
      amount: amountPerTranche,
      estimatedAnnualReturn: bonus.estimatedAnnualReturn,
    });
  }

  return tranches;
}

/**
 * Calculate the total projected value of all deferred tranches at vesting.
 *
 * @param bonus - Bonus structure
 * @param referenceDate - Optional reference date for grant
 */
export function totalProjectedDeferredValue(
  bonus: BonusStructure,
  referenceDate: Date = new Date()
): number {
  const tranches = generateDeferredTranches(bonus, referenceDate);
  return tranches.reduce((sum, tranche) => {
    const grant = new Date(tranche.grantDate);
    const vest = new Date(tranche.vestingDate);
    const years = (vest.getTime() - grant.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (years <= 0) return sum + tranche.amount;
    return sum + tranche.amount * Math.pow(1 + tranche.estimatedAnnualReturn, years);
  }, 0);
}
