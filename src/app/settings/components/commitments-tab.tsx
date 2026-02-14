"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import type { HouseholdData, CommittedOutgoing, CommittedOutgoingCategory, OutgoingFrequency } from "@/types";
import {
  OUTGOING_CATEGORY_LABELS,
  OUTGOING_FREQUENCY_LABELS,
  annualiseOutgoing,
} from "@/types";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { clone } from "./field-helpers";
import { renderField } from "./field-helpers";

interface CommitmentsTabProps {
  household: HouseholdData;
  updateHousehold: (data: HouseholdData) => void;
}

export function CommitmentsTab({ household, updateHousehold }: CommitmentsTabProps) {
  const outgoings = household.committedOutgoings;

  const totalAnnual = outgoings.reduce(
    (sum, o) => sum + annualiseOutgoing(o.amount, o.frequency),
    0
  );
  const totalMonthly = totalAnnual / 12;

  function addOutgoing() {
    const next = clone(household);
    next.committedOutgoings.push({
      id: `outgoing-${Date.now()}`,
      category: "other",
      label: "",
      amount: 0,
      frequency: "monthly",
    });
    updateHousehold(next);
  }

  function removeOutgoing(id: string) {
    const next = clone(household);
    next.committedOutgoings = next.committedOutgoings.filter((o: CommittedOutgoing) => o.id !== id);
    updateHousehold(next);
  }

  function updateOutgoing(id: string, field: keyof CommittedOutgoing, value: string | number) {
    const next = clone(household);
    const outgoing = next.committedOutgoings.find((o: CommittedOutgoing) => o.id === id);
    if (!outgoing) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (outgoing as any)[field] = value;
    updateHousehold(next);
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Committed Outgoings Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Monthly total</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalMonthly)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Annual total</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalAnnual)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Commitments</p>
              <p className="text-2xl font-bold tabular-nums">{outgoings.length}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Committed outgoings are recurring obligations that reduce your effective net worth.
            These are factored into cash flow forecasts, retirement projections, and dashboard metrics.
          </p>
        </CardContent>
      </Card>

      {/* Outgoing items */}
      {outgoings.map((outgoing) => {
        const annual = annualiseOutgoing(outgoing.amount, outgoing.frequency);
        return (
          <Card key={outgoing.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {OUTGOING_CATEGORY_LABELS[outgoing.category]}
                  </Badge>
                  {outgoing.amount > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {formatCurrencyCompact(annual)}/yr
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOutgoing(outgoing.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {renderField("Label", (
                  <Input
                    value={outgoing.label}
                    onChange={(e) => updateOutgoing(outgoing.id, "label", e.target.value)}
                    placeholder="e.g. Mortgage, School fees (Arjun)"
                  />
                ), "A short description of this outgoing")}

                {renderField("Category", (
                  <Select
                    value={outgoing.category}
                    onValueChange={(v) => updateOutgoing(outgoing.id, "category", v as CommittedOutgoingCategory)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(OUTGOING_CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}

                {renderField("Amount", (
                  <Input
                    type="number"
                    min={0}
                    value={outgoing.amount || ""}
                    onChange={(e) => updateOutgoing(outgoing.id, "amount", Number(e.target.value))}
                    placeholder="0"
                  />
                ), "Amount per occurrence")}

                {renderField("Frequency", (
                  <Select
                    value={outgoing.frequency}
                    onValueChange={(v) => updateOutgoing(outgoing.id, "frequency", v as OutgoingFrequency)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(OUTGOING_FREQUENCY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}

                {renderField("End date (optional)", (
                  <Input
                    type="date"
                    value={outgoing.endDate ?? ""}
                    onChange={(e) => updateOutgoing(outgoing.id, "endDate", e.target.value || undefined as unknown as string)}
                  />
                ), "Leave blank if ongoing. Set for time-limited obligations like school fees.")}

                {renderField("Person (optional)", (
                  <Select
                    value={outgoing.personId ?? "__household"}
                    onValueChange={(v) => updateOutgoing(outgoing.id, "personId", v === "__household" ? undefined as unknown as string : v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__household">Household</SelectItem>
                      {household.persons.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ), "Assign to a specific person or the whole household")}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button onClick={addOutgoing} className="gap-2">
        <Plus className="size-4" />
        Add Committed Outgoing
      </Button>
    </div>
  );
}
