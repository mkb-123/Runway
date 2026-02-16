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
import { getPersonContributionTotals, getDeferredBonus } from "@/types";
import { SchoolFeeSummary } from "@/components/school-fee-summary";
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
import { CashFlowTimeline } from "@/components/charts/cash-flow-timeline";
import { generateCashFlowTimeline } from "@/lib/cash-flow";
import { ScenarioDelta } from "@/components/scenario-delta";

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
  const { persons: allPersons, income: allIncome, bonusStructures: allBonusStructures, contributions: allContributions } = household;

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

  // Tax Efficiency Score
  const {
    totalSavings,
    taxAdvantagedSavings,
    taxEfficiencyScore,
  } = useMemo(() => {
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
      totalSavings: totSavings,
      taxAdvantagedSavings: taxAdvSavings,
      taxEfficiencyScore: taxEffScore,
    };
  }, [personAnalysis, income]);

  // Base (un-overridden) tax efficiency values for what-if comparison
  const baseTaxEfficiency = useMemo(() => {
    let baseTotISA = 0;
    let baseDiscPension = 0;
    let baseEmpPension = 0;
    let baseTotGIA = 0;

    for (const person of baseHousehold.persons) {
      if (selectedView !== "household" && person.id !== selectedView) continue;
      const baseContribs = getPersonContributionTotals(baseHousehold.contributions, person.id);
      baseTotISA += baseContribs.isaContribution;
      baseDiscPension += baseContribs.pensionContribution;
      baseTotGIA += baseContribs.giaContribution;
    }
    for (const inc of baseHousehold.income) {
      if (selectedView !== "household" && inc.personId !== selectedView) continue;
      baseEmpPension += inc.employeePensionContribution + inc.employerPensionContribution;
    }
    const basePension = baseDiscPension + baseEmpPension;
    const baseTotal = baseTotISA + basePension + baseTotGIA;
    const baseTaxAdv = baseTotISA + basePension;
    const baseScore = calculateTaxEfficiencyScore(baseTotISA, basePension, baseTotGIA);
    return { totalSavings: baseTotal, taxAdvantagedSavings: baseTaxAdv, taxEfficiencyScore: baseScore };
  }, [baseHousehold, selectedView]);

  return (
    <div className="space-y-8 p-4 md:p-8">
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
        }) => {
          const base = baseIncomeLookup.get(person.id);
          const totalPension = personIncome.employeePensionContribution + personIncome.employerPensionContribution;
          const cashBonus = bonus?.cashBonusAnnual ?? 0;
          const deferredBonus = bonus ? getDeferredBonus(bonus) : 0;
          const hasBonus = cashBonus > 0 || deferredBonus > 0;

          return (
          <section key={person.id} className="space-y-4">
            <h2 className="text-2xl font-semibold">{person.name}</h2>

            {/* Compact Pay Summary — key numbers at a glance */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Gross</div>
                    <div className="text-lg font-bold tabular-nums">
                      <ScenarioDelta base={base?.grossSalary ?? personIncome.grossSalary} scenario={personIncome.grossSalary} format={formatCurrency} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Take-Home</div>
                    <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      <ScenarioDelta base={base?.takeHome ?? takeHome.takeHome} scenario={takeHome.takeHome} format={formatCurrency} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Tax + NI</div>
                    <div className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                      <ScenarioDelta base={(base?.incomeTax ?? incomeTaxResult.tax) + (base?.ni ?? niResult.ni)} scenario={incomeTaxResult.tax + niResult.ni} format={formatCurrency} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Pension</div>
                    <div className="text-lg font-bold tabular-nums">
                      <ScenarioDelta base={(base?.employeePension ?? personIncome.employeePensionContribution) + (base?.employerPension ?? personIncome.employerPensionContribution)} scenario={totalPension} format={formatCurrency} />
                    </div>
                  </div>
                </div>
                {/* Monthly take-home highlight */}
                <div className="mt-4 flex items-baseline justify-between border-t pt-3">
                  <span className="text-sm text-muted-foreground">Monthly take-home</span>
                  <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    <ScenarioDelta base={base?.monthlyTakeHome ?? takeHome.monthlyTakeHome} scenario={takeHome.monthlyTakeHome} format={formatCurrency} />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Deductions detail — collapsed by default */}
            <CollapsibleSection title="Deductions Breakdown" summary={`Tax ${formatCurrency(incomeTaxResult.tax)} · NI ${formatCurrency(niResult.ni)}`} storageKey={`income-deductions-${person.id}`}>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {/* Compact deduction lines */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">Income tax</span>
                      <span className="font-medium tabular-nums text-red-600 dark:text-red-400">
                        <ScenarioDelta base={base?.incomeTax ?? takeHome.incomeTax} scenario={takeHome.incomeTax} format={formatCurrency} />
                        <span className="ml-2 text-xs text-muted-foreground">({formatPercent(incomeTaxResult.effectiveRate)} eff.)</span>
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">National Insurance</span>
                      <span className="font-medium tabular-nums text-red-600 dark:text-red-400">
                        <ScenarioDelta base={base?.ni ?? takeHome.ni} scenario={takeHome.ni} format={formatCurrency} />
                      </span>
                    </div>
                    {studentLoan > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground">Student loan <Badge variant="secondary" className="ml-1 text-[10px]">{studentLoanLabel(person.studentLoanPlan)}</Badge></span>
                        <span className="font-medium tabular-nums text-red-600 dark:text-red-400">
                          <ScenarioDelta base={base?.studentLoan ?? studentLoan} scenario={studentLoan} format={formatCurrency} />
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">
                        Pension
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          {personIncome.pensionContributionMethod === "salary_sacrifice" ? "Sal. Sac." : personIncome.pensionContributionMethod === "net_pay" ? "Net Pay" : "RAS"}
                        </Badge>
                      </span>
                      <span className="font-medium tabular-nums text-red-600 dark:text-red-400">
                        <ScenarioDelta base={base?.pensionDeduction ?? takeHome.pensionDeduction} scenario={takeHome.pensionDeduction} format={formatCurrency} />
                        <span className="ml-2 text-xs text-muted-foreground tabular-nums">+ <ScenarioDelta base={base?.employerPension ?? personIncome.employerPensionContribution} scenario={personIncome.employerPensionContribution} format={formatCurrency} showPercent={false} /> employer</span>
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleSection>

            {/* Income Tax bands — collapsed by default */}
            <CollapsibleSection title="Income Tax Bands" summary={`${incomeTaxResult.breakdown.length} bands · ${formatPercent(incomeTaxResult.effectiveRate)} effective`} storageKey={`income-tax-bands-${person.id}`}>
              <Card>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Band</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Taxable</TableHead>
                          <TableHead className="text-right">Tax</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incomeTaxResult.breakdown.map((band) => (
                          <TableRow key={band.band}>
                            <TableCell className="font-medium">{band.band}</TableCell>
                            <TableCell className="text-right">{formatPercent(band.rate)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(band.taxableAmount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(band.tax)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleSection>

            {/* NI bands — collapsed by default */}
            <CollapsibleSection title="NI Bands" summary={formatCurrency(niResult.ni)} storageKey={`income-ni-bands-${person.id}`}>
              <Card>
                <CardContent className="pt-4">
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
                            <TableCell className="text-right">{formatCurrency(band.earnings)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(band.ni)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleSection>

            {/* Bonus — compact, only when present */}
            {hasBonus && (
              <CollapsibleSection title="Bonus" summary={`${formatCurrency(cashBonus + deferredBonus)} total`} storageKey={`income-bonus-${person.id}`}>
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    {cashBonus > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground">Cash bonus</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(cashBonus)}</span>
                      </div>
                    )}
                    {bonus && deferredBonus > 0 && (
                      <>
                        <div className="flex items-baseline justify-between">
                          <span className="text-muted-foreground">Deferred bonus</span>
                          <span className="font-semibold tabular-nums">{formatCurrency(deferredBonus)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(deferredBonus / bonus.vestingYears)}/tranche over {bonus.vestingYears} years · {formatPercent(bonus.estimatedAnnualReturn)} est. return
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Vesting</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Projected</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {generateDeferredTranches(bonus).map((tranche, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{formatDate(tranche.vestingDate)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(tranche.amount)}</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(tranche.amount * Math.pow(1 + tranche.estimatedAnnualReturn, idx + 1))}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                            <TableFooter>
                              <TableRow>
                                <TableCell className="font-semibold">Total</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(deferredBonus)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(totalProjectedDeferredValue(bonus))}</TableCell>
                              </TableRow>
                            </TableFooter>
                          </Table>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </CollapsibleSection>
            )}
          </section>
          );
        }
      )}

      {/* Total Compensation Overview */}
      <CollapsibleSection title="Total Compensation Overview" summary="Salary + pension + bonus breakdown" defaultOpen storageKey="income-total-comp">
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {personAnalysis.map(({ person, personIncome, bonus }) => {
            const salary = personIncome.grossSalary;
            const employerPension = personIncome.employerPensionContribution;
            const cashBonus = bonus?.cashBonusAnnual ?? 0;
            const deferredBonus = bonus ? getDeferredBonus(bonus) : 0;
            const totalComp = salary + employerPension + cashBonus + deferredBonus;
            const base = baseIncomeLookup.get(person.id);
            const baseSalary = base?.grossSalary ?? salary;
            const baseEmployerPension = base?.employerPension ?? employerPension;
            const baseTotalComp = baseSalary + baseEmployerPension + cashBonus + deferredBonus;

            return (
              <Card key={person.id}>
                <CardHeader>
                  <CardTitle>{person.name} - Total Compensation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">Base salary</span>
                      <span className="font-medium tabular-nums"><ScenarioDelta base={baseSalary} scenario={salary} format={formatCurrency} /></span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">Employer pension</span>
                      <span className="font-medium tabular-nums"><ScenarioDelta base={baseEmployerPension} scenario={employerPension} format={formatCurrency} /></span>
                    </div>
                    {cashBonus > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground">Cash bonus</span>
                        <span className="font-medium tabular-nums">{formatCurrency(cashBonus)}</span>
                      </div>
                    )}
                    {deferredBonus > 0 && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground">Deferred bonus</span>
                        <span className="font-medium tabular-nums">{formatCurrency(deferredBonus)}</span>
                      </div>
                    )}
                    <div className="border-t pt-3 flex items-baseline justify-between">
                      <span className="text-lg font-semibold">Total compensation</span>
                      <span className="text-lg font-bold tabular-nums"><ScenarioDelta base={baseTotalComp} scenario={totalComp} format={formatCurrency} /></span>
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {personAnalysis
                .filter(({ personIncome }) => (personIncome.salaryGrowthRate ?? 0) > 0 || (personIncome.bonusGrowthRate ?? 0) > 0)
                .map(({ person, personIncome, bonus }) => {
                  const salaryGrowth = personIncome.salaryGrowthRate ?? 0;
                  const bonusGrowth = personIncome.bonusGrowthRate ?? 0;
                  const trajectory = projectSalaryTrajectory(personIncome.grossSalary, salaryGrowth, 10);
                  const totalBonus = bonus?.totalBonusAnnual ?? 0;
                  const cashBonus = bonus?.cashBonusAnnual ?? 0;
                  const hasDeferred = totalBonus > cashBonus;

                  return (
                    <Card key={person.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {person.name} — Income Trajectory
                          <Badge variant="secondary">
                            {salaryGrowth > 0 && `Salary +${formatPercent(salaryGrowth)}/yr`}
                            {salaryGrowth > 0 && bonusGrowth > 0 && " · "}
                            {bonusGrowth > 0 && `Total bonus +${formatPercent(bonusGrowth)}/yr`}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {hasDeferred && (
                          <p className="text-xs text-muted-foreground mb-3">
                            Total bonus grows at {formatPercent(bonusGrowth)}/yr. Cash portion fixed at {formatCurrency(cashBonus)}; deferred increases as total grows.
                          </p>
                        )}
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Year</TableHead>
                                <TableHead className="text-right">Salary</TableHead>
                                {totalBonus > 0 && <TableHead className="text-right">Total Bonus</TableHead>}
                                {hasDeferred && <TableHead className="text-right">Cash</TableHead>}
                                {hasDeferred && <TableHead className="text-right">Deferred</TableHead>}
                                <TableHead className="text-right">Total Comp</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {trajectory.filter((_, i) => i % 2 === 0 || i === trajectory.length - 1).map((point) => {
                                const yearTotalBonus = totalBonus * Math.pow(1 + bonusGrowth, point.year);
                                const yearDeferred = Math.max(0, yearTotalBonus - cashBonus);
                                const employerPension = personIncome.employerPensionContribution * Math.pow(1 + salaryGrowth, point.year);
                                return (
                                  <TableRow key={point.year}>
                                    <TableCell className="font-medium">
                                      {point.year === 0 ? "Now" : `+${point.year}yr`}
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(point.salary)}</TableCell>
                                    {totalBonus > 0 && (
                                      <TableCell className="text-right">{formatCurrency(yearTotalBonus)}</TableCell>
                                    )}
                                    {hasDeferred && (
                                      <TableCell className="text-right text-muted-foreground">{formatCurrency(cashBonus)}</TableCell>
                                    )}
                                    {hasDeferred && (
                                      <TableCell className="text-right text-muted-foreground">{formatCurrency(yearDeferred)}</TableCell>
                                    )}
                                    <TableCell className="text-right font-semibold">
                                      {formatCurrency(point.salary + yearTotalBonus + employerPension)}
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

      {/* School Fees — only when children exist */}
      {household.children.length > 0 && household.children.some((c) => c.schoolFeeAnnual > 0) && (
        <SchoolFeeSummary childrenList={household.children} />
      )}

      {/* Cash Flow Timeline */}
      <CollapsibleSection title="Cash Flow Timeline" summary="Monthly income vs outgoings over 24 months" storageKey="income-cashflow-timeline">
      <section>
        <Card>
          <CardContent className="pt-6">
            <CashFlowTimeline data={generateCashFlowTimeline(household)} />
          </CardContent>
        </Card>
      </section>
      </CollapsibleSection>


      {/* Tax Efficiency Score */}
      <CollapsibleSection title="Tax Efficiency Score" summary={`${Math.round(taxEfficiencyScore * 100)}% tax-advantaged`} storageKey="income-tax-efficiency">
      <section>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold">
                  <ScenarioDelta base={baseTaxEfficiency.taxEfficiencyScore} scenario={taxEfficiencyScore} format={formatPercent} epsilon={0.001} />
                </div>
                <div className="text-sm text-muted-foreground">tax-advantaged (ISA + Pension)</div>
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
                  <div className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    <ScenarioDelta base={baseTaxEfficiency.taxAdvantagedSavings} scenario={taxAdvantagedSavings} format={formatCurrency} />
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">GIA (taxable)</div>
                  <div className="text-lg font-semibold tabular-nums text-amber-600">
                    <ScenarioDelta base={baseTaxEfficiency.totalSavings - baseTaxEfficiency.taxAdvantagedSavings} scenario={totalSavings - taxAdvantagedSavings} format={formatCurrency} />
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">Total annual savings</div>
                  <div className="text-lg font-semibold tabular-nums">
                    <ScenarioDelta base={baseTaxEfficiency.totalSavings} scenario={totalSavings} format={formatCurrency} />
                  </div>
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
