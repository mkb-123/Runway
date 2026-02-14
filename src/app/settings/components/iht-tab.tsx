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
import type { Gift, HouseholdData } from "@/types";
import { clone, setField, renderField } from "./field-helpers";

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

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Property value and gift records for inheritance tax estimates under the 7-year rule.
      </p>

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
              "Estimated Property Value",
              <Input
                type="number"
                step="0.01"
                value={household.iht.estimatedPropertyValue}
                onChange={(e) =>
                  updateIHT("estimatedPropertyValue", Number(e.target.value))
                }
                placeholder="0.00"
              />,
              "Main residence value for IHT calculations"
            )}
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
