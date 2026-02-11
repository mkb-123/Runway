"use client";

import { formatCurrencyCompact } from "@/lib/format";

interface RetirementProgressProps {
  currentPot: number;
  requiredPot: number;
  progressPercent: number;
}

export function RetirementProgress({
  currentPot,
  requiredPot,
  progressPercent,
}: RetirementProgressProps) {
  const clampedPercent = Math.min(progressPercent, 100);

  return (
    <div className="w-full space-y-3">
      {/* Progress bar */}
      <div className="relative h-8 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
          style={{ width: `${clampedPercent}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
          <span
            className={
              clampedPercent > 50
                ? "text-white drop-shadow-sm"
                : "text-foreground"
            }
          >
            {progressPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{formatCurrencyCompact(currentPot)} current</span>
        <span>{formatCurrencyCompact(requiredPot)} target</span>
      </div>
    </div>
  );
}
