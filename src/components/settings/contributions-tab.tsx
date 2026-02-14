"use client";

import { useData } from "@/context/data-context";
import { clone, setField, renderField } from "./helpers";
import type { AnnualContributions } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function ContributionsTab() {
  const { household, updateHousehold } = useData();

  function updateContribution(index: number, field: keyof AnnualContributions, value: number) {
    const updated = clone(household);
    setField(updated.annualContributions[index], field, value);
    updateHousehold(updated);
  }

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
    <>
      <p className="text-sm text-muted-foreground">
        Set annual saving targets, retirement goals, and emergency fund parameters. These drive projections and recommendations.
      </p>

      {/* Annual Contributions per person */}
      {household.persons.map((person) => {
        const contribIdx = household.annualContributions.findIndex((c) => c.personId === person.id);
        const contrib = contribIdx >= 0 ? household.annualContributions[contribIdx] : null;
        if (!contrib) return null;

        return (
          <Card key={person.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {person.name || "Unnamed"}
                <Badge variant="secondary">Annual Contributions</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderField("ISA Contribution",
                  <Input type="number" step="0.01" value={contrib.isaContribution} onChange={(e) => updateContribution(contribIdx, "isaContribution", Number(e.target.value))} placeholder="0.00" />
                )}
                {renderField("Pension Contribution",
                  <Input type="number" step="0.01" value={contrib.pensionContribution} onChange={(e) => updateContribution(contribIdx, "pensionContribution", Number(e.target.value))} placeholder="0.00" />
                )}
                {renderField("GIA Contribution",
                  <Input type="number" step="0.01" value={contrib.giaContribution} onChange={(e) => updateContribution(contribIdx, "giaContribution", Number(e.target.value))} placeholder="0.00" />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Retirement Config */}
      <Card>
        <CardHeader>
          <CardTitle>Retirement Configuration</CardTitle>
          <CardDescription>Set your retirement income goals and withdrawal strategy.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderField("Target Annual Income",
              <Input type="number" step="0.01" value={household.retirement.targetAnnualIncome} onChange={(e) => updateRetirement("targetAnnualIncome", Number(e.target.value))} placeholder="0.00" />
            )}
            {renderField("Withdrawal Rate (%)",
              <Input type="number" step="0.01" value={Math.round(household.retirement.withdrawalRate * 100 * 100) / 100} onChange={(e) => updateRetirement("withdrawalRate", Number(e.target.value) / 100)} placeholder="4" />
            )}
            {renderField("Include State Pension",
              <div className="flex items-center gap-2 h-9">
                <input
                  type="checkbox"
                  id="includeStatePension"
                  checked={household.retirement.includeStatePension}
                  onChange={(e) => updateRetirement("includeStatePension", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="includeStatePension" className="text-sm font-normal">
                  {household.retirement.includeStatePension ? "Yes" : "No"}
                </Label>
              </div>
            )}
            {renderField("Scenario Rate 1 (%)",
              <Input type="number" step="0.01" value={household.retirement.scenarioRates[0] !== undefined ? Math.round(household.retirement.scenarioRates[0] * 100 * 100) / 100 : ""} onChange={(e) => updateScenarioRate(0, Number(e.target.value) / 100)} placeholder="5" />
            )}
            {renderField("Scenario Rate 2 (%)",
              <Input type="number" step="0.01" value={household.retirement.scenarioRates[1] !== undefined ? Math.round(household.retirement.scenarioRates[1] * 100 * 100) / 100 : ""} onChange={(e) => updateScenarioRate(1, Number(e.target.value) / 100)} placeholder="7" />
            )}
            {renderField("Scenario Rate 3 (%)",
              <Input type="number" step="0.01" value={household.retirement.scenarioRates[2] !== undefined ? Math.round(household.retirement.scenarioRates[2] * 100 * 100) / 100 : ""} onChange={(e) => updateScenarioRate(2, Number(e.target.value) / 100)} placeholder="9" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Fund */}
      <Card>
        <CardHeader>
          <CardTitle>Emergency Fund</CardTitle>
          <CardDescription>Configure your emergency fund target based on monthly expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderField("Monthly Essential Expenses",
              <Input type="number" step="0.01" value={household.emergencyFund.monthlyEssentialExpenses} onChange={(e) => updateEmergencyFund("monthlyEssentialExpenses", Number(e.target.value))} placeholder="0.00" />
            )}
            {renderField("Target Months",
              <Input type="number" value={household.emergencyFund.targetMonths} onChange={(e) => updateEmergencyFund("targetMonths", Number(e.target.value))} placeholder="6" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Estimated Annual Expenses */}
      <Card>
        <CardHeader>
          <CardTitle>Annual Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderField("Estimated Annual Expenses",
              <Input type="number" step="0.01" value={household.estimatedAnnualExpenses} onChange={(e) => updateEstimatedAnnualExpenses(Number(e.target.value))} placeholder="0.00" />
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
