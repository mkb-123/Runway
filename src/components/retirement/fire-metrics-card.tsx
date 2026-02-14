"use client";

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
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
} from "@/lib/format";

interface FireMetricsCardProps {
  savingsRate: number;
  totalAnnualContributions: number;
  totalGrossIncome: number;
  coastFIRE: boolean;
  requiredPot: number;
  pensionAccessAge: number;
  midRate: number;
  requiredMonthlySavings: { years: number; monthly: number }[];
}

export function FireMetricsCard({
  savingsRate,
  totalAnnualContributions,
  totalGrossIncome,
  coastFIRE,
  requiredPot,
  pensionAccessAge,
  midRate,
  requiredMonthlySavings,
}: FireMetricsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>FIRE Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top metrics row */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Savings Rate */}
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Savings Rate
            </p>
            <p className="text-2xl font-bold mt-1">
              {savingsRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(totalAnnualContributions)} /{" "}
              {formatCurrency(totalGrossIncome)} gross
            </p>
          </div>

          {/* Coast FIRE */}
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Coast FIRE
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={coastFIRE ? "default" : "outline"}>
                {coastFIRE ? "Achieved" : "Not Yet"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {coastFIRE
                ? `Pot will grow to ${formatCurrencyCompact(requiredPot)} by age ${pensionAccessAge} at ${formatPercent(midRate)}`
                : `Continue contributing to reach ${formatCurrencyCompact(requiredPot)} by age ${pensionAccessAge}`}
            </p>
          </div>
        </div>

        {/* Required Monthly Savings */}
        <div>
          <h3 className="text-sm font-medium mb-1">
            Required Monthly Savings
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            At {formatPercent(midRate)} annual return
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timeframe</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead className="text-right">Annual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requiredMonthlySavings.map(({ years, monthly }) => (
                  <TableRow key={years}>
                    <TableCell>{years} years</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(monthly)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(monthly * 12)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
