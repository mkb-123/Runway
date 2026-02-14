"use client";

import { formatCurrencyCompact } from "@/lib/format";
import type { HouseholdData } from "@/types";

interface SettingsSummaryBarProps {
  household: HouseholdData;
}

export function SettingsSummaryBar({ household }: SettingsSummaryBarProps) {
  const totalNetWorth = household.accounts.reduce(
    (sum, a) => sum + a.currentValue,
    0
  );

  const totalIncome = household.income.reduce(
    (sum, i) => sum + i.grossSalary,
    0
  );

  const retirementTarget = household.retirement.targetAnnualIncome;
  const withdrawalRate = household.retirement.withdrawalRate;
  const retirementPot =
    withdrawalRate > 0 ? retirementTarget / withdrawalRate : 0;
  const gap = retirementPot > 0 ? retirementPot - totalNetWorth : 0;
  const progress =
    retirementPot > 0
      ? Math.min(100, Math.round((totalNetWorth / retirementPot) * 100))
      : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
      <div>
        <span className="text-muted-foreground">Net worth </span>
        <span className="font-semibold tabular-nums">
          {formatCurrencyCompact(totalNetWorth)}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground">Income </span>
        <span className="font-semibold tabular-nums">
          {formatCurrencyCompact(totalIncome)}
        </span>
      </div>
      {retirementPot > 0 && (
        <>
          <div>
            <span className="text-muted-foreground">Retirement target </span>
            <span className="font-semibold tabular-nums">
              {formatCurrencyCompact(retirementPot)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Gap </span>
            <span
              className={`font-semibold tabular-nums ${
                gap <= 0 ? "text-green-600" : "text-amber-600"
              }`}
            >
              {gap <= 0
                ? "On track"
                : formatCurrencyCompact(gap)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full bg-muted">
              <div
                className={`h-2 rounded-full transition-all ${
                  progress >= 100 ? "bg-green-600" : "bg-primary"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {progress}%
            </span>
          </div>
        </>
      )}
      <div className="text-muted-foreground">
        {household.persons.length} person{household.persons.length !== 1 ? "s" : ""} · {household.accounts.length} account{household.accounts.length !== 1 ? "s" : ""} · {household.funds.length} fund{household.funds.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
