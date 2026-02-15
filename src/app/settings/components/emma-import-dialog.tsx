"use client";

import { useRef, useState } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import {
  parseEmmaCSV,
  analyzeEmmaSpending,
  toCommittedOutgoings,
} from "@/lib/emma-import";
import type { EmmaParseResult, EmmaSpendingSummary } from "@/lib/emma-import";
import type { HouseholdData } from "@/types";
import { clone } from "./field-helpers";

interface EmmaImportDialogProps {
  household: HouseholdData;
  updateHousehold: (data: HouseholdData) => void;
}

type Step = "upload" | "review" | "done";

export function EmmaImportDialog({ household, updateHousehold }: EmmaImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [parseResult, setParseResult] = useState<EmmaParseResult | null>(null);
  const [spending, setSpending] = useState<EmmaSpendingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedItems, setAppliedItems] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setParseResult(null);
    setSpending(null);
    setError(null);
    setAppliedItems(new Set());
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      setError("Please select a CSV file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const result = parseEmmaCSV(text);

      if (result.transactions.length === 0) {
        setError(
          result.warnings.length > 0
            ? `No transactions found: ${result.warnings[0]}`
            : "No transactions found in the file."
        );
        return;
      }

      setParseResult(result);
      setSpending(analyzeEmmaSpending(result.transactions));
      setStep("review");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function applySpendingFigures() {
    if (!spending) return;
    const updated = clone(household);
    updated.emergencyFund.monthlyLifestyleSpending = spending.monthlyLifestyleSpending;
    updated.emergencyFund.monthlyEssentialExpenses = spending.monthlyEssentialExpenses;
    updateHousehold(updated);
    setAppliedItems((prev) => new Set([...prev, "spending"]));
  }

  function applyOutgoing(index: number) {
    if (!spending) return;
    const suggestion = spending.suggestedOutgoings[index];
    const outgoings = toCommittedOutgoings([suggestion]);
    if (outgoings.length === 0) return;

    const updated = clone(household);
    const outgoing = outgoings[0];
    updated.committedOutgoings.push({
      ...outgoing,
      id: `emma-${Date.now()}-${index}`,
    });
    updateHousehold(updated);
    setAppliedItems((prev) => new Set([...prev, `outgoing-${index}`]));
  }

  function applyAllOutgoings() {
    if (!spending) return;
    const outgoings = toCommittedOutgoings(spending.suggestedOutgoings);
    if (outgoings.length === 0) return;

    const updated = clone(household);
    outgoings.forEach((outgoing, i) => {
      updated.committedOutgoings.push({
        ...outgoing,
        id: `emma-${Date.now()}-${i}`,
      });
    });
    updateHousehold(updated);

    const newApplied = new Set(appliedItems);
    spending.suggestedOutgoings.forEach((_, i) => newApplied.add(`outgoing-${i}`));
    setAppliedItems(newApplied);
  }

  function handleDone() {
    setStep("done");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <FileText className="size-3.5" />
          Import from Emma
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {step === "upload" && (
          <>
            <DialogHeader>
              <DialogTitle>Import from Emma</DialogTitle>
              <DialogDescription>
                Upload a CSV export from the Emma app to automatically detect your
                spending patterns and recurring payments.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
                <Upload className="mx-auto size-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Export your transactions from Emma as CSV, then upload the file here.
                </p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select CSV File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">How to export from Emma:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Open Emma app (requires Pro or Ultimate)</li>
                  <li>Go to Analytics or Transactions</li>
                  <li>Tap the export/share icon</li>
                  <li>Choose &quot;Export to CSV&quot;</li>
                  <li>Save and upload the file here</li>
                </ol>
              </div>
            </div>
          </>
        )}

        {step === "review" && parseResult && spending && (
          <>
            <DialogHeader>
              <DialogTitle>Review Emma Data</DialogTitle>
              <DialogDescription>
                Found {parseResult.transactions.length} transactions
                {parseResult.dateRange && (
                  <> from {parseResult.dateRange.from} to {parseResult.dateRange.to}</>
                )}
                {" "} covering {spending.monthsCovered} month{spending.monthsCovered !== 1 ? "s" : ""}.
              </DialogDescription>
            </DialogHeader>

            {parseResult.warnings.length > 0 && (
              <div className="rounded-md bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <p className="font-medium mb-1">{parseResult.warnings.length} warning{parseResult.warnings.length !== 1 ? "s" : ""}</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {parseResult.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {parseResult.warnings.length > 5 && (
                    <li>...and {parseResult.warnings.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              {/* Monthly spending summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    Monthly Spending Summary
                    {appliedItems.has("spending") ? (
                      <Badge variant="outline" className="text-green-600 gap-1">
                        <CheckCircle2 className="size-3" />
                        Applied
                      </Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={applySpendingFigures}>
                        Apply
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total monthly outgoings</span>
                    <span className="tabular-nums font-medium">{formatCurrency(spending.monthlyTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Essential expenses</span>
                    <span className="tabular-nums">{formatCurrency(spending.monthlyEssentialExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lifestyle spending</span>
                    <span className="tabular-nums">{formatCurrency(spending.monthlyLifestyleSpending)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Applying this will update your Emergency Fund settings.
                  </p>
                </CardContent>
              </Card>

              {/* Top categories */}
              {spending.byCategory.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top Spending Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-sm">
                      {spending.byCategory.slice(0, 8).map((cat) => (
                        <div key={cat.category} className="flex justify-between">
                          <span className="text-muted-foreground truncate mr-2">{cat.category}</span>
                          <span className="tabular-nums shrink-0">{formatCurrency(cat.monthlyAverage)}/mo</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recurring payments */}
              {spending.suggestedOutgoings.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      Detected Recurring Payments
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={applyAllOutgoings}
                        disabled={spending.suggestedOutgoings.every((_, i) =>
                          appliedItems.has(`outgoing-${i}`)
                        )}
                      >
                        Apply All
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {spending.suggestedOutgoings.map((outgoing, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{outgoing.label}</span>
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              {outgoing.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="tabular-nums">{formatCurrency(outgoing.monthlyAmount)}/mo</span>
                            {appliedItems.has(`outgoing-${i}`) ? (
                              <CheckCircle2 className="size-4 text-green-600" />
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => applyOutgoing(i)}
                              >
                                Add
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Start Over
              </Button>
              <Button onClick={handleDone} className="gap-1.5">
                Done
                <ArrowRight className="size-3.5" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>Import Complete</DialogTitle>
              <DialogDescription>
                Your Emma data has been processed. Applied items have been saved to your
                Runway settings.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center py-4 text-center">
              <CheckCircle2 className="size-10 text-green-600 mb-3" />
              <p className="text-sm text-muted-foreground">
                {appliedItems.size === 0
                  ? "No items were applied. You can re-import anytime."
                  : `${appliedItems.size} item${appliedItems.size !== 1 ? "s" : ""} applied to your settings.`}
              </p>
            </div>

            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
