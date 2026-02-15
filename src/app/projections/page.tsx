"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Wallet2, PiggyBank, Target } from "lucide-react";
import { formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/format";
import { getHouseholdGrossIncome } from "@/types";
import { projectScenarios, projectScenariosWithGrowth, calculateAdjustedRequiredPot, calculateAge } from "@/lib/projections";
import { calculateTotalAnnualContributions, calculateHouseholdStatePension } from "@/lib/aggregations";
import { ProjectionChart } from "@/components/charts/projection-chart";
import { SettingsBar } from "@/components/settings-bar";

const PROJECTION_YEARS = 30;
const SNAPSHOT_INTERVALS = [5, 10, 15, 20, 25, 30];

export default function ProjectionsPage() {
  const scenarioData = useScenarioData();
  const { selectedView } = usePersonView();
  const household = scenarioData.household;
  const { retirement } = household;

  const filteredAccounts = useMemo(() => {
    if (selectedView === "household") return household.accounts;
    return household.accounts.filter((a) => a.personId === selectedView);
  }, [household.accounts, selectedView]);

  const filteredContributions = useMemo(() => {
    if (selectedView === "household") return household.contributions;
    return household.contributions.filter((c) => c.personId === selectedView);
  }, [household.contributions, selectedView]);

  // Calculate total current pot (filtered)
  const currentPot = useMemo(
    () => filteredAccounts.reduce((sum, a) => sum + a.currentValue, 0),
    [filteredAccounts]
  );

  // Calculate total annual contributions (discretionary + employment pension)
  const filteredIncome = useMemo(() => {
    if (selectedView === "household") return household.income;
    return household.income.filter((i) => i.personId === selectedView);
  }, [household.income, selectedView]);

  const totalAnnualContributions = useMemo(
    () => calculateTotalAnnualContributions(filteredContributions, filteredIncome),
    [filteredContributions, filteredIncome]
  );

  // Monthly contributions
  const monthlyContributions = totalAnnualContributions / 12;

  // Weighted average income growth rate across household members (salary + bonus)
  const weightedContributionGrowthRate = useMemo(() => {
    const totalGross = getHouseholdGrossIncome(household.income, household.bonusStructures);
    if (totalGross <= 0) return 0;
    return household.income.reduce((s, i) => {
      const bonus = household.bonusStructures.find((b) => b.personId === i.personId);
      const personGross = i.grossSalary + (bonus?.cashBonusAnnual ?? 0);
      const salaryWeight = i.grossSalary / totalGross;
      const bonusWeight = (bonus?.cashBonusAnnual ?? 0) / totalGross;
      return s + (i.salaryGrowthRate ?? 0) * salaryWeight + (i.bonusGrowthRate ?? 0) * bonusWeight;
    }, 0);
  }, [household.income, household.bonusStructures]);

  const hasGrowthRate = weightedContributionGrowthRate > 0;

  // State pension total for adjusted required pot
  const filteredPersons = useMemo(() => {
    if (selectedView === "household") return household.persons;
    return household.persons.filter((p) => p.id === selectedView);
  }, [household.persons, selectedView]);

  const totalStatePensionAnnual = useMemo(
    () => calculateHouseholdStatePension(filteredPersons),
    [filteredPersons]
  );

  // Years until earliest retirement — contributions and growth stop here
  const yearsToRetirement = useMemo(() => {
    if (filteredPersons.length === 0) return PROJECTION_YEARS;
    const ages = filteredPersons.map((p) => calculateAge(p.dateOfBirth));
    const retirementAges = filteredPersons.map((p) => p.plannedRetirementAge);
    const yearsRemaining = filteredPersons.map((_, i) => Math.max(0, retirementAges[i] - ages[i]));
    // Use the earliest retirement for household view (contributions stop when first person retires is conservative)
    // Use max for household (most optimistic — at least one person still contributing)
    return Math.max(1, ...yearsRemaining);
  }, [filteredPersons]);

  // Required pot (adjusted for state pension, consistent with retirement page)
  const requiredPot = useMemo(
    () =>
      calculateAdjustedRequiredPot(
        retirement.targetAnnualIncome,
        retirement.withdrawalRate,
        retirement.includeStatePension,
        totalStatePensionAnnual
      ),
    [retirement.targetAnnualIncome, retirement.withdrawalRate, retirement.includeStatePension, totalStatePensionAnnual]
  );

  // Run projections — use growth-aware version if salary growth is configured
  // Contributions stop at retirement age; investment growth continues for the full period
  const scenarios = useMemo(
    () =>
      hasGrowthRate
        ? projectScenariosWithGrowth(
            currentPot,
            totalAnnualContributions,
            weightedContributionGrowthRate,
            retirement.scenarioRates,
            PROJECTION_YEARS,
            yearsToRetirement
          )
        : projectScenarios(
            currentPot,
            monthlyContributions,
            retirement.scenarioRates,
            PROJECTION_YEARS
          ),
    [currentPot, totalAnnualContributions, monthlyContributions, weightedContributionGrowthRate, hasGrowthRate, retirement.scenarioRates, yearsToRetirement]
  );

  return (
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader title="Projections" description={`Growth projections across multiple return scenarios over ${PROJECTION_YEARS} years`}>
        <PersonToggle />
      </PageHeader>

      <SettingsBar label="Planning assumptions" settingsTab="planning">
        <Badge variant="secondary" className="text-xs">
          Target: {formatCurrency(retirement.targetAnnualIncome)}/yr
        </Badge>
        <Badge variant="secondary" className="text-xs">
          SWR: {formatPercent(retirement.withdrawalRate)}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          Rates: {retirement.scenarioRates.map((r) => `${(r * 100).toFixed(0)}%`).join(" / ")}
        </Badge>
      </SettingsBar>

      {household.accounts.length === 0 && (
        <EmptyState message="No accounts yet. Add your investment accounts to see growth projections." settingsTab="accounts" />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex size-6 items-center justify-center rounded-md bg-muted">
                <Wallet2 className="size-3.5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Current Pot
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums">
              {formatCurrency(currentPot)}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Across all accounts
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex size-6 items-center justify-center rounded-md bg-muted">
                <PiggyBank className="size-3.5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Annual Contributions
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums">
              {formatCurrency(totalAnnualContributions)}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {formatCurrency(monthlyContributions)}/month
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex size-6 items-center justify-center rounded-md bg-muted">
                <Target className="size-3.5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Required Pot
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums">
              {formatCurrency(requiredPot)}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {formatCurrency(retirement.targetAnnualIncome)}/yr at {formatPercent(retirement.withdrawalRate)} SWR
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Projection Chart */}
      <Card className="border-t border-t-primary/20">
        <CardHeader>
          <CardTitle>Projected Growth Over {PROJECTION_YEARS} Years</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectionChart
            scenarios={scenarios}
            targetPot={requiredPot}
            years={PROJECTION_YEARS}
          />
        </CardContent>
      </Card>

      {/* Sensitivity Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sensitivity Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return Rate</TableHead>
                  {SNAPSHOT_INTERVALS.map((year) => (
                    <TableHead key={year} className="text-right">
                      Year {year}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map((scenario) => (
                  <TableRow key={scenario.rate}>
                    <TableCell>
                      <Badge variant="secondary">
                        {formatPercent(scenario.rate)}
                      </Badge>
                    </TableCell>
                    {SNAPSHOT_INTERVALS.map((year) => {
                      const projection = scenario.projections.find(
                        (p) => p.year === year
                      );
                      const value = projection?.value ?? 0;
                      const meetsTarget = value >= requiredPot;
                      return (
                        <TableCell
                          key={year}
                          className={`text-right font-mono ${
                            meetsTarget
                              ? "text-green-600 dark:text-green-400"
                              : ""
                          }`}
                        >
                          {formatCurrencyCompact(value)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Values highlighted in green indicate the projected pot exceeds the required pot of{" "}
            {formatCurrencyCompact(requiredPot)}.
            {hasGrowthRate && (
              <> Projections assume contributions grow at {formatPercent(weightedContributionGrowthRate)}/yr (weighted salary growth).</>
            )}
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        Capital at risk — projections are illustrative only and do not constitute financial advice. Past performance does not predict future returns.
      </p>
    </div>
  );
}
