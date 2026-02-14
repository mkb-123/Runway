"use client";

import { useData } from "@/context/data-context";
import { clone, setField, renderField, PENSION_METHOD_LABELS } from "./helpers";
import type { PersonIncome, BonusStructure, DeferredBonusTranche } from "@/types";
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

export function IncomeTab() {
  const { household, updateHousehold } = useData();

  function updateIncome(index: number, field: keyof PersonIncome, value: string | number) {
    const updated = clone(household);
    setField(updated.income[index], field, value);
    updateHousehold(updated);
  }

  function updateBonus(index: number, field: keyof BonusStructure, value: number) {
    const updated = clone(household);
    setField(updated.bonusStructures[index], field, value);
    updateHousehold(updated);
  }

  function updateTranche(bonusIndex: number, trancheIndex: number, field: keyof DeferredBonusTranche, value: string | number) {
    const updated = clone(household);
    setField(updated.bonusStructures[bonusIndex].deferredTranches[trancheIndex], field, value);
    updateHousehold(updated);
  }

  function addTranche(bonusIndex: number) {
    const updated = clone(household);
    updated.bonusStructures[bonusIndex].deferredTranches.push({
      grantDate: new Date().toISOString().split("T")[0],
      vestingDate: new Date().toISOString().split("T")[0],
      amount: 0,
      estimatedAnnualReturn: 0.08,
    });
    updateHousehold(updated);
  }

  function removeTranche(bonusIndex: number, trancheIndex: number) {
    const updated = clone(household);
    updated.bonusStructures[bonusIndex].deferredTranches.splice(trancheIndex, 1);
    updateHousehold(updated);
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Enter salary, pension contributions, and bonus details. Used for tax calculations and income projections.
      </p>
      {household.persons.map((person) => {
        const incomeIdx = household.income.findIndex((i) => i.personId === person.id);
        const income = incomeIdx >= 0 ? household.income[incomeIdx] : null;
        const bonusIdx = household.bonusStructures.findIndex((b) => b.personId === person.id);
        const bonus = bonusIdx >= 0 ? household.bonusStructures[bonusIdx] : null;

        return (
          <Card key={person.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {person.name || "Unnamed"}
                <Badge variant="secondary">Income</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {income && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderField("Gross Salary",
                    <Input type="number" step="0.01" value={income.grossSalary} onChange={(e) => updateIncome(incomeIdx, "grossSalary", Number(e.target.value))} placeholder="0.00" />
                  )}
                  {renderField("Employer Pension Contribution",
                    <Input type="number" step="0.01" value={income.employerPensionContribution} onChange={(e) => updateIncome(incomeIdx, "employerPensionContribution", Number(e.target.value))} placeholder="0.00" />
                  )}
                  {renderField("Employee Pension Contribution",
                    <Input type="number" step="0.01" value={income.employeePensionContribution} onChange={(e) => updateIncome(incomeIdx, "employeePensionContribution", Number(e.target.value))} placeholder="0.00" />
                  )}
                  {renderField("Pension Method",
                    <Select value={income.pensionContributionMethod} onValueChange={(val) => updateIncome(incomeIdx, "pensionContributionMethod", val)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PENSION_METHOD_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Bonus Structure */}
              {bonus && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bonus Structure</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderField("Cash Bonus (Annual)",
                      <Input type="number" step="0.01" value={bonus.cashBonusAnnual} onChange={(e) => updateBonus(bonusIdx, "cashBonusAnnual", Number(e.target.value))} placeholder="0.00" />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-medium">Deferred Tranches</h5>
                      <Button variant="outline" size="sm" onClick={() => addTranche(bonusIdx)}>+ Add Tranche</Button>
                    </div>
                    {bonus.deferredTranches.length === 0 && (
                      <p className="text-sm text-muted-foreground">No deferred tranches.</p>
                    )}
                    {bonus.deferredTranches.map((tranche, tIdx) => (
                      <Card key={`${person.id}-tranche-${tIdx}`} className="border-dashed">
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {renderField("Grant Date",
                              <Input type="date" value={tranche.grantDate} onChange={(e) => updateTranche(bonusIdx, tIdx, "grantDate", e.target.value)} />
                            )}
                            {renderField("Vesting Date",
                              <Input type="date" value={tranche.vestingDate} onChange={(e) => updateTranche(bonusIdx, tIdx, "vestingDate", e.target.value)} />
                            )}
                            {renderField("Amount",
                              <Input type="number" step="0.01" value={tranche.amount} onChange={(e) => updateTranche(bonusIdx, tIdx, "amount", Number(e.target.value))} placeholder="0.00" />
                            )}
                            {renderField("Est. Annual Return",
                              <Input type="number" step="0.01" value={Math.round(tranche.estimatedAnnualReturn * 100 * 100) / 100} onChange={(e) => updateTranche(bonusIdx, tIdx, "estimatedAnnualReturn", Number(e.target.value) / 100)} placeholder="8" />
                            )}
                          </div>
                          <div className="mt-3 flex justify-end">
                            <Button variant="destructive" size="sm" onClick={() => removeTranche(bonusIdx, tIdx)}>Remove Tranche</Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
