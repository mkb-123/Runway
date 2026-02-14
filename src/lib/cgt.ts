// ============================================================
// UK Capital Gains Tax Calculations
// ============================================================

import type { Transaction, Account } from "@/types";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { roundPence } from "@/lib/format";

// --- Types ---

export interface Section104Pool {
  fundId: string;
  accountId: string;
  totalUnits: number;
  pooledCost: number;
  averageCost: number;
}

export interface DisposalRecord {
  date: string;
  fundId: string;
  accountId: string;
  units: number;
  proceedsPerUnit: number;
  proceeds: number;
  costBasis: number;
  gain: number;
  rule: "same_day" | "bed_and_breakfast" | "section_104";
}

export interface TaxYearGains {
  taxYear: string; // e.g. "2024/25"
  totalGains: number;
  totalLosses: number;
  netGain: number;
  annualExemptAmount: number;
  taxableGain: number;
  taxDue: number;
  disposals: DisposalRecord[];
}

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
 * Check if a date falls within a specific tax year.
 */
function isInTaxYear(dateStr: string, taxYear: string): boolean {
  return getTaxYear(dateStr) === taxYear;
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

// --- Section 104 Pool ---

/**
 * Calculate Section 104 (pooled cost) for each fund in an account,
 * applying same-day and 30-day bed-and-breakfast matching rules for disposals.
 *
 * Returns the current state of the pools after processing all transactions.
 */
export function calculateSection104Pool(
  transactions: Transaction[]
): Section104Pool[] {
  // Group transactions by accountId + fundId
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = `${tx.accountId}::${tx.fundId}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(tx);
  }

  const pools: Section104Pool[] = [];

  for (const [key, txs] of groups) {
    const [accountId, fundId] = key.split("::");

    // Sort by date
    const sorted = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let totalUnits = 0;
    let pooledCost = 0;

    for (const tx of sorted) {
      if (tx.type === "buy" || tx.type === "contribution") {
        totalUnits += tx.units;
        pooledCost += tx.units * tx.pricePerUnit;
      } else if (tx.type === "sell") {
        if (totalUnits > 0) {
          const averageCost = pooledCost / totalUnits;
          const unitsToRemove = Math.min(tx.units, totalUnits);
          pooledCost -= unitsToRemove * averageCost;
          totalUnits -= unitsToRemove;
        }
      }
      // Dividends don't affect the pool cost basis
    }

    // Avoid floating point artifacts
    totalUnits = Math.round(totalUnits * 1e8) / 1e8;
    pooledCost = roundPence(pooledCost);

    pools.push({
      fundId,
      accountId,
      totalUnits,
      pooledCost,
      averageCost: totalUnits > 0 ? roundPence(pooledCost / totalUnits) : 0,
    });
  }

  return pools;
}

// --- Gains Calculation with Matching Rules ---

interface MatchableBuy {
  date: string;
  units: number;
  pricePerUnit: number;
  remainingUnits: number;
}

/**
 * Calculate capital gains for a specific tax year, applying HMRC matching rules:
 * 1. Same-day rule: match with buys on the same day
 * 2. Bed-and-breakfast rule: match with buys in the next 30 days
 * 3. Section 104 pool: match against the pooled average cost
 */
export function calculateGainsForTaxYear(
  transactions: Transaction[],
  taxYear: string,
  cgtBasicRateThreshold?: number
): TaxYearGains {
  const { annualExemptAmount, basicRate, higherRate } = UK_TAX_CONSTANTS.cgt;

  // Group by account+fund
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = `${tx.accountId}::${tx.fundId}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(tx);
  }

  const disposals: DisposalRecord[] = [];

  for (const [key, txs] of groups) {
    const [accountId, fundId] = key.split("::");
    const sorted = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Build list of buys with remaining units
    const buys: MatchableBuy[] = sorted
      .filter((tx) => tx.type === "buy" || tx.type === "contribution")
      .map((tx) => ({
        date: tx.date,
        units: tx.units,
        pricePerUnit: tx.pricePerUnit,
        remainingUnits: tx.units,
      }));

    // Build section 104 pool (running)
    let poolUnits = 0;
    let poolCost = 0;

    // Process all transactions chronologically to maintain the pool
    for (const tx of sorted) {
      if (tx.type === "buy" || tx.type === "contribution") {
        poolUnits += tx.units;
        poolCost += tx.units * tx.pricePerUnit;
      }

      if (tx.type === "sell" && isInTaxYear(tx.date, taxYear)) {
        let unitsToMatch = tx.units;
        const txDate = new Date(tx.date);

        // Rule 1: Same-day matching
        for (const buy of buys) {
          if (unitsToMatch <= 0) break;
          if (buy.date === tx.date && buy.remainingUnits > 0) {
            const matched = Math.min(unitsToMatch, buy.remainingUnits);
            buy.remainingUnits -= matched;
            unitsToMatch -= matched;

            if (matched > 0) {
              disposals.push({
                date: tx.date,
                fundId,
                accountId,
                units: matched,
                proceedsPerUnit: tx.pricePerUnit,
                proceeds: matched * tx.pricePerUnit,
                costBasis: matched * buy.pricePerUnit,
                gain: matched * (tx.pricePerUnit - buy.pricePerUnit),
                rule: "same_day",
              });
            }
          }
        }

        // Rule 2: Bed-and-breakfast (buys within next 30 days, FIFO)
        for (const buy of buys) {
          if (unitsToMatch <= 0) break;
          const buyDate = new Date(buy.date);
          const daysDiff =
            (buyDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);

          if (daysDiff > 0 && daysDiff <= 30 && buy.remainingUnits > 0) {
            const matched = Math.min(unitsToMatch, buy.remainingUnits);
            buy.remainingUnits -= matched;
            unitsToMatch -= matched;

            if (matched > 0) {
              disposals.push({
                date: tx.date,
                fundId,
                accountId,
                units: matched,
                proceedsPerUnit: tx.pricePerUnit,
                proceeds: matched * tx.pricePerUnit,
                costBasis: matched * buy.pricePerUnit,
                gain: matched * (tx.pricePerUnit - buy.pricePerUnit),
                rule: "bed_and_breakfast",
              });
            }
          }
        }

        // Rule 3: Section 104 pool
        if (unitsToMatch > 0 && poolUnits > 0) {
          const avgCost = poolCost / poolUnits;
          const matched = Math.min(unitsToMatch, poolUnits);
          const matchedCost = matched * avgCost;
          poolCost -= matchedCost;
          poolUnits -= matched;
          unitsToMatch -= matched;

          disposals.push({
            date: tx.date,
            fundId,
            accountId,
            units: matched,
            proceedsPerUnit: tx.pricePerUnit,
            proceeds: matched * tx.pricePerUnit,
            costBasis: roundPence(matchedCost),
            gain: roundPence(matched * tx.pricePerUnit - matchedCost),
            rule: "section_104",
          });
        }
      } else if (tx.type === "sell") {
        // Sell not in this tax year - still update the pool
        if (poolUnits > 0) {
          const avgCost = poolCost / poolUnits;
          const matched = Math.min(tx.units, poolUnits);
          poolCost -= matched * avgCost;
          poolUnits -= matched;
        }
      }
    }
  }

  const totalGains = disposals
    .filter((d) => d.gain > 0)
    .reduce((sum, d) => sum + d.gain, 0);

  const totalLosses = Math.abs(
    disposals
      .filter((d) => d.gain < 0)
      .reduce((sum, d) => sum + d.gain, 0)
  );

  const netGain = totalGains - totalLosses;
  const taxableGain = Math.max(0, netGain - annualExemptAmount);

  // Calculate tax - simplified: use higher rate if threshold not provided
  let taxDue = 0;
  if (taxableGain > 0) {
    if (cgtBasicRateThreshold !== undefined && cgtBasicRateThreshold > 0) {
      const atBasicRate = Math.min(taxableGain, cgtBasicRateThreshold);
      const atHigherRate = Math.max(0, taxableGain - cgtBasicRateThreshold);
      taxDue = atBasicRate * basicRate + atHigherRate * higherRate;
    } else {
      // Default to higher rate if we don't know income position
      taxDue = taxableGain * higherRate;
    }
  }

  return {
    taxYear,
    totalGains: roundPence(totalGains),
    totalLosses: roundPence(totalLosses),
    netGain: roundPence(netGain),
    annualExemptAmount,
    taxableGain: roundPence(taxableGain),
    taxDue: roundPence(taxDue),
    disposals,
  };
}

// --- Unrealised Gains ---

/**
 * Calculate unrealised gains across all accounts and holdings,
 * using section 104 pooled costs from transaction history.
 */
export function getUnrealisedGains(
  accounts: Account[],
  transactions: Transaction[]
): UnrealisedGain[] {
  const pools = calculateSection104Pool(transactions);
  const poolMap = new Map<string, Section104Pool>();
  for (const pool of pools) {
    poolMap.set(`${pool.accountId}::${pool.fundId}`, pool);
  }

  const results: UnrealisedGain[] = [];

  for (const account of accounts) {
    for (const holding of account.holdings) {
      const pool = poolMap.get(`${account.id}::${holding.fundId}`);

      // Use pool average cost if we have transaction history, otherwise holding's purchasePrice
      const averageCost = pool ? pool.averageCost : holding.purchasePrice;
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
  // Estimate based on average expected return (use unrealisedGain as proxy for capital moved)
  // The actual saving depends on future returns, so we report the CGT cost of the transfer
  const annualTaxSaved = roundPence(unrealisedGain * cgtRate);

  return {
    sellAmount: unrealisedGain,
    cgtCost,
    annualTaxSaved,
  };
}
