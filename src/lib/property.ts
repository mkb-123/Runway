// ============================================================
// Property & Mortgage Projection Engine
// ============================================================
// Pure functions for property appreciation, mortgage amortization,
// and combined equity projection over time.

import type { Property } from "@/types";
import { getPropertyEquity, getMortgageRemainingMonths } from "@/types";

// --- Types ---

export interface PropertyProjectionYear {
  /** Year offset from today (0 = current) */
  year: number;
  /** Projected property value (with appreciation) */
  propertyValue: number;
  /** Projected mortgage balance (with amortization) */
  mortgageBalance: number;
  /** Projected equity = value - mortgage */
  equity: number;
}

export interface MortgageAmortizationMonth {
  /** Month number (1-indexed from today) */
  month: number;
  /** Opening balance for this month */
  openingBalance: number;
  /** Interest portion of payment */
  interestPayment: number;
  /** Principal portion of payment */
  principalPayment: number;
  /** Closing balance after payment */
  closingBalance: number;
}

// --- Functions ---

/**
 * Project a single property's value, mortgage, and equity over N years.
 * Handles appreciation and mortgage amortization independently.
 *
 * @param property - Property to project
 * @param years - Number of years to project
 * @param now - Reference date (for mortgage remaining calculation)
 */
export function projectPropertyEquity(
  property: Property,
  years: number,
  now: Date = new Date()
): PropertyProjectionYear[] {
  const appreciationRate = property.appreciationRate ?? 0;
  const result: PropertyProjectionYear[] = [];

  // Build mortgage amortization schedule (monthly, then sample annually)
  const mortgageByYear = projectMortgageBalance(property, years, now);

  for (let y = 0; y <= years; y++) {
    const propertyValue = property.estimatedValue * Math.pow(1 + appreciationRate, y);
    const mortgageBalance = mortgageByYear[y] ?? 0;
    result.push({
      year: y,
      propertyValue: Math.round(propertyValue),
      mortgageBalance: Math.round(mortgageBalance),
      equity: Math.round(Math.max(0, propertyValue - mortgageBalance)),
    });
  }

  return result;
}

/**
 * Project mortgage balance at the end of each year for N years.
 * Uses standard amortization (equal monthly payments, declining balance).
 * Returns an array where index 0 = current balance, index N = balance after N years.
 *
 * If mortgage details are incomplete, returns static balance for all years.
 */
export function projectMortgageBalance(
  property: Property,
  years: number,
  now: Date = new Date()
): number[] {
  const { mortgageBalance, mortgageRate } = property;
  const result: number[] = [mortgageBalance];

  if (!mortgageBalance || mortgageBalance <= 0) {
    return Array(years + 1).fill(0);
  }

  // If no rate/term info, balance stays static
  if (!mortgageRate || !property.mortgageTerm || !property.mortgageStartDate) {
    return Array(years + 1).fill(mortgageBalance);
  }

  const remainingMonths = getMortgageRemainingMonths(property, now);
  if (remainingMonths <= 0) {
    return Array(years + 1).fill(0);
  }

  const monthlyRate = mortgageRate / 12;
  const factor = Math.pow(1 + monthlyRate, remainingMonths);
  const monthlyPayment = mortgageBalance * (monthlyRate * factor) / (factor - 1);

  let balance = mortgageBalance;
  for (let y = 1; y <= years; y++) {
    // Simulate 12 months of payments
    for (let m = 0; m < 12; m++) {
      if (balance <= 0) break;
      const interest = balance * monthlyRate;
      const principal = Math.min(monthlyPayment - interest, balance);
      balance -= principal;
    }
    result.push(Math.max(0, balance));
  }

  return result;
}

/**
 * Generate a detailed monthly amortization schedule.
 * Useful for mortgage payoff visualization.
 */
export function generateAmortizationSchedule(
  property: Property,
  now: Date = new Date()
): MortgageAmortizationMonth[] {
  const { mortgageBalance, mortgageRate } = property;
  if (!mortgageBalance || !mortgageRate || !property.mortgageTerm || !property.mortgageStartDate) {
    return [];
  }

  const remainingMonths = getMortgageRemainingMonths(property, now);
  if (remainingMonths <= 0) return [];

  const monthlyRate = mortgageRate / 12;
  const factor = Math.pow(1 + monthlyRate, remainingMonths);
  const monthlyPayment = mortgageBalance * (monthlyRate * factor) / (factor - 1);

  const schedule: MortgageAmortizationMonth[] = [];
  let balance = mortgageBalance;

  for (let m = 1; m <= remainingMonths; m++) {
    const interest = balance * monthlyRate;
    const principal = Math.min(monthlyPayment - interest, balance);
    const closing = Math.max(0, balance - principal);
    schedule.push({
      month: m,
      openingBalance: Math.round(balance),
      interestPayment: Math.round(interest),
      principalPayment: Math.round(principal),
      closingBalance: Math.round(closing),
    });
    balance = closing;
  }

  return schedule;
}

/**
 * Project total property equity for all properties at a given year offset.
 * Combines appreciation + mortgage amortization across the portfolio.
 */
export function projectTotalPropertyEquity(
  properties: Property[],
  yearOffset: number,
  now: Date = new Date()
): number {
  let total = 0;
  for (const property of properties) {
    const appreciationRate = property.appreciationRate ?? 0;
    const projectedValue = property.estimatedValue * Math.pow(1 + appreciationRate, yearOffset);
    const mortgageBalances = projectMortgageBalance(property, yearOffset, now);
    const projectedMortgage = mortgageBalances[yearOffset] ?? property.mortgageBalance;
    total += Math.max(0, projectedValue - projectedMortgage);
  }
  return Math.round(total);
}

/**
 * Project total estate value (property equity + account growth) at a year offset.
 * Used by IHT projections to include property appreciation in estate growth.
 */
export function projectEstatePropertyValue(
  properties: Property[],
  yearOffset: number,
  now: Date = new Date()
): number {
  let total = 0;
  for (const property of properties) {
    const appreciationRate = property.appreciationRate ?? 0;
    const projectedValue = property.estimatedValue * Math.pow(1 + appreciationRate, yearOffset);
    const mortgageBalances = projectMortgageBalance(property, yearOffset, now);
    const projectedMortgage = mortgageBalances[yearOffset] ?? property.mortgageBalance;
    total += Math.max(0, projectedValue - projectedMortgage);
  }
  return total;
}

/**
 * Calculate years until mortgage is fully paid off.
 * Returns null if no mortgage or no rate/term info.
 */
export function calculateMortgagePayoffYears(
  property: Property,
  now: Date = new Date()
): number | null {
  if (!property.mortgageBalance || property.mortgageBalance <= 0) return 0;
  if (!property.mortgageRate || !property.mortgageTerm || !property.mortgageStartDate) return null;
  const remainingMonths = getMortgageRemainingMonths(property, now);
  return remainingMonths > 0 ? Math.ceil(remainingMonths / 12) : 0;
}
