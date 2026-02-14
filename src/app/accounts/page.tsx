"use client";

import { useMemo } from "react";
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS } from "@/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function AccountsPage() {
  const { household } = useScenarioData();
  const { persons, accounts } = household;
  const { selectedView } = usePersonView();

  const filteredAccounts = useMemo(() => {
    if (selectedView === "household") return accounts;
    return accounts.filter((a) => a.personId === selectedView);
  }, [accounts, selectedView]);

  // Group accounts by person
  const accountsByPerson = useMemo(
    () =>
      persons
        .map((person) => {
          const personAccounts = filteredAccounts.filter((a) => a.personId === person.id);
          const totalValue = personAccounts.reduce(
            (sum, a) => sum + a.currentValue,
            0
          );
          return { person, accounts: personAccounts, totalValue };
        })
        .filter((g) => g.accounts.length > 0),
    [persons, filteredAccounts]
  );

  const grandTotal = useMemo(
    () => filteredAccounts.reduce((sum, a) => sum + a.currentValue, 0),
    [filteredAccounts]
  );

  return (
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader title="Accounts" description="Overview of all accounts grouped by person.">
        <PersonToggle />
      </PageHeader>

      {accountsByPerson.length === 0 && (
        <EmptyState message="No accounts yet. Add your ISAs, pensions, and savings accounts to get started." settingsTab="accounts" />
      )}

      {accountsByPerson.map(({ person, accounts: personAccounts, totalValue }) => (
        <section key={person.id} className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">{person.name}</h2>
            <span className="text-lg font-medium text-muted-foreground">
              Total: {formatCurrency(totalValue)}
            </span>
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Current Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {account.name}
                      </TableCell>
                      <TableCell>{account.provider}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {ACCOUNT_TYPE_LABELS[account.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(account.currentValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">
                      Subtotal
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(totalValue)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>

          {/* Mobile card view */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {personAccounts.map((account) => (
              <Card key={account.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{account.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Provider
                    </span>
                    <span className="text-sm font-medium">
                      {account.provider}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <Badge variant="secondary">
                      {ACCOUNT_TYPE_LABELS[account.type]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Value</span>
                    <span className="text-base font-semibold">
                      {formatCurrency(account.currentValue)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {/* Grand total */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Grand Total</span>
          <span className="text-2xl font-bold">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
