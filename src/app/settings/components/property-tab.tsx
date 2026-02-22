"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { Property, HouseholdData } from "@/types";
import { clone, setField, renderField } from "./field-helpers";
import { formatCurrency } from "@/lib/format";

interface PropertyTabProps {
  household: HouseholdData;
  updateHousehold: (data: HouseholdData) => void;
}

export function PropertyTab({ household, updateHousehold }: PropertyTabProps) {
  function updateProperty(index: number, field: keyof Property, value: string | number | string[]) {
    const updated = clone(household);
    setField(updated.properties[index], field, value);
    updateHousehold(updated);
  }

  function addProperty() {
    const updated = clone(household);
    const ownerIds = household.persons.map((p) => p.id);
    updated.properties.push({
      id: `property-${Date.now()}`,
      label: "Property",
      estimatedValue: 0,
      ownerPersonIds: ownerIds,
      mortgageBalance: 0,
    });
    updateHousehold(updated);
  }

  function removeProperty(index: number) {
    const updated = clone(household);
    updated.properties.splice(index, 1);
    updateHousehold(updated);
  }

  function togglePropertyOwner(propIndex: number, personId: string) {
    const updated = clone(household);
    const prop = updated.properties[propIndex];
    if (prop.ownerPersonIds.includes(personId)) {
      prop.ownerPersonIds = prop.ownerPersonIds.filter((id) => id !== personId);
    } else {
      prop.ownerPersonIds = [...prop.ownerPersonIds, personId];
    }
    updateHousehold(updated);
  }

  const totalPropertyValue = household.properties.reduce((s, p) => s + p.estimatedValue, 0);
  const totalMortgage = household.properties.reduce((s, p) => s + p.mortgageBalance, 0);
  const totalEquity = Math.max(0, totalPropertyValue - totalMortgage);

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Properties and mortgages. Net equity is included in your total net worth and estate value for IHT.
      </p>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Properties</CardTitle>
              <CardDescription>
                Add properties with optional mortgage details for amortization projections.
                {household.properties.length > 0 && (
                  <span className="block mt-1 text-foreground font-medium">
                    Total: {formatCurrency(totalPropertyValue)} value · {formatCurrency(totalMortgage)} mortgage · {formatCurrency(totalEquity)} equity
                  </span>
                )}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addProperty}>
              + Add Property
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {household.properties.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No properties recorded. Add a property to include it in your net worth and estate calculations.
            </p>
          )}
          {household.properties.map((prop, pIdx) => (
            <Card key={prop.id} className="border-dashed">
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderField(
                    "Label",
                    <Input
                      value={prop.label}
                      onChange={(e) => updateProperty(pIdx, "label", e.target.value)}
                      placeholder="e.g. Primary Residence"
                    />
                  )}
                  {renderField(
                    "Estimated Value",
                    <Input
                      type="number"
                      step="1000"
                      value={prop.estimatedValue}
                      onChange={(e) =>
                        updateProperty(pIdx, "estimatedValue", Number(e.target.value))
                      }
                      placeholder="0"
                    />,
                    "Current market value"
                  )}
                  {renderField(
                    "Annual Appreciation Rate (%)",
                    <Input
                      type="number"
                      step="0.5"
                      value={((prop.appreciationRate ?? 0) * 100).toFixed(1)}
                      onChange={(e) =>
                        updateProperty(pIdx, "appreciationRate", Number(e.target.value) / 100)
                      }
                      placeholder="e.g. 3.0"
                    />,
                    "Expected annual property price growth"
                  )}
                </div>

                {/* Mortgage section */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-3">Mortgage</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {renderField(
                      "Outstanding Balance",
                      <Input
                        type="number"
                        step="1000"
                        value={prop.mortgageBalance}
                        onChange={(e) =>
                          updateProperty(pIdx, "mortgageBalance", Number(e.target.value))
                        }
                        placeholder="0"
                      />,
                      "Current mortgage balance"
                    )}
                    {renderField(
                      "Interest Rate (%)",
                      <Input
                        type="number"
                        step="0.1"
                        value={prop.mortgageRate !== undefined ? (prop.mortgageRate * 100).toFixed(2) : ""}
                        onChange={(e) =>
                          updateProperty(pIdx, "mortgageRate", e.target.value ? Number(e.target.value) / 100 : 0)
                        }
                        placeholder="e.g. 4.2"
                      />,
                      "Annual mortgage interest rate"
                    )}
                    {renderField(
                      "Term (years)",
                      <Input
                        type="number"
                        step="1"
                        value={prop.mortgageTerm ?? ""}
                        onChange={(e) =>
                          updateProperty(pIdx, "mortgageTerm", e.target.value ? Number(e.target.value) : 0)
                        }
                        placeholder="e.g. 25"
                      />,
                      "Original mortgage term in years"
                    )}
                    {renderField(
                      "Start Date",
                      <Input
                        type="date"
                        value={prop.mortgageStartDate ?? ""}
                        onChange={(e) =>
                          updateProperty(pIdx, "mortgageStartDate", e.target.value)
                        }
                      />,
                      "When mortgage payments began"
                    )}
                  </div>
                </div>

                {household.persons.length > 1 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1.5">Owners</p>
                    <div className="flex flex-wrap gap-2">
                      {household.persons.map((person) => {
                        const isOwner = prop.ownerPersonIds.includes(person.id);
                        return (
                          <button
                            key={person.id}
                            onClick={() => togglePropertyOwner(pIdx, person.id)}
                            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                              isOwner
                                ? "border-primary bg-primary/10 text-primary font-medium"
                                : "border-border text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {person.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeProperty(pIdx)}
                  >
                    Remove Property
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
