"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Settings,
  TrendingUp,
  TrendingDown,
  X,
  Lightbulb,
  Printer,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
} from "@/lib/format";
import { useData } from "@/context/data-context";
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { CollapsibleSection } from "@/components/collapsible-section";
import { projectScenarios } from "@/lib/projections";
import {
  calculateRetirementCountdown,
  calculateAdjustedRequiredPot,
  calculateProRataStatePension,
} from "@/lib/projections";
import {
  generateRecommendations,
  type RecommendationPriority,
  type Recommendation,
} from "@/lib/recommendations";
import { annualiseOutgoing, annualiseContribution } from "@/types";
import { TAX_WRAPPER_LABELS } from "@/types";
import type { TaxWrapper, HeroMetricType } from "@/types";

import { NetWorthTrajectoryChart } from "@/components/charts/net-worth-trajectory";
import { NetWorthHistoryChart } from "@/components/charts/net-worth-history";
import { ByPersonChart } from "@/components/charts/by-person-chart";
import { WrapperSplitChart } from "@/components/charts/wrapper-split-chart";

// ============================================================
// Hero Metric — one of 3 configurable slots above the fold
// ============================================================

interface HeroMetricData {
  totalNetWorth: number;
  cashPosition: number;
  monthOnMonthChange: number;
  monthOnMonthPercent: number;
  yearOnYearChange: number;
  yearOnYearPercent: number;
  retirementCountdownYears: number;
  retirementCountdownMonths: number;
  savingsRate: number;
  fireProgress: number;
  netWorthAfterCommitments: number;
  totalAnnualCommitments: number;
}

function resolveMetric(
  type: HeroMetricType,
  data: HeroMetricData
): { label: string; value: string; subtext?: string; color: string; trend?: "up" | "down" } {
  switch (type) {
    case "net_worth":
      return {
        label: "Net Worth",
        value: formatCurrencyCompact(data.totalNetWorth),
        color: "",
      };
    case "cash_position":
      return {
        label: "Cash Position",
        value: formatCurrencyCompact(data.cashPosition),
        color: "",
      };
    case "retirement_countdown": {
      const y = data.retirementCountdownYears;
      const m = data.retirementCountdownMonths;
      return {
        label: "Retirement",
        value: y === 0 && m === 0 ? "On track" : `${y}y ${m}m`,
        subtext: y === 0 && m === 0 ? "Target pot reached" : "to target",
        color: "",
      };
    }
    case "period_change": {
      const v = data.monthOnMonthChange;
      const color = v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-600 dark:text-red-400" : "";
      return {
        label: "Period Change",
        value: `${v >= 0 ? "+" : ""}${formatCurrencyCompact(v)}`,
        subtext: `${v >= 0 ? "+" : ""}${formatPercent(data.monthOnMonthPercent)} MoM`,
        color,
        trend: v > 0 ? "up" : v < 0 ? "down" : undefined,
      };
    }
    case "year_on_year_change": {
      const v = data.yearOnYearChange;
      const color = v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-600 dark:text-red-400" : "";
      return {
        label: "Year-on-Year",
        value: `${v >= 0 ? "+" : ""}${formatCurrencyCompact(v)}`,
        subtext: `${v >= 0 ? "+" : ""}${formatPercent(data.yearOnYearPercent)} YoY`,
        color,
        trend: v > 0 ? "up" : v < 0 ? "down" : undefined,
      };
    }
    case "savings_rate":
      return {
        label: "Savings Rate",
        value: `${data.savingsRate.toFixed(1)}%`,
        subtext: "of gross income",
        color: "",
      };
    case "fire_progress":
      return {
        label: "FIRE Progress",
        value: `${data.fireProgress.toFixed(1)}%`,
        subtext: "of target pot",
        color: data.fireProgress >= 100 ? "text-emerald-600 dark:text-emerald-400" : "",
      };
    case "net_worth_after_commitments":
      return {
        label: "After Commitments",
        value: formatCurrencyCompact(data.netWorthAfterCommitments),
        subtext: `${formatCurrencyCompact(data.totalAnnualCommitments)}/yr committed`,
        color: "",
      };
  }
}

function HeroMetric({ type, data, primary }: { type: HeroMetricType; data: HeroMetricData; primary?: boolean }) {
  const { label, value, subtext, color, trend } = resolveMetric(type, data);
  return (
    <div className={`flex flex-col gap-1 ${!primary ? "sm:border-l sm:border-border/40 sm:pl-6" : ""}`}>
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className={`${primary ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"} font-bold tracking-tight tabular-nums ${color}`}>
          {value}
        </span>
        {trend === "up" && <TrendingUp className="size-5 text-emerald-500" />}
        {trend === "down" && <TrendingDown className="size-5 text-red-500" />}
      </div>
      {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
    </div>
  );
}

// ============================================================
// Collapsible Dashboard Section — progressive disclosure
// ============================================================

// CollapsibleSection is now the shared CollapsibleSection component

// ============================================================
// Recommendation Card
// ============================================================

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

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const config = priorityConfig[rec.priority];
  return (
    <Card className={`border ${config.border} ${config.bg}`}>
      <CardContent className="py-3">
        <div className="flex items-start gap-3">
          <Lightbulb className={`mt-0.5 size-4 shrink-0 ${config.color}`} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{rec.title}</h3>
              <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                {config.label}
              </Badge>
              {rec.personName && (
                <Badge variant="secondary" className="text-[10px]">
                  {rec.personName}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{rec.description}</p>
            <p className="text-xs font-medium">{rec.impact}</p>
            {rec.actionUrl && (
              <Link
                href={rec.actionUrl}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Take action <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Dashboard
// ============================================================

export default function Home() {
  const { snapshots: snapshotsData } = useData();
  const scenarioData = useScenarioData();
  const household = scenarioData.household;
  const totalNetWorth = scenarioData.getTotalNetWorth();
  const byPerson = scenarioData.getNetWorthByPerson();
  const byWrapper = scenarioData.getNetWorthByWrapper();
  const { selectedView } = usePersonView();
  const { snapshots } = snapshotsData;

  // --- Person filtering ---
  const filteredAccounts = useMemo(() => {
    if (selectedView === "household") return household.accounts;
    return household.accounts.filter((a) => a.personId === selectedView);
  }, [household.accounts, selectedView]);

  const filteredNetWorth = useMemo(
    () => filteredAccounts.reduce((sum, a) => sum + a.currentValue, 0),
    [filteredAccounts]
  );

  // --- Cash position ---
  const cashPosition = useMemo(
    () =>
      filteredAccounts
        .filter((a) => a.type === "cash_savings" || a.type === "cash_isa" || a.type === "premium_bonds")
        .reduce((sum, a) => sum + a.currentValue, 0),
    [filteredAccounts]
  );

  // --- Committed outgoings + lifestyle spending ---
  const totalAnnualCommitments = useMemo(
    () => {
      const committed = household.committedOutgoings.reduce((sum, o) => sum + annualiseOutgoing(o.amount, o.frequency), 0);
      const lifestyle = household.emergencyFund.monthlyLifestyleSpending * 12;
      return committed + lifestyle;
    },
    [household.committedOutgoings, household.emergencyFund.monthlyLifestyleSpending]
  );

  // --- Recommendations ---
  const recommendations = useMemo(
    () => generateRecommendations(household),
    [household]
  );

  const filteredRecommendations = useMemo(() => {
    if (selectedView === "household") return recommendations;
    return recommendations.filter(
      (r) =>
        !r.personName ||
        r.personName === household.persons.find((p) => p.id === selectedView)?.name
    );
  }, [recommendations, selectedView, household.persons]);

  // showAllRecs removed — recommendations now in CollapsibleSection

  // --- Snapshot changes ---
  const { monthOnMonthChange, monthOnMonthPercent, yearOnYearChange, yearOnYearPercent, latestSnapshot } =
    useMemo(() => {
      const latest = snapshots[snapshots.length - 1];
      const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
      const moMChange = latest && previous ? latest.totalNetWorth - previous.totalNetWorth : 0;
      const moMPercent = previous && previous.totalNetWorth > 0 ? moMChange / previous.totalNetWorth : 0;

      const latestDate = new Date(latest?.date ?? new Date());
      const oneYearAgo = new Date(latestDate);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const yearAgoSnapshot = snapshots.reduce<(typeof snapshots)[number] | null>((closest, snap) => {
        const snapDate = new Date(snap.date);
        if (!closest) return snap;
        return Math.abs(snapDate.getTime() - oneYearAgo.getTime()) <
          Math.abs(new Date(closest.date).getTime() - oneYearAgo.getTime())
          ? snap
          : closest;
      }, null);

      const yoYChange = latest && yearAgoSnapshot ? latest.totalNetWorth - yearAgoSnapshot.totalNetWorth : 0;
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

  // --- Household state pension total ---
  const totalStatePensionAnnual = useMemo(
    () => household.persons.reduce((sum, p) => sum + calculateProRataStatePension(p.niQualifyingYears), 0),
    [household.persons]
  );

  // --- Retirement countdown ---
  const { retirementCountdownYears, retirementCountdownMonths } = useMemo(() => {
    const { retirement, contributions } = household;
    const totalAnnual = contributions.reduce(
      (sum, c) => sum + annualiseContribution(c.amount, c.frequency),
      0
    );
    const requiredPot = calculateAdjustedRequiredPot(
      retirement.targetAnnualIncome, retirement.withdrawalRate,
      retirement.includeStatePension, totalStatePensionAnnual
    );
    const midRate = retirement.scenarioRates[Math.floor(retirement.scenarioRates.length / 2)] ?? 0.07;
    const countdown = calculateRetirementCountdown(totalNetWorth, totalAnnual, requiredPot, midRate);
    return { retirementCountdownYears: countdown.years, retirementCountdownMonths: countdown.months };
  }, [household, totalNetWorth, totalStatePensionAnnual]);

  // --- Savings rate + FIRE progress ---
  const savingsRate = useMemo(() => {
    const totalContrib = household.contributions.reduce(
      (sum, c) => sum + annualiseContribution(c.amount, c.frequency),
      0
    );
    const income = household.income.reduce((sum, i) => sum + i.grossSalary, 0);
    return income > 0 ? (totalContrib / income) * 100 : 0;
  }, [household]);

  const fireProgress = useMemo(() => {
    const req = calculateAdjustedRequiredPot(
      household.retirement.targetAnnualIncome, household.retirement.withdrawalRate,
      household.retirement.includeStatePension, totalStatePensionAnnual
    );
    return req > 0 ? (totalNetWorth / req) * 100 : 0;
  }, [household.retirement, totalNetWorth, totalStatePensionAnnual]);

  // --- Hero data ---
  const heroData: HeroMetricData = useMemo(
    () => ({
      totalNetWorth: selectedView === "household" ? totalNetWorth : filteredNetWorth,
      cashPosition,
      monthOnMonthChange,
      monthOnMonthPercent,
      yearOnYearChange,
      yearOnYearPercent,
      retirementCountdownYears,
      retirementCountdownMonths,
      savingsRate,
      fireProgress,
      netWorthAfterCommitments: totalNetWorth - totalAnnualCommitments,
      totalAnnualCommitments,
    }),
    [
      totalNetWorth, filteredNetWorth, selectedView, cashPosition,
      monthOnMonthChange, monthOnMonthPercent, yearOnYearChange, yearOnYearPercent,
      retirementCountdownYears, retirementCountdownMonths,
      savingsRate, fireProgress, totalAnnualCommitments,
    ]
  );

  // --- Projections ---
  const { scenarios, scenarioRates, projectionYears, milestones } = useMemo(() => {
    const monthlyContrib = household.contributions.reduce(
      (sum, c) => sum + annualiseContribution(c.amount, c.frequency) / 12,
      0
    );
    const rates = household.retirement.scenarioRates;
    const years = 30;
    const projScenarios = projectScenarios(totalNetWorth, monthlyContrib, rates, years);
    const targetPot = calculateAdjustedRequiredPot(
      household.retirement.targetAnnualIncome, household.retirement.withdrawalRate,
      household.retirement.includeStatePension, totalStatePensionAnnual
    );
    const ms = [
      { label: "FIRE Target", value: targetPot },
      { label: "\u00A31m", value: 1_000_000 },
      { label: "\u00A32m", value: 2_000_000 },
    ].filter((m) => m.value > 0);
    return { scenarios: projScenarios, scenarioRates: rates, projectionYears: years, milestones: ms };
  }, [household, totalNetWorth, totalStatePensionAnnual]);

  // --- Chart data ---
  const personChartData = useMemo(() => byPerson.map((p) => ({ name: p.name, value: p.value })), [byPerson]);

  const wrapperData = useMemo(() => {
    const order: TaxWrapper[] = ["pension", "isa", "gia", "cash", "premium_bonds"];
    return order
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

  const wrapperSummary = wrapperData.map((w) => `${Math.round(w.percent * 100)}% ${w.label}`).join(", ");

  // --- Banner ---
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
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
      // ignore
    }
  }, []);

  const heroMetrics = household.dashboardConfig.heroMetrics;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Print header */}
        <div className="print-report-header hidden print:block">
          <h1>Runway — Financial Report</h1>
          <p>
            Generated{" "}
            {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}
            {" | "}
            Household net worth: {formatCurrency(totalNetWorth)}
          </p>
        </div>

        {/* Getting Started */}
        {(!bannerDismissed || household.persons.length === 0) && (
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
                <h2 className="text-lg font-semibold sm:text-xl">Getting Started</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Head to <strong>Settings</strong> first to enter your personal financial data.
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

        {/* Header + Person Toggle */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {latestSnapshot
                ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
                    new Date(latestSnapshot.date)
                  )
                : "now"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PersonToggle />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 print:hidden"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
        </div>

        {/* HERO METRICS — 3 configurable slots, zero scrolling */}
        <div className="mb-8 grid grid-cols-1 gap-3 rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm sm:grid-cols-3 sm:gap-6 sm:p-8">
          {heroMetrics.map((metric, i) => (
            <HeroMetric key={`${metric}-${i}`} type={metric} data={heroData} primary={i === 0} />
          ))}
        </div>

        {/* RECOMMENDATIONS — collapsible */}
        {filteredRecommendations.length > 0 && (
          <div className="mb-6">
            <CollapsibleSection
              title="Recommendations"
              summary={`${filteredRecommendations.length} suggestion${filteredRecommendations.length !== 1 ? "s" : ""}`}
              defaultOpen
              storageKey="recommendations"
            >
              <div className="grid gap-3">
                {filteredRecommendations.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} />
                ))}
              </div>
            </CollapsibleSection>
          </div>
        )}

        {/* PRIMARY CHARTS — always visible, 2-col on desktop */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="pt-5">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-base font-semibold tracking-tight">Net Worth by Wrapper</h2>
                <span className="hidden text-xs text-muted-foreground sm:inline">{wrapperSummary}</span>
              </div>
              <WrapperSplitChart data={byWrapper} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-base font-semibold tracking-tight">Net Worth Trajectory</h2>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {scenarioRates.map((r) => `${(r * 100).toFixed(0)}%`).join("/")} over {projectionYears}yr
                </span>
              </div>
              <NetWorthTrajectoryChart snapshots={snapshots} scenarios={scenarios} milestones={milestones} />
              <p className="mt-3 text-[11px] text-muted-foreground">
                Projections are estimates, not guarantees. Capital is at risk. Past performance does not predict future returns.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* SECONDARY SECTIONS — collapsible */}
        <CollapsibleSection title="Net Worth History" summary="By tax wrapper over time" storageKey="history">
          <Card>
            <CardContent className="pt-6">
              <NetWorthHistoryChart snapshots={snapshots} />
            </CardContent>
          </Card>
        </CollapsibleSection>

        {selectedView === "household" && (
          <CollapsibleSection
            title="Net Worth by Person"
            summary={byPerson.map((p) => `${p.name}: ${formatCurrencyCompact(p.value)}`).join(", ")}
            storageKey="by-person"
          >
            <Card>
              <CardContent className="pt-6">
                <ByPersonChart data={personChartData} />
              </CardContent>
            </Card>
          </CollapsibleSection>
        )}

        {household.committedOutgoings.length > 0 && (
          <CollapsibleSection
            title="Committed Outgoings"
            summary={`${formatCurrencyCompact(totalAnnualCommitments)}/yr across ${household.committedOutgoings.length} items`}
            storageKey="commitments"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {household.committedOutgoings.map((o) => (
                <Card key={o.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{o.label || o.category}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {o.frequency}
                      </Badge>
                    </div>
                    <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(o.amount)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCurrencyCompact(annualiseOutgoing(o.amount, o.frequency))}/yr
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
