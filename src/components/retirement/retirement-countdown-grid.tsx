"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPercent, formatCurrencyCompact } from "@/lib/format";
import { calculateRetirementCountdown } from "@/lib/projections";

interface RetirementCountdownGridProps {
  currentPot: number;
  totalAnnualContributions: number;
  requiredPot: number;
  scenarioRates: number[];
  currentAge: number;
  selectedRateIndex: number;
}

export function RetirementCountdownGrid({
  currentPot,
  totalAnnualContributions,
  requiredPot,
  scenarioRates,
  currentAge,
  selectedRateIndex,
}: RetirementCountdownGridProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground mb-4">
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
                  {targetReached ? "Now" : `${countdown.years}y ${countdown.months}m`}
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
