"use client";

import { useMemo } from "react";
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { CollapsibleSection } from "@/components/collapsible-section";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import {
  calculateIncomeTax,
  calculateNI,
  calculateStudentLoan,
  calculateTakeHomePayWithStudentLoan,
} from "@/lib/tax";
import {
  calculateTaxEfficiencyScore,
  projectSalaryTrajectory,
} from "@/lib/projections";
import { generateDeferredTranches, totalProjectedDeferredValue } from "@/lib/deferred-bonus";
import { getPersonContributionTotals, annualiseOutgoing } from "@/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CashFlowWaterfall,
  type WaterfallDataPoint,
} from "@/components/charts/cash-flow-waterfall";
import { EffectiveTaxRateChart } from "@/components/charts/effective-tax-rate-chart";
import { TaxBandChart } from "@/components/charts/tax-band-chart";
import { CashFlowTimeline } from "@/components/charts/cash-flow-timeline";
import { generateCashFlowTimeline } from "@/lib/cash-flow";
import type { TaxBandDataItem } from "@/components/charts/tax-band-chart";
import { ScenarioDelta } from "@/components/scenario-delta";

// projectedValue helper removed — now using totalProjectedDeferredValue from lib

// --- Helper: student loan plan label ---
function studentLoanLabel(plan: string): string {
  switch (plan) {
    case "plan1":
      return "Plan 1";
    case "plan2":
      return "Plan 2";
    case "plan4":
      return "Plan 4";
    case "plan5":
      return "Plan 5";
    case "postgrad":
      return "Postgraduate";
    default:
      return "None";
  }
}

export default function IncomePage() {
  const { selectedView } = usePersonView();
  const scenarioData = useScenarioData();
  const household = scenarioData.household;
  const baseHousehold = scenarioData.baseHousehold;
  const { persons: allPersons, income: allIncome, bonusStructures: allBonusStructures, contributions: allContributions, committedOutgoings, emergencyFund } = household;

  const persons = useMemo(() => {
    if (selectedView === "household") return allPersons;
    return allPersons.filter((p) => p.id === selectedView);
  }, [allPersons, selectedView]);

  const income = useMemo(() => {
    if (selectedView === "household") return allIncome;
    return allIncome.filter((i) => i.personId === selectedView);
  }, [allIncome, selectedView]);

  const bonusStructures = useMemo(() => {
    if (selectedView === "household") return allBonusStructures;
    return allBonusStructures.filter((b) => b.personId === selectedView);
  }, [allBonusStructures, selectedView]);

  const contributions = useMemo(() => {
    if (selectedView === "household") return allContributions;
    return allContributions.filter((c) => c.personId === selectedView);
  }, [allContributions, selectedView]);

  // Build per-person income analysis
  const personAnalysis = useMemo(
    () =>
      persons.map((person) => {
        const personIncome = income.find((i) => i.personId === person.id);
        if (!personIncome) return null;
        const bonus = bonusStructures.find((b) => b.personId === person.id);
        const contribTotals = getPersonContributionTotals(contributions, person.id);

        // Include cash bonus in total gross employment income for tax purposes
        const cashBonus = bonus?.cashBonusAnnual ?? 0;
        const totalGross = personIncome.grossSalary + cashBonus;

        const incomeTaxResult = calculateIncomeTax(
          totalGross,
          personIncome.employeePensionContribution,
          personIncome.pensionContributionMethod
        );

        const niResult = calculateNI(
          totalGross,
          personIncome.employeePensionContribution,
          personIncome.pensionContributionMethod
        );

        // For student loan, use adjusted gross if salary sacrifice
        const studentLoanGross =
          personIncome.pensionContributionMethod === "salary_sacrifice"
            ? totalGross - personIncome.employeePensionContribution
            : totalGross;
        const studentLoan = calculateStudentLoan(studentLoanGross, person.studentLoanPlan);

        const incomeWithBonus = { ...personIncome, grossSalary: totalGross };
        const takeHome = calculateTakeHomePayWithStudentLoan(incomeWithBonus, person.studentLoanPlan);

        return {
          person,
          personIncome,
          bonus,
          contributions: contribTotals,
          incomeTaxResult,
          niResult,
          studentLoan,
          takeHome,
        };
      }).filter((p): p is NonNullable<typeof p> => p !== null),
    [persons, income, bonusStructures, contributions]
  );

  // Base income values per person (for what-if comparison)
  const baseIncomeLookup = useMemo(() => {
    const map = new Map<string, {
      grossSalary: number;
      employeePension: number;
      employerPension: number;
      incomeTax: number;
      ni: number;
      takeHome: number;
      monthlyTakeHome: number;
      adjustedGross: number;
      pensionDeduction: number;
      studentLoan: number;
    }>();
    for (const person of baseHousehold.persons) {
      const baseIncome = baseHousehold.income.find((i) => i.personId === person.id);
      if (!baseIncome) continue;
      const baseBonus = baseHousehold.bonusStructures.find((b) => b.personId === person.id);
      const cashBonus = baseBonus?.cashBonusAnnual ?? 0;
      const totalGross = baseIncome.grossSalary + cashBonus;
      const tax = calculateIncomeTax(totalGross, baseIncome.employeePensionContribution, baseIncome.pensionContributionMethod);
      const ni = calculateNI(totalGross, baseIncome.employeePensionContribution, baseIncome.pensionContributionMethod);
      const slGross = baseIncome.pensionContributionMethod === "salary_sacrifice" ? totalGross - baseIncome.employeePensionContribution : totalGross;
      const sl = calculateStudentLoan(slGross, person.studentLoanPlan);
      const incomeWithBonus = { ...baseIncome, grossSalary: totalGross };
      const th = calculateTakeHomePayWithStudentLoan(incomeWithBonus, person.studentLoanPlan);
      map.set(person.id, {
        grossSalary: baseIncome.grossSalary,
        employeePension: baseIncome.employeePensionContribution,
        employerPension: baseIncome.employerPensionContribution,
        incomeTax: tax.tax,
        ni: ni.ni,
        takeHome: th.takeHome,
        monthlyTakeHome: th.monthlyTakeHome,
        adjustedGross: th.adjustedGross,
        pensionDeduction: th.pensionDeduction,
        studentLoan: sl,
      });
    }
    return map;
  }, [baseHousehold]);

  // Compute combined waterfall data
  const {
    waterfallData,
    totalSavings,
    taxAdvantagedSavings,
    taxEfficiencyScore,
  } = useMemo(() => {
    const combinedGross = personAnalysis.reduce((sum, p) => sum + p.personIncome.grossSalary, 0);
    const combinedTax = personAnalysis.reduce((sum, p) => sum + p.incomeTaxResult.tax, 0);
    const combinedNI = personAnalysis.reduce((sum, p) => sum + p.niResult.ni, 0);
    const combinedStudentLoan = personAnalysis.reduce((sum, p) => sum + p.studentLoan, 0);
    const combinedPension = personAnalysis.reduce(
      (sum, p) => sum + p.personIncome.employeePensionContribution,
      0
    );
    const combinedTakeHome = personAnalysis.reduce((sum, p) => sum + p.takeHome.takeHome, 0);
    const combinedISA = personAnalysis.reduce(
      (sum, p) => sum + p.contributions.isaContribution,
      0
    );
    const combinedGIA = personAnalysis.reduce(
      (sum, p) => sum + p.contributions.giaContribution,
      0
    );
    // GIA overflow is whatever is directed to GIA from what remains
    const giaOverflow = combinedGIA;

    const annualLifestyle = emergencyFund.monthlyLifestyleSpending * 12;

    const wfData: WaterfallDataPoint[] = [
      { name: "Gross Income", value: combinedGross, type: "income" },
      { name: "Income Tax", value: combinedTax, type: "deduction" },
      { name: "National Insurance", value: combinedNI, type: "deduction" },
      ...(combinedStudentLoan > 0
        ? [{ name: "Student Loan", value: combinedStudentLoan, type: "deduction" as const }]
        : []),
      { name: "Employee Pension", value: combinedPension, type: "deduction" },
      { name: "Take-Home Pay", value: combinedTakeHome, type: "subtotal" },
      { name: "ISA Contributions", value: combinedISA, type: "deduction" },
      { name: "Committed Outgoings", value: committedOutgoings.reduce((s, o) => s + annualiseOutgoing(o.amount, o.frequency), 0), type: "deduction" },
      ...(annualLifestyle > 0
        ? [{ name: "Lifestyle Spending", value: annualLifestyle, type: "deduction" as const }]
        : []),
      { name: "Discretionary", value: giaOverflow, type: "subtotal" },
    ];

    // Tax Efficiency Score (via lib function)
    // Include ALL pension contributions: salary sacrifice/net pay from income + discretionary
    const totISA = personAnalysis.reduce((sum, p) => sum + p.contributions.isaContribution, 0);
    const discretionaryPension = personAnalysis.reduce((sum, p) => sum + p.contributions.pensionContribution, 0);
    const employmentPension = income.reduce(
      (sum, i) => sum + i.employeePensionContribution + i.employerPensionContribution,
      0
    );
    const totPension = discretionaryPension + employmentPension;
    const totGIA = personAnalysis.reduce((sum, p) => sum + p.contributions.giaContribution, 0);
    const totSavings = totISA + totPension + totGIA;
    const taxAdvSavings = totISA + totPension;
    const taxEffScore = calculateTaxEfficiencyScore(totISA, totPension, totGIA);

    return {
      waterfallData: wfData,
      totalSavings: totSavings,
      taxAdvantagedSavings: taxAdvSavings,
      taxEfficiencyScore: taxEffScore,
    };
  }, [personAnalysis, committedOutgoings, emergencyFund.monthlyLifestyleSpending, income]);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader title="Income & Cash Flow" description="Detailed income tax breakdown, take-home pay, bonus structures, and cash flow analysis.">
        <PersonToggle />
      </PageHeader>

      {personAnalysis.length === 0 && (
        <EmptyState message="No income data yet. Add household members and their salary details in Settings." settingsTab="household" />
      )}

      {/* Per-Person Income Breakdown */}
      {personAnalysis.map(
        ({
          person,
          personIncome,
          bonus,
          incomeTaxResult,
          niResult,
          studentLoan,
          takeHome,
        }) => (
          <section key={person.id} className="space-y-6">
            <h2 className="text-2xl font-semibold">{person.name}</h2>

            {/* Gross Salary */}
            <Card>
              <CardHeader>
                <CardTitle>Gross Salary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">Annual gross salary</span>
                  <span className="text-2xl font-bold">
                    <ScenarioDelta
                      base={baseIncomeLookup.get(person.id)?.grossSalary ?? personIncome.grossSalary}
                      scenario={personIncome.grossSalary}
                      format={formatCurrency}
                    />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Monthly gross</span>
                  <span className="text-sm font-medium">
                    <ScenarioDelta
                      base={(baseIncomeLookup.get(person.id)?.grossSalary ?? personIncome.grossSalary) / 12}
                      scenario={personIncome.grossSalary / 12}
                      format={formatCurrency}
                    />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Income Tax Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Income Tax Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Band</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Taxable Amount</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeTaxResult.breakdown.map((band) => (
                        <TableRow key={band.band}>
                          <TableCell className="font-medium">{band.band}</TableCell>
                          <TableCell className="text-right">
                            {formatPercent(band.rate)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(band.taxableAmount)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(band.tax)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="font-semibold">
                          Total Income Tax
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          Effective: {formatPercent(incomeTaxResult.effectiveRate)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <ScenarioDelta
                            base={baseIncomeLookup.get(person.id)?.incomeTax ?? incomeTaxResult.tax}
                            scenario={incomeTaxResult.tax}
                            format={formatCurrency}
                          />
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* National Insurance Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>National Insurance Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Band</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Earnings</TableHead>
                        <TableHead className="text-right">NI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {niResult.breakdown.map((band) => (
                        <TableRow key={band.band}>
                          <TableCell className="font-medium">{band.band}</TableCell>
                          <TableCell className="text-right">{formatPercent(band.rate)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(band.earnings)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(band.ni)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3} className="font-semibold">
                          Total National Insurance
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <ScenarioDelta
                            base={baseIncomeLookup.get(person.id)?.ni ?? niResult.ni}
                            scenario={niResult.ni}
                            format={formatCurrency}
                          />
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Student Loan */}
            {person.studentLoanPlan !== "none" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Student Loan Repayment
                    <Badge variant="secondary">{studentLoanLabel(person.studentLoanPlan)}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">Annual repayment</span>
                    <span className="text-lg font-semibold">{formatCurrency(studentLoan)}</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Monthly repayment</span>
                    <span className="text-sm font-medium">
                      {formatCurrency(studentLoan / 12)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pension Contributions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Pension Contributions
                  <Badge variant="outline">
                    {personIncome.pensionContributionMethod === "salary_sacrifice"
                      ? "Salary Sacrifice"
                      : personIncome.pensionContributionMethod === "net_pay"
                        ? "Net Pay"
                        : "Relief at Source"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">Employee contribution (annual)</span>
                    <span className="font-medium">
                      <ScenarioDelta
                        base={baseIncomeLookup.get(person.id)?.employeePension ?? personIncome.employeePensionContribution}
                        scenario={personIncome.employeePensionContribution}
                        format={formatCurrency}
                      />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">Employer contribution (annual)</span>
                    <span className="font-medium">
                      <ScenarioDelta
                        base={baseIncomeLookup.get(person.id)?.employerPension ?? personIncome.employerPensionContribution}
                        scenario={personIncome.employerPensionContribution}
                        format={formatCurrency}
                      />
                    </span>
                  </div>
                  <div className="border-t pt-3 flex items-baseline justify-between">
                    <span className="font-semibold">Total pension (annual)</span>
                    <span className="font-semibold">
                      <ScenarioDelta
                        base={(baseIncomeLookup.get(person.id)?.employeePension ?? 0) + (baseIncomeLookup.get(person.id)?.employerPension ?? 0)}
                        scenario={personIncome.employeePensionContribution + personIncome.employerPensionContribution}
                        format={formatCurrency}
                      />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Take-Home Pay */}
            <Card>
              <CardHeader>
                <CardTitle>Take-Home Pay</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const base = baseIncomeLookup.get(person.id);
                  return (
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground">Gross salary</span>
                        <span className="font-medium">
                          <ScenarioDelta base={base?.grossSalary ?? takeHome.gross} scenario={takeHome.gross} format={formatCurrency} />
                        </span>
                      </div>
                      {takeHome.adjustedGross !== takeHome.gross && (
                        <div className="flex items-baseline justify-between">
                          <span className="text-muted-foreground">Adjusted gross (after pension)</span>
                          <span className="font-medium">
                            <ScenarioDelta base={base?.adjustedGross ?? takeHome.adjustedGross} scenario={takeHome.adjustedGross} format={formatCurrency} />
                          </span>
                        </div>
                      )}
                      <div className="flex items-baseline justify-between text-red-600 dark:text-red-400">
                        <span>Income tax</span>
                        <span>-<ScenarioDelta base={base?.incomeTax ?? takeHome.incomeTax} scenario={takeHome.incomeTax} format={formatCurrency} /></span>
                      </div>
                      <div className="flex items-baseline justify-between text-red-600 dark:text-red-400">
                        <span>National Insurance</span>
                        <span>-<ScenarioDelta base={base?.ni ?? takeHome.ni} scenario={takeHome.ni} format={formatCurrency} /></span>
                      </div>
                      {takeHome.studentLoan > 0 && (
                        <div className="flex items-baseline justify-between text-red-600 dark:text-red-400">
                          <span>Student loan</span>
                          <span>-<ScenarioDelta base={base?.studentLoan ?? takeHome.studentLoan} scenario={takeHome.studentLoan} format={formatCurrency} /></span>
                        </div>
                      )}
                      <div className="flex items-baseline justify-between text-red-600 dark:text-red-400">
                        <span>Pension deduction</span>
                        <span>-<ScenarioDelta base={base?.pensionDeduction ?? takeHome.pensionDeduction} scenario={takeHome.pensionDeduction} format={formatCurrency} /></span>
                      </div>
                      <div className="border-t pt-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-lg font-semibold">Annual take-home</span>
                          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            <ScenarioDelta base={base?.takeHome ?? takeHome.takeHome} scenario={takeHome.takeHome} format={formatCurrency} />
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-muted-foreground">Monthly take-home</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            <ScenarioDelta base={base?.monthlyTakeHome ?? takeHome.monthlyTakeHome} scenario={takeHome.monthlyTakeHome} format={formatCurrency} />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Bonus Structure Section */}
            {bonus && (bonus.cashBonusAnnual > 0 || bonus.deferredBonusAnnual > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Bonus Structure</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Cash Bonus */}
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">Cash bonus (annual)</span>
                    <span className="text-lg font-semibold">
                      {formatCurrency(bonus.cashBonusAnnual)}
                    </span>
                  </div>

                  {/* Deferred Bonus — simplified display */}
                  {bonus.deferredBonusAnnual > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Deferred Bonus</h4>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-muted-foreground">Annual deferred</span>
                          <span className="font-medium">{formatCurrency(bonus.deferredBonusAnnual)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-muted-foreground">Vesting period</span>
                          <span className="font-medium">{bonus.vestingYears} year{bonus.vestingYears !== 1 ? "s" : ""} (equal)</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-muted-foreground">Per-tranche amount</span>
                          <span className="font-medium">{formatCurrency(bonus.deferredBonusAnnual / bonus.vestingYears)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-muted-foreground">Est. annual return</span>
                          <span className="font-medium">{formatPercent(bonus.estimatedAnnualReturn)}</span>
                        </div>
                      </div>
                      {/* Generated tranches table */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Vesting</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-right">Projected Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {generateDeferredTranches(bonus).map((tranche, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{formatDate(tranche.vestingDate)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(tranche.amount)}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(
                                    tranche.amount * Math.pow(1 + tranche.estimatedAnnualReturn, idx + 1)
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell className="font-semibold">Total</TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(bonus.deferredBonusAnnual)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(totalProjectedDeferredValue(bonus))}
                              </TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </section>
        )
      )}

      {/* Total Compensation Overview */}
      <CollapsibleSection title="Total Compensation Overview" summary="Salary + pension + bonus breakdown" defaultOpen storageKey="income-total-comp">
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {personAnalysis.map(({ person, personIncome, bonus }) => {
            const salary = personIncome.grossSalary;
            const employerPension = personIncome.employerPensionContribution;
            const cashBonus = bonus?.cashBonusAnnual ?? 0;
            const deferredBonus = bonus?.deferredBonusAnnual ?? 0;
            const totalComp = salary + employerPension + cashBonus + deferredBonus;

            return (
              <Card key={person.id}>
                <CardHeader>
                  <CardTitle>{person.name} - Total Compensation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">Base salary</span>
                      <span className="font-medium">{formatCurrency(salary)}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">Employer pension</span>
                      <span className="font-medium">{formatCurrency(employerPension)}</span>
                    </div>
                    {cashBonus > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground">Cash bonus</span>
                        <span className="font-medium">{formatCurrency(cashBonus)}</span>
                      </div>
                    )}
                    {deferredBonus > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground">Deferred bonus</span>
                        <span className="font-medium">{formatCurrency(deferredBonus)}</span>
                      </div>
                    )}
                    <div className="border-t pt-3 flex items-baseline justify-between">
                      <span className="text-lg font-semibold">Total compensation</span>
                      <span className="text-lg font-bold">{formatCurrency(totalComp)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      </CollapsibleSection>

      {/* Salary Trajectory — only shown when growth rates are configured */}
      {personAnalysis.some(({ personIncome }) => (personIncome.salaryGrowthRate ?? 0) > 0 || (personIncome.bonusGrowthRate ?? 0) > 0) && (
        <CollapsibleSection title="Income Trajectory" summary="Projected salary and bonus growth over time" storageKey="income-trajectory">
          <section className="space-y-4">
            <p className="text-muted-foreground">
              How salary and total compensation evolve based on configured annual growth rates.
              These projections feed into the portfolio growth model on the Projections page.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {personAnalysis
                .filter(({ personIncome }) => (personIncome.salaryGrowthRate ?? 0) > 0 || (personIncome.bonusGrowthRate ?? 0) > 0)
                .map(({ person, personIncome, bonus }) => {
                  const salaryGrowth = personIncome.salaryGrowthRate ?? 0;
                  const bonusGrowth = personIncome.bonusGrowthRate ?? 0;
                  const trajectory = projectSalaryTrajectory(personIncome.grossSalary, salaryGrowth, 10);
                  const cashBonus = bonus?.cashBonusAnnual ?? 0;

                  return (
                    <Card key={person.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {person.name} — Income Trajectory
                          <Badge variant="secondary">
                            {salaryGrowth > 0 && `Salary +${formatPercent(salaryGrowth)}/yr`}
                            {salaryGrowth > 0 && bonusGrowth > 0 && " · "}
                            {bonusGrowth > 0 && `Bonus +${formatPercent(bonusGrowth)}/yr`}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Year</TableHead>
                                <TableHead className="text-right">Salary</TableHead>
                                {cashBonus > 0 && <TableHead className="text-right">Cash Bonus</TableHead>}
                                <TableHead className="text-right">Total Comp</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {trajectory.filter((_, i) => i % 2 === 0 || i === trajectory.length - 1).map((point) => {
                                const yearBonus = cashBonus * Math.pow(1 + bonusGrowth, point.year);
                                const employerPension = personIncome.employerPensionContribution * Math.pow(1 + salaryGrowth, point.year);
                                return (
                                  <TableRow key={point.year}>
                                    <TableCell className="font-medium">
                                      {point.year === 0 ? "Now" : `+${point.year}yr`}
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(point.salary)}</TableCell>
                                    {cashBonus > 0 && (
                                      <TableCell className="text-right">{formatCurrency(yearBonus)}</TableCell>
                                    )}
                                    <TableCell className="text-right font-semibold">
                                      {formatCurrency(point.salary + yearBonus + employerPension)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </section>
        </CollapsibleSection>
      )}

      {/* Cash Flow Waterfall */}
      <CollapsibleSection title="Cash Flow Waterfall" summary="Gross income through deductions to savings" defaultOpen storageKey="income-waterfall">
      <section className="space-y-4">
        <p className="text-muted-foreground">
          Combined household cash flow from gross income through deductions to savings allocation.
        </p>
        <Card>
          <CardContent className="pt-6">
            <CashFlowWaterfall data={waterfallData} />
          </CardContent>
        </Card>
      </section>
      </CollapsibleSection>

      {/* Cash Flow Timeline */}
      <CollapsibleSection title="Cash Flow Timeline" summary="Monthly income vs outgoings over 24 months" storageKey="income-cashflow-timeline">
      <section className="space-y-4">
        <p className="text-muted-foreground">
          Monthly income (salary, bonuses, deferred vesting) vs total outgoings over the next 24 months.
          Shows seasonal crunches when school fees, insurance, and bonuses collide.
        </p>
        <Card>
          <CardContent className="pt-6">
            <CashFlowTimeline data={generateCashFlowTimeline(household)} />
          </CardContent>
        </Card>
      </section>
      </CollapsibleSection>

      {/* Tax Band Consumption */}
      <CollapsibleSection title="Tax Band Consumption" summary="How income fills each tax band" storageKey="income-tax-bands">
      <section className="space-y-4">
        <p className="text-muted-foreground">
          How each person&apos;s income fills the tax bands from Personal Allowance through to Additional Rate.
        </p>
        <Card>
          <CardContent className="pt-6">
            <TaxBandChart
              data={personAnalysis.map(({ person, incomeTaxResult }): TaxBandDataItem => {
                const bands = incomeTaxResult.breakdown;
                const getBand = (name: string) =>
                  bands.find((b) => b.band === name)?.taxableAmount ?? 0;
                return {
                  name: person.name,
                  personalAllowance: getBand("Personal Allowance"),
                  basicRate: getBand("Basic Rate"),
                  higherRate: getBand("Higher Rate"),
                  additionalRate: getBand("Additional Rate"),
                };
              })}
              height={Math.max(160, personAnalysis.length * 80)}
            />
          </CardContent>
        </Card>
      </section>
      </CollapsibleSection>

      {/* Effective Tax Rate Curve */}
      <CollapsibleSection title="Effective Tax Rate Curve" summary="Marginal and effective rates vs income level" storageKey="income-tax-curve">
      <section className="space-y-4">
        <p className="text-muted-foreground">
          Combined marginal and effective tax + NI rate across income levels. The red area shows the marginal rate — note the 60% trap between £100k and £125k where the personal allowance tapers away.
        </p>
        <Card>
          <CardContent className="pt-6">
            <EffectiveTaxRateChart />
          </CardContent>
        </Card>
      </section>
      </CollapsibleSection>

      {/* Tax Efficiency Score */}
      <CollapsibleSection title="Tax Efficiency Score" summary={`${Math.round(taxEfficiencyScore * 100)}% tax-advantaged`} storageKey="income-tax-efficiency">
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Savings Tax Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">{formatPercent(taxEfficiencyScore)}</div>
                <div className="text-muted-foreground">
                  of total savings goes into tax-advantaged wrappers (ISA + Pension)
                </div>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500/80 transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(taxEfficiencyScore * 100, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">ISA + Pension (tax-advantaged)</div>
                  <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(taxAdvantagedSavings)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">GIA (taxable)</div>
                  <div className="text-lg font-semibold text-amber-600">
                    {formatCurrency(totalSavings - taxAdvantagedSavings)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">Total annual savings</div>
                  <div className="text-lg font-semibold">{formatCurrency(totalSavings)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
      </CollapsibleSection>
    </div>
  );
}
