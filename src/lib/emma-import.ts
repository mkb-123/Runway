// ============================================================
// Emma App CSV Import — Transaction Parser & Spending Analyzer
// ============================================================
// Parses CSV exports from the Emma personal finance app and
// derives monthly spending figures for use in Runway.
//
// Emma CSV export format (Pro/Ultimate):
//   Date, Amount, Description, Category, Account, Notes
//
// Since Emma's exact column headers can vary, parsing is lenient:
// it detects columns by common header names and falls back to
// positional parsing for the minimal 3-column format (Date, Description, Amount).

import type { CommittedOutgoing, CommittedOutgoingCategory } from "@/types";

// --- Types ---

export interface EmmaTransaction {
  date: string; // ISO date YYYY-MM-DD
  amount: number; // negative = outgoing, positive = incoming
  description: string;
  category: string; // Emma's category label (e.g. "Groceries", "Transport")
  account: string; // Emma account name (e.g. "Barclays Current Account")
}

export interface EmmaParseResult {
  transactions: EmmaTransaction[];
  warnings: string[];
  dateRange: { from: string; to: string } | null;
}

export interface EmmaSpendingSummary {
  /** Average monthly total outgoings (positive number) */
  monthlyTotal: number;
  /** Breakdown by Emma category */
  byCategory: Array<{ category: string; monthlyAverage: number }>;
  /** Number of complete months in the dataset */
  monthsCovered: number;
  /** Suggested committed outgoings derived from recurring payments */
  suggestedOutgoings: Array<{
    label: string;
    monthlyAmount: number;
    category: CommittedOutgoingCategory;
    frequency: "monthly";
  }>;
  /** Suggested monthly lifestyle spending (non-committed, non-income) */
  monthlyLifestyleSpending: number;
  /** Suggested monthly essential expenses */
  monthlyEssentialExpenses: number;
}

// --- CSV Parsing ---

const COLUMN_ALIASES: Record<string, string> = {
  date: "date",
  "transaction date": "date",
  time: "date",
  amount: "amount",
  value: "amount",
  sum: "amount",
  description: "description",
  "payment reference": "description",
  reference: "description",
  memo: "description",
  name: "description",
  category: "category",
  type: "category",
  account: "account",
  "account name": "account",
  bank: "account",
  notes: "notes",
  note: "notes",
};

/**
 * Parse a CSV string from an Emma export into structured transactions.
 * Handles quoted fields, various date formats, and flexible column ordering.
 */
export function parseEmmaCSV(csvText: string): EmmaParseResult {
  const warnings: string[] = [];
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return { transactions: [], warnings: ["File has no data rows."], dateRange: null };
  }

  // Parse header row
  const headerCells = parseCSVRow(lines[0]);
  const columnMap = detectColumns(headerCells);

  if (columnMap.date === -1) {
    warnings.push("Could not find a date column. Using column 1.");
    columnMap.date = 0;
  }
  if (columnMap.amount === -1) {
    warnings.push("Could not find an amount column. Using column 3.");
    columnMap.amount = Math.min(2, headerCells.length - 1);
  }
  if (columnMap.description === -1) {
    warnings.push("Could not find a description column. Using column 2.");
    columnMap.description = Math.min(1, headerCells.length - 1);
  }

  const transactions: EmmaTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVRow(lines[i]);
    if (cells.length < 2) continue;

    const rawDate = cells[columnMap.date] ?? "";
    const rawAmount = cells[columnMap.amount] ?? "";
    const rawDescription = cells[columnMap.description] ?? "";
    const rawCategory = columnMap.category >= 0 ? (cells[columnMap.category] ?? "") : "";
    const rawAccount = columnMap.account >= 0 ? (cells[columnMap.account] ?? "") : "";

    const date = parseDate(rawDate);
    if (!date) {
      warnings.push(`Row ${i + 1}: Could not parse date "${rawDate}".`);
      continue;
    }

    const amount = parseAmount(rawAmount);
    if (amount === null) {
      warnings.push(`Row ${i + 1}: Could not parse amount "${rawAmount}".`);
      continue;
    }

    transactions.push({
      date,
      amount,
      description: rawDescription.trim(),
      category: rawCategory.trim(),
      account: rawAccount.trim(),
    });
  }

  let dateRange: EmmaParseResult["dateRange"] = null;
  if (transactions.length > 0) {
    const sorted = transactions.map((t) => t.date).sort();
    dateRange = { from: sorted[0], to: sorted[sorted.length - 1] };
  }

  return { transactions, warnings, dateRange };
}

// --- Spending Analysis ---

/** Category keywords mapping Emma categories to Runway outgoing categories */
const COMMITTED_CATEGORY_KEYWORDS: Array<{
  keywords: string[];
  runwayCategory: CommittedOutgoingCategory;
}> = [
  { keywords: ["mortgage", "home loan"], runwayCategory: "mortgage" },
  { keywords: ["rent", "tenancy"], runwayCategory: "rent" },
  { keywords: ["childcare", "nursery", "nanny", "au pair"], runwayCategory: "childcare" },
  { keywords: ["insurance", "life cover", "health cover", "car insurance", "home insurance"], runwayCategory: "insurance" },
  { keywords: ["school", "tuition", "education fee"], runwayCategory: "school_fees" },
];

const ESSENTIAL_CATEGORY_KEYWORDS = [
  "groceries", "food", "supermarket",
  "utilities", "energy", "electric", "gas", "water",
  "council tax",
  "transport", "fuel", "petrol", "commute", "train", "bus",
  "phone", "mobile", "broadband", "internet",
  "medical", "pharmacy", "dentist", "healthcare",
];

/**
 * Analyze parsed Emma transactions to derive monthly spending figures.
 * Only considers outgoing transactions (negative amounts).
 */
export function analyzeEmmaSpending(transactions: EmmaTransaction[]): EmmaSpendingSummary {
  const outgoings = transactions.filter((t) => t.amount < 0);

  if (outgoings.length === 0) {
    return {
      monthlyTotal: 0,
      byCategory: [],
      monthsCovered: 0,
      suggestedOutgoings: [],
      monthlyLifestyleSpending: 0,
      monthlyEssentialExpenses: 0,
    };
  }

  // Group by month (YYYY-MM)
  const byMonth = new Map<string, EmmaTransaction[]>();
  for (const t of outgoings) {
    const month = t.date.slice(0, 7); // "YYYY-MM"
    const existing = byMonth.get(month);
    if (existing) {
      existing.push(t);
    } else {
      byMonth.set(month, [t]);
    }
  }

  const monthsCovered = byMonth.size;

  // Total monthly average
  const totalOutgoing = outgoings.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const monthlyTotal = roundToTwoDecimals(totalOutgoing / monthsCovered);

  // By category
  const categoryTotals = new Map<string, number>();
  for (const t of outgoings) {
    const cat = t.category || "Uncategorised";
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + Math.abs(t.amount));
  }
  const byCategory = Array.from(categoryTotals.entries())
    .map(([category, total]) => ({
      category,
      monthlyAverage: roundToTwoDecimals(total / monthsCovered),
    }))
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage);

  // Detect recurring committed payments
  const suggestedOutgoings = detectRecurringPayments(outgoings, monthsCovered);

  // Calculate essential vs lifestyle spending
  const committedTotal = suggestedOutgoings.reduce((s, o) => s + o.monthlyAmount, 0);

  let essentialTotal = 0;
  for (const t of outgoings) {
    const lower = (t.category + " " + t.description).toLowerCase();
    if (ESSENTIAL_CATEGORY_KEYWORDS.some((kw) => lower.includes(kw))) {
      essentialTotal += Math.abs(t.amount);
    }
  }
  const monthlyEssentialExpenses = roundToTwoDecimals(
    Math.max(essentialTotal / monthsCovered, committedTotal)
  );

  // Lifestyle = total minus essentials minus committed
  const monthlyLifestyleSpending = roundToTwoDecimals(
    Math.max(0, monthlyTotal - monthlyEssentialExpenses)
  );

  return {
    monthlyTotal,
    byCategory,
    monthsCovered,
    suggestedOutgoings,
    monthlyLifestyleSpending,
    monthlyEssentialExpenses,
  };
}

/**
 * Convert suggested Emma outgoings to Runway CommittedOutgoing records.
 */
export function toCommittedOutgoings(
  suggestions: EmmaSpendingSummary["suggestedOutgoings"]
): Omit<CommittedOutgoing, "id">[] {
  return suggestions.map((s) => ({
    category: s.category,
    label: s.label,
    amount: roundToTwoDecimals(s.monthlyAmount),
    frequency: "monthly" as const,
  }));
}

// --- Internal Helpers ---

function detectColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {
    date: -1,
    amount: -1,
    description: -1,
    category: -1,
    account: -1,
    notes: -1,
  };

  for (let i = 0; i < headers.length; i++) {
    const normalised = headers[i].trim().toLowerCase();
    const mapped = COLUMN_ALIASES[normalised];
    if (mapped && map[mapped] === -1) {
      map[mapped] = i;
    }
  }

  return map;
}

/** Parse a single CSV row respecting quoted fields */
export function parseCSVRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  cells.push(current);
  return cells;
}

/** Parse various date formats into ISO YYYY-MM-DD */
export function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // UK format: DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ukMatch) {
    const day = ukMatch[1].padStart(2, "0");
    const month = ukMatch[2].padStart(2, "0");
    return `${ukMatch[3]}-${month}-${day}`;
  }

  // UK format with 2-digit year: DD/MM/YY
  const ukShortMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})(?:\s|$)/);
  if (ukShortMatch) {
    const day = ukShortMatch[1].padStart(2, "0");
    const month = ukShortMatch[2].padStart(2, "0");
    const year = Number(ukShortMatch[3]) >= 50 ? `19${ukShortMatch[3]}` : `20${ukShortMatch[3]}`;
    return `${year}-${month}-${day}`;
  }

  // Try native Date parsing as last resort
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  return null;
}

/** Parse amount string, handling currency symbols and parentheses for negatives */
export function parseAmount(raw: string): number | null {
  let trimmed = raw.trim();
  if (!trimmed) return null;

  // Remove currency symbols
  trimmed = trimmed.replace(/[£$€]/g, "");

  // Handle parentheses for negatives: (123.45) → -123.45
  const parenMatch = trimmed.match(/^\(([0-9,.\s]+)\)$/);
  if (parenMatch) {
    trimmed = "-" + parenMatch[1];
  }

  // Remove thousands separators (commas)
  trimmed = trimmed.replace(/,/g, "").trim();

  const num = Number(trimmed);
  return isNaN(num) ? null : num;
}

/**
 * Detect recurring monthly payments from transaction history.
 * A payment is "recurring" if it appears in >= 50% of months with
 * a similar amount (within 20% tolerance).
 */
function detectRecurringPayments(
  outgoings: EmmaTransaction[],
  monthsCovered: number
): EmmaSpendingSummary["suggestedOutgoings"] {
  if (monthsCovered < 2) return [];

  // Group by normalised description
  const byDesc = new Map<string, EmmaTransaction[]>();
  for (const t of outgoings) {
    const key = normaliseDescription(t.description);
    if (!key) continue;
    const existing = byDesc.get(key);
    if (existing) {
      existing.push(t);
    } else {
      byDesc.set(key, [t]);
    }
  }

  const results: EmmaSpendingSummary["suggestedOutgoings"] = [];
  const minMonths = Math.max(2, Math.floor(monthsCovered * 0.5));

  for (const [desc, txns] of byDesc) {
    // Count distinct months
    const months = new Set(txns.map((t) => t.date.slice(0, 7)));
    if (months.size < minMonths) continue;

    const amounts = txns.map((t) => Math.abs(t.amount));
    const median = getMedian(amounts);
    if (median < 5) continue; // Skip trivial amounts

    // Check amount consistency (within 20% of median for at least half)
    const consistent = amounts.filter(
      (a) => Math.abs(a - median) / median < 0.2
    );
    if (consistent.length < minMonths) continue;

    const category = classifyAsCommittedCategory(desc, txns[0]?.category ?? "");

    results.push({
      label: titleCase(desc),
      monthlyAmount: roundToTwoDecimals(median),
      category,
      frequency: "monthly",
    });
  }

  return results.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

function classifyAsCommittedCategory(
  description: string,
  emmaCategory: string
): CommittedOutgoingCategory {
  const combined = (description + " " + emmaCategory).toLowerCase();
  for (const { keywords, runwayCategory } of COMMITTED_CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => combined.includes(kw))) {
      return runwayCategory;
    }
  }
  return "other";
}

function normaliseDescription(desc: string): string {
  return desc.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function titleCase(str: string): string {
  return str
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function roundToTwoDecimals(n: number): number {
  return Math.round(n * 100) / 100;
}
