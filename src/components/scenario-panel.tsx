"use client";

// ============================================================
// What-If Scenario Panel (Enhanced)
// ============================================================
// Mobile-first interactive scenario modeller with:
// - Range sliders for key financial inputs
// - Live impact preview (tax saved, take-home change)
// - Smart presets (avoid 60% trap, bonus deployment)
// - Bottom sheet on mobile, side panel on desktop

import { useState, useMemo, useCallback } from "react";
import {
  FlaskConical,
  RotateCcw,
  Zap,
  TrendingDown,
  Briefcase,
  ShieldCheck,
  PiggyBank,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { getPersonContributionTotals } from "@/types";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { calculateIncomeTax, calculateNI } from "@/lib/tax";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";

// --- Types ---

interface ImpactPreview {
  taxSaved: number;
  niSaved: number;
  totalSaved: number;
  newTakeHome: number;
  takeHomeChange: number;
}

// --- Smart Presets ---

interface SmartPreset {
  id: string;
  label: string;
  description: string;
  icon: typeof TrendingDown;
  getOverrides: (household: ReturnType<typeof useData>["household"]) => ScenarioOverrides;
}

function buildAvoidTaperPreset(household: ReturnType<typeof useData>["household"]): ScenarioOverrides {
  const overrides: ScenarioOverrides = { income: [] };
  for (const person of household.persons) {
    const income = household.income.find((i) => i.personId === person.id);
    if (!income) continue;

    const adjustedGross =
      income.pensionContributionMethod === "salary_sacrifice" || income.pensionContributionMethod === "net_pay"
        ? income.grossSalary - income.employeePensionContribution
        : income.grossSalary;

    if (adjustedGross > UK_TAX_CONSTANTS.personalAllowanceTaperThreshold && adjustedGross <= UK_TAX_CONSTANTS.incomeTax.higherRateUpperLimit) {
      const excess = adjustedGross - UK_TAX_CONSTANTS.personalAllowanceTaperThreshold;
      const contribs = getPersonContributionTotals(household.contributions, person.id);
      const pensionUsed = income.employeePensionContribution + income.employerPensionContribution + contribs.pensionContribution;
      const headroom = UK_TAX_CONSTANTS.pensionAnnualAllowance - pensionUsed;
      const additionalSacrifice = Math.min(excess, headroom);

      if (additionalSacrifice > 0) {
        overrides.income!.push({
          personId: person.id,
          grossSalary: income.grossSalary,
          employeePensionContribution: income.employeePensionContribution + additionalSacrifice,
          employerPensionContribution: income.employerPensionContribution,
          pensionContributionMethod: income.pensionContributionMethod,
        });
      }
    }
  }
  return overrides;
}

const SMART_PRESETS: SmartPreset[] = [
  {
    id: "avoid-taper",
    label: "Avoid 60% Tax Trap",
    description: "Salary sacrifice to bring income below £100k",
    icon: ShieldCheck,
    getOverrides: buildAvoidTaperPreset,
  },
  {
    id: "max-pension",
    label: "Max Pension Contributions",
    description: "Use full £60k annual allowance per person",
    icon: PiggyBank,
    getOverrides: (household) => ({
      income: household.persons
        .map((person) => {
          const income = household.income.find((i) => i.personId === person.id);
          if (!income) return null;
          const contribs = getPersonContributionTotals(household.contributions, person.id);
          const maxEmployee = Math.max(0, UK_TAX_CONSTANTS.pensionAnnualAllowance - income.employerPensionContribution - contribs.pensionContribution);
          return {
            personId: person.id,
            grossSalary: income.grossSalary,
            employeePensionContribution: Math.min(maxEmployee, income.grossSalary),
            employerPensionContribution: income.employerPensionContribution,
            pensionContributionMethod: income.pensionContributionMethod,
          };
        })
        .filter(Boolean) as Partial<import("@/types").PersonIncome>[],
    }),
  },
  {
    id: "crash-30",
    label: "Market Crash (-30%)",
    description: "Test resilience to a major market downturn",
    icon: TrendingDown,
    getOverrides: () => ({ marketShockPercent: -0.3 }),
  },
  {
    id: "crash-50",
    label: "Severe Crash (-50%)",
    description: "Stress test with a severe market crash",
    icon: TrendingDown,
    getOverrides: () => ({ marketShockPercent: -0.5 }),
  },
];

// --- Impact Calculator ---

function calculateImpact(
  household: ReturnType<typeof useData>["household"],
  pensionOverrides: Record<string, number>
): Map<string, ImpactPreview> {
  const results = new Map<string, ImpactPreview>();

  for (const person of household.persons) {
    const income = household.income.find((i) => i.personId === person.id);
    if (!income) continue;

    const newPension = pensionOverrides[person.id] ?? income.employeePensionContribution;

    const currentTax = calculateIncomeTax(
      income.grossSalary,
      income.employeePensionContribution,
      income.pensionContributionMethod
    );
    const newTax = calculateIncomeTax(
      income.grossSalary,
      newPension,
      income.pensionContributionMethod
    );

    const currentNI = calculateNI(
      income.grossSalary,
      income.employeePensionContribution,
      income.pensionContributionMethod
    );
    const newNI = calculateNI(
      income.grossSalary,
      newPension,
      income.pensionContributionMethod
    );

    const taxSaved = currentTax.tax - newTax.tax;
    const niSaved = currentNI.ni - newNI.ni;

    const currentTakeHome =
      income.grossSalary - income.employeePensionContribution - currentTax.tax - currentNI.ni;
    const newTakeHome =
      income.grossSalary - newPension - newTax.tax - newNI.ni;

    results.set(person.id, {
      taxSaved: Math.round(taxSaved),
      niSaved: Math.round(niSaved),
      totalSaved: Math.round(taxSaved + niSaved),
      newTakeHome: Math.round(newTakeHome),
      takeHomeChange: Math.round(newTakeHome - currentTakeHome),
    });
  }

  return results;
}

// --- Collapsible Section ---

function Section({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: typeof Briefcase;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-primary" />
          {title}
        </span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="border-t px-3 pb-3 pt-3">{children}</div>}
    </div>
  );
}

// --- Range Slider with Value ---

function RangeInput({
  label,
  value,
  min,
  max,
  step,
  current,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  current: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const changed = value !== current;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className={`text-sm font-medium tabular-nums ${changed ? "text-primary" : ""}`}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      {changed && (
        <p className="text-xs text-muted-foreground">
          Currently {format(current)}
        </p>
      )}
    </div>
  );
}

// --- Main Component ---

export function ScenarioPanel() {
  const { household } = useData();
  const {
    isScenarioMode,
    enableScenario,
    disableScenario,
  } = useScenario();

  const [open, setOpen] = useState(false);

  // Track pension overrides for live preview
  const [pensionOverrides, setPensionOverrides] = useState<Record<string, number>>({});
  const [incomeOverrides, setIncomeOverrides] = useState<Record<string, number>>({});
  const [contributionOverrides, setContributionOverrides] = useState<
    Record<string, { isa?: number; pension?: number; gia?: number }>
  >({});
  const [marketShock, setMarketShock] = useState<string>("");

  // Reset form state when panel closes (if not in scenario mode)
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen);
      if (!newOpen && !isScenarioMode) {
        setPensionOverrides({});
        setIncomeOverrides({});
        setContributionOverrides({});
        setMarketShock("");
      }
    },
    [isScenarioMode]
  );

  // Live impact preview
  const impactByPerson = useMemo(
    () => calculateImpact(household, pensionOverrides),
    [household, pensionOverrides]
  );

  const hasAnyChange = useMemo(() => {
    return (
      Object.keys(pensionOverrides).length > 0 ||
      Object.keys(incomeOverrides).some((k) => incomeOverrides[k] > 0) ||
      Object.keys(contributionOverrides).length > 0 ||
      marketShock !== ""
    );
  }, [pensionOverrides, incomeOverrides, contributionOverrides, marketShock]);

  const applyCustomScenario = useCallback(() => {
    const newOverrides: ScenarioOverrides = {};

    // Pension overrides (from sliders)
    const pensionChanges = Object.entries(pensionOverrides);
    if (pensionChanges.length > 0) {
      newOverrides.income = pensionChanges.map(([personId, newPension]) => {
        const income = household.income.find((i) => i.personId === personId);
        return {
          personId,
          grossSalary: incomeOverrides[personId] || income?.grossSalary,
          employeePensionContribution: newPension,
          employerPensionContribution: income?.employerPensionContribution,
          pensionContributionMethod: income?.pensionContributionMethod,
        };
      });
    }

    // Income overrides (salary)
    // BUG-013: Allow zero income (val >= 0) for redundancy scenarios
    const salaryChanges = Object.entries(incomeOverrides).filter(([, val]) => val >= 0);
    if (salaryChanges.length > 0 && !newOverrides.income) {
      newOverrides.income = salaryChanges.map(([personId, grossSalary]) => ({
        personId,
        grossSalary,
      }));
    }

    // Contribution overrides
    const contribChanges = Object.entries(contributionOverrides).filter(
      ([, val]) => val.isa !== undefined || val.pension !== undefined || val.gia !== undefined
    );
    if (contribChanges.length > 0) {
      newOverrides.contributionOverrides = contribChanges.map(([personId, vals]) => ({
        personId,
        ...(vals.isa !== undefined ? { isaContribution: vals.isa } : {}),
        ...(vals.pension !== undefined ? { pensionContribution: vals.pension } : {}),
        ...(vals.gia !== undefined ? { giaContribution: vals.gia } : {}),
      }));
    }

    // Market shock
    if (marketShock) {
      const pct = parseFloat(marketShock);
      if (!isNaN(pct)) newOverrides.marketShockPercent = pct / 100;
    }

    enableScenario("Custom Scenario", newOverrides);
  }, [household, pensionOverrides, incomeOverrides, contributionOverrides, marketShock, enableScenario]);

  const applyPreset = useCallback(
    (preset: SmartPreset) => {
      const overrides = preset.getOverrides(household);
      enableScenario(preset.label, overrides);

      // Sync pension slider state from preset
      const newPensionOverrides: Record<string, number> = {};
      if (overrides.income) {
        for (const inc of overrides.income) {
          if (inc.personId && inc.employeePensionContribution !== undefined) {
            newPensionOverrides[inc.personId] = inc.employeePensionContribution;
          }
        }
      }
      setPensionOverrides(newPensionOverrides);
      setIncomeOverrides({});
      setContributionOverrides({});
      setMarketShock(
        overrides.marketShockPercent !== undefined
          ? String(overrides.marketShockPercent * 100)
          : ""
      );
    },
    [household, enableScenario]
  );

  const handleReset = useCallback(() => {
    disableScenario();
    setPensionOverrides({});
    setIncomeOverrides({});
    setContributionOverrides({});
    setMarketShock("");
  }, [disableScenario]);

  // Total impact summary
  const totalImpact = useMemo(() => {
    let totalSaved = 0;
    let totalTakeHomeChange = 0;
    for (const [, impact] of impactByPerson) {
      totalSaved += impact.totalSaved;
      totalTakeHomeChange += impact.takeHomeChange;
    }
    return { totalSaved, totalTakeHomeChange };
  }, [impactByPerson]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
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

      {/* Bottom sheet on mobile, side panel on desktop */}
      {/* BUG-006: Use w-full on mobile to avoid 384px overflow on 375px viewport */}
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-0 sm:inset-y-0 sm:right-0 sm:bottom-auto sm:left-auto sm:h-full sm:max-h-none sm:w-full sm:max-w-[420px] sm:rounded-none sm:border-l sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right"
      >
        <SheetHeader className="sticky top-0 z-10 border-b bg-background px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-4 text-primary" />
            What-If Scenarios
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {/* Live Impact Preview (shows when pension sliders have been moved) */}
          {totalImpact.totalSaved !== 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Tax + NI Saved</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatCurrencyCompact(totalImpact.totalSaved)}/yr
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Take-Home Change</p>
                    <p className={`text-lg font-bold ${totalImpact.totalTakeHomeChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {totalImpact.totalTakeHomeChange >= 0 ? "+" : ""}
                      {formatCurrencyCompact(totalImpact.totalTakeHomeChange)}/yr
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Smart Presets */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Quick Scenarios
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {SMART_PRESETS.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      applyPreset(preset);
                      setOpen(false);
                    }}
                    className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent active:bg-accent"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{preset.label}</p>
                      <p className="text-xs text-muted-foreground">{preset.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t" />

          {/* Pension Sacrifice Sliders (with live impact) */}
          <Section title="Pension Sacrifice" icon={PiggyBank} defaultOpen={true}>
            <div className="space-y-4">
              {household.persons.map((person) => {
                const income = household.income.find((i) => i.personId === person.id);
                if (!income) return null;

                const currentPension = income.employeePensionContribution;
                const maxPension = Math.min(
                  UK_TAX_CONSTANTS.pensionAnnualAllowance,
                  income.grossSalary
                );
                const sliderValue = pensionOverrides[person.id] ?? currentPension;
                const impact = impactByPerson.get(person.id);

                return (
                  <div key={person.id} className="space-y-2">
                    <RangeInput
                      label={`${person.name} — pension contribution`}
                      value={sliderValue}
                      min={0}
                      max={maxPension}
                      step={500}
                      current={currentPension}
                      format={(v) => formatCurrencyCompact(v)}
                      onChange={(v) =>
                        setPensionOverrides((prev) => ({
                          ...prev,
                          [person.id]: v,
                        }))
                      }
                    />
                    {impact && impact.totalSaved !== 0 && (
                      <div className="flex gap-3 rounded-md bg-muted/50 px-2 py-1.5">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          Tax: +{formatCurrencyCompact(impact.taxSaved)}
                        </span>
                        {impact.niSaved > 0 && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            NI: +{formatCurrencyCompact(impact.niSaved)}
                          </span>
                        )}
                        <span className={`text-xs ${impact.takeHomeChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          Take-home: {impact.takeHomeChange >= 0 ? "+" : ""}
                          {formatCurrencyCompact(impact.takeHomeChange)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Income Changes */}
          <Section title="Income Changes" icon={Briefcase}>
            <div className="space-y-3">
              {household.persons.map((person) => {
                const currentIncome = household.income.find((i) => i.personId === person.id);
                const inputId = `income-${person.id}`;
                return (
                  <div key={person.id}>
                    <Label htmlFor={inputId} className="text-xs text-muted-foreground">
                      {person.name} (currently {formatCurrency(currentIncome?.grossSalary ?? 0)})
                    </Label>
                    <Input
                      id={inputId}
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
            </div>
          </Section>

          {/* Market Shock */}
          <Section title="Market Shock" icon={TrendingDown}>
            <div className="space-y-3">
              <div>
                <Label htmlFor="market-shock-input" className="text-xs text-muted-foreground">
                  Market shock (%, e.g. -30)
                </Label>
                <Input
                  id="market-shock-input"
                  type="number"
                  placeholder="-30"
                  value={marketShock}
                  onChange={(e) => setMarketShock(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </Section>

          {/* Contribution Changes */}
          <Section title="Contribution Changes" icon={Zap}>
            <div className="space-y-4">
              {household.persons.map((person) => {
                const currentContrib = getPersonContributionTotals(household.contributions, person.id);
                return (
                  <div key={person.id} className="space-y-2">
                    <p className="text-xs font-medium">{person.name}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label htmlFor={`contrib-isa-${person.id}`} className="text-xs text-muted-foreground">ISA</Label>
                        <Input
                          id={`contrib-isa-${person.id}`}
                          type="number"
                          placeholder={String(currentContrib.isaContribution)}
                          value={contributionOverrides[person.id]?.isa ?? ""}
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
                        <Label htmlFor={`contrib-pension-${person.id}`} className="text-xs text-muted-foreground">Pension</Label>
                        <Input
                          id={`contrib-pension-${person.id}`}
                          type="number"
                          placeholder={String(currentContrib.pensionContribution)}
                          value={contributionOverrides[person.id]?.pension ?? ""}
                          onChange={(e) =>
                            setContributionOverrides((prev) => ({
                              ...prev,
                              [person.id]: {
                                ...prev[person.id],
                                pension: parseFloat(e.target.value) || undefined,
                              },
                            }))
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`contrib-gia-${person.id}`} className="text-xs text-muted-foreground">GIA</Label>
                        <Input
                          id={`contrib-gia-${person.id}`}
                          type="number"
                          placeholder={String(currentContrib.giaContribution)}
                          value={contributionOverrides[person.id]?.gia ?? ""}
                          onChange={(e) =>
                            setContributionOverrides((prev) => ({
                              ...prev,
                              [person.id]: {
                                ...prev[person.id],
                                gia: parseFloat(e.target.value) || undefined,
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
            </div>
          </Section>

          {/* Apply / Reset — sticky footer on mobile */}
          <div className="sticky bottom-0 -mx-4 border-t bg-background px-4 py-3">
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  applyCustomScenario();
                  setOpen(false);
                }}
                className="flex-1"
                disabled={!hasAnyChange && !isScenarioMode}
              >
                <Zap className="mr-1.5 size-4" />
                Apply Scenario
              </Button>
              {isScenarioMode && (
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="mr-1.5 size-4" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
