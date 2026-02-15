"use client";

// ============================================================
// useScenarioData - Scenario-aware data hook
// ============================================================
// Returns household data with scenario overrides applied.
// Pages should use this instead of useData().household directly
// when they want to be scenario-aware.

import { useMemo } from "react";
import { useData } from "@/context/data-context";
import { useScenario } from "@/context/scenario-context";
import type { HouseholdData, TaxWrapper, AccountType } from "@/types";
import {
  getTotalNetWorth as computeTotalNetWorth,
  getNetWorthByPerson as computeNetWorthByPerson,
  getNetWorthByWrapper as computeNetWorthByWrapper,
  getNetWorthByAccountType as computeNetWorthByAccountType,
} from "@/lib/aggregations";

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
    () => () => computeTotalNetWorth(household),
    [household]
  );

  const getNetWorthByPerson = useMemo(
    () => () => computeNetWorthByPerson(household),
    [household]
  );

  const getNetWorthByWrapper = useMemo(
    () => () => computeNetWorthByWrapper(household),
    [household]
  );

  const getNetWorthByAccountType = useMemo(
    () => () => computeNetWorthByAccountType(household),
    [household]
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
