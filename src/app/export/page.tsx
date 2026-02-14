"use client";

import * as XLSX from "xlsx";
import { useData } from "@/context/data-context";
import { ACCOUNT_TYPE_LABELS, ASSET_CLASS_LABELS, REGION_LABELS } from "@/types";
import { roundPence } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

export default function ExportPage() {
  const { household, transactions } = useData();

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
          "Total Cost": roundPence(totalCost),
          "Current Value": roundPence(currentValue),
          "Gain / Loss": roundPence(gain),
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

  function exportNetWorth() {
    const ws = XLSX.utils.json_to_sheet(buildNetWorthRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Net Worth");
    downloadWorkbook(wb, "net-worth-snapshot.xlsx");
  }

  function exportHoldings() {
    const ws = XLSX.utils.json_to_sheet(buildHoldingsRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Holdings");
    downloadWorkbook(wb, "holdings-detail.xlsx");
  }

  function exportTransactions() {
    const ws = XLSX.utils.json_to_sheet(buildTransactionRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    downloadWorkbook(wb, "transaction-history.xlsx");
  }

  function exportFullWorkbook() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildNetWorthRows()), "Net Worth");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildHoldingsRows()), "Holdings");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildTransactionRows()), "Transactions");
    downloadWorkbook(wb, "net-worth-full-export.xlsx");
  }

  const exportItems = [
    {
      title: "Net Worth Snapshot",
      description: "Export all accounts with their current values, grouped by person. Includes account name, provider, type, and current value.",
      action: exportNetWorth,
    },
    {
      title: "Holdings Detail",
      description: "Export a detailed breakdown of every fund holding across all accounts. Includes units, average cost, current price, gain/loss, and gain percentage.",
      action: exportHoldings,
    },
    {
      title: "Transaction History",
      description: "Export all recorded transactions including buys, sells, dividends, and contributions. Includes dates, amounts, prices, and notes.",
      action: exportTransactions,
    },
    {
      title: "Full Workbook",
      description: "Export a multi-sheet Excel workbook containing all of the above: Net Worth, Holdings, and Transactions in separate tabs.",
      action: exportFullWorkbook,
    },
  ];

  const printReport = () => {
    // Navigate to dashboard for the print view (it has the print-optimised layout)
    window.location.href = "/";
    // Use a short delay to allow the page to render, then trigger print
    setTimeout(() => window.print(), 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Export Data</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Download your financial data as Excel spreadsheets for offline analysis or record keeping.
        </p>
      </div>

      {/* Print Financial Report card */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Print Financial Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Generate a print-optimised PDF of your dashboard including net worth summary,
            wrapper breakdown, charts, and recommendations. Uses your browser&apos;s built-in
            &ldquo;Save as PDF&rdquo; option.
          </p>
          <div className="flex gap-2">
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full" onClick={() => setTimeout(() => window.print(), 300)}>
                Print from Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        {exportItems.map((exp) => (
          <Card key={exp.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">{exp.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground sm:text-sm">{exp.description}</p>
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
