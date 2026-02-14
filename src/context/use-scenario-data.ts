"use client";

// ============================================================
// useScenarioData - Scenario-aware data hook
// ============================================================
// Returns household data with scenario overrides applied.
// Pages should use this instead of useData().household directly
// when they want to be scenario-aware.

import { useMemo } from "react";
import { roundPence } from "@/lib/format";
import { useData } from "@/context/data-context";
import { useScenario } from "@/context/scenario-context";
import type { HouseholdData, TaxWrapper, AccountType } from "@/types";
import { getAccountTaxWrapper } from "@/types";

export interface ScenarioAwareData {
  /** Household data with scenario overrides applied */
  household: HouseholdData;
  /** Base (un-overridden) household data for before/after comparison */
  baseHousehold: HouseholdData;
  /** Whether we're currently in scenario mode */
  isScenarioMode: boolean;
  /** Total net worth (scenario-adjusted) */
  getTotalNetWorth: () => number;
  /** Net worth by person (scenario-adjusted) */
  getNetWorthByPerson: () => { personId: string; name: string; value: number }[];
  /** Net worth by wrapper (scenario-adjusted) */
  getNetWorthByWrapper: () => { wrapper: TaxWrapper; value: number }[];
  /** Net worth by account type (scenario-adjusted) */
  getNetWorthByAccountType: () => { type: AccountType; value: number }[];
}

export function useScenarioData(): ScenarioAwareData {
  const data = useData();
  const scenario = useScenario();
  const { applyOverrides, isScenarioMode } = scenario;

  const household = useMemo(
    () => applyOverrides(data.household),
    [data.household, applyOverrides]
  );

  const getTotalNetWorth = useMemo(
    () => () => {
      return roundPence(
        household.accounts.reduce((sum, acc) => sum + acc.currentValue, 0)
      );
    },
    [household.accounts]
  );

  const getNetWorthByPerson = useMemo(
    () => () => {
      return household.persons.map((person) => {
        const value = household.accounts
          .filter((a) => a.personId === person.id)
          .reduce((sum, acc) => sum + acc.currentValue, 0);
        return {
          personId: person.id,
          name: person.name,
          value: roundPence(value),
        };
      });
    },
    [household]
  );

  const getNetWorthByWrapper = useMemo(
    () => () => {
      const totals = new Map<TaxWrapper, number>();
      for (const account of household.accounts) {
        const wrapper = getAccountTaxWrapper(account.type);
        totals.set(wrapper, (totals.get(wrapper) ?? 0) + account.currentValue);
      }
      return Array.from(totals.entries()).map(([wrapper, value]) => ({
        wrapper,
        value: roundPence(value),
      }));
    },
    [household.accounts]
  );

  const getNetWorthByAccountType = useMemo(
    () => () => {
      const totals = new Map<AccountType, number>();
      for (const account of household.accounts) {
        totals.set(
          account.type,
          (totals.get(account.type) ?? 0) + account.currentValue
        );
      }
      return Array.from(totals.entries()).map(([type, value]) => ({
        type,
        value: roundPence(value),
      }));
    },
    [household.accounts]
  );

  return {
    household,
    baseHousehold: data.household,
    isScenarioMode,
    getTotalNetWorth,
    getNetWorthByPerson,
    getNetWorthByWrapper,
    getNetWorthByAccountType,
  };
}
