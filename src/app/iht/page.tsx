"use client";

import { useMemo } from "react";
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { getMidScenarioRate } from "@/lib/projections";
import {
  calculateIHT,
  calculateYearsUntilIHTExceeded,
  yearsSince,
} from "@/lib/iht";
import { getAccountTaxWrapper, annualiseContribution } from "@/types";
import type { TaxWrapper } from "@/types";
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
import { AllocationPie } from "@/components/charts/allocation-pie";
import { CollapsibleSection } from "@/components/collapsible-section";
import { ScenarioDelta } from "@/components/scenario-delta";
import { SettingsBar } from "@/components/settings-bar";

export default function IHTPage() {
  const scenarioData = useScenarioData();
  const { selectedView } = usePersonView();
  const household = scenarioData.household;
  const baseHousehold = scenarioData.baseHousehold;

  const filteredAccounts = useMemo(() => {
    if (selectedView === "household") return household.accounts;
    return household.accounts.filter((a) => a.personId === selectedView);
  }, [household.accounts, selectedView]);

  // Base IHT data for what-if comparison
  const baseIhtData = useMemo(() => {
    const baseAccounts = selectedView === "household"
      ? baseHousehold.accounts
      : baseHousehold.accounts.filter((a) => a.personId === selectedView);
    const totalNW = baseAccounts.reduce((sum, a) => sum + a.currentValue, 0);
    const wrapperTotals = new Map<TaxWrapper, number>();
    for (const a of baseAccounts) {
      const w = getAccountTaxWrapper(a.type);
      wrapperTotals.set(w, (wrapperTotals.get(w) ?? 0) + a.currentValue);
    }
    // pensionVal excluded from estate
    const isaVal = wrapperTotals.get("isa") ?? 0;
    const giaVal = wrapperTotals.get("gia") ?? 0;
    const cashVal = wrapperTotals.get("cash") ?? 0;
    const pbVal = wrapperTotals.get("premium_bonds") ?? 0;
    const baseInEstate = baseHousehold.iht.estimatedPropertyValue + isaVal + giaVal + cashVal + pbVal;
    const numberOfPersons = selectedView === "household" ? baseHousehold.persons.length : 1;
    const giftsWithin7Years = baseHousehold.iht.gifts
      .filter((g) => yearsSince(g.date) < 7)
      .reduce((sum, g) => sum + g.amount, 0);
    const pensionVal = wrapperTotals.get("pension") ?? 0;
    const result = calculateIHT(baseInEstate, numberOfPersons, giftsWithin7Years, baseHousehold.iht.passingToDirectDescendants);
    const baseContribs = selectedView === "household"
      ? baseHousehold.contributions
      : baseHousehold.contributions.filter((c) => c.personId === selectedView);
    const baseAnnualSavingsInEstate = baseContribs
      .filter((c) => c.target === "isa" || c.target === "gia")
      .reduce((sum, c) => sum + annualiseContribution(c.amount, c.frequency), 0);
    return {
      totalNetWorth: totalNW, inEstate: baseInEstate, taxableAmount: result.taxableAmount, ihtLiability: result.ihtLiability,
      propertyValue: baseHousehold.iht.estimatedPropertyValue, isaValue: isaVal, giaValue: giaVal, cashValue: cashVal,
      premiumBondsValue: pbVal, pensionValue: pensionVal, outsideEstate: pensionVal, annualSavingsInEstate: baseAnnualSavingsInEstate,
    };
  }, [baseHousehold, selectedView]);

  const ihtData = useMemo(() => {
    const ihtConfig = household.iht;
    const totalNetWorth = filteredAccounts.reduce((sum, a) => sum + a.currentValue, 0);
    const ihtConstants = UK_TAX_CONSTANTS.iht;

    // --- Estate breakdown by wrapper type ---
    const wrapperTotals = new Map<TaxWrapper, number>();
    for (const account of filteredAccounts) {
      const wrapper = getAccountTaxWrapper(account.type);
      wrapperTotals.set(
        wrapper,
        (wrapperTotals.get(wrapper) ?? 0) + account.currentValue,
      );
    }

    const pensionValue = wrapperTotals.get("pension") ?? 0;
    const isaValue = wrapperTotals.get("isa") ?? 0;
    const giaValue = wrapperTotals.get("gia") ?? 0;
    const cashValue = wrapperTotals.get("cash") ?? 0;
    const premiumBondsValue = wrapperTotals.get("premium_bonds") ?? 0;
    const propertyValue = ihtConfig.estimatedPropertyValue;

    // Pensions are normally outside the estate
    const inEstate =
      propertyValue + isaValue + giaValue + cashValue + premiumBondsValue;
    const outsideEstate = pensionValue;

    // --- 7-Year Gift Tracker ---
    const giftsWithStatus = ihtConfig.gifts.map((gift) => {
      const years = yearsSince(gift.date);
      const fallenOut = years >= 7;
      return { ...gift, yearsSinceGift: years, fallenOut };
    });

    // Gifts within 7 years reduce the available NRB
    const giftsWithin7Years = giftsWithStatus
      .filter((g) => !g.fallenOut)
      .reduce((sum, g) => sum + g.amount, 0);

    // --- IHT Thresholds & Liability (via src/lib/iht.ts) ---
    const numberOfPersons = selectedView === "household" ? household.persons.length : 1;
    const nilRateBandPerPerson = ihtConstants.nilRateBand;
    const rnrbPerPerson = ihtConfig.passingToDirectDescendants
      ? ihtConstants.residenceNilRateBand
      : 0;

    const ihtResult = calculateIHT(
      inEstate,
      numberOfPersons,
      giftsWithin7Years,
      ihtConfig.passingToDirectDescendants
    );

    const {
      effectiveNRB: totalNilRateBand,
      effectiveRNRB: totalResidenceNilRateBand,
      combinedThreshold,
      taxableAmount,
      ihtLiability,
    } = ihtResult;

    // --- Sheltered vs Exposed ---
    const shelteredPct =
      totalNetWorth > 0 ? outsideEstate / totalNetWorth : 0;
    const exposedPct =
      totalNetWorth > 0 ? inEstate / totalNetWorth : 0;

    // --- Estate Growth Projection ---
    // Total annual contributions going to non-pension accounts (in estate)
    const filteredContributions = selectedView === "household"
      ? household.contributions
      : household.contributions.filter((c) => c.personId === selectedView);
    const annualSavingsInEstate = filteredContributions
      .filter((c) => c.target === "isa" || c.target === "gia")
      .reduce(
        (sum, c) => sum + annualiseContribution(c.amount, c.frequency),
        0,
      );
    // Use mid scenario growth rate for estate projection
    const midGrowthRate = getMidScenarioRate(household.retirement.scenarioRates, 0.05);
    const yearsUntilExceeded = calculateYearsUntilIHTExceeded(
      inEstate,
      combinedThreshold,
      annualSavingsInEstate,
      midGrowthRate
    );

    // Data for the sheltered vs exposed pie chart
    const shelteredVsExposedData = [
      {
        name: "Sheltered (Pensions)",
        value: outsideEstate,
        color: "var(--chart-2)",
      },
      {
        name: "Exposed (In Estate)",
        value: inEstate,
        color: "var(--chart-3)",
      },
    ];

    // Breakdown for estate composition
    const estateBreakdown = [
      { label: "Property", value: propertyValue, inEstate: true },
      { label: "ISA", value: isaValue, inEstate: true },
      { label: "GIA", value: giaValue, inEstate: true },
      { label: "Cash Savings", value: cashValue, inEstate: true },
      { label: "Premium Bonds", value: premiumBondsValue, inEstate: true },
      { label: "Pensions", value: pensionValue, inEstate: false },
    ];

    return {
      ihtConfig,
      totalNetWorth,
      propertyValue,
      pensionValue,
      inEstate,
      outsideEstate,
      nilRateBandPerPerson,
      residenceNilRateBandPerPerson: rnrbPerPerson,
      totalNilRateBand,
      totalResidenceNilRateBand,
      combinedThreshold,
      taxableAmount,
      ihtLiability,
      ihtRate: ihtConstants.rate,
      shelteredPct,
      exposedPct,
      giftsWithStatus,
      annualSavingsInEstate,
      yearsUntilExceeded,
      midGrowthRate,
      shelteredVsExposedData,
      estateBreakdown,
      numberOfPersons,
    };
  }, [household, filteredAccounts, selectedView]);

  const {
    ihtConfig,
    totalNetWorth,
    propertyValue,
    inEstate,
    outsideEstate,
    nilRateBandPerPerson,
    residenceNilRateBandPerPerson,
    totalNilRateBand,
    totalResidenceNilRateBand,
    combinedThreshold,
    taxableAmount,
    ihtLiability,
    ihtRate,
    shelteredPct,
    exposedPct,
    giftsWithStatus,
    annualSavingsInEstate,
    yearsUntilExceeded,
    midGrowthRate,
    shelteredVsExposedData,
    estateBreakdown,
    numberOfPersons,
  } = ihtData;

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader title="Estate & IHT Planning" description="Estate value, IHT liability, pension shelter, and 7-year gift tracking.">
        <PersonToggle />
      </PageHeader>

      <SettingsBar label="IHT assumptions" settingsTab="iht">
        <Badge variant="secondary" className="text-xs">
          Property: {formatCurrency(ihtData.propertyValue)}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {ihtData.ihtConfig.passingToDirectDescendants ? "RNRB applies" : "No RNRB"}
        </Badge>
      </SettingsBar>

      {household.persons.length === 0 && (
        <EmptyState message="No household data yet. Add people and accounts to estimate your IHT position." settingsTab="household" />
      )}

      {/* Estate Value Estimator */}
      <Card>
        <CardHeader>
          <CardTitle>Estate Value Estimator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Total Net Worth (all accounts)
              </p>
              <p className="text-2xl font-bold tabular-nums">
                <ScenarioDelta base={baseIhtData.totalNetWorth} scenario={totalNetWorth} format={formatCurrency} />
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Estimated Property Value
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(propertyValue)}
              </p>
            </div>
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Estimated Estate (excl. pensions)
              </p>
              <p className="text-2xl font-bold tabular-nums">
                <ScenarioDelta base={baseIhtData.inEstate} scenario={inEstate} format={formatCurrency} />
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Category</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">In Estate?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estateBreakdown.map((item) => {
                  const baseValueMap: Record<string, number> = {
                    "Property": baseIhtData.propertyValue,
                    "ISA": baseIhtData.isaValue,
                    "GIA": baseIhtData.giaValue,
                    "Cash Savings": baseIhtData.cashValue,
                    "Premium Bonds": baseIhtData.premiumBondsValue,
                    "Pensions": baseIhtData.pensionValue,
                  };
                  const baseVal = baseValueMap[item.label] ?? item.value;
                  return (
                  <TableRow key={item.label}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-right">
                      <ScenarioDelta base={baseVal} scenario={item.value} format={formatCurrency} />
                    </TableCell>
                    <TableCell className="text-right">
                      {item.inEstate ? (
                        <Badge variant="destructive">In Estate</Badge>
                      ) : (
                        <Badge variant="secondary">Outside Estate</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* IHT Threshold */}
      <CollapsibleSection title="IHT Threshold" summary="Nil rate bands & allowances" storageKey="iht-threshold" defaultOpen>
        <Card>
          <CardHeader>
            <CardTitle>IHT Threshold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">
                  Nil Rate Band ({formatCurrency(nilRateBandPerPerson)} per person
                  x {numberOfPersons})
                </span>
                <span className="font-semibold">
                  {formatCurrency(totalNilRateBand)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    Residence Nil Rate Band (
                    {formatCurrency(residenceNilRateBandPerPerson)} per person x{" "}
                    {numberOfPersons})
                  </span>
                  {ihtConfig.passingToDirectDescendants ? (
                    <Badge variant="secondary">Passing to descendants</Badge>
                  ) : (
                    <Badge variant="outline">Not applicable</Badge>
                  )}
                </div>
                <span className="font-semibold">
                  {formatCurrency(totalResidenceNilRateBand)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-green-50 dark:bg-green-950/20 p-3">
                <span className="text-sm font-medium">
                  Combined Couple Allowance
                </span>
                <span className="text-lg font-bold">
                  {formatCurrency(combinedThreshold)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* IHT Liability Estimate */}
      <CollapsibleSection title="IHT Liability Estimate" summary="Taxable amount & payable" storageKey="iht-liability" defaultOpen>
        <Card>
          <CardHeader>
            <CardTitle>IHT Liability Estimate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Estate Value (in estate)
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  <ScenarioDelta base={baseIhtData.inEstate} scenario={inEstate} format={formatCurrency} />
                </p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">Taxable Amount</p>
                <p className="text-2xl font-bold tabular-nums">
                  <ScenarioDelta base={baseIhtData.taxableAmount} scenario={taxableAmount} format={formatCurrency} />
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Estate - {formatCurrency(combinedThreshold)} threshold
                </p>
              </div>
              <div className="rounded-lg border bg-destructive/5 border-destructive/30 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  IHT Payable at {formatPercent(ihtRate)}
                </p>
                <p className="text-2xl font-bold tabular-nums text-destructive">
                  <ScenarioDelta base={baseIhtData.ihtLiability} scenario={ihtLiability} format={formatCurrency} />
                </p>
              </div>
            </div>
            {taxableAmount <= 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Your estate is currently below the combined IHT threshold. No IHT
                would be due at current values.
              </p>
            )}
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* IHT-Sheltered vs Exposed */}
      <CollapsibleSection title="Sheltered vs Exposed" summary="Pension assets outside estate vs in-estate assets" storageKey="iht-sheltered" defaultOpen>
        <Card>
          <CardHeader>
            <CardTitle>Pension Shelter vs Estate Exposure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <AllocationPie data={shelteredVsExposedData} height={280} />
              </div>
              <div className="flex flex-col justify-center space-y-4">
                <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Sheltered (Pensions - outside estate)
                  </p>
                  <p className="text-2xl font-bold tabular-nums">
                    <ScenarioDelta base={baseIhtData.outsideEstate} scenario={outsideEstate} format={formatCurrency} />
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {formatPercent(shelteredPct)}
                  </Badge>
                </div>
                <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Exposed (In estate)
                  </p>
                  <p className="text-2xl font-bold tabular-nums">
                    <ScenarioDelta base={baseIhtData.inEstate} scenario={inEstate} format={formatCurrency} />
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {formatPercent(exposedPct)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* 7-Year Gift Tracker */}
      <CollapsibleSection title="7-Year Gift Tracker" summary="Gifts that reduce your nil-rate band" storageKey="iht-gifts" defaultOpen>
        <Card>
          <CardHeader>
            <CardTitle>7-Year Gift Tracker</CardTitle>
          </CardHeader>
          <CardContent>
            {giftsWithStatus.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Years Ago</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {giftsWithStatus.map((gift) => (
                      <TableRow key={gift.id}>
                        <TableCell>{formatDate(gift.date)}</TableCell>
                        <TableCell>{gift.recipient}</TableCell>
                        <TableCell>{gift.description}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(gift.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {gift.yearsSinceGift.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {gift.fallenOut ? (
                            <Badge variant="secondary">
                              Fallen out of estate
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              Within 7-year window
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No gifts recorded. Gifts made more than 7 years before death are
                exempt from IHT.
              </p>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              Potentially Exempt Transfers (PETs) fall out of the estate after 7
              years. Taper relief may apply for gifts made between 3 and 7 years
              before death.
            </p>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* Estate Growth Projection */}
      <CollapsibleSection title="Estate Growth Projection" summary="Time until IHT threshold exceeded" storageKey="iht-growth">
        <Card>
          <CardHeader>
            <CardTitle>Estate Growth Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">
                    Annual Savings Into Estate (ISA + GIA)
                  </p>
                  <p className="text-2xl font-bold tabular-nums">
                    <ScenarioDelta base={baseIhtData.annualSavingsInEstate} scenario={annualSavingsInEstate} format={formatCurrency} />
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">
                    Combined IHT Threshold
                  </p>
                  <p className="text-2xl font-bold tabular-nums">
                    {formatCurrency(combinedThreshold)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4">
                {yearsUntilExceeded === 0 ? (
                  <p className="text-sm">
                    <span className="font-medium">Your estate already exceeds the IHT threshold.</span>{" "}
                    The current estate value of {formatCurrency(inEstate)} is above
                    the combined threshold of {formatCurrency(combinedThreshold)}.
                    Consider IHT planning strategies such as making gifts,
                    increasing pension contributions (outside estate), or
                    establishing trusts.
                  </p>
                ) : yearsUntilExceeded !== null ? (
                  <p className="text-sm">
                    At the current savings rate of{" "}
                    {formatCurrency(annualSavingsInEstate)} per year into
                    estate-exposed accounts, with assumed investment growth of{" "}
                    {formatPercent(midGrowthRate)}/yr, your estate will exceed the{" "}
                    {formatCurrency(combinedThreshold)} IHT threshold in
                    approximately{" "}
                    <span className="font-medium">
                      {yearsUntilExceeded} year
                      {yearsUntilExceeded !== 1 ? "s" : ""}
                    </span>
                    .
                  </p>
                ) : (
                  <p className="text-sm">
                    Even with assumed investment growth of{" "}
                    {formatPercent(midGrowthRate)}/yr, your estate is projected
                    to remain below the IHT threshold for the foreseeable future.
                  </p>
                )}
              </div>
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
