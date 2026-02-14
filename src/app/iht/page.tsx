"use client";

import { useMemo } from "react";
import { useScenarioData } from "@/context/use-scenario-data";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { getAccountTaxWrapper } from "@/types";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function yearsSince(dateStr: string): number {
  const giftDate = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - giftDate.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

export default function IHTPage() {
  const scenarioData = useScenarioData();
  const household = scenarioData.household;
  const getTotalNetWorth = scenarioData.getTotalNetWorth;

  const ihtData = useMemo(() => {
    const ihtConfig = household.iht;
    const totalNetWorth = getTotalNetWorth();
    const ihtConstants = UK_TAX_CONSTANTS.iht;

    // --- Estate breakdown by wrapper type ---
    const wrapperTotals = new Map<TaxWrapper, number>();
    for (const account of household.accounts) {
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

    // --- IHT Thresholds ---
    const numberOfPersons = household.persons.length;
    const nilRateBandPerPerson = ihtConstants.nilRateBand;
    const residenceNilRateBandPerPerson = ihtConfig.passingToDirectDescendants
      ? ihtConstants.residenceNilRateBand
      : 0;
    const totalNilRateBand = nilRateBandPerPerson * numberOfPersons;
    const totalResidenceNilRateBand =
      residenceNilRateBandPerPerson * numberOfPersons;
    const combinedThreshold = totalNilRateBand + totalResidenceNilRateBand;

    // --- IHT Liability ---
    const taxableAmount = Math.max(0, inEstate - combinedThreshold);
    const ihtLiability = taxableAmount * ihtConstants.rate;

    // --- Sheltered vs Exposed ---
    const shelteredPct =
      totalNetWorth > 0 ? outsideEstate / totalNetWorth : 0;
    const exposedPct =
      totalNetWorth > 0 ? inEstate / totalNetWorth : 0;

    // --- 7-Year Gift Tracker ---
    const giftsWithStatus = ihtConfig.gifts.map((gift) => {
      const years = yearsSince(gift.date);
      const fallenOut = years >= 7;
      return { ...gift, yearsSinceGift: years, fallenOut };
    });

    // --- Estate Growth Projection ---
    // Total annual contributions going to non-pension accounts (in estate)
    const annualSavingsInEstate = household.annualContributions.reduce(
      (sum, c) => sum + c.isaContribution + c.giaContribution,
      0,
    );
    // How many years until the estate exceeds the combined threshold?
    let yearsUntilExceeded: number | null = null;
    if (inEstate < combinedThreshold && annualSavingsInEstate > 0) {
      const gap = combinedThreshold - inEstate;
      yearsUntilExceeded = Math.ceil(gap / annualSavingsInEstate);
    } else if (inEstate >= combinedThreshold) {
      yearsUntilExceeded = 0;
    }

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
      residenceNilRateBandPerPerson,
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
      shelteredVsExposedData,
      estateBreakdown,
      numberOfPersons,
    };
  }, [household, getTotalNetWorth]);

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
    shelteredVsExposedData,
    estateBreakdown,
    numberOfPersons,
  } = ihtData;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Inheritance Tax Planning
        </h1>
        <p className="text-muted-foreground mt-1">
          Estimate your estate value, IHT liability, and track gifts within the
          7-year window.
        </p>
      </div>

      {/* Estate Value Estimator */}
      <Card>
        <CardHeader>
          <CardTitle>Estate Value Estimator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Total Net Worth (all accounts)
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalNetWorth)}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Estimated Property Value
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(propertyValue)}
              </p>
            </div>
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Estimated Estate (excl. pensions)
              </p>
              <p className="text-2xl font-bold">{formatCurrency(inEstate)}</p>
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
                {estateBreakdown.map((item) => (
                  <TableRow key={item.label}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.value)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.inEstate ? (
                        <Badge variant="destructive">In Estate</Badge>
                      ) : (
                        <Badge variant="secondary">Outside Estate</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* IHT Threshold */}
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

      {/* IHT Liability Estimate */}
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
              <p className="text-2xl font-bold">{formatCurrency(inEstate)}</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Taxable Amount</p>
              <p className="text-2xl font-bold">
                {formatCurrency(taxableAmount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Estate - {formatCurrency(combinedThreshold)} threshold
              </p>
            </div>
            <div className="rounded-lg border bg-destructive/5 border-destructive/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                IHT Payable at {formatPercent(ihtRate)}
              </p>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(ihtLiability)}
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

      {/* IHT-Sheltered vs Exposed */}
      <Card>
        <CardHeader>
          <CardTitle>IHT-Sheltered vs Exposed</CardTitle>
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
                <p className="text-2xl font-bold">
                  {formatCurrency(outsideEstate)}
                </p>
                <Badge variant="secondary" className="mt-1">
                  {formatPercent(shelteredPct)}
                </Badge>
              </div>
              <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Exposed (In estate)
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(inEstate)}
                </p>
                <Badge variant="secondary" className="mt-1">
                  {formatPercent(exposedPct)}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7-Year Gift Tracker */}
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

      {/* Estate Growth Projection */}
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
                <p className="text-2xl font-bold">
                  {formatCurrency(annualSavingsInEstate)}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  Combined IHT Threshold
                </p>
                <p className="text-2xl font-bold">
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
                  estate-exposed accounts, your estate will exceed the{" "}
                  {formatCurrency(combinedThreshold)} IHT threshold in
                  approximately{" "}
                  <span className="font-medium">
                    {yearsUntilExceeded} year
                    {yearsUntilExceeded !== 1 ? "s" : ""}
                  </span>
                  . This does not account for investment growth, which would
                  bring this date closer.
                </p>
              ) : (
                <p className="text-sm">
                  With no additional savings flowing into estate-exposed
                  accounts, your estate is projected to remain below the IHT
                  threshold at current values (excluding investment growth).
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
