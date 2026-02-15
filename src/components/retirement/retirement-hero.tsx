"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ScenarioDelta } from "@/components/scenario-delta";
import {
  formatCurrency,
  formatCurrencyCompact,
} from "@/lib/format";

interface RetirementHeroProps {
  currentPot: number;
  requiredPot: number;
  progressPercent: number;
  targetAnnualIncome: number;
  withdrawalRate: number;
  includeStatePension: boolean;
  totalStatePensionAnnual: number;
  /** Base (un-overridden) values for what-if comparison */
  baseCurrentPot?: number;
  baseProgressPercent?: number;
  baseRequiredPot?: number;
}

export function RetirementHero({
  currentPot,
  requiredPot,
  progressPercent,
  targetAnnualIncome,
  withdrawalRate,
  includeStatePension,
  totalStatePensionAnnual,
  baseCurrentPot,
  baseProgressPercent,
  baseRequiredPot,
}: RetirementHeroProps) {
  const remaining = requiredPot - currentPot;
  const clampedPercent = Math.min(progressPercent, 100);

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/8 via-primary/4 to-card shadow-sm">
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -right-6 -top-6 size-32 rounded-full bg-primary/5" />

      <CardContent className="relative pt-6 pb-6 space-y-5">
        {/* Main progress display */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Retirement Progress
            </p>
            <p className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
              {baseProgressPercent !== undefined ? (
                <ScenarioDelta
                  base={baseProgressPercent}
                  scenario={progressPercent}
                  format={(n) => `${n.toFixed(1)}%`}
                  epsilon={0.05}
                />
              ) : (
                `${progressPercent.toFixed(1)}%`
              )}
            </p>
            <p className="text-sm text-muted-foreground mt-1 tabular-nums">
              {remaining > 0
                ? `${formatCurrencyCompact(remaining)} remaining`
                : "Target reached"}
            </p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Current pot</p>
              <p className="text-lg font-bold font-mono">
                {baseCurrentPot !== undefined ? (
                  <ScenarioDelta
                    base={baseCurrentPot}
                    scenario={currentPot}
                    format={formatCurrencyCompact}
                  />
                ) : (
                  formatCurrencyCompact(currentPot)
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Target pot</p>
              <p className="text-lg font-bold font-mono">
                {baseRequiredPot !== undefined ? (
                  <ScenarioDelta
                    base={baseRequiredPot}
                    scenario={requiredPot}
                    format={formatCurrencyCompact}
                  />
                ) : (
                  formatCurrencyCompact(requiredPot)
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>£0</span>
            <span>{formatCurrencyCompact(requiredPot)}</span>
          </div>
        </div>

        {/* Supporting details */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground border-t pt-3 tabular-nums">
          <span>
            Target income: {formatCurrency(targetAnnualIncome)}/yr
          </span>
          <span>SWR: {(withdrawalRate * 100).toFixed(1)}%</span>
          {includeStatePension && totalStatePensionAnnual > 0 && (
            <span>
              Incl. state pension: {formatCurrency(totalStatePensionAnnual)}/yr
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
