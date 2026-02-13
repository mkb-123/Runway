"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useData } from "@/context/data-context";
import { getAccountTaxWrapper } from "@/types";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
} from "@/lib/format";
import {
  calculateRequiredPot,
  calculateRetirementCountdown,
  calculateCoastFIRE,
  calculateRequiredSavings,
  calculatePensionBridge,
} from "@/lib/projections";
import { RetirementProgress } from "@/components/charts/retirement-progress";
import { RetirementDrawdownChart } from "@/components/charts/retirement-drawdown-chart";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";

export default function RetirementPage() {
  const { household, getTotalNetWorth } = useData();
  const { retirement, annualContributions, accounts, income, persons } =
    household;

  // Current pot
  const currentPot = getTotalNetWorth();

  // Required pot
  const requiredPot = useMemo(
    () =>
      calculateRequiredPot(
        retirement.targetAnnualIncome,
        retirement.withdrawalRate
      ),
    [retirement.targetAnnualIncome, retirement.withdrawalRate]
  );

  // Progress
  const progressPercent = (currentPot / requiredPot) * 100;

  // Total annual contributions
  const totalAnnualContributions = useMemo(
    () =>
      annualContributions.reduce(
        (sum, c) =>
          sum + c.isaContribution + c.pensionContribution + c.giaContribution,
        0
      ),
    [annualContributions]
  );

  // Total gross income
  const totalGrossIncome = useMemo(
    () => income.reduce((sum, i) => sum + i.grossSalary, 0),
    [income]
  );

  // Savings rate
  const savingsRate = (totalAnnualContributions / totalGrossIncome) * 100;

  // Calculate accessible vs locked wealth
  const { accessibleWealth, lockedWealth } = useMemo(() => {
    const accessibleWrappers = new Set(["isa", "gia", "cash", "premium_bonds"]);
    let accessible = 0;
    let locked = 0;

    for (const account of accounts) {
      const wrapper = getAccountTaxWrapper(account.type);
      if (accessibleWrappers.has(wrapper)) {
        accessible += account.currentValue;
      } else {
        locked += account.currentValue;
      }
    }

    return { accessibleWealth: accessible, lockedWealth: locked };
  }, [accounts]);

  // Get primary person (self) for age calculations
  const primaryPerson = useMemo(
    () => persons.find((p) => p.relationship === "self"),
    [persons]
  );
  const currentAge = primaryPerson
    ? Math.floor(
        (Date.now() - new Date(primaryPerson.dateOfBirth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : 35;
  const pensionAccessAge = primaryPerson?.pensionAccessAge ?? 57;

  // Coast FIRE: use the middle scenario rate
  const midRate =
    retirement.scenarioRates[
      Math.floor(retirement.scenarioRates.length / 2)
    ] ?? 0.07;
  const coastFIRE = useMemo(
    () =>
      calculateCoastFIRE(
        currentPot,
        requiredPot,
        pensionAccessAge,
        currentAge,
        midRate
      ),
    [currentPot, requiredPot, pensionAccessAge, currentAge, midRate]
  );

  // Required monthly savings for different time horizons
  const savingsTimeframes = [10, 15, 20];
  const requiredMonthlySavings = useMemo(
    () =>
      savingsTimeframes.map((years) => ({
        years,
        monthly: calculateRequiredSavings(requiredPot, currentPot, years, midRate),
      })),
    [requiredPot, currentPot, midRate]
  );

  // Pension Bridge Analysis
  // Assume early retirement = when countdown is 0 at mid rate, or use current age + countdown
  const earlyRetirementAge = currentAge + 10; // Aspirational: retire in ~10 years
  const bridgeResult = useMemo(
    () =>
      calculatePensionBridge(
        earlyRetirementAge,
        pensionAccessAge,
        retirement.targetAnnualIncome,
        accessibleWealth
      ),
    [earlyRetirementAge, pensionAccessAge, retirement.targetAnnualIncome, accessibleWealth]
  );

  // Max bar width calculation for stacked bar
  const totalWealth = accessibleWealth + lockedWealth;
  const accessiblePercent =
    totalWealth > 0 ? (accessibleWealth / totalWealth) * 100 : 0;
  const lockedPercent =
    totalWealth > 0 ? (lockedWealth / totalWealth) * 100 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Retirement Planning
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your progress toward financial independence
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Target Annual Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(retirement.targetAnnualIncome)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              At {formatPercent(retirement.withdrawalRate)} SWR
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
              Income / withdrawal rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Pot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(currentPot)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              All accounts combined
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{progressPercent.toFixed(1)}%</p>
            <Progress value={Math.min(progressPercent, 100)} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrencyCompact(requiredPot - currentPot)} remaining
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Progress to Target</CardTitle>
        </CardHeader>
        <CardContent>
          <RetirementProgress
            currentPot={currentPot}
            requiredPot={requiredPot}
            progressPercent={progressPercent}
          />
        </CardContent>
      </Card>

      {/* Retirement Countdown */}
      <Card>
        <CardHeader>
          <CardTitle>Retirement Countdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Estimated time to reach {formatCurrencyCompact(requiredPot)} target
            pot at different growth rates
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {retirement.scenarioRates.map((rate) => {
              const countdown = calculateRetirementCountdown(
                currentPot,
                totalAnnualContributions,
                requiredPot,
                rate
              );
              return (
                <Card key={rate}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">
                        {formatPercent(rate)} return
                      </Badge>
                    </div>
                    <p className="text-3xl font-bold">
                      {countdown.years}y {countdown.months}m
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {countdown.years === 0 && countdown.months === 0
                        ? "Target already reached"
                        : `Approx. age ${currentAge + countdown.years}`}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Retirement Drawdown Projection */}
      <Card>
        <CardHeader>
          <CardTitle>Retirement Drawdown Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            How your pot depletes during retirement at {formatCurrency(retirement.targetAnnualIncome)}/yr
            spending, with state pension income reducing withdrawals from age{" "}
            {primaryPerson?.stateRetirementAge ?? 67}. Capital at risk — projections are illustrative only.
          </p>
          <RetirementDrawdownChart
            startingPot={requiredPot}
            annualSpend={retirement.targetAnnualIncome}
            retirementAge={earlyRetirementAge}
            scenarioRates={retirement.scenarioRates}
            statePensionAge={primaryPerson?.stateRetirementAge ?? 67}
            statePensionAnnual={UK_TAX_CONSTANTS.statePension.fullNewStatePensionAnnual}
          />
        </CardContent>
      </Card>

      {/* FIRE Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>FIRE Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Savings Rate */}
          <div>
            <h3 className="text-sm font-medium mb-1">Savings Rate</h3>
            <p className="text-2xl font-bold">{savingsRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalAnnualContributions)} contributions /{" "}
              {formatCurrency(totalGrossIncome)} gross income
            </p>
          </div>

          {/* Coast FIRE */}
          <div>
            <h3 className="text-sm font-medium mb-1">Coast FIRE</h3>
            <div className="flex items-center gap-2">
              <Badge variant={coastFIRE ? "default" : "outline"}>
                {coastFIRE ? "Achieved" : "Not Yet"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {coastFIRE
                  ? `Your current pot will grow to ${formatCurrencyCompact(
                      requiredPot
                    )} by age ${pensionAccessAge} at ${formatPercent(
                      midRate
                    )} without further contributions`
                  : `You need to continue contributing to reach ${formatCurrencyCompact(
                      requiredPot
                    )} by age ${pensionAccessAge} at ${formatPercent(midRate)}`}
              </span>
            </div>
          </div>

          {/* Required Monthly Savings */}
          <div>
            <h3 className="text-sm font-medium mb-2">
              Required Monthly Savings to Hit Target
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              At {formatPercent(midRate)} annual return
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timeframe</TableHead>
                    <TableHead className="text-right">Monthly Savings</TableHead>
                    <TableHead className="text-right">Annual Savings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requiredMonthlySavings.map(({ years, monthly }) => (
                    <TableRow key={years}>
                      <TableCell>{years} years</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(monthly)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(monthly * 12)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pension Bridge Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Pension Bridge Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            If you retire at age {earlyRetirementAge}, can your accessible
            (non-pension) wealth bridge the gap until pension access at age{" "}
            {pensionAccessAge}?
          </p>

          {/* Accessible vs Locked Stacked Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Accessible (ISA, GIA, Cash, Premium Bonds)</span>
              <span className="font-mono">
                {formatCurrencyCompact(accessibleWealth)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Locked (Pensions)</span>
              <span className="font-mono">
                {formatCurrencyCompact(lockedWealth)}
              </span>
            </div>
            <div className="relative h-8 w-full overflow-hidden rounded-full bg-muted">
              <div className="flex h-full">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${accessiblePercent}%` }}
                  title={`Accessible: ${formatCurrencyCompact(accessibleWealth)}`}
                />
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${lockedPercent}%` }}
                  title={`Locked: ${formatCurrencyCompact(lockedWealth)}`}
                />
              </div>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-sm bg-blue-500" />
                <span>Accessible ({accessiblePercent.toFixed(1)}%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-sm bg-amber-500" />
                <span>Locked ({lockedPercent.toFixed(1)}%)</span>
              </div>
            </div>
          </div>

          {/* Bridge Result */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">
                  Bridge Pot Required
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(bridgeResult.bridgePotRequired)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {pensionAccessAge - earlyRetirementAge} years x{" "}
                  {formatCurrencyCompact(retirement.targetAnnualIncome)}/yr
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <div className="mt-1">
                  <Badge
                    variant={
                      bridgeResult.sufficient ? "default" : "destructive"
                    }
                    className="text-base px-3 py-1"
                  >
                    {bridgeResult.sufficient ? "Sufficient" : "Shortfall"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">
                  {bridgeResult.sufficient ? "Surplus" : "Shortfall Amount"}
                </p>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    bridgeResult.sufficient
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {bridgeResult.sufficient
                    ? formatCurrency(
                        accessibleWealth - bridgeResult.bridgePotRequired
                      )
                    : formatCurrency(bridgeResult.shortfall)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {bridgeResult.sufficient
                    ? "Accessible wealth exceeds bridge requirement"
                    : "Additional accessible savings needed"}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
