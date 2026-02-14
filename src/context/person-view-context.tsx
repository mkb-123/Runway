"use client";

// ============================================================
// Person View Context - Per-person / household filter
// ============================================================
// Provides a session-level filter for switching between
// individual person views and the combined household view.
// Selection persists across page navigations within a session.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

/** "household" = combined view, otherwise a person ID */
export type PersonViewFilter = "household" | string;

interface PersonViewContextValue {
  /** Currently selected person ID or "household" */
  selectedView: PersonViewFilter;
  /** Update the current view */
  setSelectedView: (view: PersonViewFilter) => void;
  /** Whether showing combined household view */
  isHouseholdView: boolean;
}

const PersonViewContext = createContext<PersonViewContextValue | null>(null);

export function PersonViewProvider({ children }: { children: ReactNode }) {
  const [selectedView, setSelectedViewState] = useState<PersonViewFilter>("household");

  const setSelectedView = useCallback((view: PersonViewFilter) => {
    setSelectedViewState(view);
  }, []);

  const isHouseholdView = selectedView === "household";

  const value = useMemo<PersonViewContextValue>(
    () => ({ selectedView, setSelectedView, isHouseholdView }),
    [selectedView, setSelectedView, isHouseholdView]
  );

  return (
    <PersonViewContext.Provider value={value}>
      {children}
    </PersonViewContext.Provider>
  );
}

export function usePersonView(): PersonViewContextValue {
  const context = useContext(PersonViewContext);
  if (context === null) {
    throw new Error("usePersonView must be used within a <PersonViewProvider>");
  }
  return context;
}
