"use client";

import { useMemo } from "react";
import { useData } from "@/context/data-context";
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { formatCurrency, formatPercent, roundPence } from "@/lib/format";
import {
  getAccountTaxWrapper,
  TAX_WRAPPER_LABELS,
  ASSET_CLASS_LABELS,
  REGION_LABELS,
} from "@/types";
import type { AssetClass, Region, TaxWrapper } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AllocationPie } from "@/components/charts/allocation-pie";
import { AllocationBar } from "@/components/charts/allocation-bar";

export default function AllocationPage() {
  const { getFundById } = useData();
  const { selectedView } = usePersonView();
  const scenarioData = useScenarioData();
  const household = scenarioData.household;

  const filteredAccounts = useMemo(() => {
    if (selectedView === "household") return household.accounts;
    return household.accounts.filter((a) => a.personId === selectedView);
  }, [household.accounts, selectedView]);

  const totalNetWorth = useMemo(
    () => filteredAccounts.reduce((sum, a) => sum + a.currentValue, 0),
    [filteredAccounts]
  );

  const allocations = useMemo(() => {
    // Maps for accumulation
    const byAssetClass = new Map<AssetClass, number>();
    const byRegion = new Map<Region, number>();
    const byFund = new Map<string, { name: string; value: number }>();
    const byProvider = new Map<string, number>();

    for (const account of filteredAccounts) {
      const wrapper = getAccountTaxWrapper(account.type);

      // Accumulate by provider
      byProvider.set(
        account.provider,
        (byProvider.get(account.provider) ?? 0) + account.currentValue,
      );

      if (account.holdings.length === 0) {
        // Cash accounts / premium bonds -- no holdings with units
        // Map to the appropriate asset class and region
        const assetClass: AssetClass = "cash";
        const region: Region = "uk";

        byAssetClass.set(
          assetClass,
          (byAssetClass.get(assetClass) ?? 0) + account.currentValue,
        );
        byRegion.set(
          region,
          (byRegion.get(region) ?? 0) + account.currentValue,
        );

        // By fund -- group under a descriptive name
        const cashLabel =
          wrapper === "premium_bonds" ? "Premium Bonds" : "Cash Savings";
        const existing = byFund.get(cashLabel);
        if (existing) {
          existing.value += account.currentValue;
        } else {
          byFund.set(cashLabel, { name: cashLabel, value: account.currentValue });
        }
      } else {
        for (const holding of account.holdings) {
          const fund = getFundById(holding.fundId);
          if (!fund) continue;

          const holdingValue = holding.currentPrice * holding.units;

          byAssetClass.set(
            fund.assetClass,
            (byAssetClass.get(fund.assetClass) ?? 0) + holdingValue,
          );

          byRegion.set(
            fund.region,
            (byRegion.get(fund.region) ?? 0) + holdingValue,
          );

          const existingFund = byFund.get(fund.id);
          if (existingFund) {
            existingFund.value += holdingValue;
          } else {
            byFund.set(fund.id, { name: fund.name, value: holdingValue });
          }
        }
      }
    }

    // Convert maps to sorted arrays
    const assetClassData = Array.from(byAssetClass.entries())
      .map(([key, value]) => ({
        name: ASSET_CLASS_LABELS[key],
        value: roundPence(value),
      }))
      .sort((a, b) => b.value - a.value);

    const regionData = Array.from(byRegion.entries())
      .map(([key, value]) => ({
        name: REGION_LABELS[key],
        value: roundPence(value),
      }))
      .sort((a, b) => b.value - a.value);

    const fundData = Array.from(byFund.values())
      .map((f) => ({
        name: f.name,
        value: roundPence(f.value),
      }))
      .sort((a, b) => b.value - a.value);

    // Wrapper data from filtered accounts
    const wrapperTotals = new Map<TaxWrapper, number>();
    for (const account of filteredAccounts) {
      const wrapper = getAccountTaxWrapper(account.type);
      wrapperTotals.set(wrapper, (wrapperTotals.get(wrapper) ?? 0) + account.currentValue);
    }
    const wrapperData = Array.from(wrapperTotals.entries()).map(([wrapper, value]) => ({
      name: TAX_WRAPPER_LABELS[wrapper],
      value: roundPence(value),
    }));

    const providerData = Array.from(byProvider.entries())
      .map(([name, value]) => ({
        name,
        value: roundPence(value),
      }))
      .sort((a, b) => b.value - a.value);

    // Concentration risk: any single fund > 25% of total
    const concentrationRisks = fundData.filter(
      (f) => f.value / totalNetWorth > 0.25,
    );

    // Wrapper efficiency: pension + ISA vs GIA
    const taxAdvantaged = Array.from(wrapperTotals.entries())
      .filter(([w]) => w === "pension" || w === "isa")
      .reduce((sum, [, v]) => sum + v, 0);
    const taxExposed = Array.from(wrapperTotals.entries())
      .filter(([w]) => w === "gia" || w === "cash" || w === "premium_bonds")
      .reduce((sum, [, v]) => sum + v, 0);

    return {
      assetClassData,
      regionData,
      fundData,
      wrapperData,
      providerData,
      concentrationRisks,
      taxAdvantaged,
      taxExposed,
    };
  }, [filteredAccounts, getFundById, totalNetWorth]);

  const {
    assetClassData,
    regionData,
    fundData,
    wrapperData,
    providerData,
    concentrationRisks,
    taxAdvantaged,
    taxExposed,
  } = allocations;

  const taxAdvantagedPct = totalNetWorth > 0 ? taxAdvantaged / totalNetWorth : 0;
  const taxExposedPct = totalNetWorth > 0 ? taxExposed / totalNetWorth : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Investment Allocation
          </h1>
          <p className="text-sm text-muted-foreground">
            Portfolio distribution across asset classes, regions, funds, wrappers,
            and providers.
          </p>
        </div>
        <PersonToggle />
      </div>

      {/* Row 1: Asset Class + Region */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By Asset Class</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationPie data={assetClassData} />
            <ul className="mt-4 space-y-1 text-sm">
              {assetClassData.map((item) => (
                <li key={item.name} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-medium">
                    {formatCurrency(item.value)}{" "}
                    <span className="text-muted-foreground">
                      ({formatPercent(item.value / totalNetWorth)})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Region</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationPie data={regionData} />
            <ul className="mt-4 space-y-1 text-sm">
              {regionData.map((item) => (
                <li key={item.name} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-medium">
                    {formatCurrency(item.value)}{" "}
                    <span className="text-muted-foreground">
                      ({formatPercent(item.value / totalNetWorth)})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: By Fund */}
      <Card>
        <CardHeader>
          <CardTitle>By Fund</CardTitle>
        </CardHeader>
        <CardContent>
          <AllocationBar data={fundData} height={300} layout="vertical" />
          <ul className="mt-4 space-y-1 text-sm">
            {fundData.map((item) => (
              <li key={item.name} className="flex justify-between">
                <span className="truncate mr-4">{item.name}</span>
                <span className="font-medium shrink-0">
                  {formatCurrency(item.value)}{" "}
                  <span className="text-muted-foreground">
                    ({formatPercent(item.value / totalNetWorth)})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Row 3: Tax Wrapper + Provider */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By Tax Wrapper</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationPie data={wrapperData} />
            <ul className="mt-4 space-y-1 text-sm">
              {wrapperData.map((item) => (
                <li key={item.name} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-medium">
                    {formatCurrency(item.value)}{" "}
                    <span className="text-muted-foreground">
                      ({formatPercent(item.value / totalNetWorth)})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationBar data={providerData} height={300} />
            <ul className="mt-4 space-y-1 text-sm">
              {providerData.map((item) => (
                <li key={item.name} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-medium">
                    {formatCurrency(item.value)}{" "}
                    <span className="text-muted-foreground">
                      ({formatPercent(item.value / totalNetWorth)})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Concentration Risk */}
      <Card>
        <CardHeader>
          <CardTitle>Concentration Risk</CardTitle>
        </CardHeader>
        <CardContent>
          {concentrationRisks.length > 0 ? (
            <div className="space-y-3">
              {concentrationRisks.map((fund) => (
                <div
                  key={fund.name}
                  className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 p-4"
                >
                  <div>
                    <p className="font-medium">{fund.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(fund.value)} of{" "}
                      {formatCurrency(totalNetWorth)} total
                    </p>
                  </div>
                  <Badge variant="destructive">
                    {formatPercent(fund.value / totalNetWorth)} of portfolio
                  </Badge>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                Any single fund representing more than 25% of total portfolio
                value is flagged as a concentration risk. Consider diversifying
                to reduce single-fund exposure.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No concentration risk detected. No single fund exceeds 25% of
              your total portfolio.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Wrapper Efficiency Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle>Wrapper Efficiency Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Tax-Advantaged (Pension + ISA)
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(taxAdvantaged)}
              </p>
              <Badge variant="secondary" className="mt-1">
                {formatPercent(taxAdvantagedPct)}
              </Badge>
            </div>
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Tax-Exposed (GIA + Cash + Premium Bonds)
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(taxExposed)}
              </p>
              <Badge variant="secondary" className="mt-1">
                {formatPercent(taxExposedPct)}
              </Badge>
            </div>
          </div>
          <div className="mt-4 rounded-lg border bg-muted/50 p-4">
            <p className="text-sm">
              <span className="font-medium">Note:</span> ISA and pension
              contributions are capped annually (ISA: £20,000; pension: £60,000
              total). Once these allowances are used, additional savings flow
              into GIA accounts. Over time, the GIA portion will grow
              disproportionately as tax-sheltered contribution limits are reached
              each year while GIA has no upper limit. Consider maximising pension
              and ISA contributions first to minimise future tax exposure.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
