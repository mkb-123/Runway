"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Settings,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Lightbulb,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
} from "@/lib/format";
import { useData } from "@/context/data-context";
import { useScenarioData } from "@/context/use-scenario-data";
import { projectScenarios } from "@/lib/projections";
import {
  generateRecommendations,
  type RecommendationPriority,
} from "@/lib/recommendations";
import { TAX_WRAPPER_LABELS } from "@/types";
import type { TaxWrapper } from "@/types";

import { NetWorthTrajectoryChart } from "@/components/charts/net-worth-trajectory";
import { NetWorthHistoryChart } from "@/components/charts/net-worth-history";
import { ByPersonChart } from "@/components/charts/by-person-chart";

const priorityConfig: Record<
  RecommendationPriority,
  { label: string; color: string; bg: string; border: string }
> = {
  high: {
    label: "High",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-900",
  },
  medium: {
    label: "Medium",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950",
    border: "border-amber-200 dark:border-amber-900",
  },
  low: {
    label: "Low",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-200 dark:border-blue-900",
  },
};

export default function Home() {
  // --- Data Loading ---
  const {
    snapshots: snapshotsData,
    transactions: transactionsData,
  } = useData();

  // Scenario-aware data
  const scenarioData = useScenarioData();
  const household = scenarioData.household;
  const totalNetWorth = scenarioData.getTotalNetWorth();
  const byPerson = scenarioData.getNetWorthByPerson();
  const byWrapper = scenarioData.getNetWorthByWrapper();

  const { snapshots } = snapshotsData;

  // --- Recommendations ---
  const recommendations = useMemo(
    () => generateRecommendations(household, transactionsData),
    [household, transactionsData]
  );

  const highPriorityCount = recommendations.filter(
    (r) => r.priority === "high"
  ).length;

  // --- Snapshot Change Calculations ---
  const {
    monthOnMonthChange,
    monthOnMonthPercent,
    yearOnYearChange,
    yearOnYearPercent,
    latestSnapshot,
  } = useMemo(() => {
    const latest = snapshots[snapshots.length - 1];
    const previous =
      snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

    const moMChange =
      latest && previous
        ? latest.totalNetWorth - previous.totalNetWorth
        : 0;
    const moMPercent =
      previous && previous.totalNetWorth > 0
        ? moMChange / previous.totalNetWorth
        : 0;

    // Year-on-year: find a snapshot roughly 12 months before the latest
    const latestDate = new Date(latest?.date ?? new Date());
    const oneYearAgo = new Date(latestDate);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const yearAgoSnapshot = snapshots.reduce<(typeof snapshots)[number] | null>(
      (closest, snap) => {
        const snapDate = new Date(snap.date);
        if (!closest) return snap;
        const closestDiff = Math.abs(
          new Date(closest.date).getTime() - oneYearAgo.getTime()
        );
        const snapDiff = Math.abs(snapDate.getTime() - oneYearAgo.getTime());
        return snapDiff < closestDiff ? snap : closest;
      },
      null
    );

    const yoYChange =
      latest && yearAgoSnapshot
        ? latest.totalNetWorth - yearAgoSnapshot.totalNetWorth
        : 0;
    const yoYPercent =
      yearAgoSnapshot && yearAgoSnapshot.totalNetWorth > 0
        ? yoYChange / yearAgoSnapshot.totalNetWorth
        : 0;

    return {
      monthOnMonthChange: moMChange,
      monthOnMonthPercent: moMPercent,
      yearOnYearChange: yoYChange,
      yearOnYearPercent: yoYPercent,
      latestSnapshot: latest,
    };
  }, [snapshots]);

  // --- Projections ---
  const { scenarios, scenarioRates, projectionYears, milestones } = useMemo(() => {
    const totalMonthlyContributions = household.annualContributions.reduce(
      (sum, c) =>
        sum + (c.isaContribution + c.pensionContribution + c.giaContribution) / 12,
      0
    );

    const rates = household.retirement.scenarioRates;
    const years = 30;
    const projScenarios = projectScenarios(
      totalNetWorth,
      totalMonthlyContributions,
      rates,
      years
    );

    // --- Milestones ---
    const targetPot =
      household.retirement.withdrawalRate > 0
        ? household.retirement.targetAnnualIncome /
          household.retirement.withdrawalRate
        : 0;

    const ms = [
      { label: "FIRE Target", value: targetPot },
      { label: "\u00A31m", value: 1_000_000 },
      { label: "\u00A32m", value: 2_000_000 },
    ].filter((m) => m.value > 0);

    return {
      scenarios: projScenarios,
      scenarioRates: rates,
      projectionYears: years,
      milestones: ms,
    };
  }, [household, totalNetWorth]);

  // --- Per-person data for donut chart ---
  const personChartData = useMemo(
    () =>
      byPerson.map((p) => ({
        name: p.name,
        value: p.value,
      })),
    [byPerson]
  );

  // --- Wrapper order for consistent display ---
  const wrapperData = useMemo(() => {
    const wrapperOrder: TaxWrapper[] = [
      "pension",
      "isa",
      "gia",
      "cash",
      "premium_bonds",
    ];

    return wrapperOrder
      .map((wrapper) => {
        const found = byWrapper.find((bw) => bw.wrapper === wrapper);
        return {
          wrapper,
          label: TAX_WRAPPER_LABELS[wrapper],
          value: found?.value ?? 0,
          percent: found && totalNetWorth > 0 ? found.value / totalNetWorth : 0,
        };
      })
      .filter((w) => w.value > 0);
  }, [byWrapper, totalNetWorth]);

  // --- Banner dismiss state ---
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return true; // SSR: default hidden to prevent flash
    try {
      return localStorage.getItem("nw-banner-dismissed") === "true";
    } catch {
      return false;
    }
  });

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try {
      localStorage.setItem("nw-banner-dismissed", "true");
    } catch {
      // localStorage unavailable
    }
  }, []);

  const changeIndicator = (value: number) =>
    value >= 0 ? "text-emerald-600" : "text-red-600";
  const changePrefix = (value: number) => (value >= 0 ? "+" : "");
  const trendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="inline size-4" aria-label="increased" />;
    if (value < 0) return <TrendingDown className="inline size-4" aria-label="decreased" />;
    return <Minus className="inline size-4" aria-label="unchanged" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Getting Started Banner */}
        {!bannerDismissed && (
          <div className="relative mb-6 rounded-lg border-2 border-primary/20 bg-primary/5 p-4 sm:p-6">
            <button
              onClick={dismissBanner}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
              aria-label="Dismiss getting started banner"
            >
              <X className="size-4" />
            </button>
            <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground sm:text-xl">
                  Getting Started
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Head to <strong>Settings</strong> first to enter your personal financial data — accounts, income, holdings, and goals.
                  All other pages compute from the data you provide there.
                </p>
              </div>
              <Link href="/settings">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  <Settings className="size-4" />
                  Open Settings
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Net Worth Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Household financial overview as of{" "}
            {latestSnapshot
              ? new Intl.DateTimeFormat("en-GB", {
                  month: "long",
                  year: "numeric",
                }).format(new Date(latestSnapshot.date))
              : "now"}
          </p>
        </div>

        {/* ============================================================ */}
        {/* Section 1: Summary Cards Row                                 */}
        {/* ============================================================ */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Net Worth */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Net Worth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-tight">
                {formatCurrency(totalNetWorth)}
              </p>
            </CardContent>
          </Card>

          {/* Per-person cards */}
          {byPerson.map((person) => (
            <Card key={person.personId}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {person.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tracking-tight">
                  {formatCurrency(person.value)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {totalNetWorth > 0
                    ? formatPercent(person.value / totalNetWorth)
                    : "0%"}{" "}
                  of total
                </p>
              </CardContent>
            </Card>
          ))}

          {/* Month-on-month change */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Period Change
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`flex items-center gap-1.5 text-2xl font-bold tracking-tight ${changeIndicator(monthOnMonthChange)}`}
              >
                {trendIcon(monthOnMonthChange)}
                <span>
                  {changePrefix(monthOnMonthChange)}
                  {formatCurrencyCompact(monthOnMonthChange)}
                </span>
              </p>
              <p
                className={`mt-1 text-sm ${changeIndicator(monthOnMonthPercent)}`}
              >
                {changePrefix(monthOnMonthPercent)}
                {formatPercent(monthOnMonthPercent)} vs previous snapshot
              </p>
            </CardContent>
          </Card>

          {/* Year-on-year change */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Year-on-Year Change
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`flex items-center gap-1.5 text-2xl font-bold tracking-tight ${changeIndicator(yearOnYearChange)}`}
              >
                {trendIcon(yearOnYearChange)}
                <span>
                  {changePrefix(yearOnYearChange)}
                  {formatCurrencyCompact(yearOnYearChange)}
                </span>
              </p>
              <p
                className={`mt-1 text-sm ${changeIndicator(yearOnYearPercent)}`}
              >
                {changePrefix(yearOnYearPercent)}
                {formatPercent(yearOnYearPercent)} year-on-year
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* Section 2: Actionable Recommendations                        */}
        {/* ============================================================ */}
        {recommendations.length > 0 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xl font-semibold text-foreground">
                Recommended Actions
              </h2>
              {highPriorityCount > 0 && (
                <Badge variant="destructive">
                  {highPriorityCount} high priority
                </Badge>
              )}
            </div>
            <div className="grid gap-3">
              {recommendations.slice(0, 5).map((rec) => {
                const config = priorityConfig[rec.priority];
                return (
                  <Card
                    key={rec.id}
                    className={`border ${config.border} ${config.bg}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <Lightbulb
                          className={`mt-0.5 size-5 shrink-0 ${config.color}`}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{rec.title}</h3>
                            <Badge
                              variant="outline"
                              className={`text-xs ${config.color}`}
                            >
                              {config.label}
                            </Badge>
                            {rec.personName && (
                              <Badge variant="secondary" className="text-xs">
                                {rec.personName}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {rec.description}
                          </p>
                          <p className="text-sm font-medium">{rec.impact}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {recommendations.length > 5 && (
                <p className="text-center text-sm text-muted-foreground">
                  +{recommendations.length - 5} more recommendations
                </p>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* Section 3: Net Worth by Wrapper                              */}
        {/* ============================================================ */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Net Worth by Tax Wrapper
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {wrapperData.map((w) => (
              <Card key={w.wrapper}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {w.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold tracking-tight">
                    {formatCurrency(w.value)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPercent(w.percent)} of total
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ============================================================ */}
        {/* Section 4: Net Worth Trajectory Chart                        */}
        {/* ============================================================ */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Net Worth Trajectory</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Historical net worth with projected growth at{" "}
                {scenarioRates
                  .map((r) => `${(r * 100).toFixed(0)}%`)
                  .join(", ")}{" "}
                annual returns over {projectionYears} years.
              </p>
              <NetWorthTrajectoryChart
                snapshots={snapshots}
                scenarios={scenarios}
                milestones={milestones}
              />
            </CardContent>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* Section 5: Net Worth History Chart (stacked area)            */}
        {/* ============================================================ */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Net Worth History by Wrapper</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Historical breakdown of net worth across tax wrappers.
              </p>
              <NetWorthHistoryChart snapshots={snapshots} />
            </CardContent>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* Section 6: By Person Breakdown                               */}
        {/* ============================================================ */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Net Worth by Person</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Share of total household net worth per person.
              </p>
              <ByPersonChart data={personChartData} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
