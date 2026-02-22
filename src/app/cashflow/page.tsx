"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { PersonToggle } from "@/components/person-toggle";
import { CollapsibleSection } from "@/components/collapsible-section";
import { EmptyState } from "@/components/empty-state";
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { calculateAge } from "@/lib/projections";
import { generateLifetimeCashFlow } from "@/lib/lifetime-cashflow";
import { LifetimeCashFlowChart } from "@/components/charts/lifetime-cashflow-chart";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
} from "lucide-react";
import { SchoolFeeSummary } from "@/components/school-fee-summary";
import { SchoolFeeTimelineChart } from "@/components/charts/school-fee-timeline-chart";
import { generateSchoolFeeTimeline, findLastSchoolFeeYear } from "@/lib/school-fees";
import { ScenarioDelta } from "@/components/scenario-delta";

export default function CashFlowPage() {
  const scenarioData = useScenarioData();
  const household = scenarioData.household;
  const baseHousehold = scenarioData.baseHousehold;
  const { selectedView } = usePersonView();

  // --- Person filtering ---
  const filteredHousehold = useMemo(() => {
    if (selectedView === "household") return household;
    return {
      ...household,
      persons: household.persons.filter((p) => p.id === selectedView),
      income: household.income.filter((i) => i.personId === selectedView),
      accounts: household.accounts.filter((a) => a.personId === selectedView),
      bonusStructures: household.bonusStructures.filter((b) => b.personId === selectedView),
      contributions: household.contributions.filter((c) => c.personId === selectedView),
    };
  }, [household, selectedView]);

  // Use mid scenario rate for the projection
  const growthRate = useMemo(() => {
    const rates = household.retirement.scenarioRates;
    return rates[Math.floor(rates.length / 2)] ?? 0.05;
  }, [household.retirement.scenarioRates]);

  // Generate lifetime cash flow data
  const { data, events, primaryPersonName } = useMemo(
    () => generateLifetimeCashFlow(filteredHousehold, growthRate),
    [filteredHousehold, growthRate]
  );

  // Key metrics
  const metrics = useMemo(() => {
    if (data.length === 0) return null;

    const currentYear = data[0];

    // First year where income drops below expenditure (the "crossover")
    const crossoverYear = data.find((d, i) => i > 0 && d.surplus < 0 && data[i - 1].surplus >= 0);

    // All years with a shortfall
    const shortfallYears = data.filter((d) => d.surplus < 0);

    return { currentYear, crossoverYear, shortfallYears };
  }, [data]);

  // --- Base (un-overridden) metrics for what-if comparison ---
  const baseFilteredHousehold = useMemo(() => {
    if (selectedView === "household") return baseHousehold;
    return {
      ...baseHousehold,
      persons: baseHousehold.persons.filter((p) => p.id === selectedView),
      income: baseHousehold.income.filter((i) => i.personId === selectedView),
      accounts: baseHousehold.accounts.filter((a) => a.personId === selectedView),
      bonusStructures: baseHousehold.bonusStructures.filter((b) => b.personId === selectedView),
      contributions: baseHousehold.contributions.filter((c) => c.personId === selectedView),
    };
  }, [baseHousehold, selectedView]);

  // Use base growth rate (not scenario-derived) for base data comparison
  const baseGrowthRate = useMemo(() => {
    const rates = baseHousehold.retirement.scenarioRates;
    return rates[Math.floor(rates.length / 2)] ?? 0.05;
  }, [baseHousehold.retirement.scenarioRates]);

  const baseData = useMemo(
    () => generateLifetimeCashFlow(baseFilteredHousehold, baseGrowthRate).data,
    [baseFilteredHousehold, baseGrowthRate]
  );

  const baseMetrics = useMemo(() => {
    if (baseData.length === 0) return null;
    const currentYear = baseData[0];
    const crossoverYear = baseData.find((d, i) => i > 0 && d.surplus < 0 && baseData[i - 1].surplus >= 0);
    const shortfallYears = baseData.filter((d) => d.surplus < 0);
    return { currentYear, crossoverYear, shortfallYears };
  }, [baseData]);

  // School fee timeline data (must be above early returns to satisfy rules-of-hooks)
  const schoolFeeTimeline = useMemo(
    () => generateSchoolFeeTimeline(household.children),
    [household.children]
  );
  const lastSchoolFeeYear = useMemo(
    () => findLastSchoolFeeYear(household.children),
    [household.children]
  );
  const hasSchoolFees = household.children.length > 0 && household.children.some((c) => c.schoolFeeAnnual > 0);

  if (filteredHousehold.persons.length === 0) {
    return (
      <div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <PageHeader title="Lifetime Cash Flow" description="Year-by-year income vs expenditure" />
        <EmptyState message="Add people and income in Settings to see your lifetime cash flow projection." />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <PageHeader title="Lifetime Cash Flow" description="Year-by-year income vs expenditure" />
        <EmptyState message="Ensure at least one person has a date of birth configured in Settings." />
      </div>
    );
  }

  const primaryPerson = filteredHousehold.persons.find((p) => p.relationship === "self") ?? filteredHousehold.persons[0];
  const currentAge = calculateAge(primaryPerson.dateOfBirth);

  // Ages that are semantically important for the year-by-year table:
  // retirement, pension access, state pension, crossover (if any), and last year.
  const keyAges = new Set([
    currentAge,
    primaryPerson.plannedRetirementAge,
    primaryPerson.pensionAccessAge,
    primaryPerson.stateRetirementAge,
    ...(metrics?.crossoverYear ? [metrics.crossoverYear.age] : []),
    data.length > 0 ? data[data.length - 1].age : currentAge,
  ]);

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Lifetime Cash Flow"
        description={`${primaryPersonName}'s household \u2014 age ${currentAge} to 95 at ${(growthRate * 100).toFixed(0)}% growth`}
      >
        <PersonToggle />
      </PageHeader>

      {/* Key Metrics Row */}
      {metrics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Current Year Income */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex size-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-950">
                  <ArrowDown className="size-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Income
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums">
                <ScenarioDelta base={baseMetrics?.currentYear.totalIncome ?? metrics.currentYear.totalIncome} scenario={metrics.currentYear.totalIncome} format={formatCurrencyCompact} />
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">/year net</span>
            </CardContent>
          </Card>

          {/* Current Year Expenditure */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex size-6 items-center justify-center rounded-md bg-red-100 dark:bg-red-950">
                  <ArrowUp className="size-3.5 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Spend
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums">
                <ScenarioDelta base={baseMetrics?.currentYear.totalExpenditure ?? metrics.currentYear.totalExpenditure} scenario={metrics.currentYear.totalExpenditure} format={formatCurrencyCompact} />
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">/year committed + lifestyle</span>
            </CardContent>
          </Card>

          {/* Current Surplus/Deficit */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`flex size-6 items-center justify-center rounded-md ${
                  metrics.currentYear.surplus >= 0
                    ? "bg-emerald-100 dark:bg-emerald-950"
                    : "bg-red-100 dark:bg-red-950"
                }`}>
                  {metrics.currentYear.surplus >= 0
                    ? <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    : <TrendingDown className="size-3.5 text-red-600 dark:text-red-400" />
                  }
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Annual Surplus
                </span>
              </div>
              <span className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${
                metrics.currentYear.surplus >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}>
                <ScenarioDelta
                  base={baseMetrics?.currentYear.surplus ?? metrics.currentYear.surplus}
                  scenario={metrics.currentYear.surplus}
                  format={(n) => `${n >= 0 ? "+" : ""}${formatCurrencyCompact(n)}`}
                />
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">income less spending</span>
            </CardContent>
          </Card>

          {/* Crossover / Coverage */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`flex size-6 items-center justify-center rounded-md ${
                  metrics.crossoverYear != null
                    ? "bg-amber-100 dark:bg-amber-950"
                    : metrics.shortfallYears.length > 0
                    ? "bg-red-100 dark:bg-red-950"
                    : "bg-emerald-100 dark:bg-emerald-950"
                }`}>
                  {metrics.crossoverYear != null || metrics.shortfallYears.length > 0
                    ? <AlertTriangle className={`size-3.5 ${metrics.crossoverYear != null ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`} />
                    : <Calendar className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  }
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {metrics.crossoverYear != null ? "Crossover" : metrics.shortfallYears.length > 0 ? "Shortfall" : "Coverage"}
                </span>
              </div>
              {metrics.crossoverYear != null ? (
                <>
                  <span className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
                    Age {metrics.crossoverYear.age}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    income first drops below spending
                  </span>
                </>
              ) : metrics.shortfallYears.length > 0 ? (
                <>
                  <span className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-red-600 dark:text-red-400">
                    From year 1
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    currently spending more than income
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                    Fully funded
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    income covers spending to 95
                  </span>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Chart */}
      <Card className="border-t border-t-primary/20">
        <CardHeader>
          <div className="flex items-baseline justify-between">
            <CardTitle>Lifetime Cash Flow</CardTitle>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Real terms (today&apos;s money) at {(growthRate * 100).toFixed(0)}% growth
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <LifetimeCashFlowChart data={data} events={events} primaryPersonName={primaryPersonName} />
          <p className="mt-3 text-[11px] text-muted-foreground">
            Projections are estimates in today&apos;s money, not guarantees. Capital is at risk.
            Past performance does not predict future returns. Employment income shown net of
            tax, NI, and pension deductions.
          </p>
        </CardContent>
      </Card>

      {/* School Fees — summary + timeline */}
      {hasSchoolFees && (
        <CollapsibleSection
          title="School Fees"
          summary={`${household.children.filter((c) => c.schoolFeeAnnual > 0).length} child${household.children.filter((c) => c.schoolFeeAnnual > 0).length !== 1 ? "ren" : ""} in private education`}
          defaultOpen
          storageKey="cashflow-school-fees"
        >
          <div className="space-y-4">
            <SchoolFeeSummary childrenList={household.children} />
            {schoolFeeTimeline.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-baseline justify-between">
                    <CardTitle>School Fee Timeline</CardTitle>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      Annual fees by child (including inflation)
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <SchoolFeeTimelineChart
                    data={schoolFeeTimeline}
                    childrenList={household.children}
                    lastSchoolFeeYear={lastSchoolFeeYear}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Key Events Timeline */}
      {events.length > 0 && (
        <CollapsibleSection
          title="Key Life Events"
          summary={`${events.length} milestone${events.length !== 1 ? "s" : ""} from age ${currentAge} to 95`}
          defaultOpen
          storageKey="cashflow-events"
        >
          <div className="relative pl-6 space-y-0">
            {/* Timeline line */}
            <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
            {events
              .sort((a, b) => a.age - b.age)
              .map((event, i) => (
                <div key={`${event.age}-${event.label}-${i}`} className="relative flex items-start gap-3 py-2">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-3 flex size-5 items-center justify-center">
                    <div className="size-2.5 rounded-full bg-primary ring-2 ring-background" />
                  </div>
                  <Badge variant="secondary" className="shrink-0 tabular-nums text-xs mt-0.5">
                    {event.age}
                  </Badge>
                  <span className="text-sm text-foreground">{event.label}</span>
                </div>
              ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Year-by-Year Summary Table */}
      <CollapsibleSection
        title="Year-by-Year Breakdown"
        summary="Detailed annual figures"
        storageKey="cashflow-table"
      >
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 text-xs font-semibold text-muted-foreground">Age</th>
                  <th className="pb-2 pr-4 text-right text-xs font-semibold text-muted-foreground">Employment</th>
                  <th className="pb-2 pr-4 text-right text-xs font-semibold text-muted-foreground">Pension</th>
                  <th className="pb-2 pr-4 text-right text-xs font-semibold text-muted-foreground">State Pension</th>
                  <th className="pb-2 pr-4 text-right text-xs font-semibold text-muted-foreground">Savings</th>
                  <th className="pb-2 pr-4 text-right text-xs font-semibold text-muted-foreground">Total Income</th>
                  <th className="pb-2 pr-4 text-right text-xs font-semibold text-muted-foreground">Expenditure</th>
                  <th className="pb-2 text-right text-xs font-semibold text-muted-foreground">Surplus</th>
                </tr>
              </thead>
              <tbody>
                {data
                  .filter((row, i) => keyAges.has(row.age) || i % 5 === 0 || i === data.length - 1)
                  .map((row) => (
                    <tr key={row.age} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 font-medium tabular-nums">{row.age}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(row.employmentIncome)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(row.pensionIncome)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(row.statePensionIncome)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(row.investmentIncome)}</td>
                      <td className="py-2 pr-4 text-right font-medium tabular-nums">{formatCurrency(row.totalIncome)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(row.totalExpenditure)}</td>
                      <td className={`py-2 text-right font-medium tabular-nums ${
                        row.surplus >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      }`}>
                        {row.surplus >= 0 ? "+" : ""}{formatCurrency(row.surplus)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </CollapsibleSection>
    </div>
  );
}
