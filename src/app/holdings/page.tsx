"use client";

import { useMemo } from "react";
import { useData } from "@/context/data-context";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  ASSET_CLASS_LABELS,
  REGION_LABELS,
} from "@/types";
import type { Fund } from "@/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GainLossChart } from "@/components/charts/gain-loss-chart";
import { FeeImpactChart } from "@/components/charts/fee-impact-chart";
import { FundPerformanceChart } from "@/components/charts/fund-performance-chart";
import { EmptyState } from "@/components/empty-state";

interface FundHoldingRow {
  accountId: string;
  accountName: string;
  personName: string;
  units: number;
  purchasePrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  unrealisedGainLoss: number;
}

interface FundGroup {
  fund: Fund;
  rows: FundHoldingRow[];
  totalInvested: number;
  totalCurrent: number;
  totalGainLoss: number;
}

export default function HoldingsPage() {
  const { household, getPersonById, getFundById } = useData();
  const { selectedView } = usePersonView();
  const { funds } = household;

  const accounts = useMemo(() => {
    if (selectedView === "household") return household.accounts;
    return household.accounts.filter((a) => a.personId === selectedView);
  }, [household.accounts, selectedView]);

  // Build a map of fund ID -> all holdings across accounts
  const { fundGroups, grandTotalInvested, grandTotalCurrent, grandTotalGainLoss } =
    useMemo(() => {
      const fundGroupMap = new Map<string, FundGroup>();

      for (const account of accounts) {
        const person = getPersonById(account.personId);
        for (const holding of account.holdings) {
          const fund = getFundById(holding.fundId);
          if (!fund) continue;

          const investedValue = holding.units * holding.purchasePrice;
          const currentValue = holding.units * holding.currentPrice;
          const unrealisedGainLoss = currentValue - investedValue;

          const row: FundHoldingRow = {
            accountId: account.id,
            accountName: account.name,
            personName: person?.name ?? "Unknown",
            units: holding.units,
            purchasePrice: holding.purchasePrice,
            currentPrice: holding.currentPrice,
            investedValue,
            currentValue,
            unrealisedGainLoss,
          };

          if (!fundGroupMap.has(fund.id)) {
            fundGroupMap.set(fund.id, {
              fund,
              rows: [],
              totalInvested: 0,
              totalCurrent: 0,
              totalGainLoss: 0,
            });
          }

          const group = fundGroupMap.get(fund.id)!;
          group.rows.push(row);
          group.totalInvested += investedValue;
          group.totalCurrent += currentValue;
          group.totalGainLoss += unrealisedGainLoss;
        }
      }

      const groups = Array.from(fundGroupMap.values());

      // Calculate grand totals
      const totalInvested = groups.reduce(
        (sum, g) => sum + g.totalInvested,
        0
      );
      const totalCurrent = groups.reduce(
        (sum, g) => sum + g.totalCurrent,
        0
      );
      const totalGainLoss = groups.reduce(
        (sum, g) => sum + g.totalGainLoss,
        0
      );

      return {
        fundGroups: groups,
        grandTotalInvested: totalInvested,
        grandTotalCurrent: totalCurrent,
        grandTotalGainLoss: totalGainLoss,
      };
    }, [accounts, getPersonById, getFundById]);

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Fund Holdings</h1>
          <p className="text-sm text-muted-foreground">
            Detailed view of all fund holdings across accounts.
          </p>
        </div>
        <PersonToggle />
      </div>

      {fundGroups.length === 0 && (
        <EmptyState message="No fund holdings yet. Add accounts with fund positions in Settings." settingsTab="accounts" />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Invested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(grandTotalInvested)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Current Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(grandTotalCurrent)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Unrealised Gain/Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                grandTotalGainLoss >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {grandTotalGainLoss >= 0 ? "+" : ""}
              {formatCurrency(grandTotalGainLoss)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gain/Loss by Fund Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Unrealised Gain/Loss by Fund</CardTitle>
        </CardHeader>
        <CardContent>
          <GainLossChart
            data={fundGroups.map((g) => ({
              name: g.fund.ticker || g.fund.name,
              value: g.totalGainLoss,
            }))}
            height={Math.max(200, fundGroups.length * 50)}
          />
        </CardContent>
      </Card>

      {/* Fund Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Historical Returns by Fund</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Annualised historical returns where data is available. Past performance does not guarantee future results.
          </p>
          <FundPerformanceChart
            data={funds
              .filter((f) => f.historicalReturns)
              .map((f) => ({
                name: f.ticker || f.name,
                "1yr": f.historicalReturns?.["1yr"],
                "3yr": f.historicalReturns?.["3yr"],
                "5yr": f.historicalReturns?.["5yr"],
              }))}
          />
        </CardContent>
      </Card>

      {/* Fee Impact Projection */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Impact Over 30 Years</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            The compounding cost of fund charges (OCF) on your portfolio over time,
            assuming 7% gross annual return and current monthly contributions.
          </p>
          <FeeImpactChart
            currentValue={grandTotalCurrent}
            monthlyContribution={0}
            annualReturn={0.07}
            weightedOCF={
              fundGroups.length > 0
                ? fundGroups.reduce((sum, g) => sum + g.fund.ocf * g.totalCurrent, 0) /
                  grandTotalCurrent || 0
                : 0
            }
          />
        </CardContent>
      </Card>

      {/* Fund sections */}
      {fundGroups.map(({ fund, rows, totalInvested, totalCurrent, totalGainLoss }) => (
        <section key={fund.id} className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>{fund.name}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>Ticker: {fund.ticker}</span>
                    <span className="hidden sm:inline">|</span>
                    <span>ISIN: {fund.isin}</span>
                    <span className="hidden sm:inline">|</span>
                    <span>OCF: {formatPercent(fund.ocf)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {ASSET_CLASS_LABELS[fund.assetClass]}
                  </Badge>
                  <Badge variant="outline">
                    {REGION_LABELS[fund.region]}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Desktop table */}
              <div className="hidden md:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Person</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">
                          Purchase Price
                        </TableHead>
                        <TableHead className="text-right">
                          Current Price
                        </TableHead>
                        <TableHead className="text-right">
                          Invested Value
                        </TableHead>
                        <TableHead className="text-right">
                          Current Value
                        </TableHead>
                        <TableHead className="text-right">
                          Gain/Loss
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.accountId}>
                          <TableCell className="font-medium">
                            {row.accountName}
                          </TableCell>
                          <TableCell>{row.personName}</TableCell>
                          <TableCell className="text-right">
                            {row.units.toLocaleString("en-GB")}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.purchasePrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.currentPrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.investedValue)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.currentValue)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              row.unrealisedGainLoss >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {row.unrealisedGainLoss >= 0 ? "+" : ""}
                            {formatCurrency(row.unrealisedGainLoss)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Mobile card view */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {rows.map((row) => (
                  <div
                    key={row.accountId}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="font-medium">{row.accountName}</div>
                    <div className="text-sm text-muted-foreground">
                      {row.personName}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Units: </span>
                        {row.units.toLocaleString("en-GB")}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Purchase:{" "}
                        </span>
                        {formatCurrency(row.purchasePrice)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Current:{" "}
                        </span>
                        {formatCurrency(row.currentPrice)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Value: </span>
                        {formatCurrency(row.currentValue)}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        row.unrealisedGainLoss >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      Gain/Loss: {row.unrealisedGainLoss >= 0 ? "+" : ""}
                      {formatCurrency(row.unrealisedGainLoss)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Fund totals */}
              <div className="mt-4 flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold">Fund Total</span>
                <div className="flex flex-wrap gap-4">
                  <span>
                    Invested:{" "}
                    <span className="font-medium">
                      {formatCurrency(totalInvested)}
                    </span>
                  </span>
                  <span>
                    Current:{" "}
                    <span className="font-medium">
                      {formatCurrency(totalCurrent)}
                    </span>
                  </span>
                  <span
                    className={`font-medium ${
                      totalGainLoss >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {totalGainLoss >= 0 ? "+" : ""}
                    {formatCurrency(totalGainLoss)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}
