"use client";

import { useState } from "react";
import {
  Users,
  Landmark,
  Wallet,
  Target,
  BookOpen,
  Shield,
  ArrowRightLeft,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useData } from "@/context/data-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { PeopleTab } from "@/components/settings/people-tab";
import { AccountsTab } from "@/components/settings/accounts-tab";
import { IncomeTab } from "@/components/settings/income-tab";
import { ContributionsTab } from "@/components/settings/contributions-tab";
import { FundsTab } from "@/components/settings/funds-tab";
import { IhtTab } from "@/components/settings/iht-tab";
import { TransactionsTab } from "@/components/settings/transactions-tab";

export default function SettingsPage() {
  const { household, resetToDefaults } = useData();

  // ============================================================
  // Quick Setup completeness checks
  // ============================================================

  const hasPersons =
    household.persons.length > 0 &&
    household.persons.some((p) => p.name.length > 0);
  const hasAccounts = household.accounts.length > 0;
  const hasIncome = household.income.some((i) => i.grossSalary > 0);
  const hasContributions = household.annualContributions.some(
    (c) =>
      c.isaContribution > 0 ||
      c.pensionContribution > 0 ||
      c.giaContribution > 0
  );
  const hasFunds = household.funds.length > 0;

  const setupSteps = [
    { key: "people", label: "Add household members", done: hasPersons, tab: "people" },
    { key: "accounts", label: "Set up accounts", done: hasAccounts, tab: "accounts" },
    { key: "income", label: "Enter income details", done: hasIncome, tab: "income" },
    { key: "funds", label: "Add funds/investments", done: hasFunds, tab: "funds" },
    { key: "contributions", label: "Set contribution goals", done: hasContributions, tab: "contributions" },
  ];
  const completedSteps = setupSteps.filter((s) => s.done).length;
  const allComplete = completedSteps === setupSteps.length;

  const [activeTab, setActiveTab] = useState("people");

  function handleReset() {
    if (
      window.confirm(
        "Are you sure you want to reset all data to defaults? This cannot be undone."
      )
    ) {
      resetToDefaults();
    }
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

      {/* Quick Setup Guide */}
      {!allComplete && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Setup</CardTitle>
            <CardDescription>
              Complete these steps to get the most out of Runway.{" "}
              {completedSteps}/{setupSteps.length} done.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {setupSteps.map((step) => (
                <button
                  key={step.key}
                  onClick={() => setActiveTab(step.tab)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    step.done
                      ? "text-muted-foreground"
                      : "font-medium text-foreground hover:bg-accent"
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={step.done ? "line-through" : ""}>
                    {step.label}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="people" className="gap-1.5">
            <Users className="size-3.5" />
            People
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5">
            <Landmark className="size-3.5" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="income" className="gap-1.5">
            <Wallet className="size-3.5" />
            Income
          </TabsTrigger>
          <TabsTrigger value="contributions" className="gap-1.5">
            <Target className="size-3.5" />
            Goals
          </TabsTrigger>
          <TabsTrigger value="funds" className="gap-1.5">
            <BookOpen className="size-3.5" />
            Funds
          </TabsTrigger>
          <TabsTrigger value="iht" className="gap-1.5">
            <Shield className="size-3.5" />
            IHT
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5">
            <ArrowRightLeft className="size-3.5" />
            Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-4 mt-4">
          <PeopleTab />
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4 mt-4">
          <AccountsTab />
        </TabsContent>

        <TabsContent value="income" className="space-y-4 mt-4">
          <IncomeTab />
        </TabsContent>

        <TabsContent value="contributions" className="space-y-4 mt-4">
          <ContributionsTab />
        </TabsContent>

        <TabsContent value="funds" className="space-y-4 mt-4">
          <FundsTab />
        </TabsContent>

        <TabsContent value="iht" className="space-y-4 mt-4">
          <IhtTab />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4 mt-4">
          <TransactionsTab />
        </TabsContent>
      </Tabs>

      {/* Danger Zone */}
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
