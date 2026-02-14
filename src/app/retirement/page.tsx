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
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { EmptyState } from "@/components/empty-state";
import { getAccountTaxWrapper, annualiseContribution } from "@/types";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
} from "@/lib/format";
import {
  calculateRequiredPot,
  calculateAdjustedRequiredPot,
  calculateRetirementCountdown,
  calculateCoastFIRE,
  calculateRequiredSavings,
  calculatePensionBridge,
  calculateProRataStatePension,
  calculateAge,
} from "@/lib/projections";
import { RetirementProgress } from "@/components/charts/retirement-progress";
import { RetirementDrawdownChart } from "@/components/charts/retirement-drawdown-chart";
import {
  RetirementIncomeTimeline,
  type PersonRetirementInput,
} from "@/components/charts/retirement-income-timeline";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";

export default function RetirementPage() {
  // Scenario-aware data
  const scenarioData = useScenarioData();
  const { selectedView } = usePersonView();
  const household = scenarioData.household;

  const accounts = useMemo(() => {
    if (selectedView === "household") return household.accounts;
    return household.accounts.filter((a) => a.personId === selectedView);
  }, [household.accounts, selectedView]);

  const persons = useMemo(() => {
    if (selectedView === "household") return household.persons;
    return household.persons.filter((p) => p.id === selectedView);
  }, [household.persons, selectedView]);

  const income = useMemo(() => {
    if (selectedView === "household") return household.income;
    return household.income.filter((i) => i.personId === selectedView);
  }, [household.income, selectedView]);

  const filteredContributions = useMemo(() => {
    if (selectedView === "household") return household.contributions;
    return household.contributions.filter((c) => c.personId === selectedView);
  }, [household.contributions, selectedView]);

  const currentPot = useMemo(
    () => accounts.reduce((sum, a) => sum + a.currentValue, 0),
    [accounts]
  );

  const { retirement } = household;

  // Household total state pension
  const totalStatePensionAnnual = useMemo(
    () => persons.reduce((sum, p) => sum + calculateProRataStatePension(p.niQualifyingYears ?? 0), 0),
    [persons]
  );

  // Required pot (adjusted for state pension if enabled)
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

  // Progress
  const progressPercent = (currentPot / requiredPot) * 100;

  // Total annual contributions
  const totalAnnualContributions = useMemo(
    () =>
      filteredContributions.reduce(
        (sum, c) => sum + annualiseContribution(c.amount, c.frequency),
        0
      ),
    [filteredContributions]
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
    ? calculateAge(primaryPerson.dateOfBirth)
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
  const requiredMonthlySavings = useMemo(() => {
    const timeframes = [10, 15, 20];
    return timeframes.map((years) => ({
      years,
      monthly: calculateRequiredSavings(requiredPot, currentPot, years, midRate),
    }));
  }, [requiredPot, currentPot, midRate]);

  // Pension Bridge Analysis
  const earlyRetirementAge = currentAge + 10;
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

  // --- Primary person pro-rata state pension ---
  const primaryStatePensionAnnual = useMemo(() => {
    if (!primaryPerson) return UK_TAX_CONSTANTS.statePension.fullNewStatePensionAnnual;
    return calculateProRataStatePension(primaryPerson.niQualifyingYears ?? 0);
  }, [primaryPerson]);

  // --- Combined Retirement Income Timeline data ---
  const personRetirementInputs: PersonRetirementInput[] = useMemo(() => {
    return persons.map((person) => {
      // Pension pot = sum of pension-type accounts for this person
      const personPensionPot = accounts
        .filter(
          (a) =>
            a.personId === person.id &&
            (a.type === "workplace_pension" || a.type === "sipp")
        )
        .reduce((sum, a) => sum + a.currentValue, 0);

      // Accessible wealth = non-pension accounts for this person
      const personAccessible = accounts
        .filter((a) => {
          if (a.personId !== person.id) return false;
          const wrapper = getAccountTaxWrapper(a.type);
          return wrapper !== "pension";
        })
        .reduce((sum, a) => sum + a.currentValue, 0);

      // State pension: pro-rata based on NI qualifying years
      const statePensionAnnual = calculateProRataStatePension(
        person.niQualifyingYears ?? 0
      );

      return {
        name: person.name,
        pensionAccessAge: person.pensionAccessAge,
        stateRetirementAge: person.stateRetirementAge,
        pensionPot: personPensionPot,
        accessibleWealth: personAccessible,
        statePensionAnnual: Math.round(statePensionAnnual),
      };
    });
  }, [persons, accounts]);

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Retirement Planning
          </h1>
          <p className="text-sm text-muted-foreground">
            Track your progress toward financial independence
          </p>
        </div>
        <PersonToggle />
      </div>

      {persons.length === 0 && (
        <EmptyState message="No household data yet. Add people and pension accounts to plan your retirement." settingsTab="household" />
      )}

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
              {retirement.includeStatePension && totalStatePensionAnnual > 0
                ? `After ${formatCurrency(totalStatePensionAnnual)}/yr state pension`
                : "Income / withdrawal rate"}
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Combined Retirement Income Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Combined Retirement Income Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            All household income sources stacked by year: state pensions, DC pension
            drawdown, and ISA/savings bridge. Shows whether combined income meets
            the {formatCurrency(retirement.targetAnnualIncome)}/yr target at{" "}
            {formatPercent(midRate)} growth.
          </p>
          <RetirementIncomeTimeline
            persons={personRetirementInputs}
            targetAnnualIncome={retirement.targetAnnualIncome}
            retirementAge={earlyRetirementAge}
            growthRate={midRate}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {personRetirementInputs.map((p) => (
              <div key={p.name} className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {p.name}
                </p>
                <div className="mt-1 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Pension pot</span>
                    <span className="font-mono">
                      {formatCurrencyCompact(p.pensionPot)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>ISA/Savings</span>
                    <span className="font-mono">
                      {formatCurrencyCompact(p.accessibleWealth)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>State pension</span>
                    <span className="font-mono">
                      {formatCurrency(p.statePensionAnnual)}/yr
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Pension access</span>
                    <span>Age {p.pensionAccessAge}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>State pension</span>
                    <span>Age {p.stateRetirementAge}</span>
                  </div>
                </div>
              </div>
            ))}
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
            statePensionAnnual={primaryStatePensionAnnual}
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
