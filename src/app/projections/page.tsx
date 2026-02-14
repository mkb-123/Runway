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
import { formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/format";
import { projectScenarios, calculateRequiredPot } from "@/lib/projections";
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
    if (selectedView === "household") return household.annualContributions;
    return household.annualContributions.filter((c) => c.personId === selectedView);
  }, [household.annualContributions, selectedView]);

  // Calculate total current pot (filtered)
  const currentPot = useMemo(
    () => filteredAccounts.reduce((sum, a) => sum + a.currentValue, 0),
    [filteredAccounts]
  );

  // Calculate total annual contributions (filtered)
  const totalAnnualContributions = useMemo(
    () =>
      filteredContributions.reduce(
        (sum, c) => sum + c.isaContribution + c.pensionContribution + c.giaContribution,
        0
      ),
    [filteredContributions]
  );

  // Monthly contributions
  const monthlyContributions = totalAnnualContributions / 12;

  // Required pot from retirement config
  const requiredPot = useMemo(
    () =>
      calculateRequiredPot(
        retirement.targetAnnualIncome,
        retirement.withdrawalRate
      ),
    [retirement.targetAnnualIncome, retirement.withdrawalRate]
  );

  // Run projections for configured scenario rates
  const scenarios = useMemo(
    () =>
      projectScenarios(
        currentPot,
        monthlyContributions,
        retirement.scenarioRates,
        PROJECTION_YEARS
      ),
    [currentPot, monthlyContributions, retirement.scenarioRates]
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projections</h1>
          <p className="text-muted-foreground mt-1">
            Growth projections across multiple return scenarios over {PROJECTION_YEARS} years
          </p>
        </div>
        <PersonToggle />
      </div>

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
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
