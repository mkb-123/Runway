"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AccountType,
  HouseholdData,
} from "@/types";
import { ACCOUNT_TYPE_LABELS } from "@/types";
import { cn } from "@/lib/utils";
import { clone, setField, renderField } from "./field-helpers";

interface AccountsTabProps {
  household: HouseholdData;
  updateHousehold: (data: HouseholdData) => void;
}

export function AccountsTab({ household, updateHousehold }: AccountsTabProps) {
  function updateAccount(
    index: number,
    field: keyof (typeof household.accounts)[number],
    value: string | number
  ) {
    const updated = clone(household);
    setField(updated.accounts[index], field, value);
    updateHousehold(updated);
  }

  function addAccount() {
    const updated = clone(household);
    const defaultPersonId =
      updated.persons.length > 0 ? updated.persons[0].id : "";
    updated.accounts.push({
      id: `acc-${Date.now()}`,
      personId: defaultPersonId,
      type: "cash_savings" as AccountType,
      provider: "",
      name: "",
      currentValue: 0,
    });
    updateHousehold(updated);
  }

  function removeAccount(index: number) {
    const updated = clone(household);
    updated.accounts.splice(index, 1);
    updateHousehold(updated);
  }

  // Group accounts by person
  const accountsByPerson = household.persons.map((person) => ({
    person,
    accounts: household.accounts
      .map((a, idx) => ({ account: a, originalIndex: idx }))
      .filter(({ account }) => account.personId === person.id),
  }));

  // Accounts with no matching person (orphaned)
  const personIds = new Set(household.persons.map((p) => p.id));
  const orphanedAccounts = household.accounts
    .map((a, idx) => ({ account: a, originalIndex: idx }))
    .filter(({ account }) => !personIds.has(account.personId));

  // eslint-disable-next-line react-hooks/rules-of-hooks -- component, not conditional
  const [selectedPersonIdx, setSelectedPersonIdx] = useState(0);
  const clampedIdx = Math.min(selectedPersonIdx, Math.max(0, household.persons.length - 1));

  return (
    <div className="space-y-6 mt-4">
      <p className="text-sm text-muted-foreground">
        Your ISAs, pensions, GIAs, and cash accounts. Update the current value
        of each account to keep your net worth up to date.
      </p>

      {/* Person selector */}
      {household.persons.length > 1 && (
        <div
          className="inline-flex items-center rounded-lg bg-muted p-1 text-sm"
          role="tablist"
          aria-label="Person selector"
        >
          {household.persons.map((p, idx) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={clampedIdx === idx}
              onClick={() => setSelectedPersonIdx(idx)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                "min-h-[36px] min-w-[44px]",
                clampedIdx === idx
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.name || "Unnamed"}
            </button>
          ))}
        </div>
      )}

      {accountsByPerson.filter((_, idx) =>
        household.persons.length <= 1 || idx === clampedIdx
      ).map(({ person, accounts }) => (
        <div key={person.id} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {person.name || "Unnamed"}&apos;s Accounts
          </h3>

          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground pl-1">
              No accounts yet.
            </p>
          )}

          {accounts.map(({ account, originalIndex: aIdx }) => (
            <Card key={account.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {account.name || "New Account"}
                    <Badge variant="outline">
                      {ACCOUNT_TYPE_LABELS[account.type]}
                    </Badge>
                  </CardTitle>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeAccount(aIdx)}
                  >
                    Remove
                  </Button>
                </div>
                <CardDescription>
                  Provider: {account.provider || "N/A"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderField(
                    "Person",
                    <Select
                      value={account.personId}
                      onValueChange={(val) => updateAccount(aIdx, "personId", val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {household.persons.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name || "Unnamed"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {renderField(
                    "Account Name",
                    <Input
                      value={account.name}
                      onChange={(e) => updateAccount(aIdx, "name", e.target.value)}
                      placeholder="e.g. Vanguard ISA"
                    />
                  )}
                  {renderField(
                    "Provider",
                    <Input
                      value={account.provider}
                      onChange={(e) => updateAccount(aIdx, "provider", e.target.value)}
                      placeholder="e.g. Vanguard, Hargreaves Lansdown"
                    />
                  )}
                  {renderField(
                    "Account Type",
                    <Select
                      value={account.type}
                      onValueChange={(val) => updateAccount(aIdx, "type", val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>,
                    "Determines tax treatment for projections"
                  )}
                  {renderField(
                    "Current Value",
                    <Input
                      type="number"
                      step="0.01"
                      value={account.currentValue}
                      onChange={(e) =>
                        updateAccount(aIdx, "currentValue", Number(e.target.value))
                      }
                      placeholder="0.00"
                    />,
                    "Total current value of this account"
                  )}
                  {account.type === "gia" &&
                    renderField(
                      "Cost Basis",
                      <Input
                        type="number"
                        step="0.01"
                        value={account.costBasis ?? ""}
                        onChange={(e) =>
                          updateAccount(aIdx, "costBasis", Number(e.target.value))
                        }
                        placeholder="0.00"
                      />,
                      "Total amount originally invested (for CGT estimation)"
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {orphanedAccounts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-destructive uppercase tracking-wide">
            Unassigned Accounts
          </h3>
          {orphanedAccounts.map(({ account, originalIndex: aIdx }) => (
            <Card key={account.id} className="border-destructive/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {account.name || "New Account"}
                    <Badge variant="destructive">No owner</Badge>
                  </CardTitle>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeAccount(aIdx)}
                  >
                    Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderField(
                    "Reassign to",
                    <Select
                      value={account.personId}
                      onValueChange={(val) => updateAccount(aIdx, "personId", val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select person" />
                      </SelectTrigger>
                      <SelectContent>
                        {household.persons.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name || "Unnamed"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button onClick={addAccount} variant="outline">
        + Add Account
      </Button>
    </div>
  );
}
