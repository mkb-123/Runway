"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  Person,
  Account,
  PersonIncome,
  BonusStructure,
  DeferredBonusTranche,
  Contribution,
  ContributionTarget,
  ContributionFrequency,
  StudentLoanPlan,
  HouseholdData,
} from "@/types";
import {
  CONTRIBUTION_TARGET_LABELS,
  CONTRIBUTION_FREQUENCY_LABELS,
} from "@/types";
import { clone, setField, renderField } from "./field-helpers";
import { FieldWarning } from "./field-warning";

const STUDENT_LOAN_LABELS: Record<StudentLoanPlan, string> = {
  none: "None",
  plan1: "Plan 1",
  plan2: "Plan 2",
  plan4: "Plan 4",
  plan5: "Plan 5",
  postgrad: "Postgraduate",
};

const PENSION_METHOD_LABELS: Record<string, string> = {
  salary_sacrifice: "Salary Sacrifice",
  net_pay: "Net Pay",
  relief_at_source: "Relief at Source",
};

function SectionHeader({ title }: { title: string }) {
  return (
    <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
      {title}
      <ChevronDown className="size-4 transition-transform [[data-state=open]_&]:rotate-180" />
    </CollapsibleTrigger>
  );
}

interface HouseholdTabProps {
  household: HouseholdData;
  updateHousehold: (data: HouseholdData) => void;
}

export function HouseholdTab({ household, updateHousehold }: HouseholdTabProps) {
  // ----------------------------------------------------------
  // Person helpers
  // ----------------------------------------------------------

  function updatePerson(index: number, field: keyof Person, value: string | number) {
    const updated = clone(household);
    setField(updated.persons[index], field, value);
    updateHousehold(updated);
  }

  function addPerson() {
    const updated = clone(household);
    const newPerson: Person = {
      id: `person-${Date.now()}`,
      name: "",
      relationship: "spouse",
      dateOfBirth: "1990-01-01",
      pensionAccessAge: 57,
      stateRetirementAge: 67,
      niQualifyingYears: 0,
      studentLoanPlan: "none",
    };
    updated.persons.push(newPerson);
    updated.income.push({
      personId: newPerson.id,
      grossSalary: 0,
      employerPensionContribution: 0,
      employeePensionContribution: 0,
      pensionContributionMethod: "salary_sacrifice",
    });
    updated.bonusStructures.push({
      personId: newPerson.id,
      cashBonusAnnual: 0,
      deferredTranches: [],
    });
    // No default contributions — user adds them explicitly
    updateHousehold(updated);
  }

  function removePerson(index: number) {
    const updated = clone(household);
    const personId = updated.persons[index].id;
    updated.persons.splice(index, 1);
    updated.accounts = updated.accounts.filter((a: Account) => a.personId !== personId);
    updated.income = updated.income.filter((i: PersonIncome) => i.personId !== personId);
    updated.bonusStructures = updated.bonusStructures.filter(
      (b: BonusStructure) => b.personId !== personId
    );
    updated.contributions = updated.contributions.filter(
      (c: Contribution) => c.personId !== personId
    );
    updateHousehold(updated);
  }

  // ----------------------------------------------------------
  // Income helpers
  // ----------------------------------------------------------

  function updateIncome(index: number, field: keyof PersonIncome, value: string | number) {
    const updated = clone(household);
    setField(updated.income[index], field, value);
    updateHousehold(updated);
  }

  // ----------------------------------------------------------
  // Bonus helpers
  // ----------------------------------------------------------

  function updateBonus(index: number, field: keyof BonusStructure, value: number) {
    const updated = clone(household);
    setField(updated.bonusStructures[index], field, value);
    updateHousehold(updated);
  }

  function updateTranche(
    bonusIndex: number,
    trancheIndex: number,
    field: keyof DeferredBonusTranche,
    value: string | number
  ) {
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

  // ----------------------------------------------------------
  // Contribution helpers
  // ----------------------------------------------------------

  function addContribution(personId: string) {
    const updated = clone(household);
    updated.contributions.push({
      id: `contrib-${Date.now()}`,
      personId,
      label: "",
      target: "isa" as ContributionTarget,
      amount: 0,
      frequency: "monthly" as ContributionFrequency,
    });
    updateHousehold(updated);
  }

  function updateContributionField(
    contribId: string,
    field: keyof Contribution,
    value: string | number
  ) {
    const updated = clone(household);
    const contrib = updated.contributions.find((c: Contribution) => c.id === contribId);
    if (contrib) {
      setField(contrib, field, value);
      updateHousehold(updated);
    }
  }

  function removeContribution(contribId: string) {
    const updated = clone(household);
    updated.contributions = updated.contributions.filter(
      (c: Contribution) => c.id !== contribId
    );
    updateHousehold(updated);
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  // eslint-disable-next-line react-hooks/rules-of-hooks -- component, not conditional
  const [selectedPersonIdx, setSelectedPersonIdx] = useState(0);

  // Clamp index if persons list shrinks
  const clampedIdx = Math.min(selectedPersonIdx, Math.max(0, household.persons.length - 1));

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Each person&apos;s details, income, and contribution targets in one place.
      </p>

      {/* Person selector — avoids scrolling past everyone */}
      {household.persons.length > 1 && (
        <div
          className="inline-flex items-center rounded-lg bg-muted p-1 text-sm"
          role="tablist"
          aria-label="Person selector"
        >
          {household.persons.map((p, idx) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={clampedIdx === idx}
              onClick={() => setSelectedPersonIdx(idx)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                "min-h-[36px] min-w-[44px]",
                clampedIdx === idx
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.name || "New Person"}
            </button>
          ))}
        </div>
      )}

      {household.persons.filter((_, idx) =>
        household.persons.length <= 1 || idx === clampedIdx
      ).map((person) => {
        const pIdx = household.persons.indexOf(person);
        const incomeIdx = household.income.findIndex((i) => i.personId === person.id);
        const income = incomeIdx >= 0 ? household.income[incomeIdx] : null;
        const bonusIdx = household.bonusStructures.findIndex((b) => b.personId === person.id);
        const bonus = bonusIdx >= 0 ? household.bonusStructures[bonusIdx] : null;
        const personContributions = household.contributions.filter(
          (c) => c.personId === person.id
        );

        const accountCount = household.accounts.filter(
          (a) => a.personId === person.id
        ).length;

        return (
          <Card key={person.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {person.name || "New Person"}
                  <Badge variant="secondary">
                    {person.relationship === "self" ? "Self" : "Spouse"}
                  </Badge>
                  <span className="text-sm font-normal text-muted-foreground">
                    {accountCount} account{accountCount !== 1 ? "s" : ""}
                  </span>
                </CardTitle>
                {household.persons.length > 1 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removePerson(pIdx)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Personal Details — always open */}
              <Collapsible defaultOpen>
                <SectionHeader title="Personal Details" />
                <CollapsibleContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 pb-4">
                    {renderField(
                      "Name",
                      <Input
                        value={person.name}
                        onChange={(e) => updatePerson(pIdx, "name", e.target.value)}
                        placeholder="Full name"
                      />
                    )}
                    {renderField(
                      "Date of Birth",
                      <Input
                        type="date"
                        value={person.dateOfBirth}
                        onChange={(e) => updatePerson(pIdx, "dateOfBirth", e.target.value)}
                      />
                    )}
                    {renderField(
                      "Pension Access Age",
                      <>
                        <Input
                          type="number"
                          value={person.pensionAccessAge}
                          onChange={(e) =>
                            updatePerson(pIdx, "pensionAccessAge", Number(e.target.value))
                          }
                        />
                        <FieldWarning
                          value={person.pensionAccessAge}
                          min={50}
                          max={75}
                          label="pension access age"
                        />
                      </>,
                      "Earliest age you can draw private pension (currently 57)"
                    )}
                    {renderField(
                      "State Retirement Age",
                      <>
                        <Input
                          type="number"
                          value={person.stateRetirementAge}
                          onChange={(e) =>
                            updatePerson(pIdx, "stateRetirementAge", Number(e.target.value))
                          }
                        />
                        <FieldWarning
                          value={person.stateRetirementAge}
                          min={60}
                          max={75}
                          label="state retirement age"
                        />
                      </>,
                      "Check yours at gov.uk/state-pension-age"
                    )}
                    {renderField(
                      "NI Qualifying Years",
                      <>
                        <Input
                          type="number"
                          value={person.niQualifyingYears}
                          onChange={(e) =>
                            updatePerson(pIdx, "niQualifyingYears", Number(e.target.value))
                          }
                        />
                        <FieldWarning
                          value={person.niQualifyingYears}
                          min={0}
                          max={50}
                          label="NI qualifying years"
                        />
                      </>,
                      "Need 35 years for full state pension. Check at gov.uk/check-state-pension"
                    )}
                    {renderField(
                      "Student Loan Plan",
                      <Select
                        value={person.studentLoanPlan}
                        onValueChange={(val) => updatePerson(pIdx, "studentLoanPlan", val)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STUDENT_LOAN_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Income & Pension */}
              {income && (
                <Collapsible defaultOpen>
                  <SectionHeader title="Income & Pension" />
                  <CollapsibleContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 pb-4">
                      {renderField(
                        "Gross Salary",
                        <>
                          <Input
                            type="number"
                            step="0.01"
                            value={income.grossSalary}
                            onChange={(e) =>
                              updateIncome(incomeIdx, "grossSalary", Number(e.target.value))
                            }
                            placeholder="0.00"
                          />
                          <FieldWarning
                            value={income.grossSalary}
                            min={0}
                            max={500000}
                            label="gross salary"
                            isCurrency
                          />
                        </>,
                        "Annual salary before tax and pension deductions"
                      )}
                      {renderField(
                        "Employer Pension Contribution",
                        <>
                          <Input
                            type="number"
                            step="0.01"
                            value={income.employerPensionContribution}
                            onChange={(e) =>
                              updateIncome(
                                incomeIdx,
                                "employerPensionContribution",
                                Number(e.target.value)
                              )
                            }
                            placeholder="0.00"
                          />
                          <FieldWarning
                            value={income.employerPensionContribution}
                            min={0}
                            max={60000}
                            label="employer pension contribution"
                            isCurrency
                          />
                        </>,
                        "Annual amount your employer puts into your pension"
                      )}
                      {renderField(
                        "Employee Pension Contribution",
                        <>
                          <Input
                            type="number"
                            step="0.01"
                            value={income.employeePensionContribution}
                            onChange={(e) =>
                              updateIncome(
                                incomeIdx,
                                "employeePensionContribution",
                                Number(e.target.value)
                              )
                            }
                            placeholder="0.00"
                          />
                          <FieldWarning
                            value={income.employeePensionContribution}
                            min={0}
                            max={60000}
                            label="employee pension contribution"
                            isCurrency
                          />
                        </>,
                        "Annual amount you contribute to your pension"
                      )}
                      {renderField(
                        "Pension Method",
                        <Select
                          value={income.pensionContributionMethod}
                          onValueChange={(val) =>
                            updateIncome(incomeIdx, "pensionContributionMethod", val)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PENSION_METHOD_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>,
                        "Salary sacrifice is usually most tax-efficient"
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Bonus */}
              {bonus && (
                <Collapsible>
                  <SectionHeader title="Bonus" />
                  <CollapsibleContent>
                    <div className="pt-2 pb-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderField(
                          "Cash Bonus (Annual)",
                          <>
                            <Input
                              type="number"
                              step="0.01"
                              value={bonus.cashBonusAnnual}
                              onChange={(e) =>
                                updateBonus(bonusIdx, "cashBonusAnnual", Number(e.target.value))
                              }
                              placeholder="0.00"
                            />
                            <FieldWarning
                              value={bonus.cashBonusAnnual}
                              min={0}
                              max={500000}
                              label="annual bonus"
                              isCurrency
                            />
                          </>,
                          "Expected annual cash bonus before tax"
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-medium">Deferred Tranches</h5>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addTranche(bonusIdx)}
                          >
                            + Add Tranche
                          </Button>
                        </div>
                        {bonus.deferredTranches.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No deferred tranches.
                          </p>
                        )}
                        {bonus.deferredTranches.map((tranche, tIdx) => (
                          <Card key={`${person.id}-tranche-${tIdx}`} className="border-dashed">
                            <CardContent className="pt-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {renderField(
                                  "Grant Date",
                                  <Input
                                    type="date"
                                    value={tranche.grantDate}
                                    onChange={(e) =>
                                      updateTranche(bonusIdx, tIdx, "grantDate", e.target.value)
                                    }
                                  />
                                )}
                                {renderField(
                                  "Vesting Date",
                                  <Input
                                    type="date"
                                    value={tranche.vestingDate}
                                    onChange={(e) =>
                                      updateTranche(bonusIdx, tIdx, "vestingDate", e.target.value)
                                    }
                                  />
                                )}
                                {renderField(
                                  "Amount",
                                  <>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={tranche.amount}
                                      onChange={(e) =>
                                        updateTranche(
                                          bonusIdx,
                                          tIdx,
                                          "amount",
                                          Number(e.target.value)
                                        )
                                      }
                                      placeholder="0.00"
                                    />
                                    <FieldWarning
                                      value={tranche.amount}
                                      min={0}
                                      max={1000000}
                                      label="tranche amount"
                                      isCurrency
                                    />
                                  </>
                                )}
                                {renderField(
                                  "Est. Annual Return (%)",
                                  <>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={
                                        Math.round(tranche.estimatedAnnualReturn * 100 * 100) / 100
                                      }
                                      onChange={(e) =>
                                        updateTranche(
                                          bonusIdx,
                                          tIdx,
                                          "estimatedAnnualReturn",
                                          Number(e.target.value) / 100
                                        )
                                      }
                                      placeholder="8"
                                    />
                                    <FieldWarning
                                      value={Math.round(tranche.estimatedAnnualReturn * 100 * 100) / 100}
                                      min={-10}
                                      max={30}
                                      label="annual return"
                                      suffix="%"
                                    />
                                  </>
                                )}
                              </div>
                              <div className="mt-3 flex justify-end">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeTranche(bonusIdx, tIdx)}
                                >
                                  Remove Tranche
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Contributions */}
              <Collapsible defaultOpen>
                <SectionHeader title="Contributions" />
                <CollapsibleContent>
                  <div className="pt-2 pb-4 space-y-3">
                    {personContributions.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No contributions yet. Add ISA, pension, or GIA contributions.
                      </p>
                    )}
                    {personContributions.map((contrib) => (
                      <Card key={contrib.id} className="border-dashed">
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            {renderField(
                              "Label",
                              <Input
                                value={contrib.label}
                                onChange={(e) =>
                                  updateContributionField(contrib.id, "label", e.target.value)
                                }
                                placeholder="e.g. Monthly ISA"
                              />,
                              "A short description for this contribution"
                            )}
                            {renderField(
                              "Target",
                              <Select
                                value={contrib.target}
                                onValueChange={(val) =>
                                  updateContributionField(contrib.id, "target", val)
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(CONTRIBUTION_TARGET_LABELS).map(
                                    ([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label}
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                            {renderField(
                              "Amount",
                              <>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={contrib.amount}
                                  onChange={(e) =>
                                    updateContributionField(
                                      contrib.id,
                                      "amount",
                                      Number(e.target.value)
                                    )
                                  }
                                  placeholder="0.00"
                                />
                                <FieldWarning
                                  value={contrib.amount}
                                  min={0}
                                  max={contrib.target === "isa" ? 20000 : 500000}
                                  label="contribution amount"
                                  isCurrency
                                />
                              </>
                            )}
                            {renderField(
                              "Frequency",
                              <Select
                                value={contrib.frequency}
                                onValueChange={(val) =>
                                  updateContributionField(contrib.id, "frequency", val)
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(CONTRIBUTION_FREQUENCY_LABELS).map(
                                    ([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label}
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                            <div className="flex items-end">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeContribution(contrib.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addContribution(person.id)}
                    >
                      + Add Contribution
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        );
      })}

      <Button onClick={addPerson} variant="outline">
        + Add Person
      </Button>
    </div>
  );
}
