"use client";

import * as XLSX from "xlsx";
import { useData } from "@/context/data-context";
import { ACCOUNT_TYPE_LABELS } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

export default function ExportPage() {
  const { household } = useData();

  function getPersonName(personId: string): string {
    return household.persons.find((p) => p.id === personId)?.name ?? personId;
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

  function exportNetWorth() {
    const ws = XLSX.utils.json_to_sheet(buildNetWorthRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Net Worth");
    downloadWorkbook(wb, "net-worth-snapshot.xlsx");
  }

  function buildIFASummaryRows() {
    const rows: Record<string, string | number>[] = [];

    for (const person of household.persons) {
      rows.push({ Section: "Household", Item: person.name, Detail: person.relationship, Value: "" });
    }

    for (const account of household.accounts) {
      rows.push({
        Section: "Accounts",
        Item: account.name,
        Detail: `${getPersonName(account.personId)} — ${ACCOUNT_TYPE_LABELS[account.type]}`,
        Value: account.currentValue,
      });
    }

    for (const inc of household.income) {
      rows.push({
        Section: "Income",
        Item: `${getPersonName(inc.personId)} Gross Salary`,
        Detail: "",
        Value: inc.grossSalary,
      });
    }

    rows.push({
      Section: "Retirement",
      Item: "Target Annual Income",
      Detail: `${(household.retirement.withdrawalRate * 100).toFixed(1)}% SWR`,
      Value: household.retirement.targetAnnualIncome,
    });

    const totalNW = household.accounts.reduce((s, a) => s + a.currentValue, 0);
    rows.push({ Section: "Summary", Item: "Total Net Worth", Detail: "", Value: totalNW });

    return rows;
  }

  function exportIFASummary() {
    const ws = XLSX.utils.json_to_sheet(buildIFASummaryRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "IFA Summary");
    downloadWorkbook(wb, `ifa-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const exportItems = [
    {
      title: "Net Worth Snapshot",
      description: "Export all accounts with their current values, grouped by person. Includes account name, provider, type, and current value.",
      action: exportNetWorth,
    },
    {
      title: "IFA Summary",
      description: "One-page financial summary for your adviser: household, accounts, income, retirement targets, and net worth.",
      action: exportIFASummary,
    },
  ];

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Export Data</h1>
        <p className="text-sm text-muted-foreground">
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
