"use client";

import { useData } from "@/context/data-context";
import { roundPence } from "@/lib/format";
import { clone, setField, renderField, TRANSACTION_TYPE_LABELS } from "./helpers";
import type { Transaction, TransactionType } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function TransactionsTab() {
  const { household, transactions, updateTransactions } = useData();

  function accountLabel(accountId: string): string {
    return household.accounts.find((a) => a.id === accountId)?.name || "Unknown Account";
  }

  function fundLabel(fundId: string): string {
    return household.funds.find((f) => f.id === fundId)?.name || "Unknown Fund";
  }

  function updateTransaction(index: number, field: keyof Transaction, value: string | number) {
    const updated = clone(transactions);
    setField(updated.transactions[index], field, value);
    if (field === "units" || field === "pricePerUnit") {
      const units = Number(updated.transactions[index].units);
      const price = Number(updated.transactions[index].pricePerUnit);
      updated.transactions[index].amount = roundPence(units * price);
    }
    updateTransactions(updated);
  }

  function addTransaction() {
    const updated = clone(transactions);
    const defaultAccountId = household.accounts.length > 0 ? household.accounts[0].id : "";
    const defaultFundId = household.funds.length > 0 ? household.funds[0].id : "";
    updated.transactions.push({
      id: `tx-${Date.now()}`,
      accountId: defaultAccountId,
      fundId: defaultFundId,
      type: "buy" as TransactionType,
      date: new Date().toISOString().split("T")[0],
      units: 0,
      pricePerUnit: 0,
      amount: 0,
      notes: "",
    });
    updateTransactions(updated);
  }

  function removeTransaction(index: number) {
    const updated = clone(transactions);
    updated.transactions.splice(index, 1);
    updateTransactions(updated);
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Track buy, sell, dividend, and contribution transactions for CGT calculations and audit trail.
      </p>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Transactions</h2>
        <Button variant="outline" onClick={addTransaction}>+ Add Transaction</Button>
      </div>

      {transactions.transactions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No transactions recorded yet.</p>
          </CardContent>
        </Card>
      )}

      {transactions.transactions.map((tx, txIdx) => (
        <Card key={tx.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge variant={tx.type === "buy" ? "default" : tx.type === "sell" ? "destructive" : "secondary"}>
                  {TRANSACTION_TYPE_LABELS[tx.type]}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  {tx.date} | {accountLabel(tx.accountId)} | {fundLabel(tx.fundId)}
                </span>
              </CardTitle>
              <Button variant="destructive" size="sm" onClick={() => removeTransaction(txIdx)}>Remove</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {renderField("Account",
                <Select value={tx.accountId} onValueChange={(val) => updateTransaction(txIdx, "accountId", val)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {household.accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name || "Unnamed Account"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {renderField("Fund",
                <Select value={tx.fundId} onValueChange={(val) => updateTransaction(txIdx, "fundId", val)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {household.funds.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name || f.ticker || "Unnamed Fund"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {renderField("Type",
                <Select value={tx.type} onValueChange={(val) => updateTransaction(txIdx, "type", val)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {renderField("Date",
                <Input type="date" value={tx.date} onChange={(e) => updateTransaction(txIdx, "date", e.target.value)} />
              )}
              {renderField("Units",
                <Input type="number" step="0.01" value={tx.units} onChange={(e) => updateTransaction(txIdx, "units", Number(e.target.value))} />
              )}
              {renderField("Price Per Unit",
                <Input type="number" step="0.01" value={tx.pricePerUnit} onChange={(e) => updateTransaction(txIdx, "pricePerUnit", Number(e.target.value))} />
              )}
              {renderField("Total Amount",
                <Input type="number" step="0.01" value={tx.amount} disabled className="bg-muted" />
              )}
              {renderField("Notes",
                <Input value={tx.notes || ""} onChange={(e) => updateTransaction(txIdx, "notes", e.target.value)} placeholder="Optional notes" />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
