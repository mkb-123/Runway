"use client";

import { useMemo } from "react";
import { useScenarioData } from "@/context/use-scenario-data";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS, getAccountTaxWrapper, TAX_WRAPPER_LABELS } from "@/types";
import type { TaxWrapper } from "@/types";
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
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { CollapsibleSection } from "@/components/collapsible-section";
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

  // Summary totals by tax wrapper type
  const wrapperSummary = useMemo(() => {
    const map = new Map<TaxWrapper, number>();
    for (const a of filteredAccounts) {
      const wrapper = getAccountTaxWrapper(a.type);
      map.set(wrapper, (map.get(wrapper) ?? 0) + a.currentValue);
    }
    // Sort by value descending
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [filteredAccounts]);

  // Base wrapper totals for what-if comparison
  const baseWrapperTotals = useMemo(() => {
    const map = new Map<TaxWrapper, number>();
    for (const a of filteredAccounts) {
      const wrapper = getAccountTaxWrapper(a.type);
      const baseVal = baseAccountValues.get(a.id) ?? a.currentValue;
      map.set(wrapper, (map.get(wrapper) ?? 0) + baseVal);
    }
    return map;
  }, [filteredAccounts, baseAccountValues]);

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader title="Accounts" description="Overview of all accounts grouped by person.">
        <PersonToggle />
      </PageHeader>

      {accountsByPerson.length === 0 && (
        <EmptyState message="No accounts yet. Add your ISAs, pensions, and savings accounts to get started." settingsTab="accounts" />
      )}

      {/* Summary by wrapper type + grand total */}
      {filteredAccounts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {wrapperSummary.map(([wrapper, total]) => (
            <Card key={wrapper}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{TAX_WRAPPER_LABELS[wrapper]}</div>
                <div className="text-lg font-bold tabular-nums mt-1">
                  <ScenarioDelta base={baseWrapperTotals.get(wrapper) ?? total} scenario={total} format={formatCurrency} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Card className="bg-gradient-to-br from-primary/8 via-primary/4 to-card">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Total</div>
              <div className="text-lg font-bold tabular-nums mt-1">
                <ScenarioDelta base={baseGrandTotal} scenario={grandTotal} format={formatCurrency} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {accountsByPerson.map(({ person, accounts: personAccounts, totalValue, baseTotalValue }) => (
        <CollapsibleSection
          key={person.id}
          title={person.name}
          summary={formatCurrency(totalValue)}
          defaultOpen
          storageKey={`accounts-${person.id}`}
        >
          {/* Desktop table view */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell className="text-muted-foreground">{account.provider}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
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
                    <TableCell colSpan={3} className="font-semibold">Subtotal</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
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
              <div key={account.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <div className="font-medium text-sm">{account.name}</div>
                  <div className="text-xs text-muted-foreground">{account.provider} · {ACCOUNT_TYPE_LABELS[account.type]}</div>
                </div>
                <div className="font-semibold tabular-nums">
                  <ScenarioDelta
                    base={baseAccountValues.get(account.id) ?? account.currentValue}
                    scenario={account.currentValue}
                    format={formatCurrency}
                  />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
}
