"use client";

// ============================================================
// Data Context - Client-side state management with localStorage persistence
// ============================================================
// Replaces static JSON imports with editable, localStorage-backed state.
// Provides the same computed helpers as lib/data.ts but operating on live state.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
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

// --- Default data from JSON files ---

const defaultHousehold = householdJson as unknown as HouseholdData;
const defaultTransactions = transactionsJson as unknown as TransactionsData;
const defaultSnapshots = snapshotsJson as unknown as SnapshotsData;

// --- localStorage keys ---

const LS_KEY_HOUSEHOLD = "nw-household";
const LS_KEY_TRANSACTIONS = "nw-transactions";
const LS_KEY_SNAPSHOTS = "nw-snapshots";

// --- Context value type ---

interface DataContextValue {
  household: HouseholdData;
  transactions: TransactionsData;
  snapshots: SnapshotsData;
  isHydrated: boolean;
  updateHousehold: (data: HouseholdData) => void;
  updateTransactions: (data: TransactionsData) => void;
  updateSnapshots: (data: SnapshotsData) => void;
  resetToDefaults: () => void;
  // Computed helpers
  getPersonById: (id: string) => Person | undefined;
  getAccountById: (id: string) => Account | undefined;
  getFundById: (id: string) => Fund | undefined;
  getAccountsForPerson: (personId: string) => Account[];
  getNetWorthByPerson: () => { personId: string; name: string; value: number }[];
  getNetWorthByWrapper: () => { wrapper: TaxWrapper; value: number }[];
  getNetWorthByAccountType: () => { type: AccountType; value: number }[];
  getTotalNetWorth: () => number;
}

// --- Context creation ---

const DataContext = createContext<DataContextValue | null>(null);

// --- Safe localStorage helpers ---

function loadFromLocalStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveToLocalStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}

function removeFromLocalStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Silently fail
  }
}

// --- Provider component ---

export function DataProvider({ children }: { children: ReactNode }) {
  // Initialize with JSON defaults for SSR consistency
  const [household, setHousehold] = useState<HouseholdData>(defaultHousehold);
  const [transactions, setTransactions] = useState<TransactionsData>(defaultTransactions);
  const [snapshots, setSnapshots] = useState<SnapshotsData>(defaultSnapshots);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    const storedHousehold = loadFromLocalStorage<HouseholdData>(LS_KEY_HOUSEHOLD);
    const storedTransactions = loadFromLocalStorage<TransactionsData>(LS_KEY_TRANSACTIONS);
    const storedSnapshots = loadFromLocalStorage<SnapshotsData>(LS_KEY_SNAPSHOTS);

    if (storedHousehold) setHousehold(storedHousehold);
    if (storedTransactions) setTransactions(storedTransactions);
    if (storedSnapshots) setSnapshots(storedSnapshots);

    setIsHydrated(true);
  }, []);

  // --- Update functions ---

  const updateHousehold = useCallback((data: HouseholdData) => {
    setHousehold(data);
    saveToLocalStorage(LS_KEY_HOUSEHOLD, data);
  }, []);

  const updateTransactions = useCallback((data: TransactionsData) => {
    setTransactions(data);
    saveToLocalStorage(LS_KEY_TRANSACTIONS, data);
  }, []);

  const updateSnapshots = useCallback((data: SnapshotsData) => {
    setSnapshots(data);
    saveToLocalStorage(LS_KEY_SNAPSHOTS, data);
  }, []);

  const resetToDefaults = useCallback(() => {
    setHousehold(defaultHousehold);
    setTransactions(defaultTransactions);
    setSnapshots(defaultSnapshots);
    removeFromLocalStorage(LS_KEY_HOUSEHOLD);
    removeFromLocalStorage(LS_KEY_TRANSACTIONS);
    removeFromLocalStorage(LS_KEY_SNAPSHOTS);
  }, []);

  // --- Computed helpers ---

  const getPersonById = useCallback(
    (id: string): Person | undefined => {
      return household.persons.find((p) => p.id === id);
    },
    [household]
  );

  const getAccountById = useCallback(
    (id: string): Account | undefined => {
      return household.accounts.find((a) => a.id === id);
    },
    [household]
  );

  const getFundById = useCallback(
    (id: string): Fund | undefined => {
      return household.funds.find((f) => f.id === id);
    },
    [household]
  );

  const getAccountsForPerson = useCallback(
    (personId: string): Account[] => {
      return household.accounts.filter((a) => a.personId === personId);
    },
    [household]
  );

  const getNetWorthByPerson = useCallback((): {
    personId: string;
    name: string;
    value: number;
  }[] => {
    return household.persons.map((person) => {
      const accounts = household.accounts.filter(
        (a) => a.personId === person.id
      );
      const value = accounts.reduce((sum, acc) => sum + acc.currentValue, 0);
      return {
        personId: person.id,
        name: person.name,
        value: Math.round(value * 100) / 100,
      };
    });
  }, [household]);

  const getNetWorthByWrapper = useCallback((): {
    wrapper: TaxWrapper;
    value: number;
  }[] => {
    const totals = new Map<TaxWrapper, number>();

    for (const account of household.accounts) {
      const wrapper = getAccountTaxWrapper(account.type);
      totals.set(wrapper, (totals.get(wrapper) ?? 0) + account.currentValue);
    }

    return Array.from(totals.entries()).map(([wrapper, value]) => ({
      wrapper,
      value: Math.round(value * 100) / 100,
    }));
  }, [household]);

  const getNetWorthByAccountType = useCallback((): {
    type: AccountType;
    value: number;
  }[] => {
    const totals = new Map<AccountType, number>();

    for (const account of household.accounts) {
      totals.set(
        account.type,
        (totals.get(account.type) ?? 0) + account.currentValue
      );
    }

    return Array.from(totals.entries()).map(([type, value]) => ({
      type,
      value: Math.round(value * 100) / 100,
    }));
  }, [household]);

  const getTotalNetWorth = useCallback((): number => {
    const total = household.accounts.reduce(
      (sum, acc) => sum + acc.currentValue,
      0
    );
    return Math.round(total * 100) / 100;
  }, [household]);

  // --- Memoize context value ---

  const value = useMemo<DataContextValue>(
    () => ({
      household,
      transactions,
      snapshots,
      isHydrated,
      updateHousehold,
      updateTransactions,
      updateSnapshots,
      resetToDefaults,
      getPersonById,
      getAccountById,
      getFundById,
      getAccountsForPerson,
      getNetWorthByPerson,
      getNetWorthByWrapper,
      getNetWorthByAccountType,
      getTotalNetWorth,
    }),
    [
      household,
      transactions,
      snapshots,
      isHydrated,
      updateHousehold,
      updateTransactions,
      updateSnapshots,
      resetToDefaults,
      getPersonById,
      getAccountById,
      getFundById,
      getAccountsForPerson,
      getNetWorthByPerson,
      getNetWorthByWrapper,
      getNetWorthByAccountType,
      getTotalNetWorth,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// --- Consumer hook ---

/**
 * Access all data and computed helpers from the DataContext.
 * Must be used within a <DataProvider>.
 */
export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (context === null) {
    throw new Error("useData must be used within a <DataProvider>");
  }
  return context;
}
