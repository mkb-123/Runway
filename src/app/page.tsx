"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
} from "@/lib/format";
import { useData } from "@/context/data-context";
import { projectScenarios } from "@/lib/projections";
import { TAX_WRAPPER_LABELS } from "@/types";
import type { TaxWrapper } from "@/types";

import { NetWorthTrajectoryChart } from "@/components/charts/net-worth-trajectory";
import { NetWorthHistoryChart } from "@/components/charts/net-worth-history";
import { ByPersonChart } from "@/components/charts/by-person-chart";

export default function Home() {
  // --- Data Loading ---
  const {
    household,
    snapshots: snapshotsData,
    getTotalNetWorth,
    getNetWorthByPerson,
    getNetWorthByWrapper,
  } = useData();

  const { snapshots } = snapshotsData;
  const totalNetWorth = getTotalNetWorth();
  const byPerson = getNetWorthByPerson();
  const byWrapper = getNetWorthByWrapper();

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

  const changeIndicator = (value: number) =>
    value >= 0 ? "text-emerald-600" : "text-red-600";
  const changePrefix = (value: number) => (value >= 0 ? "+" : "");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
                className={`text-2xl font-bold tracking-tight ${changeIndicator(monthOnMonthChange)}`}
              >
                {changePrefix(monthOnMonthChange)}
                {formatCurrencyCompact(monthOnMonthChange)}
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
                className={`text-2xl font-bold tracking-tight ${changeIndicator(yearOnYearChange)}`}
              >
                {changePrefix(yearOnYearChange)}
                {formatCurrencyCompact(yearOnYearChange)}
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
        {/* Section 2: Net Worth by Wrapper                              */}
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
        {/* Section 3: Net Worth Trajectory Chart                        */}
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
        {/* Section 4: Net Worth History Chart (stacked area)            */}
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
        {/* Section 5: By Person Breakdown                               */}
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
