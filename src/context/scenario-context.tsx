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
import type { HouseholdData, PersonIncome, RetirementConfig, Contribution } from "@/types";

// --- Scenario overrides ---

export interface ContributionOverride {
  personId: string;
  isaContribution?: number;
  pensionContribution?: number;
  giaContribution?: number;
}

export interface ScenarioOverrides {
  income?: Partial<PersonIncome>[];
  contributionOverrides?: ContributionOverride[];
  retirement?: Partial<RetirementConfig>;
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

      const result = { ...household };

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

      // Override contributions — replace per-person contributions with overrides
      if (
        overrides.contributionOverrides &&
        overrides.contributionOverrides.length > 0
      ) {
        // Keep contributions for persons not being overridden
        const overriddenPersonIds = new Set(overrides.contributionOverrides.map((o) => o.personId));
        const kept = household.contributions.filter((c) => !overriddenPersonIds.has(c.personId));

        // Create synthetic contributions from overrides
        const synthetic: Contribution[] = [];
        for (const ov of overrides.contributionOverrides) {
          if (ov.isaContribution !== undefined && ov.isaContribution > 0) {
            synthetic.push({ id: `scenario-isa-${ov.personId}`, personId: ov.personId, label: "ISA (scenario)", target: "isa", amount: ov.isaContribution, frequency: "annually" });
          }
          if (ov.pensionContribution !== undefined && ov.pensionContribution > 0) {
            synthetic.push({ id: `scenario-pension-${ov.personId}`, personId: ov.personId, label: "Pension (scenario)", target: "pension", amount: ov.pensionContribution, frequency: "annually" });
          }
          if (ov.giaContribution !== undefined && ov.giaContribution > 0) {
            synthetic.push({ id: `scenario-gia-${ov.personId}`, personId: ov.personId, label: "GIA (scenario)", target: "gia", amount: ov.giaContribution, frequency: "annually" });
          }
        }

        result.contributions = [...kept, ...synthetic];
      }

      // Override retirement config
      if (overrides.retirement) {
        result.retirement = { ...household.retirement, ...overrides.retirement };
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
