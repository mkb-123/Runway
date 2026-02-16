"use client";

import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
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
import type { HouseholdData } from "@/types";
import { clone, setField, renderField } from "./field-helpers";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface PlanningTabProps {
  household: HouseholdData;
  updateHousehold: (data: HouseholdData) => void;
}

export function PlanningTab({ household, updateHousehold }: PlanningTabProps) {
  function updateRetirement(field: string, value: number | boolean) {
    const updated = clone(household);
    setField(updated.retirement, field as keyof typeof updated.retirement, value);
    updateHousehold(updated);
  }

  function updateScenarioRate(index: number, value: number) {
    const updated = clone(household);
    updated.retirement.scenarioRates[index] = value;
    updateHousehold(updated);
  }

  function addScenarioRate() {
    const updated = clone(household);
    const rates = updated.retirement.scenarioRates;
    if (rates.length >= 10) return;
    const lastRate = rates[rates.length - 1] ?? 0;
    updated.retirement.scenarioRates = [...rates, lastRate + 0.02];
    updateHousehold(updated);
  }

  function removeScenarioRate(index: number) {
    const updated = clone(household);
    if (updated.retirement.scenarioRates.length <= 1) return;
    updated.retirement.scenarioRates = updated.retirement.scenarioRates.filter(
      (_: number, i: number) => i !== index
    );
    updateHousehold(updated);
  }

  function updateEmergencyFund(field: string, value: number) {
    const updated = clone(household);
    setField(updated.emergencyFund, field as keyof typeof updated.emergencyFund, value);
    updateHousehold(updated);
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Retirement targets, projection assumptions, and emergency fund settings.
          These drive all projection and recommendation calculations.
        </p>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="text-muted-foreground">Shown on:</span>
          <Link href="/retirement" className="text-primary hover:underline flex items-center gap-0.5">
            Retirement <ArrowRight className="size-3" />
          </Link>
          <Link href="/income" className="text-primary hover:underline flex items-center gap-0.5">
            Income <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Retirement Config */}
      <Card>
        <CardHeader>
          <CardTitle>Retirement</CardTitle>
          <CardDescription>
            Set your target retirement income and withdrawal strategy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderField(
              "Target Annual Income",
              <div className="space-y-2">
                <Input
                  type="number"
                  step="1000"
                  value={household.retirement.targetAnnualIncome}
                  onChange={(e) =>
                    updateRetirement("targetAnnualIncome", Number(e.target.value))
                  }
                  placeholder="0.00"
                />
                <input
                  type="range"
                  min={10000}
                  max={200000}
                  step={1000}
                  value={household.retirement.targetAnnualIncome}
                  onChange={(e) =>
                    updateRetirement("targetAnnualIncome", Number(e.target.value))
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                  <span>£10k</span>
                  <span>£200k</span>
                </div>
              </div>,
              "How much you want to spend per year in retirement (today's money)"
            )}
            {renderField(
              "Withdrawal Rate (%)",
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={
                  Math.round(household.retirement.withdrawalRate * 100 * 100) / 100
                }
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val > 0) updateRetirement("withdrawalRate", val / 100);
                }}
                placeholder="4"
              />,
              "The 4% rule is a common starting point (must be greater than 0)"
            )}
            {renderField(
              "Include State Pension",
              <div className="flex items-center gap-2 h-9">
                <input
                  type="checkbox"
                  id="includeStatePension"
                  checked={household.retirement.includeStatePension}
                  onChange={(e) =>
                    updateRetirement("includeStatePension", e.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="includeStatePension" className="text-sm font-normal">
                  {household.retirement.includeStatePension ? "Yes" : "No"}
                </Label>
              </div>,
              `Full new state pension is £${UK_TAX_CONSTANTS.statePension.fullNewStatePensionWeekly.toFixed(2)}/week`
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scenario Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Growth Scenarios</CardTitle>
          <CardDescription>
            Return assumptions for projections (nominal, before inflation). Add up to 10 scenarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {household.retirement.scenarioRates.map((rate, index) => (
              <div key={index} className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Scenario {index + 1} (%)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={Math.round(rate * 100 * 100) / 100}
                    onChange={(e) =>
                      updateScenarioRate(index, Number(e.target.value) / 100)
                    }
                    placeholder="0"
                  />
                  {household.retirement.scenarioRates.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeScenarioRate(index)}
                      aria-label={`Remove scenario ${index + 1}`}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Annual return rate
                </p>
              </div>
            ))}
          </div>
          {household.retirement.scenarioRates.length < 10 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={addScenarioRate}
            >
              Add scenario
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Emergency Fund */}
      <Card>
        <CardHeader>
          <CardTitle>Emergency Fund</CardTitle>
          <CardDescription>
            How much cash buffer you want based on monthly essential spending.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderField(
              "Monthly Essential Expenses",
              <Input
                type="number"
                step="0.01"
                value={household.emergencyFund.monthlyEssentialExpenses}
                onChange={(e) =>
                  updateEmergencyFund(
                    "monthlyEssentialExpenses",
                    Number(e.target.value)
                  )
                }
                placeholder="0.00"
              />,
              "Rent/mortgage, bills, food, insurance — what you must pay each month"
            )}
            {renderField(
              "Target Months",
              <Input
                type="number"
                value={household.emergencyFund.targetMonths}
                onChange={(e) =>
                  updateEmergencyFund("targetMonths", Number(e.target.value))
                }
                placeholder="6"
              />,
              "3-6 months is typical; more if self-employed"
            )}
            {renderField(
              "Monthly Lifestyle Spending",
              <Input
                type="number"
                step="0.01"
                value={household.emergencyFund.monthlyLifestyleSpending}
                onChange={(e) =>
                  updateEmergencyFund(
                    "monthlyLifestyleSpending",
                    Number(e.target.value)
                  )
                }
                placeholder="0.00"
              />,
              "Groceries, transport, leisure — everything not in committed outgoings"
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
