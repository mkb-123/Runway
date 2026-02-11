import { getHouseholdData, getFundById, getAccountById, getPersonById } from "@/lib/data";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  ASSET_CLASS_LABELS,
  REGION_LABELS,
} from "@/types";
import type { Fund, Account, Holding } from "@/types";
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
  const { accounts, funds } = getHouseholdData();

  // Build a map of fund ID -> all holdings across accounts
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

  const fundGroups = Array.from(fundGroupMap.values());

  // Calculate grand totals
  const grandTotalInvested = fundGroups.reduce(
    (sum, g) => sum + g.totalInvested,
    0
  );
  const grandTotalCurrent = fundGroups.reduce(
    (sum, g) => sum + g.totalCurrent,
    0
  );
  const grandTotalGainLoss = fundGroups.reduce(
    (sum, g) => sum + g.totalGainLoss,
    0
  );

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Fund Holdings</h1>
        <p className="text-muted-foreground">
          Detailed view of all fund holdings across accounts.
        </p>
      </div>

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
