"use client";

// ============================================================
// Scenario Context - What-If Scenario Mode
// ============================================================
// Provides an overlay layer on top of the base data context.
// When active, pages can read scenario-modified data without
// affecting the real saved data. Scenarios are in-memory only.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { HouseholdData } from "@/types";
import {
  applyScenarioOverrides,
  type ScenarioOverrides,
  type ContributionOverride,
} from "@/lib/scenario";

// Re-export for consumers
export type { ScenarioOverrides, ContributionOverride };

export interface ScenarioContextValue {
  isScenarioMode: boolean;
  scenarioLabel: string;
  overrides: ScenarioOverrides;
  enableScenario: (label: string, overrides: ScenarioOverrides) => void;
  updateOverrides: (overrides: Partial<ScenarioOverrides>) => void;
  disableScenario: () => void;
  /** Apply overrides to household data to produce scenario-adjusted data */
  applyOverrides: (household: HouseholdData) => HouseholdData;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [isScenarioMode, setIsScenarioMode] = useState(false);
  const [scenarioLabel, setScenarioLabel] = useState("");
  const [overrides, setOverrides] = useState<ScenarioOverrides>({});

  const enableScenario = useCallback(
    (label: string, newOverrides: ScenarioOverrides) => {
      setIsScenarioMode(true);
      setScenarioLabel(label);
      setOverrides(newOverrides);
    },
    []
  );

  const updateOverrides = useCallback(
    (partial: Partial<ScenarioOverrides>) => {
      setOverrides((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const disableScenario = useCallback(() => {
    setIsScenarioMode(false);
    setScenarioLabel("");
    setOverrides({});
  }, []);

  const applyOverrides = useCallback(
    (household: HouseholdData): HouseholdData => {
      if (!isScenarioMode) return household;
      return applyScenarioOverrides(household, overrides);
    },
    [isScenarioMode, overrides]
  );

  const value = useMemo<ScenarioContextValue>(
    () => ({
      isScenarioMode,
      scenarioLabel,
      overrides,
      enableScenario,
      updateOverrides,
      disableScenario,
      applyOverrides,
    }),
    [
      isScenarioMode,
      scenarioLabel,
      overrides,
      enableScenario,
      updateOverrides,
      disableScenario,
      applyOverrides,
    ]
  );

  return (
    <ScenarioContext.Provider value={value}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenario(): ScenarioContextValue {
  const context = useContext(ScenarioContext);
  if (context === null) {
    throw new Error("useScenario must be used within a <ScenarioProvider>");
  }
  return context;
}
