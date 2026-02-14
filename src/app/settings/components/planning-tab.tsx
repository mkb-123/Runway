"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { HouseholdData } from "@/types";
import { clone, setField, renderField } from "./field-helpers";

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

  function updateEmergencyFund(field: string, value: number) {
    const updated = clone(household);
    setField(updated.emergencyFund, field as keyof typeof updated.emergencyFund, value);
    updateHousehold(updated);
  }

  function updateEstimatedAnnualExpenses(value: number) {
    const updated = clone(household);
    updated.estimatedAnnualExpenses = value;
    updateHousehold(updated);
  }

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Retirement targets, projection assumptions, and emergency fund settings.
        These drive all projection and recommendation calculations.
      </p>

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
              <Input
                type="number"
                step="0.01"
                value={household.retirement.targetAnnualIncome}
                onChange={(e) =>
                  updateRetirement("targetAnnualIncome", Number(e.target.value))
                }
                placeholder="0.00"
              />,
              "How much you want to spend per year in retirement (today's money)"
            )}
            {renderField(
              "Withdrawal Rate (%)",
              <Input
                type="number"
                step="0.01"
                value={
                  Math.round(household.retirement.withdrawalRate * 100 * 100) / 100
                }
                onChange={(e) =>
                  updateRetirement("withdrawalRate", Number(e.target.value) / 100)
                }
                placeholder="4"
              />,
              "The 4% rule is a common starting point"
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
              "Full new state pension is £221.20/week (2024-25)"
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scenario Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Growth Scenarios</CardTitle>
          <CardDescription>
            Three return assumptions for pessimistic, expected, and optimistic projections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {renderField(
              "Pessimistic (%)",
              <Input
                type="number"
                step="0.01"
                value={
                  household.retirement.scenarioRates[0] !== undefined
                    ? Math.round(household.retirement.scenarioRates[0] * 100 * 100) / 100
                    : ""
                }
                onChange={(e) => updateScenarioRate(0, Number(e.target.value) / 100)}
                placeholder="5"
              />,
              "Low-growth scenario"
            )}
            {renderField(
              "Expected (%)",
              <Input
                type="number"
                step="0.01"
                value={
                  household.retirement.scenarioRates[1] !== undefined
                    ? Math.round(household.retirement.scenarioRates[1] * 100 * 100) / 100
                    : ""
                }
                onChange={(e) => updateScenarioRate(1, Number(e.target.value) / 100)}
                placeholder="7"
              />,
              "Base case scenario"
            )}
            {renderField(
              "Optimistic (%)",
              <Input
                type="number"
                step="0.01"
                value={
                  household.retirement.scenarioRates[2] !== undefined
                    ? Math.round(household.retirement.scenarioRates[2] * 100 * 100) / 100
                    : ""
                }
                onChange={(e) => updateScenarioRate(2, Number(e.target.value) / 100)}
                placeholder="9"
              />,
              "High-growth scenario"
            )}
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>
        </CardContent>
      </Card>

      {/* Annual Expenses */}
      <Card>
        <CardHeader>
          <CardTitle>Annual Expenses</CardTitle>
          <CardDescription>
            Total household spending used for savings rate and retirement calculations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderField(
              "Estimated Annual Expenses",
              <Input
                type="number"
                step="0.01"
                value={household.estimatedAnnualExpenses}
                onChange={(e) =>
                  updateEstimatedAnnualExpenses(Number(e.target.value))
                }
                placeholder="0.00"
              />,
              "Total spending per year including discretionary"
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
