"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getAccountTaxWrapper, annualiseContribution } from "@/types";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
} from "@/lib/format";
import {
  calculateAdjustedRequiredPot,
  calculateCoastFIRE,
  calculateRequiredSavings,
  calculatePensionBridge,
  calculateProRataStatePension,
  calculateAge,
} from "@/lib/projections";
import { CollapsibleSection } from "@/components/collapsible-section";
import { RetirementDrawdownChart } from "@/components/charts/retirement-drawdown-chart";
import {
  RetirementIncomeTimeline,
  type PersonRetirementInput,
} from "@/components/charts/retirement-income-timeline";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";

import { RetirementHero } from "@/components/retirement/retirement-hero";
import { ScenarioControls } from "@/components/retirement/scenario-controls";
import { PensionBridgeCard } from "@/components/retirement/pension-bridge-card";
import { RetirementCountdownGrid } from "@/components/retirement/retirement-countdown-grid";
import { FireMetricsCard } from "@/components/retirement/fire-metrics-card";

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
    () =>
      persons.reduce(
        (sum, p) =>
          sum + calculateProRataStatePension(p.niQualifyingYears ?? 0),
        0
      ),
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
    [
      retirement.targetAnnualIncome,
      retirement.withdrawalRate,
      retirement.includeStatePension,
      totalStatePensionAnnual,
    ]
  );

  // Progress
  const progressPercent = requiredPot > 0 ? (currentPot / requiredPot) * 100 : 0;

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

  // Savings rate (guard against division by zero)
  const savingsRate =
    totalGrossIncome > 0
      ? (totalAnnualContributions / totalGrossIncome) * 100
      : 0;

  // Calculate accessible vs locked wealth
  const { accessibleWealth, lockedWealth } = useMemo(() => {
    const accessibleWrappers = new Set([
      "isa",
      "gia",
      "cash",
      "premium_bonds",
    ]);
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
  const plannedRetirementAge = primaryPerson?.plannedRetirementAge ?? 60;
  const pensionAccessAge = primaryPerson?.pensionAccessAge ?? 57;

  // Interactive retirement age override
  const [retirementAgeOverride, setRetirementAgeOverride] = useState<
    number | null
  >(null);
  const effectiveRetirementAge = retirementAgeOverride ?? plannedRetirementAge;

  // Growth rate toggle (index into scenarioRates)
  const [selectedRateIndex, setSelectedRateIndex] = useState<number>(
    Math.floor((retirement.scenarioRates.length || 1) / 2)
  );

  // Coast FIRE: use the selected scenario rate
  const midRate = retirement.scenarioRates[selectedRateIndex] ?? 0.07;
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
      monthly: calculateRequiredSavings(
        requiredPot,
        currentPot,
        years,
        midRate
      ),
    }));
  }, [requiredPot, currentPot, midRate]);

  // Pension Bridge Analysis
  const bridgeResult = useMemo(
    () =>
      calculatePensionBridge(
        effectiveRetirementAge,
        pensionAccessAge,
        retirement.targetAnnualIncome,
        accessibleWealth
      ),
    [
      effectiveRetirementAge,
      pensionAccessAge,
      retirement.targetAnnualIncome,
      accessibleWealth,
    ]
  );

  // Primary person pro-rata state pension
  const primaryStatePensionAnnual = useMemo(() => {
    if (!primaryPerson)
      return UK_TAX_CONSTANTS.statePension.fullNewStatePensionAnnual;
    return calculateProRataStatePension(
      primaryPerson.niQualifyingYears ?? 0
    );
  }, [primaryPerson]);

  // Combined Retirement Income Timeline data
  const personRetirementInputs: PersonRetirementInput[] = useMemo(() => {
    return persons.map((person) => {
      const personPensionPot = accounts
        .filter(
          (a) =>
            a.personId === person.id &&
            (a.type === "workplace_pension" || a.type === "sipp")
        )
        .reduce((sum, a) => sum + a.currentValue, 0);

      const personAccessible = accounts
        .filter((a) => {
          if (a.personId !== person.id) return false;
          const wrapper = getAccountTaxWrapper(a.type);
          return wrapper !== "pension";
        })
        .reduce((sum, a) => sum + a.currentValue, 0);

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
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Retirement Planning"
        description="Track your progress toward financial independence"
      >
        <PersonToggle />
      </PageHeader>

      {persons.length === 0 && (
        <EmptyState
          message="No household data yet. Add people and pension accounts to plan your retirement."
          settingsTab="household"
        />
      )}

      {/* 1. Hero: Retirement Progress */}
      <RetirementHero
        currentPot={currentPot}
        requiredPot={requiredPot}
        progressPercent={progressPercent}
        targetAnnualIncome={retirement.targetAnnualIncome}
        withdrawalRate={retirement.withdrawalRate}
        includeStatePension={retirement.includeStatePension}
        totalStatePensionAnnual={totalStatePensionAnnual}
      />

      {/* 2. Scenario Controls (shared across sections) */}
      <ScenarioControls
        effectiveRetirementAge={effectiveRetirementAge}
        plannedRetirementAge={plannedRetirementAge}
        retirementAgeOverride={retirementAgeOverride}
        onRetirementAgeChange={setRetirementAgeOverride}
        onRetirementAgeReset={() => setRetirementAgeOverride(null)}
        scenarioRates={retirement.scenarioRates}
        selectedRateIndex={selectedRateIndex}
        onRateIndexChange={setSelectedRateIndex}
      />

      {/* 3. Pension Bridge Analysis (promoted — key question) */}
      <CollapsibleSection
        title="Pension Bridge"
        summary={
          bridgeResult.sufficient
            ? `Sufficient — ${formatCurrencyCompact(accessibleWealth - bridgeResult.bridgePotRequired)} surplus`
            : `Shortfall — ${formatCurrencyCompact(bridgeResult.shortfall)} needed`
        }
        storageKey="retirement-bridge"
        defaultOpen
      >
        <PensionBridgeCard
          bridgeResult={bridgeResult}
          effectiveRetirementAge={effectiveRetirementAge}
          pensionAccessAge={pensionAccessAge}
          targetAnnualIncome={retirement.targetAnnualIncome}
          accessibleWealth={accessibleWealth}
          lockedWealth={lockedWealth}
        />
      </CollapsibleSection>

      {/* 4. Combined Retirement Income Timeline */}
      <CollapsibleSection
        title="Income Timeline"
        summary="All household income sources stacked by year"
        storageKey="retirement-income-timeline"
        defaultOpen
      >
        <Card>
          <CardHeader>
            <CardTitle>Combined Retirement Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Household income sources stacked by year: state pensions, DC
              pension drawdown, and ISA/savings bridge at{" "}
              {formatPercent(midRate)} growth. Target:{" "}
              {formatCurrency(retirement.targetAnnualIncome)}/yr.
            </p>

            <RetirementIncomeTimeline
              persons={personRetirementInputs}
              targetAnnualIncome={retirement.targetAnnualIncome}
              retirementAge={effectiveRetirementAge}
              growthRate={midRate}
            />

            {/* Per-person summary cards */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {personRetirementInputs.map((p) => (
                <div
                  key={p.name}
                  className="rounded-lg border bg-muted/30 p-3 space-y-2"
                >
                  <p className="text-sm font-semibold">{p.name}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Pension pot
                      </span>
                      <span className="font-mono">
                        {formatCurrencyCompact(p.pensionPot)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        ISA/Savings
                      </span>
                      <span className="font-mono">
                        {formatCurrencyCompact(p.accessibleWealth)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        State pension
                      </span>
                      <span className="font-mono">
                        {formatCurrency(p.statePensionAnnual)}/yr
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground border-t pt-2">
                    <span>Pension: age {p.pensionAccessAge}</span>
                    <span>State: age {p.stateRetirementAge}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* 5. Retirement Drawdown Projection */}
      <CollapsibleSection
        title="Drawdown Projection"
        summary="How your pot depletes during retirement"
        storageKey="retirement-drawdown"
      >
        <Card>
          <CardHeader>
            <CardTitle>Retirement Drawdown</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              How your current pot ({formatCurrencyCompact(currentPot)})
              depletes during retirement at{" "}
              {formatCurrencyCompact(retirement.targetAnnualIncome)}/yr, with
              state pension reducing withdrawals from age{" "}
              {primaryPerson?.stateRetirementAge ?? 67}.
            </p>
            <RetirementDrawdownChart
              startingPot={currentPot}
              annualSpend={retirement.targetAnnualIncome}
              retirementAge={effectiveRetirementAge}
              scenarioRates={retirement.scenarioRates}
              statePensionAge={primaryPerson?.stateRetirementAge ?? 67}
              statePensionAnnual={primaryStatePensionAnnual}
            />
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* 6. Retirement Countdown */}
      <CollapsibleSection
        title="Retirement Countdown"
        summary="Time to reach target at different growth rates"
        storageKey="retirement-countdown"
        defaultOpen
      >
        <RetirementCountdownGrid
          currentPot={currentPot}
          totalAnnualContributions={totalAnnualContributions}
          requiredPot={requiredPot}
          scenarioRates={retirement.scenarioRates}
          currentAge={currentAge}
          selectedRateIndex={selectedRateIndex}
        />
      </CollapsibleSection>

      {/* 7. FIRE Metrics */}
      <CollapsibleSection
        title="FIRE Metrics"
        summary="Savings rate, Coast FIRE, and required monthly savings"
        storageKey="retirement-fire"
      >
        <FireMetricsCard
          savingsRate={savingsRate}
          totalAnnualContributions={totalAnnualContributions}
          totalGrossIncome={totalGrossIncome}
          coastFIRE={coastFIRE}
          requiredPot={requiredPot}
          pensionAccessAge={pensionAccessAge}
          midRate={midRate}
          requiredMonthlySavings={requiredMonthlySavings}
        />
      </CollapsibleSection>

      {/* 8. Disclaimer (always at the bottom) */}
      <p className="text-xs text-muted-foreground italic">
        Capital at risk — projections are illustrative only and do not
        constitute financial advice. Figures are shown in today&apos;s money
        with no inflation adjustment. Past performance does not predict future
        returns.
      </p>
    </div>
  );
}
