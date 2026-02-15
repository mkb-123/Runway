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
import { ScenarioDelta } from "@/components/scenario-delta";

export default function AccountsPage() {
  const { household, baseHousehold } = useScenarioData();
  const { persons, accounts } = household;
  const { selectedView } = usePersonView();

  const filteredAccounts = useMemo(() => {
    if (selectedView === "household") return accounts;
    return accounts.filter((a) => a.personId === selectedView);
  }, [accounts, selectedView]);

  // Base account value lookup by ID
  const baseAccountValues = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of baseHousehold.accounts) {
      map.set(a.id, a.currentValue);
    }
    return map;
  }, [baseHousehold.accounts]);

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
          const baseTotalValue = personAccounts.reduce(
            (sum, a) => sum + (baseAccountValues.get(a.id) ?? a.currentValue),
            0
          );
          return { person, accounts: personAccounts, totalValue, baseTotalValue };
        })
        .filter((g) => g.accounts.length > 0),
    [persons, filteredAccounts, baseAccountValues]
  );

  const grandTotal = useMemo(
    () => filteredAccounts.reduce((sum, a) => sum + a.currentValue, 0),
    [filteredAccounts]
  );

  const baseGrandTotal = useMemo(
    () => filteredAccounts.reduce((sum, a) => sum + (baseAccountValues.get(a.id) ?? a.currentValue), 0),
    [filteredAccounts, baseAccountValues]
  );

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader title="Accounts" description="Overview of all accounts grouped by person.">
        <PersonToggle />
      </PageHeader>

      {accountsByPerson.length === 0 && (
        <EmptyState message="No accounts yet. Add your ISAs, pensions, and savings accounts to get started." settingsTab="accounts" />
      )}

      {accountsByPerson.map(({ person, accounts: personAccounts, totalValue, baseTotalValue }) => (
        <section key={person.id} className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">{person.name}</h2>
            <span className="text-lg font-medium text-muted-foreground">
              Total: <ScenarioDelta base={baseTotalValue} scenario={totalValue} format={formatCurrency} />
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
                        <ScenarioDelta
                          base={baseAccountValues.get(account.id) ?? account.currentValue}
                          scenario={account.currentValue}
                          format={formatCurrency}
                        />
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
                      <ScenarioDelta base={baseTotalValue} scenario={totalValue} format={formatCurrency} />
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
                      <ScenarioDelta
                        base={baseAccountValues.get(account.id) ?? account.currentValue}
                        scenario={account.currentValue}
                        format={formatCurrency}
                      />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {/* Grand total */}
      <div className="rounded-xl border-0 bg-gradient-to-br from-primary/8 via-primary/4 to-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Grand Total</span>
          <span className="text-3xl font-bold tracking-tight tabular-nums">
            <ScenarioDelta base={baseGrandTotal} scenario={grandTotal} format={formatCurrency} />
          </span>
        </div>
      </div>
    </div>
  );
}
