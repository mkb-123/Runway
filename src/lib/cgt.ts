// ============================================================
// UK Capital Gains Tax Calculations
// ============================================================

import type { Account } from "@/types";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { roundPence } from "@/lib/format";

// --- Types ---

export interface UnrealisedGain {
  accountId: string;
  unrealisedGain: number;
  currentValue: number;
  costBasis: number;
}

export interface BedAndISAResult {
  sellAmount: number;
  cgtCost: number;
  annualTaxSaved: number;
}

// --- Helpers ---

/**
 * Determine the UK tax year for a given date.
 * Tax year runs 6 April to 5 April.
 * e.g. 2024-04-06 to 2025-04-05 = "2024/25"
 */
export function getTaxYear(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();

  // Before 6 April -> previous tax year
  if (month < 4 || (month === 4 && day < 6)) {
    return `${year - 1}/${String(year).slice(2)}`;
  }
  return `${year}/${String(year + 1).slice(2)}`;
}

/**
 * Parse tax year string to start/end dates.
 * "2024/25" -> { start: "2024-04-06", end: "2025-04-05" }
 */
export function parseTaxYearDates(taxYear: string): { start: string; end: string } {
  const startYear = parseInt(taxYear.split("/")[0], 10);
  return {
    start: `${startYear}-04-06`,
    end: `${startYear + 1}-04-05`,
  };
}

// --- Unrealised Gains ---

/**
 * Estimate unrealised gains across accounts using the optional costBasis field.
 * If an account has no costBasis, it is skipped (gain cannot be estimated).
 */
export function getUnrealisedGains(
  accounts: Account[]
): UnrealisedGain[] {
  const results: UnrealisedGain[] = [];

  for (const account of accounts) {
    if (account.costBasis == null) continue;

    const unrealisedGain = account.currentValue - account.costBasis;

    results.push({
      accountId: account.id,
      unrealisedGain: roundPence(unrealisedGain),
      currentValue: account.currentValue,
      costBasis: roundPence(account.costBasis),
    });
  }

  return results;
}

// --- CGT Rate Determination ---

/**
 * Determine the applicable CGT rate based on taxable income.
 *
 * CGT rate depends on total taxable income (after pension deductions for
 * salary sacrifice / net pay). If taxable income falls within the basic rate
 * band, the basic CGT rate applies; otherwise the higher rate.
 *
 * HMRC ref: https://www.gov.uk/capital-gains-tax/rates
 */
export function determineCgtRate(
  grossIncome: number,
  pensionContribution: number = 0,
  pensionMethod: string = "relief_at_source"
): number {
  const taxableIncome =
    pensionMethod === "salary_sacrifice" || pensionMethod === "net_pay"
      ? grossIncome - pensionContribution
      : grossIncome;

  return taxableIncome > UK_TAX_CONSTANTS.incomeTax.basicRateUpperLimit
    ? UK_TAX_CONSTANTS.cgt.higherRate
    : UK_TAX_CONSTANTS.cgt.basicRate;
}

/**
 * Calculate the Bed & ISA break-even period.
 */
export function calculateBedAndISABreakEven(
  cgtCost: number,
  giaValue: number,
  cgtRate: number,
  assumedReturn: number = 0.07
): number {
  if (cgtCost <= 0) return 0;
  const annualFutureTaxSaved = giaValue * assumedReturn * cgtRate;
  if (annualFutureTaxSaved <= 0) return 0;
  return Math.ceil((cgtCost / annualFutureTaxSaved) * 10) / 10;
}

// --- Bed and ISA ---

/**
 * Calculate the benefit of a Bed and ISA strategy.
 */
export function calculateBedAndISA(
  unrealisedGain: number,
  cgtAllowanceRemaining: number,
  cgtRate: number
): BedAndISAResult {
  const taxableGain = Math.max(0, unrealisedGain - cgtAllowanceRemaining);
  const cgtCost = roundPence(taxableGain * cgtRate);
  const annualTaxSaved = roundPence(unrealisedGain * cgtRate);

  return {
    sellAmount: unrealisedGain,
    cgtCost,
    annualTaxSaved,
  };
}
