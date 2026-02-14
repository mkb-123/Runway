"use client";

import { useState } from "react";
import {
  Users,
  Landmark,
  BookOpen,
  Target,
  Shield,
  ArrowRightLeft,
  Receipt,
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

import { HouseholdTab } from "./components/household-tab";
import { AccountsTab } from "./components/accounts-tab";
import { FundsTab } from "./components/funds-tab";
import { PlanningTab } from "./components/planning-tab";
import { IhtTab } from "./components/iht-tab";
import { TransactionsTab } from "./components/transactions-tab";
import { CommitmentsTab } from "./components/commitments-tab";
import { SettingsSummaryBar } from "./components/settings-summary-bar";

// ============================================================
// Settings Page — Thin Orchestrator
// ============================================================

export default function SettingsPage() {
  const {
    household,
    transactions,
    updateHousehold,
    updateTransactions,
    clearAllData,
    loadExampleData,
  } = useData();

  const [activeTab, setActiveTab] = useState("household");

  // ----------------------------------------------------------
  // Quick Setup completeness
  // ----------------------------------------------------------

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
    {
      key: "people",
      label: "Add household members",
      done: hasPersons,
      tab: "household",
    },
    {
      key: "income",
      label: "Enter income details",
      done: hasIncome,
      tab: "household",
    },
    {
      key: "accounts",
      label: "Set up accounts",
      done: hasAccounts,
      tab: "accounts",
    },
    {
      key: "funds",
      label: "Add funds/investments",
      done: hasFunds,
      tab: "funds",
    },
    {
      key: "contributions",
      label: "Set contribution goals",
      done: hasContributions,
      tab: "household",
    },
  ];
  const completedSteps = setupSteps.filter((s) => s.done).length;
  const allComplete = completedSteps === setupSteps.length;

  // ----------------------------------------------------------
  // Reset
  // ----------------------------------------------------------

  function handleClearAll() {
    if (
      window.confirm(
        "Are you sure you want to clear all data? This will remove everything and cannot be undone."
      )
    ) {
      clearAllData();
    }
  }

  function handleLoadExample() {
    if (
      window.confirm(
        "Load example data? This will replace all current data with a sample household."
      )
    ) {
      loadExampleData();
    }
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

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

      <SettingsSummaryBar household={household} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full overflow-x-auto gap-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsTrigger value="household" className="gap-1.5 shrink-0">
            <Users className="size-3.5" />
            <span className="hidden sm:inline">Household</span>
            <span className="sm:hidden">Home</span>
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5 shrink-0">
            <Landmark className="size-3.5" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="funds" className="gap-1.5 shrink-0">
            <BookOpen className="size-3.5" />
            Funds
          </TabsTrigger>
          <TabsTrigger value="planning" className="gap-1.5 shrink-0">
            <Target className="size-3.5" />
            Planning
          </TabsTrigger>
          <TabsTrigger value="commitments" className="gap-1.5 shrink-0">
            <Receipt className="size-3.5" />
            <span className="hidden sm:inline">Commitments</span>
            <span className="sm:hidden">Bills</span>
          </TabsTrigger>
          <TabsTrigger value="iht" className="gap-1.5 shrink-0">
            <Shield className="size-3.5" />
            IHT
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5 shrink-0">
            <ArrowRightLeft className="size-3.5" />
            <span className="hidden sm:inline">Transactions</span>
            <span className="sm:hidden">Txns</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="household">
          <HouseholdTab
            household={household}
            updateHousehold={updateHousehold}
          />
        </TabsContent>

        <TabsContent value="accounts">
          <AccountsTab
            household={household}
            updateHousehold={updateHousehold}
          />
        </TabsContent>

        <TabsContent value="funds">
          <FundsTab
            household={household}
            updateHousehold={updateHousehold}
          />
        </TabsContent>

        <TabsContent value="planning">
          <PlanningTab
            household={household}
            updateHousehold={updateHousehold}
          />
        </TabsContent>

        <TabsContent value="commitments">
          <CommitmentsTab
            household={household}
            updateHousehold={updateHousehold}
          />
        </TabsContent>

        <TabsContent value="iht">
          <IhtTab
            household={household}
            updateHousehold={updateHousehold}
          />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsTab
            household={household}
            transactions={transactions}
            updateTransactions={updateTransactions}
          />
        </TabsContent>
      </Tabs>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Clear all data to start fresh, or load a pre-built example household
            to explore Runway&apos;s features.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleLoadExample}>
            Load Example Data
          </Button>
          <Button variant="destructive" onClick={handleClearAll}>
            Clear All Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
