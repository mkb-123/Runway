"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScenarioDelta } from "@/components/scenario-delta";
import { formatPercent, formatCurrencyCompact } from "@/lib/format";
import { calculateRetirementCountdown } from "@/lib/projections";

interface RetirementCountdownGridProps {
  currentPot: number;
  totalAnnualContributions: number;
  requiredPot: number;
  scenarioRates: number[];
  currentAge: number;
  selectedRateIndex: number;
  /** Base (un-overridden) values for what-if comparison */
  baseCurrentPot?: number;
  baseTotalAnnualContributions?: number;
  baseRequiredPot?: number;
}

export function RetirementCountdownGrid({
  currentPot,
  totalAnnualContributions,
  requiredPot,
  scenarioRates,
  currentAge,
  selectedRateIndex,
  baseCurrentPot,
  baseTotalAnnualContributions,
  baseRequiredPot,
}: RetirementCountdownGridProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground mb-4 tabular-nums">
          Estimated time to reach {formatCurrencyCompact(requiredPot)} target
        </p>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {scenarioRates.map((rate, idx) => {
            const countdown = calculateRetirementCountdown(
              currentPot,
              totalAnnualContributions,
              requiredPot,
              rate
            );
            const isSelected = idx === selectedRateIndex;
            const targetReached =
              countdown.years === 0 && countdown.months === 0;

            // Base countdown for what-if comparison
            const hasBase = baseCurrentPot !== undefined && baseTotalAnnualContributions !== undefined && baseRequiredPot !== undefined;
            const baseCountdown = hasBase
              ? calculateRetirementCountdown(baseCurrentPot, baseTotalAnnualContributions, baseRequiredPot, rate)
              : null;
            const baseTotalMonths = baseCountdown ? baseCountdown.years * 12 + baseCountdown.months : 0;
            const scenarioTotalMonths = countdown.years * 12 + countdown.months;

            return (
              <div
                key={rate}
                className={`rounded-lg border p-4 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border opacity-70"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant={isSelected ? "default" : "secondary"}
                  >
                    {formatPercent(rate)}
                  </Badge>
                  {isSelected && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Selected
                    </span>
                  )}
                </div>
                <p
                  className={`text-3xl font-bold ${
                    isSelected ? "" : "text-muted-foreground"
                  }`}
                >
                  {hasBase ? (
                    <ScenarioDelta
                      base={baseTotalMonths}
                      scenario={scenarioTotalMonths}
                      format={(n) => {
                        if (n === 0) return "Now";
                        const y = Math.floor(n / 12);
                        const m = Math.round(n % 12);
                        return `${y}y ${m}m`;
                      }}
                      showPercent={false}
                    />
                  ) : (
                    targetReached ? "Now" : `${countdown.years}y ${countdown.months}m`
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {targetReached
                    ? "Target already reached"
                    : `Approx. age ${currentAge + countdown.years}`}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
