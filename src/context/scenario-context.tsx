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
  type PersonOverride,
} from "@/lib/scenario";

// Re-export for consumers
export type { ScenarioOverrides, ContributionOverride, PersonOverride };

export interface SavedScenario {
  name: string;
  overrides: ScenarioOverrides;
  savedAt: string; // ISO date
}

export interface ScenarioContextValue {
  isScenarioMode: boolean;
  scenarioLabel: string;
  overrides: ScenarioOverrides;
  enableScenario: (label: string, overrides: ScenarioOverrides) => void;
  updateOverrides: (overrides: Partial<ScenarioOverrides>) => void;
  disableScenario: () => void;
  applyOverrides: (household: HouseholdData) => HouseholdData;
  savedScenarios: SavedScenario[];
  saveScenario: (name: string) => void;
  loadScenario: (name: string) => void;
  deleteScenario: (name: string) => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

const LS_KEY_SCENARIOS = "nw-saved-scenarios";

function loadSavedScenarios(): SavedScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY_SCENARIOS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedScenarios(scenarios: SavedScenario[]) {
  try {
    localStorage.setItem(LS_KEY_SCENARIOS, JSON.stringify(scenarios));
  } catch {
    // ignore
  }
}

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [isScenarioMode, setIsScenarioMode] = useState(false);
  const [scenarioLabel, setScenarioLabel] = useState("");
  const [overrides, setOverrides] = useState<ScenarioOverrides>({});
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(loadSavedScenarios);

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

  const saveScenario = useCallback((name: string) => {
    setSavedScenarios((prev) => {
      const updated = prev.filter((s) => s.name !== name);
      updated.push({ name, overrides, savedAt: new Date().toISOString() });
      persistSavedScenarios(updated);
      return updated;
    });
  }, [overrides]);

  const loadScenario = useCallback((name: string) => {
    const found = savedScenarios.find((s) => s.name === name);
    if (found) {
      setIsScenarioMode(true);
      setScenarioLabel(found.name);
      setOverrides(found.overrides);
    }
  }, [savedScenarios]);

  const deleteScenario = useCallback((name: string) => {
    setSavedScenarios((prev) => {
      const updated = prev.filter((s) => s.name !== name);
      persistSavedScenarios(updated);
      return updated;
    });
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
      savedScenarios,
      saveScenario,
      loadScenario,
      deleteScenario,
    }),
    [
      isScenarioMode,
      scenarioLabel,
      overrides,
      enableScenario,
      updateOverrides,
      disableScenario,
      applyOverrides,
      savedScenarios,
      saveScenario,
      loadScenario,
      deleteScenario,
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
