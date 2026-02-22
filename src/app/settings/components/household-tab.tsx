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
  Contribution,
  ContributionTarget,
  ContributionFrequency,
  StudentLoanPlan,
  HouseholdData,
  HeroMetricType,
} from "@/types";
import {
  CONTRIBUTION_TARGET_LABELS,
  CONTRIBUTION_FREQUENCY_LABELS,
  HERO_METRIC_LABELS,
  annualiseContribution,
} from "@/types";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { formatCurrency } from "@/lib/format";
import { clone, setField, renderField } from "./field-helpers";
import { FieldWarning } from "./field-warning";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
      plannedRetirementAge: 60,
      pensionAccessAge: 57,
      stateRetirementAge: 67,
      niQualifyingYears: 35,
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
      totalBonusAnnual: 0,
      cashBonusAnnual: 0,
      vestingYears: 3,
      vestingGapYears: 0,
      estimatedAnnualReturn: 0.08,
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

  // Tranche helpers removed — deferred bonus now uses total bonus model
  // (totalBonusAnnual + cashBonusAnnual + vestingYears + vestingGapYears + estimatedAnnualReturn)

  // ----------------------------------------------------------
  // Contribution helpers
  // ----------------------------------------------------------

  function addContribution(personId: string, template?: { label: string; target: ContributionTarget; amount: number; frequency: ContributionFrequency }) {
    const updated = clone(household);
    updated.contributions.push({
      id: `contrib-${crypto.randomUUID()}`,
      personId,
      label: template?.label ?? "",
      target: template?.target ?? ("isa" as ContributionTarget),
      amount: template?.amount ?? 0,
      frequency: template?.frequency ?? ("monthly" as ContributionFrequency),
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

  const [selectedPersonIdx, setSelectedPersonIdx] = useState(0);

  // Clamp index if persons list shrinks
  const clampedIdx = Math.min(selectedPersonIdx, Math.max(0, household.persons.length - 1));

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Each person&apos;s details, income, and contribution targets in one place.
        </p>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="text-muted-foreground">Shown on:</span>
          <Link href="/tax-planning" className="text-primary hover:underline flex items-center gap-0.5">
            Tax Planning <ArrowRight className="size-3" />
          </Link>
          <Link href="/income" className="text-primary hover:underline flex items-center gap-0.5">
            Income <ArrowRight className="size-3" />
          </Link>
          <Link href="/retirement" className="text-primary hover:underline flex items-center gap-0.5">
            Retirement <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

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
                      "Planned Retirement Age",
                      <>
                        <Input
                          type="number"
                          value={person.plannedRetirementAge}
                          onChange={(e) =>
                            updatePerson(pIdx, "plannedRetirementAge", Number(e.target.value))
                          }
                        />
                        <FieldWarning
                          value={person.plannedRetirementAge}
                          min={40}
                          max={80}
                          label="planned retirement age"
                        />
                      </>,
                      "When you plan to stop working"
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
                      {renderField(
                        "Salary Growth Rate (%)",
                        <>
                          <Input
                            type="number"
                            step="0.5"
                            value={((income.salaryGrowthRate ?? 0) * 100).toFixed(1)}
                            onChange={(e) =>
                              updateIncome(incomeIdx, "salaryGrowthRate", Number(e.target.value) / 100)
                            }
                            placeholder="0.0"
                          />
                          <FieldWarning
                            value={(income.salaryGrowthRate ?? 0) * 100}
                            min={0}
                            max={20}
                            label="salary growth rate"
                          />
                        </>,
                        "Expected annual salary increase (e.g. 3 for 3%/yr). Used in projections."
                      )}
                      {renderField(
                        "Bonus Growth Rate (%)",
                        <>
                          <Input
                            type="number"
                            step="0.5"
                            value={((income.bonusGrowthRate ?? 0) * 100).toFixed(1)}
                            onChange={(e) =>
                              updateIncome(incomeIdx, "bonusGrowthRate", Number(e.target.value) / 100)
                            }
                            placeholder="0.0"
                          />
                          <FieldWarning
                            value={(income.bonusGrowthRate ?? 0) * 100}
                            min={0}
                            max={30}
                            label="bonus growth rate"
                          />
                        </>,
                        "Expected annual bonus growth (e.g. 5 for 5%/yr). Used in cash flow projections."
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
                          "Total Bonus (Annual)",
                          <>
                            <Input
                              type="number"
                              step="0.01"
                              value={bonus.totalBonusAnnual}
                              onChange={(e) =>
                                updateBonus(bonusIdx, "totalBonusAnnual", Number(e.target.value))
                              }
                              placeholder="0.00"
                            />
                            <FieldWarning
                              value={bonus.totalBonusAnnual}
                              min={0}
                              max={2000000}
                              label="total bonus"
                              isCurrency
                            />
                          </>,
                          "Total annual bonus (cash + deferred). Grows at the bonus growth rate."
                        )}
                        {renderField(
                          "Cash Portion (Fixed)",
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
                              max={bonus.totalBonusAnnual}
                              label="cash bonus"
                              isCurrency
                            />
                          </>,
                          "Fixed cash paid immediately each year. Does not grow."
                        )}
                      </div>
                      {bonus.totalBonusAnnual > bonus.cashBonusAnnual && (
                        <p className="text-xs text-muted-foreground">
                          Deferred: {formatCurrency(bonus.totalBonusAnnual - bonus.cashBonusAnnual)}/yr — vests equally over {bonus.vestingYears} year{bonus.vestingYears !== 1 ? "s" : ""}{bonus.vestingGapYears > 0 ? ` after a ${bonus.vestingGapYears}-year gap` : ""}.
                        </p>
                      )}

                      <div className="space-y-3">
                        <h5 className="text-sm font-medium">Vesting Schedule</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {renderField(
                            "Vesting Years",
                            <>
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                max="10"
                                value={bonus.vestingYears}
                                onChange={(e) =>
                                  updateBonus(bonusIdx, "vestingYears", Number(e.target.value))
                                }
                                placeholder="3"
                              />
                              <FieldWarning
                                value={bonus.vestingYears}
                                min={0}
                                max={10}
                                label="vesting years"
                              />
                            </>,
                            "Equal vesting over this many years"
                          )}
                          {renderField(
                            "Gap Before 1st Vest",
                            <>
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                max="5"
                                value={bonus.vestingGapYears}
                                onChange={(e) =>
                                  updateBonus(bonusIdx, "vestingGapYears", Number(e.target.value))
                                }
                                placeholder="0"
                              />
                            </>,
                            "Years before first tranche vests (e.g. 1 = cliff year)"
                          )}
                          {renderField(
                            "Est. Annual Return (%)",
                            <>
                              <Input
                                type="number"
                                step="0.01"
                                value={
                                  Math.round(bonus.estimatedAnnualReturn * 100 * 100) / 100
                                }
                                onChange={(e) =>
                                  updateBonus(
                                    bonusIdx,
                                    "estimatedAnnualReturn",
                                    Number(e.target.value) / 100
                                  )
                                }
                                placeholder="8"
                              />
                              <FieldWarning
                                value={Math.round(bonus.estimatedAnnualReturn * 100 * 100) / 100}
                                min={-10}
                                max={30}
                                label="annual return"
                                suffix="%"
                              />
                            </>,
                            "Expected annual return on deferred amount while vesting"
                          )}
                        </div>
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    {/* Aggregate ISA allowance warning */}
                    {(() => {
                      const totalISA = personContributions
                        .filter((c) => c.target === "isa")
                        .reduce((s, c) => s + annualiseContribution(c.amount, c.frequency), 0);
                      const allowance = UK_TAX_CONSTANTS.isaAnnualAllowance;
                      if (totalISA > allowance) {
                        return (
                          <p className="flex items-center gap-1 text-xs text-amber-600">
                            <span className="font-medium">ISA warning:</span> {person.name}&apos;s total ISA contributions ({"\u00A3"}{Math.round(totalISA).toLocaleString()}/yr) exceed the {"\u00A3"}{allowance.toLocaleString()} annual allowance
                          </p>
                        );
                      }
                      return null;
                    })()}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addContribution(person.id)}
                      >
                        + Custom
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addContribution(person.id, { label: "Monthly ISA", target: "isa", amount: 1666, frequency: "monthly" })}
                      >
                        Monthly ISA
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addContribution(person.id, { label: "Annual ISA", target: "isa", amount: 20000, frequency: "annually" })}
                      >
                        Annual ISA
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addContribution(person.id, { label: "Annual SIPP top-up", target: "pension", amount: 10000, frequency: "annually" })}
                      >
                        SIPP Top-up
                      </Button>
                    </div>
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

      {/* REC-I: Hero Metrics Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Dashboard Hero Metrics
              <Badge variant="secondary">3 slots</Badge>
            </CardTitle>
            <div className="flex items-center gap-3 text-xs shrink-0">
              <span className="text-muted-foreground">Shown on:</span>
              <Link href="/" className="text-primary hover:underline flex items-center gap-0.5">
                Dashboard <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose which metrics appear in the hero section of your dashboard. The first metric is displayed prominently.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([0, 1, 2] as const).map((slotIndex) => (
              <div key={slotIndex}>
                {renderField(
                  slotIndex === 0 ? "Primary Metric" : `Secondary ${slotIndex}`,
                  <Select
                    value={household.dashboardConfig.heroMetrics[slotIndex]}
                    onValueChange={(val) => {
                      const updated = clone(household);
                      const metrics = [...updated.dashboardConfig.heroMetrics] as [HeroMetricType, HeroMetricType, HeroMetricType];
                      metrics[slotIndex] = val as HeroMetricType;
                      updated.dashboardConfig.heroMetrics = metrics;
                      updateHousehold(updated);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(HERO_METRIC_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>,
                  slotIndex === 0 ? "The headline number displayed largest" : undefined
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
