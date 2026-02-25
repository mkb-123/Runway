"use client";

import type { SensitivityResult } from "@/lib/sensitivity";
import { formatCurrencyCompact } from "@/lib/format";

interface SensitivityChartProps {
  result: SensitivityResult;
  /** Maximum number of inputs to show (default 7) */
  maxItems?: number;
}

/**
 * Tornado chart showing which inputs have the biggest impact
 * on the projected pot at retirement.
 */
export function SensitivityChart({ result, maxItems = 7 }: SensitivityChartProps) {
  const items = result.inputs.slice(0, maxItems);
  if (items.length === 0) return null;

  const maxAbsImpact = Math.max(...items.map((i) => Math.abs(i.impact)));

  return (
    <div className="space-y-3" role="img" aria-label="Sensitivity analysis tornado chart">
      {items.map((input) => {
        const isPositive = input.impact > 0;
        const widthPercent = maxAbsImpact > 0
          ? (Math.abs(input.impact) / maxAbsImpact) * 100
          : 0;

        return (
          <div key={input.label} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium truncate mr-2">{input.label}</span>
              <span className={`tabular-nums text-xs font-mono shrink-0 ${
                isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}>
                {isPositive ? "+" : ""}{formatCurrencyCompact(input.impact)}
              </span>
            </div>
            <div className="h-5 w-full rounded-sm bg-muted relative overflow-hidden">
              <div
                className={`h-full rounded-sm transition-all duration-300 ${
                  isPositive
                    ? "bg-emerald-500/70 dark:bg-emerald-600/70"
                    : "bg-red-500/70 dark:bg-red-600/70"
                }`}
                style={{ width: `${Math.max(2, widthPercent)}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">
              Currently: {input.unit === "£" ? formatCurrencyCompact(input.currentValue) :
                input.unit === "%" ? `${input.currentValue.toFixed(1)}%` :
                `${input.currentValue} ${input.unit}`}
              {" · "}
              Impact of {input.unit === "%" ? "+1pp" :
                input.unit === "years" ? "+1 year" :
                "+10%"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
