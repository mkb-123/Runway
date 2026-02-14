"use client";

import { useMemo } from "react";
import { useData } from "@/context/data-context";
import { useScenarioData } from "@/context/use-scenario-data";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import {
  calculateIncomeTax,
  calculateNI,
  calculateStudentLoan,
  calculateTakeHomePayWithStudentLoan,
} from "@/lib/tax";
import type {
  DeferredBonusTranche,
} from "@/types";
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
import type { TaxBandDataItem } from "@/components/charts/tax-band-chart";

// --- Helper: projected value at vesting ---
function projectedValue(tranche: DeferredBonusTranche): number {
  const grantDate = new Date(tranche.grantDate);
  const vestingDate = new Date(tranche.vestingDate);
  const yearsToVest =
    (vestingDate.getTime() - grantDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return tranche.amount * Math.pow(1 + tranche.estimatedAnnualReturn, yearsToVest);
}

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
  const { getFundById } = useData();
  const scenarioData = useScenarioData();
  const household = scenarioData.household;
  const { persons, income, bonusStructures, annualContributions, estimatedAnnualExpenses } = household;

  // Build per-person income analysis
  const personAnalysis = useMemo(
    () =>
      persons.map((person) => {
        const personIncome = income.find((i) => i.personId === person.id)!;
        const bonus = bonusStructures.find((b) => b.personId === person.id);
        const contributions = annualContributions.find((c) => c.personId === person.id);

        const incomeTaxResult = calculateIncomeTax(
          personIncome.grossSalary,
          personIncome.employeePensionContribution,
          personIncome.pensionContributionMethod
        );

        const niResult = calculateNI(
          personIncome.grossSalary,
          personIncome.employeePensionContribution,
          personIncome.pensionContributionMethod
        );

        // For student loan, use adjusted gross if salary sacrifice
        const studentLoanGross =
          personIncome.pensionContributionMethod === "salary_sacrifice"
            ? personIncome.grossSalary - personIncome.employeePensionContribution
            : personIncome.grossSalary;
        const studentLoan = calculateStudentLoan(studentLoanGross, person.studentLoanPlan);

        const takeHome = calculateTakeHomePayWithStudentLoan(personIncome, person.studentLoanPlan);

        return {
          person,
          personIncome,
          bonus,
          contributions,
          incomeTaxResult,
          niResult,
          studentLoan,
          takeHome,
        };
      }),
    [persons, income, bonusStructures, annualContributions]
  );

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
      (sum, p) => sum + (p.contributions?.isaContribution ?? 0),
      0
    );
    const combinedGIA = personAnalysis.reduce(
      (sum, p) => sum + (p.contributions?.giaContribution ?? 0),
      0
    );
    // GIA overflow is whatever is directed to GIA from what remains
    const giaOverflow = combinedGIA;

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
      { name: "Expenses", value: estimatedAnnualExpenses, type: "deduction" },
      { name: "GIA Overflow", value: giaOverflow, type: "subtotal" },
    ];

    // Tax Efficiency Score
    const totSavings = personAnalysis.reduce((sum, p) => {
      const c = p.contributions;
      if (!c) return sum;
      return sum + c.isaContribution + c.pensionContribution + c.giaContribution;
    }, 0);
    const taxAdvSavings = personAnalysis.reduce((sum, p) => {
      const c = p.contributions;
      if (!c) return sum;
      return sum + c.isaContribution + c.pensionContribution;
    }, 0);
    const taxEffScore = totSavings > 0 ? taxAdvSavings / totSavings : 0;

    return {
      waterfallData: wfData,
      totalSavings: totSavings,
      taxAdvantagedSavings: taxAdvSavings,
      taxEfficiencyScore: taxEffScore,
    };
  }, [personAnalysis, estimatedAnnualExpenses]);

  return (
    <div className="space-y-8 p-4 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Income &amp; Cash Flow</h1>
        <p className="text-muted-foreground">
          Detailed income tax breakdown, take-home pay, bonus structures, and cash flow analysis.
        </p>
      </div>

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
                    {formatCurrency(personIncome.grossSalary)}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Monthly gross</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(personIncome.grossSalary / 12)}
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
                          {formatCurrency(incomeTaxResult.tax)}
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
                          {formatCurrency(niResult.ni)}
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
                      {formatCurrency(personIncome.employeePensionContribution)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">Employer contribution (annual)</span>
                    <span className="font-medium">
                      {formatCurrency(personIncome.employerPensionContribution)}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex items-baseline justify-between">
                    <span className="font-semibold">Total pension (annual)</span>
                    <span className="font-semibold">
                      {formatCurrency(
                        personIncome.employeePensionContribution +
                          personIncome.employerPensionContribution
                      )}
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
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">Gross salary</span>
                    <span className="font-medium">{formatCurrency(takeHome.gross)}</span>
                  </div>
                  {takeHome.adjustedGross !== takeHome.gross && (
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">Adjusted gross (after pension)</span>
                      <span className="font-medium">
                        {formatCurrency(takeHome.adjustedGross)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between text-red-600">
                    <span>Income tax</span>
                    <span>-{formatCurrency(takeHome.incomeTax)}</span>
                  </div>
                  <div className="flex items-baseline justify-between text-red-600">
                    <span>National Insurance</span>
                    <span>-{formatCurrency(takeHome.ni)}</span>
                  </div>
                  {takeHome.studentLoan > 0 && (
                    <div className="flex items-baseline justify-between text-red-600">
                      <span>Student loan</span>
                      <span>-{formatCurrency(takeHome.studentLoan)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between text-red-600">
                    <span>Pension deduction</span>
                    <span>-{formatCurrency(takeHome.pensionDeduction)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-semibold">Annual take-home</span>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(takeHome.takeHome)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-muted-foreground">Monthly take-home</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(takeHome.monthlyTakeHome)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deferred Bonus Section */}
            {bonus && (bonus.cashBonusAnnual > 0 || bonus.deferredTranches.length > 0) && (
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

                  {/* Deferred Tranches */}
                  {bonus.deferredTranches.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Deferred Bonus Tranches</h4>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Grant Date</TableHead>
                              <TableHead>Vesting Date</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Fund</TableHead>
                              <TableHead className="text-right">Est. Return</TableHead>
                              <TableHead className="text-right">Projected Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bonus.deferredTranches.map((tranche, idx) => {
                              const fund = tranche.fundId
                                ? getFundById(tranche.fundId)
                                : undefined;
                              const projected = projectedValue(tranche);
                              return (
                                <TableRow key={idx}>
                                  <TableCell>{formatDate(tranche.grantDate)}</TableCell>
                                  <TableCell>{formatDate(tranche.vestingDate)}</TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(tranche.amount)}
                                  </TableCell>
                                  <TableCell>
                                    {fund ? (
                                      <Badge variant="secondary">{fund.ticker}</Badge>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatPercent(tranche.estimatedAnnualReturn)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(projected)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell colSpan={2} className="font-semibold">
                                Total Deferred
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(
                                  bonus.deferredTranches.reduce((s, t) => s + t.amount, 0)
                                )}
                              </TableCell>
                              <TableCell colSpan={2} />
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(
                                  bonus.deferredTranches.reduce(
                                    (s, t) => s + projectedValue(t),
                                    0
                                  )
                                )}
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
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Total Compensation Overview</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {personAnalysis.map(({ person, personIncome, bonus }) => {
            const salary = personIncome.grossSalary;
            const employerPension = personIncome.employerPensionContribution;
            const cashBonus = bonus?.cashBonusAnnual ?? 0;
            const deferredBonus = bonus
              ? bonus.deferredTranches.reduce((s, t) => s + t.amount, 0)
              : 0;
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

      {/* Cash Flow Waterfall */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Cash Flow Waterfall</h2>
        <p className="text-muted-foreground">
          Combined household cash flow from gross income through deductions to savings allocation.
        </p>
        <Card>
          <CardContent className="pt-6">
            <CashFlowWaterfall data={waterfallData} />
          </CardContent>
        </Card>
      </section>

      {/* Tax Band Consumption */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Tax Band Consumption</h2>
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

      {/* Effective Tax Rate Curve */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Effective Tax Rate Curve</h2>
        <p className="text-muted-foreground">
          Combined marginal and effective tax + NI rate across income levels. The red area shows the marginal rate — note the 60% trap between £100k and £125k where the personal allowance tapers away.
        </p>
        <Card>
          <CardContent className="pt-6">
            <EffectiveTaxRateChart />
          </CardContent>
        </Card>
      </section>

      {/* Tax Efficiency Score */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Tax Efficiency Score</h2>
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
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${Math.min(taxEfficiencyScore * 100, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">ISA + Pension (tax-advantaged)</div>
                  <div className="text-lg font-semibold text-green-600">
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
    </div>
  );
}
