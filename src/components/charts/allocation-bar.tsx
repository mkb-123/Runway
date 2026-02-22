"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatPercent } from "@/lib/format";

interface AllocationSegment {
  label: string;
  value: number;
  color: string;
}

interface AllocationBarProps {
  segments: AllocationSegment[];
  height?: number;
}

/**
 * Horizontal stacked bar chart — mobile-friendly replacement for pie charts.
 * Shows proportional allocation with tooltips for detail.
 */
export function AllocationBar({ segments, height = 32 }: AllocationBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  const nonZero = segments.filter((s) => s.value > 0);

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div
        className="flex w-full overflow-hidden rounded-lg"
        style={{ height }}
        role="img"
        aria-label="Allocation breakdown"
      >
        <TooltipProvider>
          {nonZero.map((segment, idx) => {
            const pct = segment.value / total;
            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <div
                    className="transition-all hover:opacity-80"
                    style={{
                      width: `${Math.max(pct * 100, 1)}%`,
                      backgroundColor: segment.color,
                      minWidth: pct > 0 ? "4px" : "0px",
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{segment.label}</p>
                  <p className="text-xs">{formatCurrency(segment.value)} ({formatPercent(pct)})</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {nonZero.map((segment, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs">
            <div
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="font-mono tabular-nums">{formatPercent(segment.value / total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
