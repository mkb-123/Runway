// ============================================================
// UK Capital Gains Tax Calculations
// ============================================================

import type { Account } from "@/types";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { roundPence } from "@/lib/format";

// --- Types ---

export interface UnrealisedGain {
  accountId: string;
  fundId: string;
  unrealisedGain: number;
  units: number;
  averageCost: number;
  currentPrice: number;
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
 * Calculate unrealised gains across all accounts and holdings,
 * using each holding's purchase price as the cost basis.
 */
export function getUnrealisedGains(
  accounts: Account[]
): UnrealisedGain[] {
  const results: UnrealisedGain[] = [];

  for (const account of accounts) {
    for (const holding of account.holdings) {
      const averageCost = holding.purchasePrice;
      const units = holding.units;
      const currentPrice = holding.currentPrice;
      const unrealisedGain = units * (currentPrice - averageCost);

      results.push({
        accountId: account.id,
        fundId: holding.fundId,
        unrealisedGain: roundPence(unrealisedGain),
        units,
        averageCost: roundPence(averageCost),
        currentPrice,
      });
    }
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
 *
 * @param grossIncome - Gross employment income
 * @param pensionContribution - Employee pension contribution
 * @param pensionMethod - "salary_sacrifice" | "net_pay" | "relief_at_source"
 * @returns The applicable CGT rate (0.18 or 0.24 for 2024/25)
 */
export function determineCgtRate(
  grossIncome: number,
  pensionContribution: number = 0,
  pensionMethod: string = "relief_at_source"
): number {
  // Salary sacrifice and net pay reduce income before tax
  const taxableIncome =
    pensionMethod === "salary_sacrifice" || pensionMethod === "net_pay"
      ? grossIncome - pensionContribution
      : grossIncome;

  return taxableIncome > UK_TAX_CONSTANTS.incomeTax.basicRateUpperLimit
    ? UK_TAX_CONSTANTS.cgt.higherRate
    : UK_TAX_CONSTANTS.cgt.basicRate;
}

/**
 * Calculate the Bed & ISA break-even period: how many years until
 * the CGT cost of transferring is recouped by ISA tax savings on future gains.
 *
 * @param cgtCost - Upfront CGT cost of the Bed & ISA transfer
 * @param giaValue - Current GIA value being transferred
 * @param cgtRate - Applicable CGT rate
 * @param assumedReturn - Assumed annual return rate (default 0.07 = 7%)
 * @returns Break-even in years (rounded to 1 decimal), or 0 if no cost
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
 * Calculate the benefit of a Bed and ISA strategy:
 * Sell holdings in a GIA, crystallise the gain using CGT allowance,
 * and re-purchase within an ISA to shield future growth from tax.
 *
 * @param unrealisedGain - The unrealised gain on the holding to transfer
 * @param cgtAllowanceRemaining - How much of the annual exempt amount is unused
 * @param cgtRate - The CGT rate applicable (basic or higher)
 * @returns The cost of CGT and the annual tax saved on future gains
 */
export function calculateBedAndISA(
  unrealisedGain: number,
  cgtAllowanceRemaining: number,
  cgtRate: number
): BedAndISAResult {
  // Taxable gain after applying remaining allowance
  const taxableGain = Math.max(0, unrealisedGain - cgtAllowanceRemaining);
  const cgtCost = roundPence(taxableGain * cgtRate);

  // Annual tax saved: future gains on this amount would be tax-free in ISA
  const annualTaxSaved = roundPence(unrealisedGain * cgtRate);

  return {
    sellAmount: unrealisedGain,
    cgtCost,
    annualTaxSaved,
  };
}
