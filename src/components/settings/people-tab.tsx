"use client";

import { useData } from "@/context/data-context";
import { clone, setField, renderField, STUDENT_LOAN_LABELS } from "./helpers";
import type { Person, Account, PersonIncome, BonusStructure, AnnualContributions } from "@/types";
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

export function PeopleTab() {
  const { household, updateHousehold } = useData();

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
    updated.annualContributions.push({
      personId: newPerson.id,
      isaContribution: 0,
      pensionContribution: 0,
      giaContribution: 0,
    });
    updateHousehold(updated);
  }

  function removePerson(index: number) {
    const updated = clone(household);
    const personId = updated.persons[index].id;
    updated.persons.splice(index, 1);
    updated.accounts = updated.accounts.filter((a: Account) => a.personId !== personId);
    updated.income = updated.income.filter((i: PersonIncome) => i.personId !== personId);
    updated.bonusStructures = updated.bonusStructures.filter((b: BonusStructure) => b.personId !== personId);
    updated.annualContributions = updated.annualContributions.filter((c: AnnualContributions) => c.personId !== personId);
    updateHousehold(updated);
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Add everyone in your household. Accounts, income, and contributions are linked to each person.
      </p>
      {household.persons.map((person, pIdx) => (
        <Card key={person.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {person.name || "New Person"}
                <Badge variant="secondary">
                  {person.relationship === "self" ? "Self" : "Spouse"}
                </Badge>
              </CardTitle>
              {household.persons.length > 1 && (
                <Button variant="destructive" size="sm" onClick={() => removePerson(pIdx)}>
                  Remove
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {renderField("Name",
                <Input value={person.name} onChange={(e) => updatePerson(pIdx, "name", e.target.value)} placeholder="Full name" />
              )}
              {renderField("Date of Birth",
                <Input type="date" value={person.dateOfBirth} onChange={(e) => updatePerson(pIdx, "dateOfBirth", e.target.value)} />
              )}
              {renderField("Pension Access Age",
                <Input type="number" value={person.pensionAccessAge} onChange={(e) => updatePerson(pIdx, "pensionAccessAge", Number(e.target.value))} />
              )}
              {renderField("State Retirement Age",
                <Input type="number" value={person.stateRetirementAge} onChange={(e) => updatePerson(pIdx, "stateRetirementAge", Number(e.target.value))} />
              )}
              {renderField("NI Qualifying Years",
                <Input type="number" value={person.niQualifyingYears} onChange={(e) => updatePerson(pIdx, "niQualifyingYears", Number(e.target.value))} />
              )}
              {renderField("Student Loan Plan",
                <Select value={person.studentLoanPlan} onValueChange={(val) => updatePerson(pIdx, "studentLoanPlan", val)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STUDENT_LOAN_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      <Button onClick={addPerson} variant="outline">+ Add Person</Button>
    </>
  );
}
