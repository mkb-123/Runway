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
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  getUnrealisedGains,
  calculateBedAndISA,
  calculateGainsForTaxYear,
} from "@/lib/cgt";
import { calculateTakeHomePay } from "@/lib/tax";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { WrapperSplitChart } from "@/components/charts/wrapper-split-chart";
import type { PersonIncome } from "@/types";

export default function TaxPlanningPage() {
  const { transactions: transactionsData, getAccountsForPerson } = useData();
  const { selectedView } = usePersonView();
  const scenarioData = useScenarioData();
  const household = scenarioData.household;
  const getNetWorthByWrapper = scenarioData.getNetWorthByWrapper;
  const { transactions } = transactionsData;

  const persons = useMemo(() => {
    if (selectedView === "household") return household.persons;
    return household.persons.filter((p) => p.id === selectedView);
  }, [household.persons, selectedView]);

  const { income, annualContributions } = household;

  const currentTaxYear = "2024/25";
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
        const personContributions = annualContributions.find(
          (c) => c.personId === person.id
        );
        const personAccounts = getAccountsForPerson(person.id);
        const personGiaAccounts = personAccounts.filter((a) => a.type === "gia");
        const personGiaAccountIds = new Set(personGiaAccounts.map((a) => a.id));
        const personGiaTransactions = transactions.filter((tx) =>
          personGiaAccountIds.has(tx.accountId)
        );

        // GIA value
        const giaValue = personGiaAccounts.reduce(
          (sum, a) => sum + a.currentValue,
          0
        );

        // ISA remaining
        const isaUsed = personContributions?.isaContribution ?? 0;
        const isaRemaining = Math.max(0, isaAllowance - isaUsed);

        // Pension remaining
        const pensionUsed = personContributions?.pensionContribution ?? 0;
        const pensionRemaining = Math.max(0, pensionAllowance - pensionUsed);

        // Unrealised gains in GIA
        const unrealisedGains = getUnrealisedGains(
          personGiaAccounts,
          personGiaTransactions
        );
        const totalUnrealisedGain = unrealisedGains.reduce(
          (sum, ug) => sum + ug.unrealisedGain,
          0
        );

        // Calculate realised gains for this person
        const personTaxYearGains = calculateGainsForTaxYear(
          personGiaTransactions,
          currentTaxYear
        );
        const usedAllowance = Math.max(0, personTaxYearGains.netGain);
        const remainingCgtAllowance = Math.max(0, cgtAnnualExempt - usedAllowance);

        // Determine CGT rate based on income
        const isHigherRate =
          personIncome && personIncome.grossSalary > UK_TAX_CONSTANTS.incomeTax.basicRateUpperLimit;
        const cgtRate = isHigherRate
          ? UK_TAX_CONSTANTS.cgt.higherRate
          : UK_TAX_CONSTANTS.cgt.basicRate;

        // Bed & ISA calculation
        const bedAndISA = calculateBedAndISA(
          totalUnrealisedGain,
          remainingCgtAllowance,
          cgtRate
        );

        // Break-even analysis: how many years until the CGT cost is recouped
        // by ISA tax savings on future gains
        // Assume 7% average annual return in the ISA
        const assumedReturn = 0.07;
        const annualFutureTaxSaved = giaValue * assumedReturn * cgtRate;
        const breakEvenYears =
          annualFutureTaxSaved > 0
            ? Math.ceil((bedAndISA.cgtCost / annualFutureTaxSaved) * 10) / 10
            : 0;

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
          usedAllowance,
          remainingCgtAllowance,
          cgtRate,
          bedAndISA,
          breakEvenYears,
          isHigherRate,
        };
      }),
    [persons, income, annualContributions, transactions, getAccountsForPerson, isaAllowance, pensionAllowance, cgtAnnualExempt]
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
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Tax Planning &amp; Optimisation
          </h1>
          <p className="text-muted-foreground mt-1">
            Strategies to minimise tax drag and optimise your investment wrappers.
          </p>
        </div>
        <PersonToggle />
      </div>

      {/* Bed & ISA Planner */}
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
                            {formatCurrency(giaValue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            ISA Allowance Remaining
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(isaRemaining)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">
                            Unrealised Gain
                          </p>
                          <p
                            className={`text-lg font-semibold ${
                              totalUnrealisedGain >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(totalUnrealisedGain)}
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
                        <div className="grid grid-cols-3 gap-4 text-center">
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

      {/* Pension Optimisation */}
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
              const personContributions = annualContributions.find(
                (c) => c.personId === person.id
              );
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

                  <div className="mb-3 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Current Pension Contributions
                      </p>
                      <p className="font-semibold">
                        {formatCurrency(
                          (personIncome?.employeePensionContribution ?? 0) +
                            (personIncome?.employerPensionContribution ?? 0)
                        )}
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          /yr (employee + employer)
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Pension Allowance Used
                      </p>
                      <p className="font-semibold">
                        {formatCurrency(
                          personContributions?.pensionContribution ?? 0
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Remaining Allowance
                      </p>
                      <p className="font-semibold">
                        {formatCurrency(
                          pensionAllowance -
                            (personContributions?.pensionContribution ?? 0)
                        )}
                      </p>
                    </div>
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
                              <TableCell className="text-right text-green-600">
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

      {/* Wrapper Efficiency */}
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
                        {formatCurrency(w.value)}
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

      {/* ISA & Pension Allowance Trackers */}
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
                            {formatCurrency(isaUsed)} /{" "}
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
                            {formatCurrency(isaRemaining)} remaining
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
                            {formatCurrency(pensionUsed)} /{" "}
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
                            {formatCurrency(pensionRemaining)} remaining
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
    </div>
  );
}
