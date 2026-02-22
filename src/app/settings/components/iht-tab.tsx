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
import type { Gift, Property, HouseholdData } from "@/types";
import { clone, setField, renderField } from "./field-helpers";
import { formatCurrency } from "@/lib/format";

interface IhtTabProps {
  household: HouseholdData;
  updateHousehold: (data: HouseholdData) => void;
}

export function IhtTab({ household, updateHousehold }: IhtTabProps) {
  function updateIHT(field: string, value: number | boolean) {
    const updated = clone(household);
    setField(updated.iht, field as keyof typeof updated.iht, value);
    updateHousehold(updated);
  }

  function updateGift(index: number, field: keyof Gift, value: string | number) {
    const updated = clone(household);
    setField(updated.iht.gifts[index], field, value);
    updateHousehold(updated);
  }

  function addGift() {
    const updated = clone(household);
    updated.iht.gifts.push({
      id: `gift-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      amount: 0,
      recipient: "",
      description: "",
    });
    updateHousehold(updated);
  }

  function removeGift(index: number) {
    const updated = clone(household);
    updated.iht.gifts.splice(index, 1);
    updateHousehold(updated);
  }

  // --- Property CRUD ---

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
        Properties, mortgages, and gift records for inheritance tax estimates under the 7-year rule.
      </p>

      {/* Properties */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Properties</CardTitle>
              <CardDescription>
                Add properties and outstanding mortgages. Net equity is included in your total net worth and estate value.
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
                    "Mortgage Balance",
                    <Input
                      type="number"
                      step="1000"
                      value={prop.mortgageBalance}
                      onChange={(e) =>
                        updateProperty(pIdx, "mortgageBalance", Number(e.target.value))
                      }
                      placeholder="0"
                    />,
                    "Outstanding mortgage (0 if none)"
                  )}
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

      {/* IHT Config */}
      <Card>
        <CardHeader>
          <CardTitle>Estate</CardTitle>
          <CardDescription>
            Nil-rate band is £325,000 + £175,000 residence nil-rate band if passing
            to direct descendants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderField(
              "Passing to Direct Descendants",
              <div className="flex items-center gap-2 h-9">
                <input
                  type="checkbox"
                  id="passingToDirectDescendants"
                  checked={household.iht.passingToDirectDescendants}
                  onChange={(e) =>
                    updateIHT("passingToDirectDescendants", e.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="passingToDirectDescendants" className="text-sm font-normal">
                  {household.iht.passingToDirectDescendants ? "Yes" : "No"}
                </Label>
              </div>,
              "Enables the £175,000 residence nil-rate band"
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gifts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gifts</CardTitle>
              <CardDescription>
                Gifts become exempt from IHT after 7 years. Track them here.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addGift}>
              + Add Gift
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {household.iht.gifts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No gifts recorded.
            </p>
          )}
          {household.iht.gifts.map((gift, gIdx) => (
            <Card key={gift.id} className="border-dashed">
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {renderField(
                    "Date",
                    <Input
                      type="date"
                      value={gift.date}
                      onChange={(e) => updateGift(gIdx, "date", e.target.value)}
                    />
                  )}
                  {renderField(
                    "Amount",
                    <Input
                      type="number"
                      step="0.01"
                      value={gift.amount}
                      onChange={(e) =>
                        updateGift(gIdx, "amount", Number(e.target.value))
                      }
                      placeholder="0.00"
                    />
                  )}
                  {renderField(
                    "Recipient",
                    <Input
                      value={gift.recipient}
                      onChange={(e) => updateGift(gIdx, "recipient", e.target.value)}
                      placeholder="Recipient name"
                    />
                  )}
                  {renderField(
                    "Description",
                    <Input
                      value={gift.description}
                      onChange={(e) =>
                        updateGift(gIdx, "description", e.target.value)
                      }
                      placeholder="Description"
                    />
                  )}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeGift(gIdx)}
                  >
                    Remove Gift
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
