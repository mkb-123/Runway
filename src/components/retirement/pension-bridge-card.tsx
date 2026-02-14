"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScenarioDelta } from "@/components/scenario-delta";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import type { PensionBridgeResult } from "@/lib/projections";

interface PensionBridgeCardProps {
  bridgeResult: PensionBridgeResult;
  effectiveRetirementAge: number;
  pensionAccessAge: number;
  targetAnnualIncome: number;
  accessibleWealth: number;
  lockedWealth: number;
  /** Base (un-overridden) values for what-if comparison */
  baseAccessibleWealth?: number;
  baseLockedWealth?: number;
}

export function PensionBridgeCard({
  bridgeResult,
  effectiveRetirementAge,
  pensionAccessAge,
  targetAnnualIncome,
  accessibleWealth,
  lockedWealth,
  baseAccessibleWealth,
  baseLockedWealth,
}: PensionBridgeCardProps) {
  const totalWealth = accessibleWealth + lockedWealth;
  const accessiblePercent =
    totalWealth > 0 ? (accessibleWealth / totalWealth) * 100 : 0;
  const lockedPercent =
    totalWealth > 0 ? (lockedWealth / totalWealth) * 100 : 0;

  const bridgeYears = Math.max(0, pensionAccessAge - effectiveRetirementAge);
  const surplus = accessibleWealth - bridgeResult.bridgePotRequired;

  // No bridge needed if retiring at or after pension access age
  if (bridgeYears <= 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Badge variant="secondary" className="mb-3 text-sm px-4 py-1">
            No Bridge Needed
          </Badge>
          <p className="text-sm text-muted-foreground">
            Your planned retirement age ({effectiveRetirementAge}) is at or
            after pension access age ({pensionAccessAge}). No bridging required.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Pension Bridge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hero answer */}
        <div
          className={`rounded-xl p-5 ${
            bridgeResult.sufficient
              ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"
              : "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-semibold text-lg">
                {bridgeResult.sufficient
                  ? `You can bridge the gap to age ${pensionAccessAge}`
                  : `Shortfall bridging to age ${pensionAccessAge}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {bridgeYears} year{bridgeYears !== 1 ? "s" : ""} at{" "}
                {formatCurrencyCompact(targetAnnualIncome)}/yr from accessible
                savings before pensions unlock
              </p>
            </div>
            <Badge
              variant={bridgeResult.sufficient ? "default" : "destructive"}
              className="shrink-0 text-sm px-3 py-1"
            >
              {bridgeResult.sufficient ? "Sufficient" : "Shortfall"}
            </Badge>
          </div>

          {/* Key numbers */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Bridge pot needed</p>
              <p className="text-lg font-bold font-mono">
                {formatCurrencyCompact(bridgeResult.bridgePotRequired)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Accessible wealth
              </p>
              <p className="text-lg font-bold font-mono">
                {baseAccessibleWealth !== undefined ? (
                  <ScenarioDelta
                    base={baseAccessibleWealth}
                    scenario={accessibleWealth}
                    format={formatCurrencyCompact}
                  />
                ) : (
                  formatCurrencyCompact(accessibleWealth)
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {bridgeResult.sufficient ? "Surplus" : "Shortfall"}
              </p>
              <p
                className={`text-lg font-bold font-mono ${
                  bridgeResult.sufficient
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {bridgeResult.sufficient
                  ? `+${formatCurrency(surplus)}`
                  : `-${formatCurrency(bridgeResult.shortfall)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Accessible vs Locked wealth bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Wealth split</span>
            <span className="font-mono text-muted-foreground">
              {formatCurrencyCompact(totalWealth)} total
            </span>
          </div>
          <div className="relative h-6 w-full overflow-hidden rounded-full bg-muted">
            <div className="flex h-full">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${accessiblePercent}%` }}
              />
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${lockedPercent}%` }}
              />
            </div>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-sm bg-blue-500" />
              <span>
                Accessible{" "}
                {baseAccessibleWealth !== undefined ? (
                  <ScenarioDelta
                    base={baseAccessibleWealth}
                    scenario={accessibleWealth}
                    format={formatCurrencyCompact}
                  />
                ) : (
                  formatCurrencyCompact(accessibleWealth)
                )}{" "}
                ({accessiblePercent.toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-sm bg-amber-500" />
              <span>
                Locked{" "}
                {baseLockedWealth !== undefined ? (
                  <ScenarioDelta
                    base={baseLockedWealth}
                    scenario={lockedWealth}
                    format={formatCurrencyCompact}
                  />
                ) : (
                  formatCurrencyCompact(lockedWealth)
                )}{" "}
                ({lockedPercent.toFixed(0)}%)
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
