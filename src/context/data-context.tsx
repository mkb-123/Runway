"use client";

// ============================================================
// Data Context - Client-side state management with localStorage persistence
// ============================================================
// Replaces static JSON imports with editable, localStorage-backed state.
// Provides computed helpers operating on live state.

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
  SnapshotsData,
  NetWorthSnapshot,
  Person,
  Account,
  AccountType,
  TaxWrapper,
} from "@/types";
import { getAccountTaxWrapper } from "@/types";
import { roundPence } from "@/lib/format";
import {
  getTotalNetWorth as computeTotalNetWorth,
  getNetWorthByPerson as computeNetWorthByPerson,
  getNetWorthByWrapper as computeNetWorthByWrapper,
  getNetWorthByAccountType as computeNetWorthByAccountType,
} from "@/lib/aggregations";
import { z } from "zod";
import {
  HouseholdDataSchema,
  SnapshotsDataSchema,
} from "@/lib/schemas";
import { migrateHouseholdData } from "@/lib/migration";

import householdJson from "../../data/household.json";
import snapshotsJson from "../../data/snapshots.json";

// --- Default data from JSON files (validated at startup) ---

const defaultHousehold = HouseholdDataSchema.parse(householdJson);
const defaultSnapshots = SnapshotsDataSchema.parse(snapshotsJson);

// Empty data for "Clear All"
const emptyHousehold: HouseholdData = {
  persons: [],
  children: [],
  accounts: [],
  income: [],
  bonusStructures: [],
  contributions: [],
  retirement: {
    targetAnnualIncome: 0,
    withdrawalRate: 0.04,
    includeStatePension: true,
    scenarioRates: [0.05, 0.07, 0.09],
  },
  emergencyFund: { monthlyEssentialExpenses: 0, targetMonths: 6, monthlyLifestyleSpending: 0 },
  iht: { estimatedPropertyValue: 0, passingToDirectDescendants: false, gifts: [] },
  committedOutgoings: [],
  dashboardConfig: { heroMetrics: ["projected_retirement_income", "retirement_countdown", "fire_progress", "period_change", "cash_runway"] },
};
const emptySnapshots: SnapshotsData = { snapshots: [] };

// --- localStorage keys ---

const LS_KEY_HOUSEHOLD = "nw-household";
const LS_KEY_SNAPSHOTS = "nw-snapshots";

// --- Context value type ---

interface DataContextValue {
  household: HouseholdData;
  snapshots: SnapshotsData;
  isHydrated: boolean;
  saveError: string | null;
  dismissSaveError: () => void;
  updateHousehold: (data: HouseholdData) => void;
  updateSnapshots: (data: SnapshotsData) => void;
  resetToDefaults: () => void;
  clearAllData: () => void;
  loadExampleData: () => void;
  // Computed helpers
  getPersonById: (id: string) => Person | undefined;
  getAccountById: (id: string) => Account | undefined;
  getAccountsForPerson: (personId: string) => Account[];
  getNetWorthByPerson: () => { personId: string; name: string; value: number }[];
  getNetWorthByWrapper: () => { wrapper: TaxWrapper; value: number }[];
  getNetWorthByAccountType: () => { type: AccountType; value: number }[];
  getTotalNetWorth: () => number;
}

// --- Context creation ---

const DataContext = createContext<DataContextValue | null>(null);

// --- Safe localStorage helpers ---

function loadFromLocalStorage<T>(key: string, schema: z.ZodType<T>, migrate?: (raw: Record<string, unknown>) => Record<string, unknown>): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    let parsed = JSON.parse(raw);

    // Apply migration before validation to handle schema changes
    if (migrate && typeof parsed === "object" && parsed !== null) {
      parsed = migrate(parsed as Record<string, unknown>);
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.warn(`[Runway] Invalid data in localStorage key "${key}":`, result.error.issues);
    return null;
  } catch {
    return null;
  }
}

function saveToLocalStorage<T>(key: string, value: T): string | null {
  if (typeof window === "undefined") return null;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return null;
  } catch (e) {
    const message = e instanceof DOMException && e.name === "QuotaExceededError"
      ? "Storage is full. Your changes may not be saved. Try exporting your data and clearing old snapshots."
      : "Unable to save data. You may be in private browsing mode or storage is unavailable.";
    console.warn(`[Runway] localStorage write failed for "${key}":`, e);
    return message;
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

// --- Auto-snapshot helper ---

function createAutoSnapshot(household: HouseholdData, date: Date): NetWorthSnapshot {
  const isoDate = date.toISOString().slice(0, 10);
  const totalNetWorth = roundPence(household.accounts.reduce((sum, a) => sum + a.currentValue, 0));

  const byPersonMap = new Map<string, number>();
  const byTypeMap = new Map<AccountType, number>();
  const byWrapperMap = new Map<TaxWrapper, number>();

  for (const account of household.accounts) {
    byPersonMap.set(account.personId, (byPersonMap.get(account.personId) ?? 0) + account.currentValue);
    byTypeMap.set(account.type, (byTypeMap.get(account.type) ?? 0) + account.currentValue);
    const wrapper = getAccountTaxWrapper(account.type);
    byWrapperMap.set(wrapper, (byWrapperMap.get(wrapper) ?? 0) + account.currentValue);
  }

  const getPersonName = (id: string) => household.persons.find((p) => p.id === id)?.name ?? id;

  return {
    date: isoDate,
    totalNetWorth,
    byPerson: Array.from(byPersonMap.entries()).map(([personId, value]) => ({
      personId,
      name: getPersonName(personId),
      value: roundPence(value),
    })),
    byType: Array.from(byTypeMap.entries()).map(([type, value]) => ({
      type,
      value: roundPence(value),
    })),
    byWrapper: Array.from(byWrapperMap.entries()).map(([wrapper, value]) => ({
      wrapper,
      value: roundPence(value),
    })),
  };
}

// --- Provider component ---

export function DataProvider({ children }: { children: ReactNode }) {
  // Initialize with JSON defaults for SSR consistency
  const [household, setHousehold] = useState<HouseholdData>(defaultHousehold);
  const [snapshots, setSnapshots] = useState<SnapshotsData>(defaultSnapshots);
  const [isHydrated, setIsHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dismissSaveError = useCallback(() => setSaveError(null), []);

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    const storedHousehold = loadFromLocalStorage(LS_KEY_HOUSEHOLD, HouseholdDataSchema, migrateHouseholdData);
    const storedSnapshots = loadFromLocalStorage(LS_KEY_SNAPSHOTS, SnapshotsDataSchema);

    const hydratedHousehold = storedHousehold ?? defaultHousehold;
    const hydratedSnapshots = storedSnapshots ?? defaultSnapshots;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard Next.js hydration pattern: must read localStorage in effect (unavailable during SSR) and sync into state
    if (storedHousehold) setHousehold(storedHousehold);
    if (storedSnapshots) setSnapshots(storedSnapshots);

    // Auto-snapshot: create a snapshot if it's a new month and there are accounts
    if (hydratedHousehold.accounts.length > 0) {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const hasThisMonth = hydratedSnapshots.snapshots.some((s) => s.date.startsWith(thisMonth));

      if (!hasThisMonth) {
        const snapshot = createAutoSnapshot(hydratedHousehold, now);
        const updatedSnapshots = { snapshots: [...hydratedSnapshots.snapshots, snapshot] };
        setSnapshots(updatedSnapshots);
        saveToLocalStorage(LS_KEY_SNAPSHOTS, updatedSnapshots);
      }
    }

    setIsHydrated(true);
  }, []);

  // --- Update functions ---

  const updateHousehold = useCallback((data: HouseholdData) => {
    setHousehold(data);
    const error = saveToLocalStorage(LS_KEY_HOUSEHOLD, data);
    if (error) setSaveError(error);
  }, []);

  const updateSnapshots = useCallback((data: SnapshotsData) => {
    setSnapshots(data);
    const error = saveToLocalStorage(LS_KEY_SNAPSHOTS, data);
    if (error) setSaveError(error);
  }, []);

  const resetToDefaults = useCallback(() => {
    setHousehold(defaultHousehold);
    setSnapshots(defaultSnapshots);
    removeFromLocalStorage(LS_KEY_HOUSEHOLD);
    removeFromLocalStorage(LS_KEY_SNAPSHOTS);
  }, []);

  const clearAllData = useCallback(() => {
    setHousehold(emptyHousehold);
    setSnapshots(emptySnapshots);
    saveToLocalStorage(LS_KEY_HOUSEHOLD, emptyHousehold);
    saveToLocalStorage(LS_KEY_SNAPSHOTS, emptySnapshots);
  }, []);

  const loadExampleData = useCallback(() => {
    setHousehold(defaultHousehold);
    setSnapshots(defaultSnapshots);
    saveToLocalStorage(LS_KEY_HOUSEHOLD, defaultHousehold);
    saveToLocalStorage(LS_KEY_SNAPSHOTS, defaultSnapshots);
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

  const getAccountsForPerson = useCallback(
    (personId: string): Account[] => {
      return household.accounts.filter((a) => a.personId === personId);
    },
    [household]
  );

  const getNetWorthByPerson = useCallback(
    () => computeNetWorthByPerson(household),
    [household]
  );

  const getNetWorthByWrapper = useCallback(
    () => computeNetWorthByWrapper(household),
    [household]
  );

  const getNetWorthByAccountType = useCallback(
    () => computeNetWorthByAccountType(household),
    [household]
  );

  const getTotalNetWorth = useCallback(
    () => computeTotalNetWorth(household),
    [household]
  );

  // --- Memoize context value ---

  const value = useMemo<DataContextValue>(
    () => ({
      household,
      snapshots,
      isHydrated,
      saveError,
      dismissSaveError,
      updateHousehold,
      updateSnapshots,
      resetToDefaults,
      clearAllData,
      loadExampleData,
      getPersonById,
      getAccountById,
      getAccountsForPerson,
      getNetWorthByPerson,
      getNetWorthByWrapper,
      getNetWorthByAccountType,
      getTotalNetWorth,
    }),
    [
      household,
      snapshots,
      isHydrated,
      saveError,
      dismissSaveError,
      updateHousehold,
      updateSnapshots,
      resetToDefaults,
      clearAllData,
      loadExampleData,
      getPersonById,
      getAccountById,
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
