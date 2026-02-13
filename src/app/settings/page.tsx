"use client";

import { useData } from "@/context/data-context";
import {
  ACCOUNT_TYPE_LABELS,
  ASSET_CLASS_LABELS,
  REGION_LABELS,
} from "@/types";
import type {
  AccountType,
  AssetClass,
  Region,
  StudentLoanPlan,
  Person,
  Account,
  Fund,
  Holding,
  PersonIncome,
  BonusStructure,
  DeferredBonusTranche,
  AnnualContributions,
  Gift,
  Transaction,
  TransactionType,
} from "@/types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Helpers
// ============================================================

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Type-safe field setter that avoids TS2352 with a double assertion. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setField<T>(obj: T, field: keyof T, value: any): void {
  (obj as any)[field] = value;
}

// ============================================================
// Student Loan labels
// ============================================================

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

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  dividend: "Dividend",
  contribution: "Contribution",
};

// ============================================================
// Settings Page Component
// ============================================================

export default function SettingsPage() {
  const {
    household,
    transactions,
    updateHousehold,
    updateTransactions,
    resetToDefaults,
  } = useData();

  // ----------------------------------------------------------
  // Person helpers
  // ----------------------------------------------------------

  function updatePerson(
    index: number,
    field: keyof Person,
    value: string | number
  ) {
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
    // Also add corresponding income, bonus, and contributions entries
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
    // Remove related data
    updated.accounts = updated.accounts.filter(
      (a: Account) => a.personId !== personId
    );
    updated.income = updated.income.filter(
      (i: PersonIncome) => i.personId !== personId
    );
    updated.bonusStructures = updated.bonusStructures.filter(
      (b: BonusStructure) => b.personId !== personId
    );
    updated.annualContributions = updated.annualContributions.filter(
      (c: AnnualContributions) => c.personId !== personId
    );
    updateHousehold(updated);
  }

  // ----------------------------------------------------------
  // Account helpers
  // ----------------------------------------------------------

  function updateAccount(
    index: number,
    field: keyof Account,
    value: string | number
  ) {
    const updated = clone(household);
    setField(updated.accounts[index], field, value);
    updateHousehold(updated);
  }

  function addAccount() {
    const updated = clone(household);
    const defaultPersonId =
      updated.persons.length > 0 ? updated.persons[0].id : "";
    updated.accounts.push({
      id: `acc-${Date.now()}`,
      personId: defaultPersonId,
      type: "cash_savings" as AccountType,
      provider: "",
      name: "",
      currentValue: 0,
      holdings: [],
    });
    updateHousehold(updated);
  }

  function removeAccount(index: number) {
    const updated = clone(household);
    updated.accounts.splice(index, 1);
    updateHousehold(updated);
  }

  // ----------------------------------------------------------
  // Holding helpers
  // ----------------------------------------------------------

  function updateHolding(
    accountIndex: number,
    holdingIndex: number,
    field: keyof Holding,
    value: string | number
  ) {
    const updated = clone(household);
    setField(updated.accounts[accountIndex].holdings[holdingIndex], field, value);
    updateHousehold(updated);
  }

  function addHolding(accountIndex: number) {
    const updated = clone(household);
    const defaultFundId =
      updated.funds.length > 0 ? updated.funds[0].id : "";
    updated.accounts[accountIndex].holdings.push({
      fundId: defaultFundId,
      units: 0,
      purchasePrice: 0,
      currentPrice: 0,
    });
    updateHousehold(updated);
  }

  function removeHolding(accountIndex: number, holdingIndex: number) {
    const updated = clone(household);
    updated.accounts[accountIndex].holdings.splice(holdingIndex, 1);
    updateHousehold(updated);
  }

  // ----------------------------------------------------------
  // Income helpers
  // ----------------------------------------------------------

  function updateIncome(
    index: number,
    field: keyof PersonIncome,
    value: string | number
  ) {
    const updated = clone(household);
    setField(updated.income[index], field, value);
    updateHousehold(updated);
  }

  // ----------------------------------------------------------
  // Bonus helpers
  // ----------------------------------------------------------

  function updateBonus(
    index: number,
    field: keyof BonusStructure,
    value: number
  ) {
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
    updated.bonusStructures[bonusIndex].deferredTranches.splice(
      trancheIndex,
      1
    );
    updateHousehold(updated);
  }

  // ----------------------------------------------------------
  // Contributions helpers
  // ----------------------------------------------------------

  function updateContribution(
    index: number,
    field: keyof AnnualContributions,
    value: number
  ) {
    const updated = clone(household);
    setField(updated.annualContributions[index], field, value);
    updateHousehold(updated);
  }

  // ----------------------------------------------------------
  // Retirement / Emergency / Expenses helpers
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // Fund helpers
  // ----------------------------------------------------------

  function updateFund(
    index: number,
    field: keyof Fund,
    value: string | number
  ) {
    const updated = clone(household);
    setField(updated.funds[index], field, value);
    updateHousehold(updated);
  }

  function addFund() {
    const updated = clone(household);
    updated.funds.push({
      id: `fund-${Date.now()}`,
      name: "",
      ticker: "",
      isin: "",
      ocf: 0,
      assetClass: "equity" as AssetClass,
      region: "global" as Region,
    });
    updateHousehold(updated);
  }

  function removeFund(index: number) {
    const updated = clone(household);
    updated.funds.splice(index, 1);
    updateHousehold(updated);
  }

  // ----------------------------------------------------------
  // IHT & Gift helpers
  // ----------------------------------------------------------

  function updateIHT(field: string, value: number | boolean) {
    const updated = clone(household);
    setField(updated.iht, field as keyof typeof updated.iht, value);
    updateHousehold(updated);
  }

  function updateGift(
    index: number,
    field: keyof Gift,
    value: string | number
  ) {
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

  // ----------------------------------------------------------
  // Transaction helpers
  // ----------------------------------------------------------

  function updateTransaction(
    index: number,
    field: keyof Transaction,
    value: string | number
  ) {
    const updated = clone(transactions);
    setField(updated.transactions[index], field, value);
    // Auto-compute amount when units or pricePerUnit change
    if (field === "units" || field === "pricePerUnit") {
      const units = Number(updated.transactions[index].units);
      const price = Number(updated.transactions[index].pricePerUnit);
      updated.transactions[index].amount = Math.round(units * price * 100) / 100;
    }
    updateTransactions(updated);
  }

  function addTransaction() {
    const updated = clone(transactions);
    const defaultAccountId =
      household.accounts.length > 0 ? household.accounts[0].id : "";
    const defaultFundId =
      household.funds.length > 0 ? household.funds[0].id : "";
    updated.transactions.push({
      id: `tx-${Date.now()}`,
      accountId: defaultAccountId,
      fundId: defaultFundId,
      type: "buy" as TransactionType,
      date: new Date().toISOString().split("T")[0],
      units: 0,
      pricePerUnit: 0,
      amount: 0,
      notes: "",
    });
    updateTransactions(updated);
  }

  function removeTransaction(index: number) {
    const updated = clone(transactions);
    updated.transactions.splice(index, 1);
    updateTransactions(updated);
  }

  // ----------------------------------------------------------
  // Reset with confirmation
  // ----------------------------------------------------------

  function handleReset() {
    if (
      window.confirm(
        "Are you sure you want to reset all data to defaults? This cannot be undone."
      )
    ) {
      resetToDefaults();
    }
  }

  // ----------------------------------------------------------
  // Render helpers for reusable field patterns
  // ----------------------------------------------------------

  function renderField(
    label: string,
    children: React.ReactNode,
    key?: string
  ) {
    return (
      <div className="space-y-1.5" key={key}>
        <Label>{label}</Label>
        {children}
      </div>
    );
  }

  function personName(personId: string): string {
    const person = household.persons.find((p) => p.id === personId);
    return person ? person.name || "Unnamed" : "Unknown";
  }

  function accountLabel(accountId: string): string {
    const account = household.accounts.find((a) => a.id === accountId);
    return account ? account.name || "Unnamed Account" : "Unknown Account";
  }

  function fundLabel(fundId: string): string {
    const fund = household.funds.find((f) => f.id === fundId);
    return fund ? fund.name || "Unnamed Fund" : "Unknown Fund";
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage all your financial data. Changes are saved automatically.
        </p>
      </div>

      <Tabs defaultValue="people" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="contributions">Contributions &amp; Goals</TabsTrigger>
          <TabsTrigger value="funds">Funds</TabsTrigger>
          <TabsTrigger value="iht">IHT &amp; Gifts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* ====================================================== */}
        {/* TAB 1: PEOPLE                                          */}
        {/* ====================================================== */}
        <TabsContent value="people" className="space-y-4 mt-4">
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
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderField(
                    "Name",
                    <Input
                      value={person.name}
                      onChange={(e) =>
                        updatePerson(pIdx, "name", e.target.value)
                      }
                      placeholder="Full name"
                    />
                  )}
                  {renderField(
                    "Date of Birth",
                    <Input
                      type="date"
                      value={person.dateOfBirth}
                      onChange={(e) =>
                        updatePerson(pIdx, "dateOfBirth", e.target.value)
                      }
                    />
                  )}
                  {renderField(
                    "Pension Access Age",
                    <Input
                      type="number"
                      value={person.pensionAccessAge}
                      onChange={(e) =>
                        updatePerson(
                          pIdx,
                          "pensionAccessAge",
                          Number(e.target.value)
                        )
                      }
                    />
                  )}
                  {renderField(
                    "State Retirement Age",
                    <Input
                      type="number"
                      value={person.stateRetirementAge}
                      onChange={(e) =>
                        updatePerson(
                          pIdx,
                          "stateRetirementAge",
                          Number(e.target.value)
                        )
                      }
                    />
                  )}
                  {renderField(
                    "NI Qualifying Years",
                    <Input
                      type="number"
                      value={person.niQualifyingYears}
                      onChange={(e) =>
                        updatePerson(
                          pIdx,
                          "niQualifyingYears",
                          Number(e.target.value)
                        )
                      }
                    />
                  )}
                  {renderField(
                    "Student Loan Plan",
                    <Select
                      value={person.studentLoanPlan}
                      onValueChange={(val) =>
                        updatePerson(pIdx, "studentLoanPlan", val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STUDENT_LOAN_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          <Button onClick={addPerson} variant="outline">
            + Add Person
          </Button>
        </TabsContent>

        {/* ====================================================== */}
        {/* TAB 2: ACCOUNTS                                        */}
        {/* ====================================================== */}
        <TabsContent value="accounts" className="space-y-4 mt-4">
          {household.accounts.map((account, aIdx) => (
            <Card key={account.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {account.name || "New Account"}
                    <Badge variant="outline">
                      {ACCOUNT_TYPE_LABELS[account.type]}
                    </Badge>
                  </CardTitle>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeAccount(aIdx)}
                  >
                    Remove
                  </Button>
                </div>
                <CardDescription>
                  Owner: {personName(account.personId)} | Provider:{" "}
                  {account.provider || "N/A"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderField(
                    "Person",
                    <Select
                      value={account.personId}
                      onValueChange={(val) =>
                        updateAccount(aIdx, "personId", val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {household.persons.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name || "Unnamed"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {renderField(
                    "Account Name",
                    <Input
                      value={account.name}
                      onChange={(e) =>
                        updateAccount(aIdx, "name", e.target.value)
                      }
                      placeholder="Account name"
                    />
                  )}
                  {renderField(
                    "Provider",
                    <Input
                      value={account.provider}
                      onChange={(e) =>
                        updateAccount(aIdx, "provider", e.target.value)
                      }
                      placeholder="Provider name"
                    />
                  )}
                  {renderField(
                    "Account Type",
                    <Select
                      value={account.type}
                      onValueChange={(val) =>
                        updateAccount(aIdx, "type", val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ACCOUNT_TYPE_LABELS).map(
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
                    "Current Value",
                    <Input
                      type="number"
                      step="0.01"
                      value={account.currentValue}
                      onChange={(e) =>
                        updateAccount(
                          aIdx,
                          "currentValue",
                          Number(e.target.value)
                        )
                      }
                      placeholder="0.00"
                    />
                  )}
                </div>

                {/* Holdings sub-section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Holdings
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addHolding(aIdx)}
                    >
                      + Add Holding
                    </Button>
                  </div>
                  {account.holdings.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No holdings for this account.
                    </p>
                  )}
                  {account.holdings.map((holding, hIdx) => (
                    <Card
                      key={`${account.id}-holding-${hIdx}`}
                      className="border-dashed"
                    >
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {renderField(
                            "Fund",
                            <Select
                              value={holding.fundId}
                              onValueChange={(val) =>
                                updateHolding(aIdx, hIdx, "fundId", val)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {household.funds.map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.name || f.ticker || "Unnamed"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {renderField(
                            "Units",
                            <Input
                              type="number"
                              step="0.01"
                              value={holding.units}
                              onChange={(e) =>
                                updateHolding(
                                  aIdx,
                                  hIdx,
                                  "units",
                                  Number(e.target.value)
                                )
                              }
                            />
                          )}
                          {renderField(
                            "Purchase Price",
                            <Input
                              type="number"
                              step="0.01"
                              value={holding.purchasePrice}
                              onChange={(e) =>
                                updateHolding(
                                  aIdx,
                                  hIdx,
                                  "purchasePrice",
                                  Number(e.target.value)
                                )
                              }
                            />
                          )}
                          {renderField(
                            "Current Price",
                            <Input
                              type="number"
                              step="0.01"
                              value={holding.currentPrice}
                              onChange={(e) =>
                                updateHolding(
                                  aIdx,
                                  hIdx,
                                  "currentPrice",
                                  Number(e.target.value)
                                )
                              }
                            />
                          )}
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeHolding(aIdx, hIdx)}
                          >
                            Remove Holding
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <Button onClick={addAccount} variant="outline">
            + Add Account
          </Button>
        </TabsContent>

        {/* ====================================================== */}
        {/* TAB 3: INCOME                                          */}
        {/* ====================================================== */}
        <TabsContent value="income" className="space-y-4 mt-4">
          {household.persons.map((person, pIdx) => {
            const incomeIdx = household.income.findIndex(
              (i) => i.personId === person.id
            );
            const income = incomeIdx >= 0 ? household.income[incomeIdx] : null;
            const bonusIdx = household.bonusStructures.findIndex(
              (b) => b.personId === person.id
            );
            const bonus =
              bonusIdx >= 0 ? household.bonusStructures[bonusIdx] : null;

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
                      {renderField(
                        "Gross Salary",
                        <Input
                          type="number"
                          step="0.01"
                          value={income.grossSalary}
                          onChange={(e) =>
                            updateIncome(
                              incomeIdx,
                              "grossSalary",
                              Number(e.target.value)
                            )
                          }
                          placeholder="0.00"
                        />
                      )}
                      {renderField(
                        "Employer Pension Contribution",
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
                      )}
                      {renderField(
                        "Employee Pension Contribution",
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
                      )}
                      {renderField(
                        "Pension Method",
                        <Select
                          value={income.pensionContributionMethod}
                          onValueChange={(val) =>
                            updateIncome(
                              incomeIdx,
                              "pensionContributionMethod",
                              val
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PENSION_METHOD_LABELS).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Bonus Structure */}
                  {bonus && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Bonus Structure
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderField(
                          "Cash Bonus (Annual)",
                          <Input
                            type="number"
                            step="0.01"
                            value={bonus.cashBonusAnnual}
                            onChange={(e) =>
                              updateBonus(
                                bonusIdx,
                                "cashBonusAnnual",
                                Number(e.target.value)
                              )
                            }
                            placeholder="0.00"
                          />
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-medium">
                            Deferred Tranches
                          </h5>
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
                          <Card
                            key={`${person.id}-tranche-${tIdx}`}
                            className="border-dashed"
                          >
                            <CardContent className="pt-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {renderField(
                                  "Grant Date",
                                  <Input
                                    type="date"
                                    value={tranche.grantDate}
                                    onChange={(e) =>
                                      updateTranche(
                                        bonusIdx,
                                        tIdx,
                                        "grantDate",
                                        e.target.value
                                      )
                                    }
                                  />
                                )}
                                {renderField(
                                  "Vesting Date",
                                  <Input
                                    type="date"
                                    value={tranche.vestingDate}
                                    onChange={(e) =>
                                      updateTranche(
                                        bonusIdx,
                                        tIdx,
                                        "vestingDate",
                                        e.target.value
                                      )
                                    }
                                  />
                                )}
                                {renderField(
                                  "Amount",
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
                                )}
                                {renderField(
                                  "Est. Annual Return",
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={
                                      Math.round(
                                        tranche.estimatedAnnualReturn * 100 * 100
                                      ) / 100
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
                                )}
                              </div>
                              <div className="mt-3 flex justify-end">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() =>
                                    removeTranche(bonusIdx, tIdx)
                                  }
                                >
                                  Remove Tranche
                                </Button>
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
        </TabsContent>

        {/* ====================================================== */}
        {/* TAB 4: CONTRIBUTIONS & GOALS                           */}
        {/* ====================================================== */}
        <TabsContent value="contributions" className="space-y-4 mt-4">
          {/* Annual Contributions per person */}
          {household.persons.map((person) => {
            const contribIdx = household.annualContributions.findIndex(
              (c) => c.personId === person.id
            );
            const contrib =
              contribIdx >= 0
                ? household.annualContributions[contribIdx]
                : null;

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
                    {renderField(
                      "ISA Contribution",
                      <Input
                        type="number"
                        step="0.01"
                        value={contrib.isaContribution}
                        onChange={(e) =>
                          updateContribution(
                            contribIdx,
                            "isaContribution",
                            Number(e.target.value)
                          )
                        }
                        placeholder="0.00"
                      />
                    )}
                    {renderField(
                      "Pension Contribution",
                      <Input
                        type="number"
                        step="0.01"
                        value={contrib.pensionContribution}
                        onChange={(e) =>
                          updateContribution(
                            contribIdx,
                            "pensionContribution",
                            Number(e.target.value)
                          )
                        }
                        placeholder="0.00"
                      />
                    )}
                    {renderField(
                      "GIA Contribution",
                      <Input
                        type="number"
                        step="0.01"
                        value={contrib.giaContribution}
                        onChange={(e) =>
                          updateContribution(
                            contribIdx,
                            "giaContribution",
                            Number(e.target.value)
                          )
                        }
                        placeholder="0.00"
                      />
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
              <CardDescription>
                Set your retirement income goals and withdrawal strategy.
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
                      updateRetirement(
                        "targetAnnualIncome",
                        Number(e.target.value)
                      )
                    }
                    placeholder="0.00"
                  />
                )}
                {renderField(
                  "Withdrawal Rate (%)",
                  <Input
                    type="number"
                    step="0.01"
                    value={
                      Math.round(
                        household.retirement.withdrawalRate * 100 * 100
                      ) / 100
                    }
                    onChange={(e) =>
                      updateRetirement(
                        "withdrawalRate",
                        Number(e.target.value) / 100
                      )
                    }
                    placeholder="4"
                  />
                )}
                {renderField(
                  "Include State Pension",
                  <div className="flex items-center gap-2 h-9">
                    <input
                      type="checkbox"
                      id="includeStatePension"
                      checked={household.retirement.includeStatePension}
                      onChange={(e) =>
                        updateRetirement(
                          "includeStatePension",
                          e.target.checked
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="includeStatePension" className="text-sm font-normal">
                      {household.retirement.includeStatePension
                        ? "Yes"
                        : "No"}
                    </Label>
                  </div>
                )}
                {renderField(
                  "Scenario Rate 1 (%)",
                  <Input
                    type="number"
                    step="0.01"
                    value={
                      household.retirement.scenarioRates[0] !== undefined
                        ? Math.round(
                            household.retirement.scenarioRates[0] * 100 * 100
                          ) / 100
                        : ""
                    }
                    onChange={(e) =>
                      updateScenarioRate(0, Number(e.target.value) / 100)
                    }
                    placeholder="5"
                  />
                )}
                {renderField(
                  "Scenario Rate 2 (%)",
                  <Input
                    type="number"
                    step="0.01"
                    value={
                      household.retirement.scenarioRates[1] !== undefined
                        ? Math.round(
                            household.retirement.scenarioRates[1] * 100 * 100
                          ) / 100
                        : ""
                    }
                    onChange={(e) =>
                      updateScenarioRate(1, Number(e.target.value) / 100)
                    }
                    placeholder="7"
                  />
                )}
                {renderField(
                  "Scenario Rate 3 (%)",
                  <Input
                    type="number"
                    step="0.01"
                    value={
                      household.retirement.scenarioRates[2] !== undefined
                        ? Math.round(
                            household.retirement.scenarioRates[2] * 100 * 100
                          ) / 100
                        : ""
                    }
                    onChange={(e) =>
                      updateScenarioRate(2, Number(e.target.value) / 100)
                    }
                    placeholder="9"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Emergency Fund */}
          <Card>
            <CardHeader>
              <CardTitle>Emergency Fund</CardTitle>
              <CardDescription>
                Configure your emergency fund target based on monthly expenses.
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
                  />
                )}
                {renderField(
                  "Target Months",
                  <Input
                    type="number"
                    value={household.emergencyFund.targetMonths}
                    onChange={(e) =>
                      updateEmergencyFund(
                        "targetMonths",
                        Number(e.target.value)
                      )
                    }
                    placeholder="6"
                  />
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
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================================================== */}
        {/* TAB 5: FUNDS                                           */}
        {/* ====================================================== */}
        <TabsContent value="funds" className="space-y-4 mt-4">
          {household.funds.map((fund, fIdx) => (
            <Card key={fund.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {fund.name || "New Fund"}
                    {fund.ticker && (
                      <Badge variant="outline">{fund.ticker}</Badge>
                    )}
                  </CardTitle>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeFund(fIdx)}
                  >
                    Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderField(
                    "Name",
                    <Input
                      value={fund.name}
                      onChange={(e) =>
                        updateFund(fIdx, "name", e.target.value)
                      }
                      placeholder="Fund name"
                    />
                  )}
                  {renderField(
                    "Ticker",
                    <Input
                      value={fund.ticker}
                      onChange={(e) =>
                        updateFund(fIdx, "ticker", e.target.value)
                      }
                      placeholder="e.g. VWRL"
                    />
                  )}
                  {renderField(
                    "ISIN",
                    <Input
                      value={fund.isin}
                      onChange={(e) =>
                        updateFund(fIdx, "isin", e.target.value)
                      }
                      placeholder="e.g. IE00B3RBWM25"
                    />
                  )}
                  {renderField(
                    "OCF (%)",
                    <Input
                      type="number"
                      step="0.01"
                      value={
                        Math.round(fund.ocf * 100 * 100) / 100
                      }
                      onChange={(e) =>
                        updateFund(
                          fIdx,
                          "ocf",
                          Number(e.target.value) / 100
                        )
                      }
                      placeholder="0.22"
                    />
                  )}
                  {renderField(
                    "Asset Class",
                    <Select
                      value={fund.assetClass}
                      onValueChange={(val) =>
                        updateFund(fIdx, "assetClass", val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ASSET_CLASS_LABELS).map(
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
                    "Region",
                    <Select
                      value={fund.region}
                      onValueChange={(val) =>
                        updateFund(fIdx, "region", val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(REGION_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          <Button onClick={addFund} variant="outline">
            + Add Fund
          </Button>
        </TabsContent>

        {/* ====================================================== */}
        {/* TAB 6: IHT & GIFTS                                     */}
        {/* ====================================================== */}
        <TabsContent value="iht" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Inheritance Tax Configuration</CardTitle>
              <CardDescription>
                Property value and direct descendant status for IHT calculations.
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
                      updateIHT(
                        "estimatedPropertyValue",
                        Number(e.target.value)
                      )
                    }
                    placeholder="0.00"
                  />
                )}
                {renderField(
                  "Passing to Direct Descendants",
                  <div className="flex items-center gap-2 h-9">
                    <input
                      type="checkbox"
                      id="passingToDirectDescendants"
                      checked={household.iht.passingToDirectDescendants}
                      onChange={(e) =>
                        updateIHT(
                          "passingToDirectDescendants",
                          e.target.checked
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="passingToDirectDescendants" className="text-sm font-normal">
                      {household.iht.passingToDirectDescendants
                        ? "Yes"
                        : "No"}
                    </Label>
                  </div>
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
                    Track gifts for the 7-year IHT rule.
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
                          onChange={(e) =>
                            updateGift(gIdx, "date", e.target.value)
                          }
                        />
                      )}
                      {renderField(
                        "Amount",
                        <Input
                          type="number"
                          step="0.01"
                          value={gift.amount}
                          onChange={(e) =>
                            updateGift(
                              gIdx,
                              "amount",
                              Number(e.target.value)
                            )
                          }
                          placeholder="0.00"
                        />
                      )}
                      {renderField(
                        "Recipient",
                        <Input
                          value={gift.recipient}
                          onChange={(e) =>
                            updateGift(gIdx, "recipient", e.target.value)
                          }
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
        </TabsContent>

        {/* ====================================================== */}
        {/* TAB 7: TRANSACTIONS                                    */}
        {/* ====================================================== */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Transactions</h2>
              <p className="text-sm text-muted-foreground">
                Record buy, sell, dividend, and contribution transactions.
              </p>
            </div>
            <Button variant="outline" onClick={addTransaction}>
              + Add Transaction
            </Button>
          </div>

          {transactions.transactions.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No transactions recorded yet.
                </p>
              </CardContent>
            </Card>
          )}

          {transactions.transactions.map((tx, txIdx) => (
            <Card key={tx.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Badge
                      variant={
                        tx.type === "buy"
                          ? "default"
                          : tx.type === "sell"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {TRANSACTION_TYPE_LABELS[tx.type]}
                    </Badge>
                    <span className="text-muted-foreground text-sm">
                      {tx.date} | {accountLabel(tx.accountId)} |{" "}
                      {fundLabel(tx.fundId)}
                    </span>
                  </CardTitle>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeTransaction(txIdx)}
                  >
                    Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderField(
                    "Account",
                    <Select
                      value={tx.accountId}
                      onValueChange={(val) =>
                        updateTransaction(txIdx, "accountId", val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {household.accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name || "Unnamed Account"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {renderField(
                    "Fund",
                    <Select
                      value={tx.fundId}
                      onValueChange={(val) =>
                        updateTransaction(txIdx, "fundId", val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {household.funds.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name || f.ticker || "Unnamed Fund"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {renderField(
                    "Type",
                    <Select
                      value={tx.type}
                      onValueChange={(val) =>
                        updateTransaction(txIdx, "type", val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRANSACTION_TYPE_LABELS).map(
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
                    "Date",
                    <Input
                      type="date"
                      value={tx.date}
                      onChange={(e) =>
                        updateTransaction(txIdx, "date", e.target.value)
                      }
                    />
                  )}
                  {renderField(
                    "Units",
                    <Input
                      type="number"
                      step="0.01"
                      value={tx.units}
                      onChange={(e) =>
                        updateTransaction(
                          txIdx,
                          "units",
                          Number(e.target.value)
                        )
                      }
                    />
                  )}
                  {renderField(
                    "Price Per Unit",
                    <Input
                      type="number"
                      step="0.01"
                      value={tx.pricePerUnit}
                      onChange={(e) =>
                        updateTransaction(
                          txIdx,
                          "pricePerUnit",
                          Number(e.target.value)
                        )
                      }
                    />
                  )}
                  {renderField(
                    "Total Amount",
                    <Input
                      type="number"
                      step="0.01"
                      value={tx.amount}
                      disabled
                      className="bg-muted"
                    />
                  )}
                  {renderField(
                    "Notes",
                    <Input
                      value={tx.notes || ""}
                      onChange={(e) =>
                        updateTransaction(txIdx, "notes", e.target.value)
                      }
                      placeholder="Optional notes"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* ====================================================== */}
      {/* RESET TO DEFAULTS                                       */}
      {/* ====================================================== */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Reset all data back to the original default values. This will remove
            all your customisations and cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleReset}>
            Reset to Defaults
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
