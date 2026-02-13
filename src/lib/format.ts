// ============================================================
// Formatting Utilities
// ============================================================

/**
 * Format a number as GBP currency: "£1,234.56"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number as compact GBP: "£1.2k", "£1.5m", "£2.3bn"
 */
export function formatCurrencyCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    return `${sign}\u00A3${val.toFixed(1)}bn`;
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    return `${sign}\u00A3${val.toFixed(1)}m`;
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    return `${sign}\u00A3${val.toFixed(1)}k`;
  }
  return formatCurrency(amount);
}

/**
 * Format a decimal as a percentage: 0.07 -> "7.00%"
 */
export function formatPercent(decimal: number): string {
  return `${(decimal * 100).toFixed(2)}%`;
}

/**
 * Format an ISO date string to a readable UK date: "15 Jun 2024"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Format a number with thousands separators: 1234 -> "1,234"
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

/**
 * Format currency for chart axis ticks: "£732k", "£1.5m"
 * Uses integer for thousands, one decimal for millions/billions.
 */
export function formatCurrencyAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}\u00A3${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}\u00A3${(abs / 1_000).toFixed(0)}k`;
  return `${sign}\u00A3${abs.toFixed(0)}`;
}

/**
 * Format currency for chart tooltips: "£732,000" (full precision, no pence).
 */
export function formatCurrencyTooltip(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
