"use client";

// ============================================================
// Scenario Mode Banner + Page Tint
// ============================================================
// Shows a prominent sticky banner when what-if mode is active.
// Also applies a subtle amber tint to the entire page background
// so users cannot mistake scenario data for real data.

import { FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useScenario } from "@/context/scenario-context";
import { useData } from "@/context/data-context";
import { useScenarioData } from "@/context/use-scenario-data";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";

export function ScenarioBanner() {
  const { isScenarioMode, scenarioLabel, disableScenario } = useScenario();
  const { getTotalNetWorth: getBaseNetWorth } = useData();
  const scenarioData = useScenarioData();

  if (!isScenarioMode) return null;

  const baseNW = getBaseNetWorth();
  const scenarioNW = scenarioData.getTotalNetWorth();
  const diff = scenarioNW - baseNW;
  const diffPct = baseNW > 0 ? (diff / baseNW) * 100 : 0;

  return (
    <>
      {/* Full-page amber tint overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-30 bg-amber-500/[0.04] dark:bg-amber-400/[0.06] print:hidden"
        aria-hidden="true"
      />

      {/* Sticky banner below nav */}
      <div className="sticky top-16 z-40 border-b-2 border-amber-400 bg-amber-50 px-4 py-2 shadow-sm dark:border-amber-700 dark:bg-amber-950 print:hidden">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800">
              <FlaskConical className="size-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-amber-900 dark:text-amber-100 truncate">
                  What-If: {scenarioLabel}
                </span>
                <Badge
                  variant="outline"
                  className="border-amber-400 text-[10px] text-amber-700 dark:border-amber-600 dark:text-amber-300 shrink-0 hidden sm:inline-flex"
                >
                  Not saved
                </Badge>
              </div>
              {/* Compact on mobile, full on desktop */}
              <p className="text-xs text-amber-700 dark:text-amber-400 tabular-nums">
                <span className="hidden sm:inline">
                  Net worth: {formatCurrency(baseNW)} &rarr; <span className="font-semibold">{formatCurrency(scenarioNW)}</span>
                </span>
                <span className="sm:hidden">
                  {formatCurrencyCompact(baseNW)} &rarr; <span className="font-semibold">{formatCurrencyCompact(scenarioNW)}</span>
                </span>
                {" "}
                <span className={diff < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                  ({diff >= 0 ? "+" : ""}{diffPct.toFixed(1)}%)
                </span>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={disableScenario}
            className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900"
          >
            <X className="mr-1 size-3" />
            <span className="hidden sm:inline">Exit What-If</span>
            <span className="sm:hidden">Exit</span>
          </Button>
        </div>
      </div>
    </>
  );
}
