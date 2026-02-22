"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { isAccountAccessible, getHouseholdGrossIncome, annualiseContribution } from "@/types";
import { calculateTotalAnnualContributions, calculateHouseholdStatePension } from "@/lib/aggregations";
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
  calculateSWR,
  calculateAge,
  projectFinalValue,
  getMidScenarioRate,
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
import { Badge } from "@/components/ui/badge";
import { SettingsBar } from "@/components/settings-bar";
import { ScenarioDelta } from "@/components/scenario-delta";

export default function RetirementPage() {
  // Scenario-aware data
  const scenarioData = useScenarioData();
  const { selectedView } = usePersonView();
  const { household, baseHousehold, isScenarioMode } = scenarioData;

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

  const bonusStructures = useMemo(() => {
    if (selectedView === "household") return household.bonusStructures;
    return household.bonusStructures.filter((b) => b.personId === selectedView);
  }, [household.bonusStructures, selectedView]);

  const currentPot = useMemo(
    () => accounts.reduce((sum, a) => sum + a.currentValue, 0),
    [accounts]
  );

  const { retirement } = household;

  // Household total state pension
  const totalStatePensionAnnual = useMemo(
    () => calculateHouseholdStatePension(persons),
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

  // Total annual contributions (discretionary + employment pension)
  const totalAnnualContributions = useMemo(
    () => calculateTotalAnnualContributions(filteredContributions, income),
    [filteredContributions, income]
  );

  // Total gross income (salary + cash bonus)
  const totalGrossIncome = useMemo(
    () => getHouseholdGrossIncome(income, bonusStructures),
    [income, bonusStructures]
  );

  // Savings rate (guard against division by zero)
  const savingsRate =
    totalGrossIncome > 0
      ? (totalAnnualContributions / totalGrossIncome) * 100
      : 0;

  // --- Base (un-overridden) values for what-if comparison ---
  const baseAccounts = useMemo(() => {
    if (selectedView === "household") return baseHousehold.accounts;
    return baseHousehold.accounts.filter((a) => a.personId === selectedView);
  }, [baseHousehold.accounts, selectedView]);

  const basePersons = useMemo(() => {
    if (selectedView === "household") return baseHousehold.persons;
    return baseHousehold.persons.filter((p) => p.id === selectedView);
  }, [baseHousehold.persons, selectedView]);

  const baseIncome = useMemo(() => {
    if (selectedView === "household") return baseHousehold.income;
    return baseHousehold.income.filter((i) => i.personId === selectedView);
  }, [baseHousehold.income, selectedView]);

  const baseFilteredContributions = useMemo(() => {
    if (selectedView === "household") return baseHousehold.contributions;
    return baseHousehold.contributions.filter((c) => c.personId === selectedView);
  }, [baseHousehold.contributions, selectedView]);

  const baseCurrentPot = useMemo(
    () => baseAccounts.reduce((sum, a) => sum + a.currentValue, 0),
    [baseAccounts]
  );

  const baseTotalStatePensionAnnual = useMemo(
    () => calculateHouseholdStatePension(basePersons),
    [basePersons]
  );

  const baseRequiredPot = useMemo(
    () =>
      calculateAdjustedRequiredPot(
        baseHousehold.retirement.targetAnnualIncome,
        baseHousehold.retirement.withdrawalRate,
        baseHousehold.retirement.includeStatePension,
        baseTotalStatePensionAnnual
      ),
    [baseHousehold.retirement, baseTotalStatePensionAnnual]
  );

  const baseProgressPercent =
    baseRequiredPot > 0 ? (baseCurrentPot / baseRequiredPot) * 100 : 0;

  const baseTotalAnnualContributions = useMemo(
    () => calculateTotalAnnualContributions(baseFilteredContributions, baseIncome),
    [baseFilteredContributions, baseIncome]
  );

  const baseBonusStructures = useMemo(() => {
    if (selectedView === "household") return baseHousehold.bonusStructures;
    return baseHousehold.bonusStructures.filter((b) => b.personId === selectedView);
  }, [baseHousehold.bonusStructures, selectedView]);

  const baseTotalGrossIncome = useMemo(
    () => getHouseholdGrossIncome(baseIncome, baseBonusStructures),
    [baseIncome, baseBonusStructures]
  );

  const baseSavingsRate =
    baseTotalGrossIncome > 0
      ? (baseTotalAnnualContributions / baseTotalGrossIncome) * 100
      : 0;

  const { baseAccessibleWealth, baseLockedWealth } = useMemo(() => {
    let accessible = 0;
    let locked = 0;
    for (const account of baseAccounts) {
      if (isAccountAccessible(account.type)) accessible += account.currentValue;
      else locked += account.currentValue;
    }
    return { baseAccessibleWealth: accessible, baseLockedWealth: locked };
  }, [baseAccounts]);

  // Calculate accessible vs locked wealth
  const { accessibleWealth, lockedWealth } = useMemo(() => {
    let accessible = 0;
    let locked = 0;
    for (const account of accounts) {
      if (isAccountAccessible(account.type)) accessible += account.currentValue;
      else locked += account.currentValue;
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

  // Interactive retirement age override.
  // Store the scenario mode alongside the override so we can automatically
  // reset the slider when scenario mode changes (avoids stale local state
  // conflicting with scenario panel retirement age overrides).
  const [retirementAgeState, setRetirementAgeState] = useState<{
    scenarioMode: boolean;
    ageOverride: number | null;
  }>({ scenarioMode: isScenarioMode, ageOverride: null });

  // Derive effective override — auto-resets when scenario mode changes
  const retirementAgeOverride =
    retirementAgeState.scenarioMode === isScenarioMode
      ? retirementAgeState.ageOverride
      : null;

  const setRetirementAgeOverride = (age: number | null) => {
    setRetirementAgeState({ scenarioMode: isScenarioMode, ageOverride: age });
  };

  const effectiveRetirementAge = retirementAgeOverride ?? plannedRetirementAge;

  // Growth rate toggle (index into scenarioRates)
  const [selectedRateIndex, setSelectedRateIndex] = useState<number>(
    Math.floor((retirement.scenarioRates.length || 1) / 2)
  );

  // Selected scenario rate (for projections, Coast FIRE, drawdown)
  const midRate = retirement.scenarioRates[selectedRateIndex]
    ?? getMidScenarioRate(retirement.scenarioRates);
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

  // Primary person pro-rata state pension
  const primaryStatePensionAnnual = useMemo(() => {
    if (!primaryPerson)
      return UK_TAX_CONSTANTS.statePension.fullNewStatePensionAnnual;
    return calculateProRataStatePension(
      primaryPerson.niQualifyingYears ?? 0
    );
  }, [primaryPerson]);

  // Years from now to retirement for the primary person
  const yearsToRetirement = Math.max(0, effectiveRetirementAge - currentAge);

  // Per-person pension and accessible contributions (for projecting pots to retirement)
  const personContribBreakdown = useMemo(() => {
    return persons.map((person) => {
      const personIncome = income.find((i) => i.personId === person.id);
      const employmentPensionContrib = personIncome
        ? personIncome.employeePensionContribution + personIncome.employerPensionContribution
        : 0;
      const personContribs = filteredContributions.filter((c) => c.personId === person.id);
      // Route discretionary contributions by target: pension vs accessible (ISA/GIA)
      const discretionaryPension = personContribs
        .filter((c) => c.target === "pension")
        .reduce((sum, c) => sum + annualiseContribution(c.amount, c.frequency), 0);
      const accessibleContrib = personContribs
        .filter((c) => c.target === "isa" || c.target === "gia")
        .reduce((sum, c) => sum + annualiseContribution(c.amount, c.frequency), 0);
      return {
        personId: person.id,
        pensionContrib: employmentPensionContrib + discretionaryPension,
        accessibleContrib,
      };
    });
  }, [persons, income, filteredContributions]);

  // Projected pot at retirement (current pot + contributions compounded at selected growth rate)
  const projectedPotAtRetirement = useMemo(() =>
    projectFinalValue(currentPot, totalAnnualContributions, midRate, yearsToRetirement),
    [currentPot, totalAnnualContributions, midRate, yearsToRetirement]
  );

  // Base projected pot at retirement for what-if comparison
  const baseProjectedPotAtRetirement = useMemo(() =>
    projectFinalValue(baseCurrentPot, baseTotalAnnualContributions, midRate, yearsToRetirement),
    [baseCurrentPot, baseTotalAnnualContributions, midRate, yearsToRetirement]
  );

  // Sustainable income from projected pot (SWR * projected pot)
  const sustainableIncome = useMemo(
    () => calculateSWR(projectedPotAtRetirement, retirement.withdrawalRate),
    [projectedPotAtRetirement, retirement.withdrawalRate]
  );

  // Total projected retirement income (sustainable drawdown + state pension if enabled)
  const totalProjectedIncome = useMemo(
    () => sustainableIncome + (retirement.includeStatePension ? totalStatePensionAnnual : 0),
    [sustainableIncome, retirement.includeStatePension, totalStatePensionAnnual]
  );

  // Base sustainable income for what-if comparison
  const baseSustainableIncome = useMemo(
    () => calculateSWR(baseProjectedPotAtRetirement, baseHousehold.retirement.withdrawalRate),
    [baseProjectedPotAtRetirement, baseHousehold.retirement.withdrawalRate]
  );

  const baseTotalProjectedIncome = useMemo(
    () => baseSustainableIncome + (baseHousehold.retirement.includeStatePension ? baseTotalStatePensionAnnual : 0),
    [baseSustainableIncome, baseHousehold.retirement.includeStatePension, baseTotalStatePensionAnnual]
  );

  // Projected accessible wealth at retirement (for pension bridge)
  const totalAccessibleContrib = useMemo(() =>
    personContribBreakdown.reduce((sum, p) => sum + p.accessibleContrib, 0),
    [personContribBreakdown]
  );
  const projectedAccessibleWealth = useMemo(() =>
    projectFinalValue(accessibleWealth, totalAccessibleContrib, midRate, yearsToRetirement),
    [accessibleWealth, totalAccessibleContrib, midRate, yearsToRetirement]
  );

  // Pension Bridge Analysis (uses projected accessible wealth at retirement)
  const bridgeResult = useMemo(
    () =>
      calculatePensionBridge(
        effectiveRetirementAge,
        pensionAccessAge,
        retirement.targetAnnualIncome,
        projectedAccessibleWealth
      ),
    [
      effectiveRetirementAge,
      pensionAccessAge,
      retirement.targetAnnualIncome,
      projectedAccessibleWealth,
    ]
  );

  // Combined Retirement Income Timeline data — projected to retirement age
  const personRetirementInputs: PersonRetirementInput[] = useMemo(() => {
    return persons.map((person) => {
      const personPensionPot = accounts
        .filter((a) => a.personId === person.id && !isAccountAccessible(a.type))
        .reduce((sum, a) => sum + a.currentValue, 0);

      const personAccessible = accounts
        .filter((a) => a.personId === person.id && isAccountAccessible(a.type))
        .reduce((sum, a) => sum + a.currentValue, 0);

      const statePensionAnnual = calculateProRataStatePension(
        person.niQualifyingYears ?? 0
      );

      // Project pots forward to retirement age with contributions + growth
      const contribs = personContribBreakdown.find((c) => c.personId === person.id);

      return {
        name: person.name,
        pensionAccessAge: person.pensionAccessAge,
        stateRetirementAge: person.stateRetirementAge,
        pensionPot: projectFinalValue(personPensionPot, contribs?.pensionContrib ?? 0, midRate, yearsToRetirement),
        accessibleWealth: projectFinalValue(personAccessible, contribs?.accessibleContrib ?? 0, midRate, yearsToRetirement),
        statePensionAnnual: Math.round(statePensionAnnual),
      };
    });
  }, [persons, accounts, personContribBreakdown, yearsToRetirement, midRate]);

  // Base per-person retirement inputs for what-if comparison
  const basePersonContribBreakdown = useMemo(() => {
    return basePersons.map((person) => {
      const personIncome = baseIncome.find((i) => i.personId === person.id);
      const employmentPensionContrib = personIncome
        ? personIncome.employeePensionContribution + personIncome.employerPensionContribution
        : 0;
      const personContribs = baseFilteredContributions.filter((c) => c.personId === person.id);
      const discretionaryPension = personContribs
        .filter((c) => c.target === "pension")
        .reduce((sum, c) => sum + annualiseContribution(c.amount, c.frequency), 0);
      const accessibleContrib = personContribs
        .filter((c) => c.target === "isa" || c.target === "gia")
        .reduce((sum, c) => sum + annualiseContribution(c.amount, c.frequency), 0);
      return {
        personId: person.id,
        pensionContrib: employmentPensionContrib + discretionaryPension,
        accessibleContrib,
      };
    });
  }, [basePersons, baseIncome, baseFilteredContributions]);

  const basePersonRetirementInputs = useMemo(() => {
    return basePersons.map((person) => {
      const personPensionPot = baseAccounts
        .filter((a) => a.personId === person.id && !isAccountAccessible(a.type))
        .reduce((sum, a) => sum + a.currentValue, 0);
      const personAccessible = baseAccounts
        .filter((a) => a.personId === person.id && isAccountAccessible(a.type))
        .reduce((sum, a) => sum + a.currentValue, 0);
      const contribs = basePersonContribBreakdown.find((c) => c.personId === person.id);
      return {
        name: person.name,
        pensionPot: projectFinalValue(personPensionPot, contribs?.pensionContrib ?? 0, midRate, yearsToRetirement),
        accessibleWealth: projectFinalValue(personAccessible, contribs?.accessibleContrib ?? 0, midRate, yearsToRetirement),
      };
    });
  }, [basePersons, baseAccounts, basePersonContribBreakdown, midRate, yearsToRetirement]);

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
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
        projectedPotAtRetirement={projectedPotAtRetirement}
        sustainableIncome={sustainableIncome}
        totalProjectedIncome={totalProjectedIncome}
        yearsToRetirement={yearsToRetirement}
        growthRate={midRate}
        baseCurrentPot={baseCurrentPot}
        baseProgressPercent={baseProgressPercent}
        baseRequiredPot={baseRequiredPot}
        baseProjectedPotAtRetirement={baseProjectedPotAtRetirement}
        baseSustainableIncome={baseSustainableIncome}
        baseTotalProjectedIncome={baseTotalProjectedIncome}
      />

      {/* 2. Planning Settings — quick reference */}
      <SettingsBar label="Planning assumptions" settingsTab="planning">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Target income</span>
          <Badge variant="secondary">{formatCurrency(retirement.targetAnnualIncome)}/yr</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Withdrawal rate</span>
          <Badge variant="secondary">{formatPercent(retirement.withdrawalRate)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">State pension</span>
          <Badge variant={retirement.includeStatePension ? "default" : "outline"}>
            {retirement.includeStatePension ? `Yes (${formatCurrency(totalStatePensionAnnual)}/yr)` : "Excluded"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Pension access</span>
          <Badge variant="secondary">Age {pensionAccessAge}</Badge>
        </div>
      </SettingsBar>

      {/* 3. Scenario Controls (shared across sections) */}
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
            ? `Sufficient — ${formatCurrencyCompact(projectedAccessibleWealth - bridgeResult.bridgePotRequired)} surplus`
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
          accessibleWealth={projectedAccessibleWealth}
          lockedWealth={lockedWealth}
          baseAccessibleWealth={baseAccessibleWealth}
          baseLockedWealth={baseLockedWealth}
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
              Pots projected to retirement ({formatPercent(midRate)} growth + contributions), then
              drawn down. Target: {formatCurrency(retirement.targetAnnualIncome)}/yr.
            </p>

            <RetirementIncomeTimeline
              persons={personRetirementInputs}
              targetAnnualIncome={retirement.targetAnnualIncome}
              retirementAge={effectiveRetirementAge}
              growthRate={midRate}
            />

            {/* Per-person summary cards */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {personRetirementInputs.map((p) => {
                const basePerson = basePersonRetirementInputs.find((bp) => bp.name === p.name);
                return (
                <div
                  key={p.name}
                  className="rounded-lg border bg-muted/30 p-3 space-y-2"
                >
                  <p className="text-sm font-semibold">{p.name}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Pension at retirement
                      </span>
                      <span className="font-mono">
                        <ScenarioDelta base={basePerson?.pensionPot ?? p.pensionPot} scenario={p.pensionPot} format={formatCurrencyCompact} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        ISA/Savings at retirement
                      </span>
                      <span className="font-mono">
                        <ScenarioDelta base={basePerson?.accessibleWealth ?? p.accessibleWealth} scenario={p.accessibleWealth} format={formatCurrencyCompact} />
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
                );
              })}
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
              Projected pot at retirement: <span className="font-medium text-foreground"><ScenarioDelta base={baseProjectedPotAtRetirement} scenario={projectedPotAtRetirement} format={formatCurrencyCompact} /></span> (today: {formatCurrencyCompact(currentPot)}, +{yearsToRetirement}yr growth at {formatPercent(midRate)}).
              Drawdown at {formatCurrencyCompact(retirement.targetAnnualIncome)}/yr, with
              state pension reducing withdrawals from age{" "}
              {primaryPerson?.stateRetirementAge ?? 67}.
            </p>
            <RetirementDrawdownChart
              startingPot={projectedPotAtRetirement}
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
          baseCurrentPot={baseCurrentPot}
          baseTotalAnnualContributions={baseTotalAnnualContributions}
          baseRequiredPot={baseRequiredPot}
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
          baseSavingsRate={baseSavingsRate}
          baseTotalAnnualContributions={baseTotalAnnualContributions}
          baseTotalGrossIncome={baseTotalGrossIncome}
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
