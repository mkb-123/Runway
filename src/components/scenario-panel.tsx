"use client";

// ============================================================
// What-If Scenario Panel
// ============================================================
// A slide-out panel that lets users tweak income, contributions,
// market conditions, and expenses to see how changes affect
// their financial picture — without modifying real data.

import { useState } from "react";
import {
  FlaskConical,
  RotateCcw,
  Zap,
  TrendingDown,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useScenario, type ScenarioOverrides } from "@/context/scenario-context";
import { useData } from "@/context/data-context";
import { formatCurrency } from "@/lib/format";

/** Preset scenarios for quick selection */
const PRESETS = [
  {
    id: "crash-30",
    label: "Market Crash (-30%)",
    icon: TrendingDown,
    overrides: { marketShockPercent: -0.3 } as ScenarioOverrides,
  },
  {
    id: "crash-50",
    label: "Severe Crash (-50%)",
    icon: TrendingDown,
    overrides: { marketShockPercent: -0.5 } as ScenarioOverrides,
  },
] as const;

export function ScenarioPanel() {
  const { household } = useData();
  const {
    isScenarioMode,
    scenarioLabel,
    enableScenario,
    disableScenario,
  } = useScenario();

  const [open, setOpen] = useState(false);

  // Local form state for custom scenario
  const [incomeOverrides, setIncomeOverrides] = useState<
    Record<string, number>
  >({});
  const [contributionOverrides, setContributionOverrides] = useState<
    Record<string, { isa?: number; pension?: number; gia?: number }>
  >({});
  const [marketShock, setMarketShock] = useState<string>("");
  const [expensesOverride, setExpensesOverride] = useState<string>("");

  const applyCustomScenario = () => {
    const newOverrides: ScenarioOverrides = {};

    // Income overrides
    const incomeChanges = Object.entries(incomeOverrides).filter(
      ([, val]) => val > 0
    );
    if (incomeChanges.length > 0) {
      newOverrides.income = incomeChanges.map(([personId, grossSalary]) => ({
        personId,
        grossSalary,
      }));
    }

    // Contribution overrides
    const contribChanges = Object.entries(contributionOverrides).filter(
      ([, val]) =>
        val.isa !== undefined || val.pension !== undefined || val.gia !== undefined
    );
    if (contribChanges.length > 0) {
      newOverrides.annualContributions = contribChanges.map(
        ([personId, vals]) => ({
          personId,
          ...(vals.isa !== undefined ? { isaContribution: vals.isa } : {}),
          ...(vals.pension !== undefined
            ? { pensionContribution: vals.pension }
            : {}),
          ...(vals.gia !== undefined ? { giaContribution: vals.gia } : {}),
        })
      );
    }

    // Market shock
    if (marketShock) {
      const pct = parseFloat(marketShock);
      if (!isNaN(pct)) {
        newOverrides.marketShockPercent = pct / 100;
      }
    }

    // Expenses
    if (expensesOverride) {
      const exp = parseFloat(expensesOverride);
      if (!isNaN(exp)) {
        newOverrides.estimatedAnnualExpenses = exp;
      }
    }

    enableScenario("Custom Scenario", newOverrides);
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    // Reset custom fields
    setIncomeOverrides({});
    setContributionOverrides({});
    setMarketShock(
      preset.overrides.marketShockPercent
        ? String(preset.overrides.marketShockPercent * 100)
        : ""
    );
    setExpensesOverride("");
    enableScenario(preset.label, preset.overrides);
  };

  const handleReset = () => {
    disableScenario();
    setIncomeOverrides({});
    setContributionOverrides({});
    setMarketShock("");
    setExpensesOverride("");
  };

  return (
    <>
      {/* Trigger button (always visible in nav area) */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant={isScenarioMode ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
          >
            <FlaskConical className="size-3.5" />
            <span className="hidden sm:inline">What If</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-96 overflow-y-auto p-0">
          <SheetHeader className="border-b px-4 py-4">
            <SheetTitle className="flex items-center gap-2">
              <FlaskConical className="size-5 text-amber-500" />
              What-If Scenario Mode
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6 p-4">
            {/* Quick Presets */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Quick Presets
              </h3>
              <div className="grid gap-2">
                {PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <Button
                      key={preset.id}
                      variant="outline"
                      className="justify-start gap-2"
                      onClick={() => {
                        applyPreset(preset);
                        setOpen(false);
                      }}
                    >
                      <Icon className="size-4" />
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="border-t" />

            {/* Custom Scenario Builder */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Custom Scenario
              </h3>

              {/* Income Changes */}
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Briefcase className="size-4" />
                    Income Changes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {household.persons.map((person) => {
                    const currentIncome = household.income.find(
                      (i) => i.personId === person.id
                    );
                    return (
                      <div key={person.id}>
                        <Label className="text-xs text-muted-foreground">
                          {person.name} (currently{" "}
                          {formatCurrency(currentIncome?.grossSalary ?? 0)})
                        </Label>
                        <Input
                          type="number"
                          placeholder="New gross salary"
                          value={incomeOverrides[person.id] ?? ""}
                          onChange={(e) =>
                            setIncomeOverrides((prev) => ({
                              ...prev,
                              [person.id]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="mt-1"
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Contribution Changes */}
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Zap className="size-4" />
                    Contribution Changes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {household.persons.map((person) => {
                    const currentContrib =
                      household.annualContributions.find(
                        (c) => c.personId === person.id
                      );
                    return (
                      <div key={person.id} className="space-y-2">
                        <p className="text-xs font-medium">{person.name}</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              ISA
                            </Label>
                            <Input
                              type="number"
                              placeholder={String(
                                currentContrib?.isaContribution ?? 0
                              )}
                              value={
                                contributionOverrides[person.id]?.isa ?? ""
                              }
                              onChange={(e) =>
                                setContributionOverrides((prev) => ({
                                  ...prev,
                                  [person.id]: {
                                    ...prev[person.id],
                                    isa: parseFloat(e.target.value) || undefined,
                                  },
                                }))
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              Pension
                            </Label>
                            <Input
                              type="number"
                              placeholder={String(
                                currentContrib?.pensionContribution ?? 0
                              )}
                              value={
                                contributionOverrides[person.id]?.pension ?? ""
                              }
                              onChange={(e) =>
                                setContributionOverrides((prev) => ({
                                  ...prev,
                                  [person.id]: {
                                    ...prev[person.id],
                                    pension:
                                      parseFloat(e.target.value) || undefined,
                                  },
                                }))
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              GIA
                            </Label>
                            <Input
                              type="number"
                              placeholder={String(
                                currentContrib?.giaContribution ?? 0
                              )}
                              value={
                                contributionOverrides[person.id]?.gia ?? ""
                              }
                              onChange={(e) =>
                                setContributionOverrides((prev) => ({
                                  ...prev,
                                  [person.id]: {
                                    ...prev[person.id],
                                    gia:
                                      parseFloat(e.target.value) || undefined,
                                  },
                                }))
                              }
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Market Shock */}
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingDown className="size-4" />
                    Market Shock
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Label className="text-xs text-muted-foreground">
                    Portfolio change (%, e.g. -30 for a 30% crash)
                  </Label>
                  <Input
                    type="number"
                    placeholder="-30"
                    value={marketShock}
                    onChange={(e) => setMarketShock(e.target.value)}
                    className="mt-1"
                  />
                </CardContent>
              </Card>

              {/* Expenses Override */}
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Annual Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <Label className="text-xs text-muted-foreground">
                    Override (currently{" "}
                    {formatCurrency(household.estimatedAnnualExpenses)})
                  </Label>
                  <Input
                    type="number"
                    placeholder={String(household.estimatedAnnualExpenses)}
                    value={expensesOverride}
                    onChange={(e) => setExpensesOverride(e.target.value)}
                    className="mt-1"
                  />
                </CardContent>
              </Card>

              {/* Apply / Reset */}
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    applyCustomScenario();
                    setOpen(false);
                  }}
                  className="flex-1"
                >
                  <Zap className="mr-1.5 size-4" />
                  Apply Scenario
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="mr-1.5 size-4" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
