// ============================================================
// UK Inheritance Tax Calculations
// ============================================================
// Pure functions for IHT liability estimation.
// All thresholds sourced from UK_TAX_CONSTANTS.
//
// HMRC guidance: https://www.gov.uk/inheritance-tax

import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { roundPence } from "@/lib/format";

// --- Types ---

export interface IHTResult {
  /** Nil Rate Band after gift reduction */
  effectiveNRB: number;
  /** Residence Nil Rate Band after taper */
  effectiveRNRB: number;
  /** NRB + RNRB */
  combinedThreshold: number;
  /** Estate value minus combined threshold, floored at 0 */
  taxableAmount: number;
  /** IHT payable */
  ihtLiability: number;
  /** Amount by which RNRB is reduced due to taper */
  rnrbTaperReduction: number;
}

// --- Functions ---

/**
 * Calculate the effective Nil Rate Band after reducing by gifts
 * made within 7 years of death.
 *
 * Gifts within 7 years are set against the NRB first.
 * HMRC ref: IHT400 notes
 *
 * @param nilRateBandPerPerson - NRB per person (£325,000 for 2024/25)
 * @param numberOfPersons - 1 for individual, 2 for couple (transferable NRB)
 * @param giftsWithin7Years - Total value of PETs within the 7-year window
 */
export function calculateEffectiveNRB(
  nilRateBandPerPerson: number,
  numberOfPersons: number,
  giftsWithin7Years: number
): number {
  return Math.max(0, nilRateBandPerPerson * numberOfPersons - giftsWithin7Years);
}

/**
 * Calculate the RNRB taper reduction for estates over the taper threshold.
 *
 * HMRC rule: RNRB is reduced by £1 for every £2 the estate exceeds
 * the taper threshold (£2,000,000 for 2024/25).
 *
 * Uses Math.max(0, ...) to ensure non-negative and integer pounds via Math.floor
 * to match HMRC's "£1 for every £2" wording (whole pounds down).
 *
 * @param estateValue - Total value of the estate (in-estate assets)
 * @param taperThreshold - Threshold above which RNRB tapers (default from constants)
 */
export function calculateRnrbTaperReduction(
  estateValue: number,
  taperThreshold: number = UK_TAX_CONSTANTS.iht.rnrbTaperThreshold
): number {
  if (estateValue <= taperThreshold) return 0;
  return Math.floor((estateValue - taperThreshold) / 2);
}

/**
 * Calculate the effective RNRB after taper.
 *
 * @param rnrbPerPerson - RNRB per person (£175,000 for 2024/25, or 0 if not passing to descendants)
 * @param numberOfPersons - 1 for individual, 2 for couple
 * @param estateValue - Total value of the estate (in-estate assets)
 */
export function calculateEffectiveRNRB(
  rnrbPerPerson: number,
  numberOfPersons: number,
  estateValue: number
): number {
  const grossRnrb = rnrbPerPerson * numberOfPersons;
  const taperReduction = calculateRnrbTaperReduction(estateValue);
  return Math.max(0, grossRnrb - taperReduction);
}

/**
 * Calculate the full IHT position for an estate.
 *
 * @param estateValue - Total in-estate value (property + ISA + GIA + cash + premium bonds)
 * @param numberOfPersons - 1 for individual, 2 for couple
 * @param giftsWithin7Years - Total PETs within 7-year window
 * @param passingToDirectDescendants - Whether RNRB applies
 */
export function calculateIHT(
  estateValue: number,
  numberOfPersons: number,
  giftsWithin7Years: number,
  passingToDirectDescendants: boolean
): IHTResult {
  const iht = UK_TAX_CONSTANTS.iht;

  const effectiveNRB = calculateEffectiveNRB(
    iht.nilRateBand,
    numberOfPersons,
    giftsWithin7Years
  );

  const rnrbPerPerson = passingToDirectDescendants ? iht.residenceNilRateBand : 0;
  const rnrbTaperReduction = calculateRnrbTaperReduction(estateValue);
  const effectiveRNRB = calculateEffectiveRNRB(
    rnrbPerPerson,
    numberOfPersons,
    estateValue
  );

  const combinedThreshold = effectiveNRB + effectiveRNRB;
  const taxableAmount = Math.max(0, estateValue - combinedThreshold);
  const ihtLiability = roundPence(taxableAmount * iht.rate);

  return {
    effectiveNRB,
    effectiveRNRB,
    combinedThreshold,
    taxableAmount,
    ihtLiability,
    rnrbTaperReduction,
  };
}

/**
 * Calculate how many years until the estate exceeds the IHT threshold,
 * given annual savings flowing into the estate and investment growth.
 *
 * @param currentEstateValue - Current in-estate value
 * @param combinedThreshold - NRB + RNRB combined threshold
 * @param annualSavingsInEstate - Annual contributions to estate-exposed accounts
 * @param growthRate - Annual investment growth rate (decimal, e.g. 0.05). Defaults to 0.
 * @returns null if estate won't exceed threshold within 100 years, 0 if already exceeded, else years
 */
export function calculateYearsUntilIHTExceeded(
  currentEstateValue: number,
  combinedThreshold: number,
  annualSavingsInEstate: number,
  growthRate: number = 0
): number | null {
  if (currentEstateValue >= combinedThreshold) return 0;
  if (annualSavingsInEstate <= 0 && growthRate <= 0) return null;

  let estate = currentEstateValue;
  for (let year = 1; year <= 100; year++) {
    estate = estate * (1 + growthRate) + annualSavingsInEstate;
    if (estate >= combinedThreshold) return year;
  }
  return null;
}

/**
 * Calculate the number of years since a given date.
 * Uses 365.25 days per year to account for leap years.
 *
 * @param dateStr - ISO date string
 * @param now - Reference date (defaults to current date)
 */
export function yearsSince(dateStr: string, now: Date = new Date()): number {
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}
