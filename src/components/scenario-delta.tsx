"use client";

// ============================================================
// ScenarioDelta — inline before/after comparison for what-if mode
// ============================================================
// When scenario mode is active and the value has changed, renders:
//   <dimmed strikethrough>original</dimmed> → new <colored>(±X%)</colored>
// Otherwise renders the formatted scenario value as-is.

import { useScenario } from "@/context/scenario-context";

interface ScenarioDeltaProps {
  /** The value from base (un-overridden) data */
  base: number;
  /** The value from scenario-adjusted data */
  scenario: number;
  /** Formatter for the number (e.g. formatCurrency) */
  format: (n: number) => string;
  /** Show the percentage difference (default true) */
  showPercent?: boolean;
  /** Tolerance for "same" — values within this are not flagged (default 0.50) */
  epsilon?: number;
}

export function ScenarioDelta({
  base,
  scenario,
  format,
  showPercent = true,
  epsilon = 0.5,
}: ScenarioDeltaProps) {
  const { isScenarioMode } = useScenario();

  const isDifferent = Math.abs(scenario - base) > epsilon;

  if (!isScenarioMode || !isDifferent) {
    return <>{format(scenario)}</>;
  }

  const diff = scenario - base;
  const pct = base !== 0 ? (diff / Math.abs(base)) * 100 : 0;
  const isPositive = diff > 0;

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-[0.8em] text-muted-foreground line-through decoration-muted-foreground/40">
        {format(base)}
      </span>
      <span className="text-[0.7em] text-muted-foreground/60" aria-hidden="true">{"\u2192"}</span>
      <span>{format(scenario)}</span>
      {showPercent && base !== 0 && (
        <span
          className={`text-[0.75em] font-medium rounded-full px-1.5 py-0.5 ${
            isPositive
              ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
              : "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40"
          }`}
        >
          {isPositive ? "+" : ""}
          {pct.toFixed(1)}%
        </span>
      )}
    </span>
  );
}
