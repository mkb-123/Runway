// ============================================================
// Data Loading & Lookup Functions
// ============================================================
// Static imports of JSON data files for compatibility with Next.js static export.

import type {
  HouseholdData,
  TransactionsData,
  SnapshotsData,
  Person,
  Account,
  Fund,
  AccountType,
  TaxWrapper,
} from "@/types";
import { getAccountTaxWrapper } from "@/types";

import householdJson from "../../data/household.json";
import transactionsJson from "../../data/transactions.json";
import snapshotsJson from "../../data/snapshots.json";

// Cast imported JSON to typed data
const householdData = householdJson as unknown as HouseholdData;
const transactionsData = transactionsJson as unknown as TransactionsData;
const snapshotsData = snapshotsJson as unknown as SnapshotsData;

// --- Data Accessors ---

/**
 * Get the full household data.
 */
export function getHouseholdData(): HouseholdData {
  return householdData;
}

/**
 * Get all transactions.
 */
export function getTransactionsData(): TransactionsData {
  return transactionsData;
}

/**
 * Get all net worth snapshots.
 */
export function getSnapshotsData(): SnapshotsData {
  return snapshotsData;
}

// --- Lookup Helpers ---

/**
 * Find a person by their ID.
 */
export function getPersonById(id: string): Person | undefined {
  return householdData.persons.find((p) => p.id === id);
}

/**
 * Find an account by its ID.
 */
export function getAccountById(id: string): Account | undefined {
  return householdData.accounts.find((a) => a.id === id);
}

/**
 * Find a fund by its ID.
 */
export function getFundById(id: string): Fund | undefined {
  return householdData.funds.find((f) => f.id === id);
}

/**
 * Get all accounts belonging to a specific person.
 */
export function getAccountsForPerson(personId: string): Account[] {
  return householdData.accounts.filter((a) => a.personId === personId);
}

// --- Aggregation Helpers ---

/**
 * Get net worth broken down by person.
 */
export function getNetWorthByPerson(): { personId: string; name: string; value: number }[] {
  return householdData.persons.map((person) => {
    const accounts = getAccountsForPerson(person.id);
    const value = accounts.reduce((sum, acc) => sum + acc.currentValue, 0);
    return {
      personId: person.id,
      name: person.name,
      value: Math.round(value * 100) / 100,
    };
  });
}

/**
 * Get net worth broken down by tax wrapper (pension, ISA, GIA, cash, premium bonds).
 */
export function getNetWorthByWrapper(): { wrapper: TaxWrapper; value: number }[] {
  const totals = new Map<TaxWrapper, number>();

  for (const account of householdData.accounts) {
    const wrapper = getAccountTaxWrapper(account.type);
    totals.set(wrapper, (totals.get(wrapper) ?? 0) + account.currentValue);
  }

  return Array.from(totals.entries()).map(([wrapper, value]) => ({
    wrapper,
    value: Math.round(value * 100) / 100,
  }));
}

/**
 * Get net worth broken down by account type.
 */
export function getNetWorthByAccountType(): { type: AccountType; value: number }[] {
  const totals = new Map<AccountType, number>();

  for (const account of householdData.accounts) {
    totals.set(account.type, (totals.get(account.type) ?? 0) + account.currentValue);
  }

  return Array.from(totals.entries()).map(([type, value]) => ({
    type,
    value: Math.round(value * 100) / 100,
  }));
}

/**
 * Get total net worth across all accounts.
 */
export function getTotalNetWorth(): number {
  const total = householdData.accounts.reduce((sum, acc) => sum + acc.currentValue, 0);
  return Math.round(total * 100) / 100;
}
