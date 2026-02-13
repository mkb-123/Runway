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
import type { HouseholdData, PersonIncome, AnnualContributions, RetirementConfig } from "@/types";

// --- Scenario overrides ---

export interface ScenarioOverrides {
  income?: Partial<PersonIncome>[];
  annualContributions?: Partial<AnnualContributions>[];
  retirement?: Partial<RetirementConfig>;
  estimatedAnnualExpenses?: number;
  /** Override specific account values by ID */
  accountValues?: Record<string, number>;
  /** Apply a percentage shock to all account values (e.g. -0.30 for a 30% crash) */
  marketShockPercent?: number;
}

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

      let result = { ...household };

      // Override income
      if (overrides.income && overrides.income.length > 0) {
        result.income = household.income.map((inc) => {
          const override = overrides.income?.find(
            (o) => o.personId === inc.personId
          );
          if (override) {
            return { ...inc, ...override } as PersonIncome;
          }
          return inc;
        });
      }

      // Override contributions
      if (
        overrides.annualContributions &&
        overrides.annualContributions.length > 0
      ) {
        result.annualContributions = household.annualContributions.map((c) => {
          const override = overrides.annualContributions?.find(
            (o) => o.personId === c.personId
          );
          if (override) {
            return { ...c, ...override } as AnnualContributions;
          }
          return c;
        });
      }

      // Override retirement config
      if (overrides.retirement) {
        result.retirement = { ...household.retirement, ...overrides.retirement };
      }

      // Override expenses
      if (overrides.estimatedAnnualExpenses !== undefined) {
        result.estimatedAnnualExpenses = overrides.estimatedAnnualExpenses;
      }

      // Override account values (specific accounts or market shock)
      if (overrides.accountValues || overrides.marketShockPercent !== undefined) {
        result.accounts = household.accounts.map((acc) => {
          let value = acc.currentValue;

          // Apply market shock first
          if (overrides.marketShockPercent !== undefined) {
            value = value * (1 + overrides.marketShockPercent);
          }

          // Then apply specific account overrides
          if (overrides.accountValues?.[acc.id] !== undefined) {
            value = overrides.accountValues[acc.id];
          }

          if (value !== acc.currentValue) {
            return { ...acc, currentValue: Math.max(0, value) };
          }
          return acc;
        });
      }

      return result;
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
