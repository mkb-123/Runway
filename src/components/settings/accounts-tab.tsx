"use client";

import { useData } from "@/context/data-context";
import { clone, setField, renderField } from "./helpers";
import { ACCOUNT_TYPE_LABELS } from "@/types";
import type { AccountType, Holding } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AccountsTab() {
  const { household, updateHousehold } = useData();

  function personName(personId: string): string {
    return household.persons.find((p) => p.id === personId)?.name || "Unknown";
  }

  function updateAccount(index: number, field: keyof import("@/types").Account, value: string | number) {
    const updated = clone(household);
    setField(updated.accounts[index], field, value);
    updateHousehold(updated);
  }

  function addAccount() {
    const updated = clone(household);
    const defaultPersonId = updated.persons.length > 0 ? updated.persons[0].id : "";
    updated.accounts.push({
      id: `acc-${Date.now()}`,
      personId: defaultPersonId,
      type: "cash_savings" as AccountType,
      provider: "",
      name: "",
      currentValue: 0,
      holdings: [],
    });
    updateHousehold(updated);
  }

  function removeAccount(index: number) {
    const updated = clone(household);
    updated.accounts.splice(index, 1);
    updateHousehold(updated);
  }

  function updateHolding(accountIndex: number, holdingIndex: number, field: keyof Holding, value: string | number) {
    const updated = clone(household);
    setField(updated.accounts[accountIndex].holdings[holdingIndex], field, value);
    updateHousehold(updated);
  }

  function addHolding(accountIndex: number) {
    const updated = clone(household);
    const defaultFundId = updated.funds.length > 0 ? updated.funds[0].id : "";
    updated.accounts[accountIndex].holdings.push({
      fundId: defaultFundId,
      units: 0,
      purchasePrice: 0,
      currentPrice: 0,
    });
    updateHousehold(updated);
  }

  function removeHolding(accountIndex: number, holdingIndex: number) {
    const updated = clone(household);
    updated.accounts[accountIndex].holdings.splice(holdingIndex, 1);
    updateHousehold(updated);
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Add your ISAs, pensions, GIAs, and cash accounts. Each account belongs to a person and can hold multiple fund holdings.
      </p>
      {household.accounts.map((account, aIdx) => (
        <Card key={account.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {account.name || "New Account"}
                <Badge variant="outline">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
              </CardTitle>
              <Button variant="destructive" size="sm" onClick={() => removeAccount(aIdx)}>Remove</Button>
            </div>
            <CardDescription>
              Owner: {personName(account.personId)} | Provider: {account.provider || "N/A"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {renderField("Person",
                <Select value={account.personId} onValueChange={(val) => updateAccount(aIdx, "personId", val)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {household.persons.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name || "Unnamed"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {renderField("Account Name",
                <Input value={account.name} onChange={(e) => updateAccount(aIdx, "name", e.target.value)} placeholder="Account name" />
              )}
              {renderField("Provider",
                <Input value={account.provider} onChange={(e) => updateAccount(aIdx, "provider", e.target.value)} placeholder="Provider name" />
              )}
              {renderField("Account Type",
                <Select value={account.type} onValueChange={(val) => updateAccount(aIdx, "type", val)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {renderField("Current Value",
                <Input type="number" step="0.01" value={account.currentValue} onChange={(e) => updateAccount(aIdx, "currentValue", Number(e.target.value))} placeholder="0.00" />
              )}
            </div>

            {/* Holdings sub-section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Holdings</h4>
                <Button variant="outline" size="sm" onClick={() => addHolding(aIdx)}>+ Add Holding</Button>
              </div>
              {account.holdings.length === 0 && (
                <p className="text-sm text-muted-foreground">No holdings for this account.</p>
              )}
              {account.holdings.map((holding, hIdx) => (
                <Card key={`${account.id}-holding-${hIdx}`} className="border-dashed">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {renderField("Fund",
                        <Select value={holding.fundId} onValueChange={(val) => updateHolding(aIdx, hIdx, "fundId", val)}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {household.funds.map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.name || f.ticker || "Unnamed"}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {renderField("Units",
                        <Input type="number" step="0.01" value={holding.units} onChange={(e) => updateHolding(aIdx, hIdx, "units", Number(e.target.value))} />
                      )}
                      {renderField("Purchase Price",
                        <Input type="number" step="0.01" value={holding.purchasePrice} onChange={(e) => updateHolding(aIdx, hIdx, "purchasePrice", Number(e.target.value))} />
                      )}
                      {renderField("Current Price",
                        <Input type="number" step="0.01" value={holding.currentPrice} onChange={(e) => updateHolding(aIdx, hIdx, "currentPrice", Number(e.target.value))} />
                      )}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button variant="destructive" size="sm" onClick={() => removeHolding(aIdx, hIdx)}>Remove Holding</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <Button onClick={addAccount} variant="outline">+ Add Account</Button>
    </>
  );
}
