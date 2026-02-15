// ============================================================
// Deferred Bonus — Tranche Generation
// ============================================================
// Generates DeferredBonusTranche[] from the simplified bonus
// structure (annual amount + vesting years). Tranches vest in
// January each year, starting from the next January after grant.

import type { BonusStructure, DeferredBonusTranche } from "@/types";

/**
 * Generate deferred bonus tranches from the simplified parameters.
 *
 * Given a total annual deferred bonus and vesting period, creates
 * equal tranches vesting in January each year.
 *
 * Example: £45,000 over 3 years, granted in 2025 →
 *   - £15,000 vests Jan 2026
 *   - £15,000 vests Jan 2027
 *   - £15,000 vests Jan 2028
 *
 * @param bonus - Bonus structure with simplified fields
 * @param referenceDate - Optional reference date for grant (defaults to today)
 */
export function generateDeferredTranches(
  bonus: BonusStructure,
  referenceDate: Date = new Date()
): DeferredBonusTranche[] {
  if (bonus.deferredBonusAnnual <= 0 || bonus.vestingYears <= 0) return [];

  const amountPerTranche = bonus.deferredBonusAnnual / bonus.vestingYears;
  const grantYear = referenceDate.getFullYear();
  const grantDate = `${grantYear}-01-01`;

  const tranches: DeferredBonusTranche[] = [];
  for (let i = 1; i <= bonus.vestingYears; i++) {
    // Vest in January each year, starting from the next year
    const vestYear = grantYear + i;
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
 * @param bonus - Bonus structure with simplified fields
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
