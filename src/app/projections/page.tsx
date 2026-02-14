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
import { formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/format";
import { annualiseContribution } from "@/types";
import { projectScenarios, projectScenariosWithGrowth, calculateAdjustedRequiredPot, calculateProRataStatePension } from "@/lib/projections";
import { ProjectionChart } from "@/components/charts/projection-chart";

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

  const totalAnnualContributions = useMemo(() => {
    const discretionary = filteredContributions.reduce(
      (sum, c) => sum + annualiseContribution(c.amount, c.frequency), 0
    );
    const employmentPension = filteredIncome.reduce(
      (sum, i) => sum + i.employeePensionContribution + i.employerPensionContribution, 0
    );
    return discretionary + employmentPension;
  }, [filteredContributions, filteredIncome]);

  // Monthly contributions
  const monthlyContributions = totalAnnualContributions / 12;

  // Weighted average salary growth rate across household members
  const weightedContributionGrowthRate = useMemo(() => {
    const totalGross = household.income.reduce((s, i) => s + i.grossSalary, 0);
    if (totalGross <= 0) return 0;
    return household.income.reduce(
      (s, i) => s + (i.salaryGrowthRate ?? 0) * (i.grossSalary / totalGross),
      0
    );
  }, [household.income]);

  const hasGrowthRate = weightedContributionGrowthRate > 0;

  // State pension total for adjusted required pot
  const filteredPersons = useMemo(() => {
    if (selectedView === "household") return household.persons;
    return household.persons.filter((p) => p.id === selectedView);
  }, [household.persons, selectedView]);

  const totalStatePensionAnnual = useMemo(
    () => filteredPersons.reduce((sum, p) => sum + calculateProRataStatePension(p.niQualifyingYears ?? 0), 0),
    [filteredPersons]
  );

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
  const scenarios = useMemo(
    () =>
      hasGrowthRate
        ? projectScenariosWithGrowth(
            currentPot,
            totalAnnualContributions,
            weightedContributionGrowthRate,
            retirement.scenarioRates,
            PROJECTION_YEARS
          )
        : projectScenarios(
            currentPot,
            monthlyContributions,
            retirement.scenarioRates,
            PROJECTION_YEARS
          ),
    [currentPot, totalAnnualContributions, monthlyContributions, weightedContributionGrowthRate, hasGrowthRate, retirement.scenarioRates]
  );

  return (
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader title="Projections" description={`Growth projections across multiple return scenarios over ${PROJECTION_YEARS} years`}>
        <PersonToggle />
      </PageHeader>

      {household.accounts.length === 0 && (
        <EmptyState message="No accounts yet. Add your investment accounts to see growth projections." settingsTab="accounts" />
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Pot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(currentPot)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Total net worth across all accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Annual Contributions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(totalAnnualContributions)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(monthlyContributions)}/month across all accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Required Pot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(requiredPot)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(retirement.targetAnnualIncome)}/yr at{" "}
              {formatPercent(retirement.withdrawalRate)} SWR
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projection Chart */}
      <Card>
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
    </div>
  );
}
