"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users,
  Landmark,
  Target,
  Shield,
  Receipt,
  CheckCircle2,
  Circle,
  Download,
  Upload,
} from "lucide-react";
import { useData } from "@/context/data-context";
import {
  HouseholdDataSchema,
  SnapshotsDataSchema,
} from "@/lib/schemas";
import { z } from "zod";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

const RunwayExportSchema = z.object({
  _runway: z.literal(true),
  version: z.literal(1),
  exportedAt: z.string(),
  household: HouseholdDataSchema,
  snapshots: SnapshotsDataSchema,
});

import { HouseholdTab } from "./components/household-tab";
import { AccountsTab } from "./components/accounts-tab";
import { PlanningTab } from "./components/planning-tab";
import { IhtTab } from "./components/iht-tab";
import { CommitmentsTab } from "./components/commitments-tab";
import { SettingsSummaryBar } from "./components/settings-summary-bar";

// ============================================================
// Settings Page — Thin Orchestrator
// ============================================================

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const {
    household,
    snapshots,
    updateHousehold,
    updateSnapshots,
    clearAllData,
    loadExampleData,
  } = useData();

  const searchParams = useSearchParams();
  const validTabs = ["household", "accounts", "planning", "commitments", "iht"];
  const tabFromUrl = searchParams.get("tab");
  const urlTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : null;
  const [localTab, setLocalTab] = useState(urlTab ?? "household");
  const activeTab = urlTab ?? localTab;
  const setActiveTab = setLocalTab;
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------------
  // Quick Setup completeness
  // ----------------------------------------------------------

  const hasPersons =
    household.persons.length > 0 &&
    household.persons.some((p) => p.name.length > 0);
  const hasAccounts = household.accounts.length > 0;
  const hasIncome = household.income.some((i) => i.grossSalary > 0);
  const hasContributions = household.contributions.some(
    (c) => c.amount > 0
  );
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
  // Export / Import
  // ----------------------------------------------------------

  function handleExport() {
    const payload = {
      _runway: true as const,
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      household,
      snapshots,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `runway-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        const result = RunwayExportSchema.safeParse(raw);
        if (!result.success) {
          const issues = result.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
          setImportError(`Invalid file: ${issues}`);
          return;
        }
        if (
          !window.confirm(
            "Import this file? All current data will be replaced."
          )
        ) {
          return;
        }
        updateHousehold(result.data.household);
        updateSnapshots(result.data.snapshots);
        setImportError(null);
      } catch {
        setImportError("Could not parse file. Make sure it is valid JSON.");
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader title="Settings" description="Manage all your financial data. Changes are saved automatically." />

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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
      </Tabs>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Export your data as JSON to back up or transfer between devices.
            Import a previously exported file to restore.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-1.5" onClick={handleExport}>
              <Download className="size-3.5" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Import JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
          {importError && (
            <p className="text-sm text-destructive">{importError}</p>
          )}
          <hr className="border-border" />
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleLoadExample}>
              Load Example Data
            </Button>
            <Button variant="destructive" onClick={handleClearAll}>
              Clear All Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
