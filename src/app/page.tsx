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
  Wallet2,
  Banknote,
  Clock,
  BarChart3,
  PiggyBank,
  Target,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
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
): { label: string; value: string; subtext?: string; color: string; trend?: "up" | "down"; icon: LucideIcon } {
  switch (type) {
    case "net_worth":
      return {
        label: "Net Worth",
        value: formatCurrencyCompact(data.totalNetWorth),
        color: "",
        icon: Wallet2,
      };
    case "cash_position":
      return {
        label: "Cash Position",
        value: formatCurrencyCompact(data.cashPosition),
        color: "",
        icon: Banknote,
      };
    case "retirement_countdown": {
      const y = data.retirementCountdownYears;
      const m = data.retirementCountdownMonths;
      return {
        label: "Retirement",
        value: y === 0 && m === 0 ? "On track" : `${y}y ${m}m`,
        subtext: y === 0 && m === 0 ? "Target pot reached" : "to target",
        color: "",
        icon: Clock,
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
        icon: TrendingUp,
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
        icon: BarChart3,
      };
    }
    case "savings_rate":
      return {
        label: "Savings Rate",
        value: `${data.savingsRate.toFixed(1)}%`,
        subtext: "of gross income",
        color: "",
        icon: PiggyBank,
      };
    case "fire_progress":
      return {
        label: "FIRE Progress",
        value: `${data.fireProgress.toFixed(1)}%`,
        subtext: "of target pot",
        color: data.fireProgress >= 100 ? "text-emerald-600 dark:text-emerald-400" : "",
        icon: Target,
      };
    case "net_worth_after_commitments":
      return {
        label: "After Commitments",
        value: formatCurrencyCompact(data.netWorthAfterCommitments),
        subtext: `${formatCurrencyCompact(data.totalAnnualCommitments)}/yr committed`,
        color: "",
        icon: Shield,
      };
  }
}

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
    <div className="space-y-8 p-4 md:p-8">
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
        <div className="relative rounded-lg border-2 border-primary/20 bg-primary/5 p-4 sm:p-6">
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

      {/* Header */}
      <PageHeader
        title="Dashboard"
        description={
          latestSnapshot
            ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
                new Date(latestSnapshot.date)
              )
            : "Your financial overview"
        }
      >
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
      </PageHeader>

      {/* HERO — bold primary metric + supporting metrics */}
      {(() => {
        const primary = resolveMetric(heroMetrics[0], heroData);
        const PrimaryIcon = primary.icon;
        const secondaryMetrics = heroMetrics.slice(1).map((m) => resolveMetric(m, heroData));
        return (
          <div className="space-y-4">
            {/* Primary metric — the headline number */}
            <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/8 via-primary/4 to-card">
              <div className="pointer-events-none absolute -right-6 -top-6 size-32 rounded-full bg-primary/5" />
              <div className="pointer-events-none absolute -right-2 bottom-0 size-20 rounded-full bg-primary/3" />
              <CardContent className="relative pt-6 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                        <PrimaryIcon className="size-4 text-primary" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {primary.label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className={`text-4xl sm:text-5xl font-bold tracking-tight tabular-nums ${primary.color}`}>
                        {primary.value}
                      </span>
                      {primary.trend === "up" && <TrendingUp className="size-6 text-emerald-500" />}
                      {primary.trend === "down" && <TrendingDown className="size-6 text-red-500" />}
                    </div>
                    {primary.subtext && (
                      <span className="mt-1 block text-sm text-muted-foreground">{primary.subtext}</span>
                    )}
                  </div>
                </div>

                {/* FIRE progress bar — integrated into hero */}
                {heroData.fireProgress > 0 && (
                  <div className="mt-5 pt-4 border-t border-primary/10">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Target className="size-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">FIRE Progress</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums">
                        {heroData.fireProgress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all"
                        style={{ width: `${Math.min(heroData.fireProgress, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                      <span>{formatCurrencyCompact(heroData.totalNetWorth)} saved</span>
                      <span>
                        Target: {formatCurrencyCompact(
                          heroData.fireProgress > 0 ? heroData.totalNetWorth / (heroData.fireProgress / 100) : 0
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Secondary metrics — compact row */}
            {secondaryMetrics.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {secondaryMetrics.map((metric, i) => {
                  const MetricIcon = metric.icon;
                  return (
                    <Card key={i} className="border-muted-foreground/10">
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex size-6 items-center justify-center rounded-md bg-muted">
                            <MetricIcon className="size-3.5 text-muted-foreground" />
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {metric.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${metric.color}`}>
                            {metric.value}
                          </span>
                          {metric.trend === "up" && <TrendingUp className="size-4 text-emerald-500" />}
                          {metric.trend === "down" && <TrendingDown className="size-4 text-red-500" />}
                        </div>
                        {metric.subtext && (
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">{metric.subtext}</span>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* RECOMMENDATIONS — collapsible */}
      {filteredRecommendations.length > 0 && (
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
      )}

      {/* PRIMARY CHARTS — 2-col on desktop, with accent top border */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-t-2 border-t-primary/30">
          <CardHeader>
            <div className="flex items-baseline justify-between">
              <CardTitle>Net Worth by Wrapper</CardTitle>
              <span className="hidden text-xs text-muted-foreground sm:inline">{wrapperSummary}</span>
            </div>
          </CardHeader>
          <CardContent>
            <WrapperSplitChart data={byWrapper} />
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-primary/30">
          <CardHeader>
            <div className="flex items-baseline justify-between">
              <CardTitle>Net Worth Trajectory</CardTitle>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {scenarioRates.map((r) => `${(r * 100).toFixed(0)}%`).join("/")} over {projectionYears}yr
              </span>
            </div>
          </CardHeader>
          <CardContent>
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
                <CardContent className="pt-6">
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
  );
}
