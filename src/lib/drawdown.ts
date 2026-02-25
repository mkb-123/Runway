// ============================================================
// Tax-Optimal Drawdown Sequencing
// ============================================================
// Models the tax-efficient order for retirement withdrawals:
//   1. GIA first — use annual CGT allowance, then pay CGT on excess
//   2. ISA/Cash — fully tax-free withdrawals
//   3. Pension — 25% tax-free (PCLS), 75% taxed as income
//
// This produces a year-by-year drawdown plan that minimises
// lifetime tax drag compared to proportional drawdown.

import { calculateIncomeTax } from "@/lib/tax";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";

// --- Types ---

export type DrawdownStrategy = "proportional" | "tax_optimal";

export interface AccountPot {
  /** Wrapper type determines tax treatment */
  type: "pension" | "isa" | "gia" | "cash";
  /** Current balance */
  balance: number;
}

export interface DrawdownYearResult {
  age: number;
  /** Amount drawn from each wrapper */
  pensionDrawn: number;
  isaDrawn: number;
  giaDrawn: number;
  cashDrawn: number;
  /** Net income received after tax */
  netIncome: number;
  /** Tax paid on withdrawals */
  taxPaid: number;
  /** Remaining balances after drawdown + growth */
  pensionRemaining: number;
  isaRemaining: number;
  giaRemaining: number;
  cashRemaining: number;
}

export interface DrawdownPlan {
  years: DrawdownYearResult[];
  /** Total tax paid across all years */
  totalTaxPaid: number;
  /** Total net income received */
  totalNetIncome: number;
  /** Year pots are exhausted (or null if they last) */
  exhaustionAge: number | null;
}

// --- Tax helpers ---

/**
 * Calculate net income from a gross pension withdrawal.
 * 25% is tax-free (PCLS), 75% is taxed as income.
 */
function netPensionWithdrawal(
  grossAmount: number,
  otherTaxableIncome: number
): { net: number; tax: number } {
  if (grossAmount <= 0) return { net: 0, tax: 0 };

  const taxFree = grossAmount * 0.25;
  const taxable = grossAmount * 0.75;

  const totalTaxableIncome = otherTaxableIncome + taxable;
  const taxOnTotal = calculateIncomeTax(totalTaxableIncome).tax;
  const taxOnOther = calculateIncomeTax(otherTaxableIncome).tax;
  const marginalTax = taxOnTotal - taxOnOther;

  return { net: taxFree + taxable - marginalTax, tax: marginalTax };
}

/**
 * Calculate net income from a GIA withdrawal.
 * Assumes gains are proportional to balance (simplified).
 * Uses annual CGT exemption, then basic/higher rate CGT.
 */
function netGIAWithdrawal(
  amount: number,
  grossIncome: number
): { net: number; tax: number } {
  if (amount <= 0) return { net: 0, tax: 0 };

  // Simplified: assume 50% of withdrawal is gain (rest is cost basis)
  const gain = amount * 0.5;
  const exemption = UK_TAX_CONSTANTS.cgt.annualExemptAmount;
  const taxableGain = Math.max(0, gain - exemption);

  if (taxableGain <= 0) return { net: amount, tax: 0 };

  // CGT rate depends on income tax band
  const basicLimit = UK_TAX_CONSTANTS.incomeTax.basicRateUpperLimit;
  const rate = grossIncome > basicLimit
    ? UK_TAX_CONSTANTS.cgt.higherRate
    : UK_TAX_CONSTANTS.cgt.basicRate;

  const tax = taxableGain * rate;
  return { net: amount - tax, tax };
}

// --- Main function ---

/**
 * Generate a tax-optimal drawdown plan.
 *
 * @param pots - Current balances by wrapper type
 * @param annualNeed - Gross annual spending requirement
 * @param statePensionAnnual - Annual state pension (taxable income)
 * @param statePensionStartAge - Age state pension begins
 * @param startAge - Age drawdown begins (pension access age)
 * @param endAge - Age to project to (default 95)
 * @param growthRate - Annual investment growth rate
 * @param strategy - "tax_optimal" or "proportional"
 */
export function generateDrawdownPlan(
  pots: AccountPot[],
  annualNeed: number,
  statePensionAnnual: number,
  statePensionStartAge: number,
  startAge: number,
  endAge: number = 95,
  growthRate: number = 0.04,
  strategy: DrawdownStrategy = "tax_optimal"
): DrawdownPlan {
  // Mutable balances
  let pension = pots.find(p => p.type === "pension")?.balance ?? 0;
  let isa = pots.find(p => p.type === "isa")?.balance ?? 0;
  let gia = pots.find(p => p.type === "gia")?.balance ?? 0;
  let cash = pots.find(p => p.type === "cash")?.balance ?? 0;

  const years: DrawdownYearResult[] = [];
  let totalTaxPaid = 0;
  let totalNetIncome = 0;
  let exhaustionAge: number | null = null;

  for (let age = startAge; age <= endAge; age++) {
    const hasStatePension = age >= statePensionStartAge;
    const statePension = hasStatePension ? statePensionAnnual : 0;
    const netNeed = Math.max(0, annualNeed - statePension);

    let pensionDrawn = 0;
    let isaDrawn = 0;
    let giaDrawn = 0;
    let cashDrawn = 0;
    let yearTax = 0;

    if (strategy === "tax_optimal") {
      let remaining = netNeed;

      // Step 1: Draw from GIA first (use CGT exemption)
      if (remaining > 0 && gia > 0) {
        const draw = Math.min(remaining, gia);
        const { net, tax } = netGIAWithdrawal(draw, statePension);
        giaDrawn = draw;
        gia -= draw;
        remaining -= net;
        yearTax += tax;
        if (remaining < 0) remaining = 0;
      }

      // Step 2: Draw from ISA (tax-free)
      if (remaining > 0 && isa > 0) {
        const draw = Math.min(remaining, isa);
        isaDrawn = draw;
        isa -= draw;
        remaining -= draw;
      }

      // Step 3: Draw from cash (tax-free)
      if (remaining > 0 && cash > 0) {
        const draw = Math.min(remaining, cash);
        cashDrawn = draw;
        cash -= draw;
        remaining -= draw;
      }

      // Step 4: Draw from pension (partially taxed)
      if (remaining > 0 && pension > 0) {
        // Gross-up: we need enough gross withdrawal to produce `remaining` net
        // Use a simple multiplier approach: pension tax is roughly 15-30% effective
        // so gross ≈ net / 0.75. Clamp to available pension.
        let grossNeeded = remaining / 0.75;
        // Refine with 3 iterations of Newton-like adjustment
        for (let iter = 0; iter < 3; iter++) {
          const clamped = Math.min(Math.max(0, grossNeeded), pension);
          const { net } = netPensionWithdrawal(clamped, statePension);
          if (net <= 0) { grossNeeded = pension; break; }
          grossNeeded = grossNeeded * (remaining / net);
          if (!isFinite(grossNeeded) || grossNeeded <= 0) { grossNeeded = pension; break; }
        }
        const draw = Math.min(Math.max(0, grossNeeded), pension);
        const { net, tax } = netPensionWithdrawal(draw, statePension);
        pensionDrawn = draw;
        pension -= draw;
        yearTax += tax;
        remaining = Math.max(0, remaining - net);
      }
    } else {
      // Proportional drawdown (existing behaviour)
      const totalAvailable = pension + isa + gia + cash;
      if (totalAvailable > 0 && netNeed > 0) {
        const drawRatio = Math.min(1, netNeed / totalAvailable);
        pensionDrawn = pension * drawRatio;
        isaDrawn = isa * drawRatio;
        giaDrawn = gia * drawRatio;
        cashDrawn = cash * drawRatio;

        pension -= pensionDrawn;
        isa -= isaDrawn;
        gia -= giaDrawn;
        cash -= cashDrawn;

        // Tax on pension portion
        const { tax: pTax } = netPensionWithdrawal(pensionDrawn, statePension);
        const { tax: gTax } = netGIAWithdrawal(giaDrawn, statePension);
        yearTax = pTax + gTax;
      }
    }

    const grossDrawn = pensionDrawn + isaDrawn + giaDrawn + cashDrawn;
    let netIncome = grossDrawn + statePension - yearTax;

    // Check exhaustion
    if (exhaustionAge === null && pension + isa + gia + cash <= 0 && netNeed > 0) {
      exhaustionAge = age;
    }

    // Floor balances at zero (prevent negative pot from compounding)
    pension = Math.max(0, pension);
    isa = Math.max(0, isa);
    gia = Math.max(0, gia);
    cash = Math.max(0, cash);

    // Grow remaining balances
    pension *= (1 + growthRate);
    isa *= (1 + growthRate);
    gia *= (1 + growthRate);
    // Cash doesn't grow (or grows at near-zero)

    // Guard against NaN propagation
    if (!isFinite(yearTax)) yearTax = 0;
    if (!isFinite(netIncome)) netIncome = grossDrawn + statePension;

    totalTaxPaid += yearTax;
    totalNetIncome += netIncome;

    years.push({
      age,
      pensionDrawn: Math.round(pensionDrawn),
      isaDrawn: Math.round(isaDrawn),
      giaDrawn: Math.round(giaDrawn),
      cashDrawn: Math.round(cashDrawn),
      netIncome: Math.round(netIncome),
      taxPaid: Math.round(yearTax),
      pensionRemaining: Math.round(pension),
      isaRemaining: Math.round(isa),
      giaRemaining: Math.round(gia),
      cashRemaining: Math.round(cash),
    });
  }

  return {
    years,
    totalTaxPaid: Math.round(totalTaxPaid),
    totalNetIncome: Math.round(totalNetIncome),
    exhaustionAge,
  };
}

/**
 * Compare tax-optimal vs proportional drawdown strategies.
 * Returns the tax savings from using the optimal strategy.
 */
export function compareDrawdownStrategies(
  pots: AccountPot[],
  annualNeed: number,
  statePensionAnnual: number,
  statePensionStartAge: number,
  startAge: number,
  endAge: number = 95,
  growthRate: number = 0.04
): { optimalTaxPaid: number; proportionalTaxPaid: number; taxSaving: number } {
  const optimal = generateDrawdownPlan(
    pots, annualNeed, statePensionAnnual, statePensionStartAge,
    startAge, endAge, growthRate, "tax_optimal"
  );
  const proportional = generateDrawdownPlan(
    pots, annualNeed, statePensionAnnual, statePensionStartAge,
    startAge, endAge, growthRate, "proportional"
  );

  return {
    optimalTaxPaid: optimal.totalTaxPaid,
    proportionalTaxPaid: proportional.totalTaxPaid,
    taxSaving: proportional.totalTaxPaid - optimal.totalTaxPaid,
  };
}
