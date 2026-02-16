"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ScenarioDelta } from "@/components/scenario-delta";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
} from "@/lib/format";

interface RetirementHeroProps {
  currentPot: number;
  requiredPot: number;
  progressPercent: number;
  targetAnnualIncome: number;
  withdrawalRate: number;
  includeStatePension: boolean;
  totalStatePensionAnnual: number;
  /** Projected pot at retirement (with contributions + growth) */
  projectedPotAtRetirement: number;
  /** Sustainable annual income from projected pot (SWR * projected pot) */
  sustainableIncome: number;
  /** Total projected income including state pension */
  totalProjectedIncome: number;
  /** Years until retirement */
  yearsToRetirement: number;
  /** Growth rate used for projection */
  growthRate: number;
  /** Base (un-overridden) values for what-if comparison */
  baseCurrentPot?: number;
  baseProgressPercent?: number;
  baseRequiredPot?: number;
  baseProjectedPotAtRetirement?: number;
  baseSustainableIncome?: number;
  baseTotalProjectedIncome?: number;
}

export function RetirementHero({
  currentPot,
  requiredPot,
  progressPercent,
  targetAnnualIncome,
  withdrawalRate,
  includeStatePension,
  totalStatePensionAnnual,
  projectedPotAtRetirement,
  sustainableIncome,
  totalProjectedIncome,
  yearsToRetirement,
  growthRate,
  baseCurrentPot,
  baseProgressPercent,
  baseRequiredPot,
  baseProjectedPotAtRetirement,
  baseSustainableIncome,
  baseTotalProjectedIncome,
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

        {/* Estimated pot at retirement & projected income */}
        {yearsToRetirement > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Estimated pot at retirement</p>
                <p className="text-lg font-bold font-mono">
                  {baseProjectedPotAtRetirement !== undefined ? (
                    <ScenarioDelta
                      base={baseProjectedPotAtRetirement}
                      scenario={projectedPotAtRetirement}
                      format={formatCurrencyCompact}
                    />
                  ) : (
                    formatCurrencyCompact(projectedPotAtRetirement)
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  in {yearsToRetirement}yr at {formatPercent(growthRate)} growth
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sustainable drawdown</p>
                <p className="text-lg font-bold font-mono">
                  {baseSustainableIncome !== undefined ? (
                    <ScenarioDelta
                      base={baseSustainableIncome}
                      scenario={sustainableIncome}
                      format={(n) => `${formatCurrencyCompact(n)}/yr`}
                    />
                  ) : (
                    <>{formatCurrencyCompact(sustainableIncome)}/yr</>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  at {(withdrawalRate * 100).toFixed(1)}% SWR
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total retirement income</p>
                <p className="text-lg font-bold font-mono text-primary">
                  {baseTotalProjectedIncome !== undefined ? (
                    <ScenarioDelta
                      base={baseTotalProjectedIncome}
                      scenario={totalProjectedIncome}
                      format={(n) => `${formatCurrencyCompact(n)}/yr`}
                    />
                  ) : (
                    <>{formatCurrencyCompact(totalProjectedIncome)}/yr</>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  drawdown{includeStatePension && totalStatePensionAnnual > 0
                    ? ` + ${formatCurrencyCompact(totalStatePensionAnnual)} state pension`
                    : ""}
                </p>
              </div>
            </div>
            {totalProjectedIncome < targetAnnualIncome ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Shortfall of {formatCurrencyCompact(targetAnnualIncome - totalProjectedIncome)}/yr vs your {formatCurrencyCompact(targetAnnualIncome)} target
              </p>
            ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Exceeds target by {formatCurrencyCompact(totalProjectedIncome - targetAnnualIncome)}/yr
              </p>
            )}
          </div>
        )}

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
