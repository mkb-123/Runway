"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { EmptyState } from "@/components/empty-state";
import { CollapsibleSection } from "@/components/collapsible-section";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  getUnrealisedGains,
  calculateBedAndISA,
  determineCgtRate,
  calculateBedAndISABreakEven,
} from "@/lib/cgt";
import { calculateTakeHomePay } from "@/lib/tax";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { WrapperSplitChart } from "@/components/charts/wrapper-split-chart";
import { ScenarioDelta } from "@/components/scenario-delta";
import type { PersonIncome } from "@/types";
import { getPersonContributionTotals, getAccountTaxWrapper } from "@/types";
import type { TaxWrapper } from "@/types";
import { SettingsBar } from "@/components/settings-bar";

export default function TaxPlanningPage() {
  useData(); // keep context provider mounted
  const { selectedView } = usePersonView();
  const scenarioData = useScenarioData();
  const household = scenarioData.household;
  const baseHousehold = scenarioData.baseHousehold;
  const getNetWorthByWrapper = scenarioData.getNetWorthByWrapper;

  // Base income lookup for ScenarioDelta comparison
  const baseIncomeLookup = useMemo(() => {
    const map = new Map<string, PersonIncome>();
    for (const i of baseHousehold.income) map.set(i.personId, i);
    return map;
  }, [baseHousehold.income]);

  const persons = useMemo(() => {
    if (selectedView === "household") return household.persons;
    return household.persons.filter((p) => p.id === selectedView);
  }, [household.persons, selectedView]);

  const { income, contributions } = household;

  const currentTaxYear = (() => {
    const now = new Date();
    const y = now.getMonth() >= 3 && now.getDate() > 5 ? now.getFullYear() : now.getFullYear() - 1;
    return `${y}/${(y + 1) % 100}`;
  })();
  const isaAllowance = UK_TAX_CONSTANTS.isaAnnualAllowance;
  const pensionAllowance = UK_TAX_CONSTANTS.pensionAnnualAllowance;
  const cgtAnnualExempt = UK_TAX_CONSTANTS.cgt.annualExemptAmount;

  const wrapperData = useMemo(() => getNetWorthByWrapper(), [getNetWorthByWrapper]);
  const totalNetWorth = useMemo(
    () => wrapperData.reduce((sum, w) => sum + w.value, 0),
    [wrapperData]
  );

  // Per-person data
  const personData = useMemo(
    () =>
      persons.map((person) => {
        const personIncome = income.find((i) => i.personId === person.id);
        const personBonus = household.bonusStructures.find((b) => b.personId === person.id);
        const personContributions = getPersonContributionTotals(contributions, person.id);
        const personAccounts = household.accounts.filter((a) => a.personId === person.id);
        const personGiaAccounts = personAccounts.filter((a) => a.type === "gia");

        // GIA value
        const giaValue = personGiaAccounts.reduce(
          (sum, a) => sum + a.currentValue,
          0
        );

        // ISA remaining
        const isaUsed = personContributions.isaContribution;
        const isaRemaining = Math.max(0, isaAllowance - isaUsed);

        // Pension remaining — ALL sources count against the annual allowance:
        // employee + employer (from income) + discretionary (from contributions array)
        const employeePension = personIncome?.employeePensionContribution ?? 0;
        const employerPension = personIncome?.employerPensionContribution ?? 0;
        const discretionaryPension = personContributions.pensionContribution;
        const pensionUsed = employeePension + employerPension + discretionaryPension;
        const pensionRemaining = Math.max(0, pensionAllowance - pensionUsed);

        // Unrealised gains in GIA
        const unrealisedGains = getUnrealisedGains(personGiaAccounts);
        const totalUnrealisedGain = unrealisedGains.reduce(
          (sum, ug) => sum + ug.unrealisedGain,
          0
        );

        // Without transaction history, assume full CGT allowance is available
        const remainingCgtAllowance = cgtAnnualExempt;

        // Determine CGT rate based on total income including bonus (accounting for pension method)
        const cgtRate = personIncome
          ? determineCgtRate(
              personIncome.grossSalary + (personBonus?.cashBonusAnnual ?? 0),
              personIncome.employeePensionContribution,
              personIncome.pensionContributionMethod
            )
          : UK_TAX_CONSTANTS.cgt.basicRate;
        const isHigherRate = cgtRate === UK_TAX_CONSTANTS.cgt.higherRate;

        // Bed & ISA calculation
        const bedAndISA = calculateBedAndISA(
          totalUnrealisedGain,
          remainingCgtAllowance,
          cgtRate
        );

        // Break-even analysis: how many years until the CGT cost is recouped
        const breakEvenYears = calculateBedAndISABreakEven(
          bedAndISA.cgtCost,
          giaValue,
          cgtRate
        );

        // --- Base (un-overridden) values for ScenarioDelta ---
        const baseIncome = baseIncomeLookup.get(person.id);
        const baseContributions = getPersonContributionTotals(baseHousehold.contributions, person.id);
        const basePersonAccounts = baseHousehold.accounts.filter((a) => a.personId === person.id);
        const baseGiaAccounts = basePersonAccounts.filter((a) => a.type === "gia");

        const baseGiaValue = baseGiaAccounts.reduce(
          (sum, a) => sum + a.currentValue,
          0
        );
        const baseIsaUsed = baseContributions.isaContribution;
        const baseIsaRemaining = Math.max(0, isaAllowance - baseIsaUsed);

        const baseEmployeePension = baseIncome?.employeePensionContribution ?? 0;
        const baseEmployerPension = baseIncome?.employerPensionContribution ?? 0;
        const baseDiscretionaryPension = baseContributions.pensionContribution;
        const basePensionUsed = baseEmployeePension + baseEmployerPension + baseDiscretionaryPension;
        const basePensionRemaining = Math.max(0, pensionAllowance - basePensionUsed);

        const baseUnrealisedGains = getUnrealisedGains(baseGiaAccounts);
        const baseTotalUnrealisedGain = baseUnrealisedGains.reduce(
          (sum, ug) => sum + ug.unrealisedGain,
          0
        );

        return {
          person,
          personIncome,
          personContributions,
          giaValue,
          isaUsed,
          isaRemaining,
          pensionUsed,
          pensionRemaining,
          unrealisedGains,
          totalUnrealisedGain,
          remainingCgtAllowance,
          cgtRate,
          bedAndISA,
          breakEvenYears,
          isHigherRate,
          // Base values for ScenarioDelta
          baseGiaValue,
          baseIsaUsed,
          baseIsaRemaining,
          basePensionUsed,
          basePensionRemaining,
          baseTotalUnrealisedGain,
        };
      }),
    [persons, income, contributions, household.accounts, isaAllowance, pensionAllowance, cgtAnnualExempt, baseIncomeLookup, baseHousehold.contributions, baseHousehold.accounts]
  );

  // Pension modelling scenarios
  const pensionScenarios = useMemo(
    () =>
      personData.map(
        ({ person, personIncome, pensionRemaining }) => {
          if (!personIncome) return { person, scenarios: [] };

          const currentEmployeePension =
            personIncome.employeePensionContribution;
          const maxAdditional = pensionRemaining;

          const increments = [
            { label: "Current", additional: 0 },
            { label: "+\u00A310k", additional: Math.min(10000, maxAdditional) },
            { label: "+\u00A320k", additional: Math.min(20000, maxAdditional) },
            { label: "Max", additional: maxAdditional },
          ];

          const scenarios = increments.map(({ label, additional }) => {
            const newPensionContribution = currentEmployeePension + additional;

            const modifiedIncome: PersonIncome = {
              ...personIncome,
              employeePensionContribution: newPensionContribution,
            };

            const takeHome = calculateTakeHomePay(modifiedIncome);

            // NI saving from salary sacrifice
            const baseTakeHome = calculateTakeHomePay(personIncome);
            const niSaving =
              personIncome.pensionContributionMethod === "salary_sacrifice"
                ? baseTakeHome.ni - takeHome.ni
                : 0;

            // Effective cost = reduction in take-home
            const effectiveCost = baseTakeHome.takeHome - takeHome.takeHome;

            // Tax relief value = additional contribution - effective cost
            const taxRelief = additional - effectiveCost;

            return {
              label,
              additional,
              totalPensionContribution:
                newPensionContribution +
                personIncome.employerPensionContribution,
              takeHome: takeHome.takeHome,
              monthlyTakeHome: takeHome.monthlyTakeHome,
              niSaving,
              effectiveCost,
              taxRelief,
              incomeTax: takeHome.incomeTax,
            };
          });

          return { person, scenarios };
        }
      ),
    [personData]
  );

  // Base wrapper data for ScenarioDelta comparison
  const baseWrapperData = useMemo(() => {
    const totals = new Map<TaxWrapper, number>();
    for (const account of baseHousehold.accounts) {
      const wrapper = getAccountTaxWrapper(account.type);
      totals.set(wrapper, (totals.get(wrapper) ?? 0) + account.currentValue);
    }
    return totals;
  }, [baseHousehold.accounts]);

  // Wrapper efficiency: compute percentages
  const wrapperPercentages = useMemo(
    () =>
      wrapperData.map((w) => ({
        ...w,
        percentage: totalNetWorth > 0 ? w.value / totalNetWorth : 0,
      })),
    [wrapperData, totalNetWorth]
  );

  const giaPercentage = useMemo(
    () => wrapperPercentages.find((w) => w.wrapper === "gia")?.percentage ?? 0,
    [wrapperPercentages]
  );

  return (
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader title="Tax Planning & Optimisation" description="Strategies to minimise tax drag and optimise your investment wrappers.">
        <PersonToggle />
      </PageHeader>

      {persons.length === 0 && (
        <EmptyState message="No household data yet. Add people and accounts to see tax planning strategies." settingsTab="household" />
      )}

      {/* Allowance Summary Bar — always visible at top */}
      {personData.length > 0 && (
        <SettingsBar label="Allowance usage" settingsTab="household" editLabel="Edit contributions">
          {personData.map(({ person, isaUsed, isaRemaining, pensionUsed, pensionRemaining }) => {
            const isaPercent = Math.min(100, (isaUsed / isaAllowance) * 100);
            const pensionPercent = Math.min(100, (pensionUsed / pensionAllowance) * 100);
            return (
              <div key={person.id} className="flex items-center gap-4">
                <span className="font-medium text-xs">{person.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-xs">ISA</span>
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${isaPercent >= 100 ? "bg-green-500" : isaPercent >= 80 ? "bg-amber-500" : "bg-blue-500"}`}
                      style={{ width: `${isaPercent}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-xs">{formatCurrency(isaRemaining)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-xs">Pension</span>
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${pensionPercent >= 100 ? "bg-green-500" : pensionPercent >= 80 ? "bg-amber-500" : "bg-blue-500"}`}
                      style={{ width: `${pensionPercent}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-xs">{formatCurrency(pensionRemaining)}</span>
                </div>
              </div>
            );
          })}
        </SettingsBar>
      )}

      {/* Bed & ISA Planner */}
      <CollapsibleSection title="Bed & ISA Planner" summary="CGT-efficient ISA transfers" storageKey="tax-bed-isa" defaultOpen>
        <Card>
          <CardHeader>
            <CardTitle>Bed &amp; ISA Planner</CardTitle>
            <CardDescription>
              Sell GIA holdings, crystallise gains within your CGT allowance, and
              repurchase within an ISA to shelter future growth from tax.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {personData.map(
                ({
                  person,
                  giaValue,
                  isaRemaining,
                  totalUnrealisedGain,
                  remainingCgtAllowance,
                  cgtRate,
                  bedAndISA,
                  breakEvenYears,
                  isHigherRate,
                  baseGiaValue,
                  baseIsaRemaining,
                  baseTotalUnrealisedGain,
                }) => (
                  <Card key={person.id} className="border-dashed">
                    <CardHeader>
                      <CardTitle className="text-lg">{person.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-muted-foreground text-sm">
                              GIA Value
                            </p>
                            <p className="text-lg font-semibold">
                              <ScenarioDelta base={baseGiaValue} scenario={giaValue} format={formatCurrency} />
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-sm">
                              ISA Allowance Remaining
                            </p>
                            <p className="text-lg font-semibold">
                              <ScenarioDelta base={baseIsaRemaining} scenario={isaRemaining} format={formatCurrency} />
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-sm">
                              Unrealised Gain
                            </p>
                            <p
                              className={`text-lg font-semibold ${
                                totalUnrealisedGain >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-600"
                              }`}
                            >
                              <ScenarioDelta base={baseTotalUnrealisedGain} scenario={totalUnrealisedGain} format={formatCurrency} />
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-sm">
                              CGT Rate
                            </p>
                            <p className="text-lg font-semibold">
                              {formatPercent(cgtRate)}{" "}
                              <Badge variant="outline" className="text-xs">
                                {isHigherRate ? "Higher" : "Basic"}
                              </Badge>
                            </p>
                          </div>
                        </div>

                        <div className="rounded-lg border p-4">
                          <p className="mb-2 text-sm font-medium">
                            Bed &amp; ISA Analysis
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-muted-foreground text-xs">
                                CGT Allowance Left
                              </p>
                              <p className="text-base font-semibold">
                                {formatCurrency(remainingCgtAllowance)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">
                                CGT Cost of Transfer
                              </p>
                              <p className="text-base font-semibold text-red-600">
                                {formatCurrency(bedAndISA.cgtCost)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">
                                Break-even Period
                              </p>
                              <p className="text-base font-semibold">
                                {bedAndISA.cgtCost === 0
                                  ? "Immediate"
                                  : `~${breakEvenYears} yrs`}
                              </p>
                            </div>
                          </div>
                        </div>

                        {bedAndISA.cgtCost === 0 && totalUnrealisedGain > 0 ? (
                          <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
                            <p className="text-sm text-green-700 dark:text-green-300">
                              The full unrealised gain of{" "}
                              <span className="font-bold">
                                {formatCurrency(totalUnrealisedGain)}
                              </span>{" "}
                              can be crystallised within your CGT allowance at
                              zero tax cost. Transfer up to{" "}
                              <span className="font-bold">
                                {formatCurrency(
                                  Math.min(giaValue, isaRemaining)
                                )}
                              </span>{" "}
                              to your ISA.
                            </p>
                          </div>
                        ) : totalUnrealisedGain > 0 ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              Transferring all GIA holdings would incur{" "}
                              <span className="font-bold">
                                {formatCurrency(bedAndISA.cgtCost)}
                              </span>{" "}
                              in CGT. This cost is recovered in approximately{" "}
                              <span className="font-bold">
                                {breakEvenYears} years
                              </span>{" "}
                              through ISA tax savings (assuming 7% annual return).
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* Pension Optimisation */}
      <CollapsibleSection title="Pension Optimisation" summary="Model contribution levels" storageKey="tax-pension" defaultOpen>
        <Card>
          <CardHeader>
            <CardTitle>Pension Optimisation</CardTitle>
            <CardDescription>
              Model different pension contribution levels to find the optimal
              balance between take-home pay and tax efficiency.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {pensionScenarios.map(({ person, scenarios }) => {
                if (scenarios.length === 0) return null;
                const personIncome = income.find(
                  (i) => i.personId === person.id
                );
                const personContributions = getPersonContributionTotals(contributions, person.id);
                const isSalarySacrifice =
                  personIncome?.pensionContributionMethod === "salary_sacrifice";

                return (
                  <div key={person.id}>
                    <div className="mb-4 flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{person.name}</h3>
                      <Badge variant="outline">
                        {formatCurrency(personIncome?.grossSalary ?? 0)} gross
                      </Badge>
                      {isSalarySacrifice && (
                        <Badge variant="secondary">Salary Sacrifice</Badge>
                      )}
                    </div>

                    <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {(() => {
                        const totalPensionUsed =
                          (personIncome?.employeePensionContribution ?? 0) +
                          (personIncome?.employerPensionContribution ?? 0) +
                          personContributions.pensionContribution;
                        return (
                          <>
                            <div>
                              <p className="text-muted-foreground text-sm">
                                Current Pension Contributions
                              </p>
                              <p className="font-semibold">
                                {formatCurrency(totalPensionUsed)}
                                <span className="text-muted-foreground text-xs">
                                  {" "}
                                  /yr (employee + employer + discretionary)
                                </span>
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-sm">
                                Pension Allowance Used
                              </p>
                              <p className="font-semibold">
                                {formatCurrency(totalPensionUsed)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-sm">
                                Remaining Allowance
                              </p>
                              <p className="font-semibold">
                                {formatCurrency(
                                  pensionAllowance - totalPensionUsed
                                )}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Scenario</TableHead>
                            <TableHead className="text-right">
                              Additional
                            </TableHead>
                            <TableHead className="text-right">
                              Total Pension (p.a.)
                            </TableHead>
                            <TableHead className="text-right">
                              Income Tax
                            </TableHead>
                            {isSalarySacrifice && (
                              <TableHead className="text-right">
                                NI Saving
                              </TableHead>
                            )}
                            <TableHead className="text-right">
                              Effective Cost
                            </TableHead>
                            <TableHead className="text-right">
                              Take-Home (monthly)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scenarios.map((scenario) => (
                            <TableRow key={scenario.label}>
                              <TableCell className="font-medium">
                                {scenario.label}
                              </TableCell>
                              <TableCell className="text-right">
                                {scenario.additional > 0
                                  ? formatCurrency(scenario.additional)
                                  : "--"}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(
                                  scenario.totalPensionContribution
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(scenario.incomeTax)}
                              </TableCell>
                              {isSalarySacrifice && (
                                <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                                  {scenario.niSaving > 0
                                    ? formatCurrency(scenario.niSaving)
                                    : "--"}
                                </TableCell>
                              )}
                              <TableCell className="text-right">
                                {scenario.effectiveCost > 0
                                  ? formatCurrency(scenario.effectiveCost)
                                  : "--"}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(scenario.monthlyTakeHome)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {isSalarySacrifice && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Salary sacrifice reduces both income tax and National
                        Insurance, making each additional pound of pension
                        contribution cheaper than the face value.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* Wrapper Efficiency */}
      <CollapsibleSection title="Wrapper Efficiency" summary="Tax wrapper allocation" storageKey="tax-wrapper">
        <Card>
          <CardHeader>
            <CardTitle>Wrapper Efficiency</CardTitle>
            <CardDescription>
              Current allocation across tax wrappers. Minimise GIA exposure to
              reduce tax drag.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <WrapperSplitChart data={wrapperData} />
              </div>
              <div className="space-y-4">
                {wrapperPercentages.map((w) => {
                  const labels: Record<string, string> = {
                    pension: "Pension",
                    isa: "ISA",
                    gia: "GIA",
                    cash: "Cash",
                    premium_bonds: "Premium Bonds",
                  };
                  const baseValue = baseWrapperData.get(w.wrapper) ?? 0;
                  return (
                    <div
                      key={w.wrapper}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">
                          {labels[w.wrapper] ?? w.wrapper}
                        </span>
                        {w.wrapper === "gia" && w.percentage > 0.15 && (
                          <Badge variant="destructive" className="text-xs">
                            Tax inefficient
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">
                          <ScenarioDelta base={baseValue} scenario={w.value} format={formatCurrency} />
                        </span>
                        <span className="text-muted-foreground ml-2 text-sm">
                          ({formatPercent(w.percentage)})
                        </span>
                      </div>
                    </div>
                  );
                })}

                {giaPercentage > 0.15 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Growing GIA allocation
                    </p>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                      Your GIA represents {formatPercent(giaPercentage)} of
                      your portfolio. Consider Bed &amp; ISA or additional pension
                      contributions to reduce tax-inefficient exposure.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* ISA & Pension Allowance Trackers */}
      <CollapsibleSection title="Allowance Trackers" summary="ISA & pension usage" storageKey="tax-allowances">
        <Card>
          <CardHeader>
            <CardTitle>ISA &amp; Pension Allowance Trackers</CardTitle>
            <CardDescription>
              Track usage of your annual tax-advantaged contribution allowances for
              the {currentTaxYear} tax year.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {personData.map(
                ({
                  person,
                  isaUsed,
                  isaRemaining,
                  pensionUsed,
                  pensionRemaining,
                  baseIsaUsed,
                  baseIsaRemaining,
                  basePensionUsed,
                  basePensionRemaining,
                }) => (
                  <Card key={person.id} className="border-dashed">
                    <CardHeader>
                      <CardTitle className="text-lg">{person.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* ISA Tracker */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">ISA Allowance</p>
                            <p className="text-muted-foreground text-sm">
                              <ScenarioDelta base={baseIsaUsed} scenario={isaUsed} format={formatCurrency} showPercent={false} /> /{" "}
                              {formatCurrency(isaAllowance)}
                            </p>
                          </div>
                          <Progress
                            value={Math.min(
                              100,
                              (isaUsed / isaAllowance) * 100
                            )}
                          />
                          <div className="flex justify-between">
                            <span className="text-muted-foreground text-xs">
                              {formatPercent(isaUsed / isaAllowance)} used
                            </span>
                            <span className="text-xs font-medium">
                              <ScenarioDelta base={baseIsaRemaining} scenario={isaRemaining} format={formatCurrency} /> remaining
                            </span>
                          </div>
                          {isaRemaining === 0 && (
                            <Badge className="bg-green-600">Fully utilised</Badge>
                          )}
                        </div>

                        {/* Pension Tracker */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              Pension Annual Allowance
                            </p>
                            <p className="text-muted-foreground text-sm">
                              <ScenarioDelta base={basePensionUsed} scenario={pensionUsed} format={formatCurrency} showPercent={false} /> /{" "}
                              {formatCurrency(pensionAllowance)}
                            </p>
                          </div>
                          <Progress
                            value={Math.min(
                              100,
                              (pensionUsed / pensionAllowance) * 100
                            )}
                          />
                          <div className="flex justify-between">
                            <span className="text-muted-foreground text-xs">
                              {formatPercent(pensionUsed / pensionAllowance)}{" "}
                              used
                            </span>
                            <span className="text-xs font-medium">
                              <ScenarioDelta base={basePensionRemaining} scenario={pensionRemaining} format={formatCurrency} /> remaining
                            </span>
                          </div>
                          {pensionRemaining === 0 ? (
                            <Badge className="bg-green-600">Fully utilised</Badge>
                          ) : pensionRemaining > 20000 ? (
                            <Badge variant="outline">
                              Significant headroom remaining
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      <p className="text-xs text-muted-foreground italic">
        Capital at risk — projections are illustrative only and do not constitute financial advice. Past performance does not predict future returns.
      </p>
    </div>
  );
}
