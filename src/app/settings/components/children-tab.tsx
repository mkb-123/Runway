"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GraduationCap } from "lucide-react";
import type { HouseholdData, Child } from "@/types";
import { formatCurrency } from "@/lib/format";
import { calculateAge } from "@/lib/projections";
import {
  calculateSchoolYearsRemaining,
  calculateTotalSchoolFeeCost,
  syncSchoolFeeOutgoings,
} from "@/lib/school-fees";
import { clone, renderField } from "./field-helpers";

interface ChildrenTabProps {
  household: HouseholdData;
  updateHousehold: (data: HouseholdData) => void;
}

export function ChildrenTab({ household, updateHousehold }: ChildrenTabProps) {
  const children = household.children;

  const totalAnnualFees = children.reduce((sum, c) => sum + c.schoolFeeAnnual, 0);
  const totalProjectedCost = children.reduce((sum, c) => sum + calculateTotalSchoolFeeCost(c), 0);
  const childrenInSchool = children.filter(
    (c) => {
      const age = calculateAge(c.dateOfBirth);
      return age >= c.schoolStartAge && age < c.schoolEndAge;
    }
  ).length;

  function addChild() {
    const next = clone(household);
    const newChild: Child = {
      id: `child-${Date.now()}`,
      name: "",
      dateOfBirth: "2020-01-01",
      schoolFeeAnnual: 0,
      feeInflationRate: 0.05,
      schoolStartAge: 4,
      schoolEndAge: 18,
    };
    next.children.push(newChild);
    updateHousehold(next);
  }

  function removeChild(id: string) {
    const next = clone(household);
    next.children = next.children.filter((c: Child) => c.id !== id);
    // Sync committed outgoings to remove the linked school fee
    next.committedOutgoings = syncSchoolFeeOutgoings(next.children, next.committedOutgoings);
    updateHousehold(next);
  }

  function updateChild(id: string, field: keyof Child, value: string | number) {
    const next = clone(household);
    const child = next.children.find((c: Child) => c.id === id);
    if (!child) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (child as any)[field] = value;
    // Re-sync committed outgoings whenever a child changes
    next.committedOutgoings = syncSchoolFeeOutgoings(next.children, next.committedOutgoings);
    updateHousehold(next);
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-5" />
            Children & School Fees
          </CardTitle>
          <CardDescription>
            Add your children to automatically generate school fee committed outgoings.
            Fees are projected with per-child inflation rates in the lifetime cash flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Children</p>
              <p className="text-2xl font-bold tabular-nums">{children.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Currently in school</p>
              <p className="text-2xl font-bold tabular-nums">{childrenInSchool}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current annual fees</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalAnnualFees)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total projected cost</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalProjectedCost)}</p>
            </div>
          </div>
          {totalProjectedCost > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Total projected cost includes fee inflation over remaining school years.
              School fee outgoings are automatically created in the Commitments tab.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Child cards */}
      {children.map((child) => {
        const age = calculateAge(child.dateOfBirth);
        const yearsRemaining = calculateSchoolYearsRemaining(child);
        const projectedCost = calculateTotalSchoolFeeCost(child);
        const inSchool = age >= child.schoolStartAge && age < child.schoolEndAge;
        const notStarted = age < child.schoolStartAge;

        return (
          <Card key={child.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {child.name || "New child"}
                  </span>
                  {age >= 0 && (
                    <Badge variant="outline">Age {age}</Badge>
                  )}
                  {inSchool && (
                    <Badge variant="default">In school</Badge>
                  )}
                  {notStarted && (
                    <Badge variant="secondary">Starts in {child.schoolStartAge - age} yr{child.schoolStartAge - age !== 1 ? "s" : ""}</Badge>
                  )}
                  {yearsRemaining === 0 && age >= child.schoolEndAge && (
                    <Badge variant="outline">Finished</Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeChild(child.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {renderField("Name", (
                  <Input
                    value={child.name}
                    onChange={(e) => updateChild(child.id, "name", e.target.value)}
                    placeholder="e.g. Arjun"
                  />
                ))}

                {renderField("Date of birth", (
                  <Input
                    type="date"
                    value={child.dateOfBirth}
                    onChange={(e) => updateChild(child.id, "dateOfBirth", e.target.value)}
                  />
                ))}

                {renderField("Annual school fee (today's cost)", (
                  <Input
                    type="number"
                    min={0}
                    step={100}
                    value={child.schoolFeeAnnual || ""}
                    onChange={(e) => updateChild(child.id, "schoolFeeAnnual", Number(e.target.value))}
                    placeholder="e.g. 18000"
                  />
                ), "Current annual cost in today's money")}

                {renderField("Fee inflation rate (%)", (
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={child.feeInflationRate ? (child.feeInflationRate * 100).toFixed(1) : ""}
                    onChange={(e) => updateChild(child.id, "feeInflationRate", Number(e.target.value) / 100)}
                    placeholder="e.g. 5"
                  />
                ), "Expected annual fee increase (UK average ~5%)")}

                {renderField("School start age", (
                  <Input
                    type="number"
                    min={0}
                    max={18}
                    value={child.schoolStartAge}
                    onChange={(e) => updateChild(child.id, "schoolStartAge", Number(e.target.value))}
                  />
                ), "Age when private school starts (e.g. 4 for reception)")}

                {renderField("School end age", (
                  <Input
                    type="number"
                    min={0}
                    max={25}
                    value={child.schoolEndAge}
                    onChange={(e) => updateChild(child.id, "schoolEndAge", Number(e.target.value))}
                  />
                ), "Age when school ends (e.g. 18 for sixth form)")}
              </div>

              {/* Per-child projections */}
              {child.schoolFeeAnnual > 0 && yearsRemaining > 0 && (
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground border-t pt-3">
                  <span>{yearsRemaining} school year{yearsRemaining !== 1 ? "s" : ""} remaining</span>
                  <span>Projected total: {formatCurrency(projectedCost)}</span>
                  <span>Termly cost: {formatCurrency(child.schoolFeeAnnual / 3)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Button onClick={addChild} className="gap-2">
        <Plus className="size-4" />
        Add Child
      </Button>
    </div>
  );
}
