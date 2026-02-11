"use client";

import * as XLSX from "xlsx";
import householdData from "../../../data/household.json";
import transactionsData from "../../../data/transactions.json";
import snapshotsData from "../../../data/snapshots.json";
import type {
  HouseholdData,
  TransactionsData,
  SnapshotsData,
} from "@/types";
import { ACCOUNT_TYPE_LABELS, ASSET_CLASS_LABELS, REGION_LABELS } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const household = householdData as unknown as HouseholdData;
const transactions = transactionsData as unknown as TransactionsData;
const snapshots = snapshotsData as unknown as SnapshotsData;

// --- Helpers ---

function getPersonName(personId: string): string {
  return household.persons.find((p) => p.id === personId)?.name ?? personId;
}

function getAccountName(accountId: string): string {
  return household.accounts.find((a) => a.id === accountId)?.name ?? accountId;
}

function getFundName(fundId: string): string {
  return household.funds.find((f) => f.id === fundId)?.name ?? fundId;
}

function getFundTicker(fundId: string): string {
  return household.funds.find((f) => f.id === fundId)?.ticker ?? "";
}

// --- Data Builders ---

function buildNetWorthRows() {
  return household.accounts.map((account) => ({
    Person: getPersonName(account.personId),
    "Account Name": account.name,
    Provider: account.provider,
    Type: ACCOUNT_TYPE_LABELS[account.type],
    "Current Value": account.currentValue,
  }));
}

function buildHoldingsRows() {
  const rows: Record<string, string | number>[] = [];

  for (const account of household.accounts) {
    if (!account.holdings || account.holdings.length === 0) {
      // Include the account even if it has no holdings (e.g. cash)
      rows.push({
        Person: getPersonName(account.personId),
        Account: account.name,
        Provider: account.provider,
        Fund: "N/A (Cash / No Holdings)",
        Ticker: "",
        "Asset Class": "",
        Region: "",
        Units: 0,
        "Avg Cost Per Unit": 0,
        "Current Price Per Unit": 0,
        "Total Cost": 0,
        "Current Value": account.currentValue,
        "Gain / Loss": 0,
        "Gain %": 0,
      });
      continue;
    }

    for (const holding of account.holdings) {
      const fund = household.funds.find((f) => f.id === holding.fundId);
      const totalCost = holding.units * holding.purchasePrice;
      const currentValue = holding.units * holding.currentPrice;
      const gain = currentValue - totalCost;
      const gainPct = totalCost > 0 ? gain / totalCost : 0;

      rows.push({
        Person: getPersonName(account.personId),
        Account: account.name,
        Provider: account.provider,
        Fund: fund?.name ?? holding.fundId,
        Ticker: fund?.ticker ?? "",
        "Asset Class": fund ? ASSET_CLASS_LABELS[fund.assetClass] : "",
        Region: fund ? REGION_LABELS[fund.region] : "",
        Units: holding.units,
        "Avg Cost Per Unit": holding.purchasePrice,
        "Current Price Per Unit": holding.currentPrice,
        "Total Cost": Math.round(totalCost * 100) / 100,
        "Current Value": Math.round(currentValue * 100) / 100,
        "Gain / Loss": Math.round(gain * 100) / 100,
        "Gain %": Math.round(gainPct * 10000) / 10000,
      });
    }
  }

  return rows;
}

function buildTransactionRows() {
  return transactions.transactions.map((tx) => ({
    Date: tx.date,
    Account: getAccountName(tx.accountId),
    Fund: getFundName(tx.fundId),
    Ticker: getFundTicker(tx.fundId),
    Type: tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
    Units: tx.units,
    "Price Per Unit": tx.pricePerUnit,
    Amount: tx.amount,
    Notes: tx.notes ?? "",
  }));
}

// --- Export Functions ---

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function exportNetWorth() {
  const rows = buildNetWorthRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Net Worth");
  downloadWorkbook(wb, "net-worth-snapshot.xlsx");
}

function exportHoldings() {
  const rows = buildHoldingsRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Holdings");
  downloadWorkbook(wb, "holdings-detail.xlsx");
}

function exportTransactions() {
  const rows = buildTransactionRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  downloadWorkbook(wb, "transaction-history.xlsx");
}

function exportFullWorkbook() {
  const wb = XLSX.utils.book_new();

  const nwRows = buildNetWorthRows();
  const nwWs = XLSX.utils.json_to_sheet(nwRows);
  XLSX.utils.book_append_sheet(wb, nwWs, "Net Worth");

  const holdingsRows = buildHoldingsRows();
  const holdingsWs = XLSX.utils.json_to_sheet(holdingsRows);
  XLSX.utils.book_append_sheet(wb, holdingsWs, "Holdings");

  const txRows = buildTransactionRows();
  const txWs = XLSX.utils.json_to_sheet(txRows);
  XLSX.utils.book_append_sheet(wb, txWs, "Transactions");

  downloadWorkbook(wb, "net-worth-full-export.xlsx");
}

// --- Component ---

const exports = [
  {
    title: "Net Worth Snapshot",
    description:
      "Export all accounts with their current values, grouped by person. Includes account name, provider, type, and current value.",
    action: exportNetWorth,
  },
  {
    title: "Holdings Detail",
    description:
      "Export a detailed breakdown of every fund holding across all accounts. Includes units, average cost, current price, gain/loss, and gain percentage.",
    action: exportHoldings,
  },
  {
    title: "Transaction History",
    description:
      "Export all recorded transactions including buys, sells, dividends, and contributions. Includes dates, amounts, prices, and notes.",
    action: exportTransactions,
  },
  {
    title: "Full Workbook",
    description:
      "Export a multi-sheet Excel workbook containing all of the above: Net Worth, Holdings, and Transactions in separate tabs.",
    action: exportFullWorkbook,
  },
];

export default function ExportPage() {
  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Export Data</h1>
        <p className="text-muted-foreground">
          Download your financial data as Excel spreadsheets for offline analysis
          or record keeping.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {exports.map((exp) => (
          <Card key={exp.title}>
            <CardHeader>
              <CardTitle>{exp.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {exp.description}
              </p>
              <Button onClick={exp.action} className="w-full">
                Download {exp.title}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
