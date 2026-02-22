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
  Percent,
  CalendarClock,
  Target,
  Save,
  Trash2,
  BookOpen,
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
import { getPersonContributionTotals, getPersonGrossIncome } from "@/types";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { calculateAge, projectFinalValue, calculateSWR, calculateProRataStatePension } from "@/lib/projections";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import {
  scaleSavingsRateContributions,
  calculateScenarioImpact,
  buildAvoidTaperPreset,
  generateScenarioDescription,
} from "@/lib/scenario";

// --- Smart Presets ---

interface SmartPreset {
  id: string;
  label: string;
  description: string;
  icon: typeof TrendingDown;
  getOverrides: (household: ReturnType<typeof useData>["household"]) => ScenarioOverrides;
}

const SMART_PRESETS: SmartPreset[] = [
  {
    id: "avoid-taper",
    label: "Avoid 60% Tax Trap",
    description: "Salary sacrifice to bring income below £100k",
    icon: ShieldCheck,
    getOverrides: (household) => buildAvoidTaperPreset(household.persons, household.income, household.contributions),
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
        aria-expanded={open}
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
      <div className={`grid transition-all duration-200 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden border-t">
          <div className="px-3 pb-3 pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

// --- Range Slider with Value ---

// BUG-007: All form inputs must have htmlFor/id linkage for WCAG compliance
let rangeIdCounter = 0;

function RangeInput({
  label,
  value,
  min,
  max,
  step,
  current,
  format,
  onChange,
  id: externalId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  current: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  id?: string;
}) {
  const inputId = externalId ?? `range-input-${++rangeIdCounter}`;
  const changed = value !== current;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId} className="text-xs text-muted-foreground">{label}</Label>
        <span className={`text-sm font-medium tabular-nums ${changed ? "text-primary" : ""}`}>
          {format(value)}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      {changed && (
        <p className="text-xs text-muted-foreground tabular-nums">
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
    overrides: activeOverrides,
    enableScenario,
    disableScenario,
    savedScenarios,
    saveScenario,
    loadScenario,
    deleteScenario,
  } = useScenario();

  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Track pension overrides for live preview
  const [pensionOverrides, setPensionOverrides] = useState<Record<string, number>>({});
  const [incomeOverrides, setIncomeOverrides] = useState<Record<string, number>>({});
  const [contributionOverrides, setContributionOverrides] = useState<
    Record<string, { isa?: number; pension?: number; gia?: number }>
  >({});
  const [marketShock, setMarketShock] = useState<string>("");
  const [savingsRateOverride, setSavingsRateOverride] = useState<number | null>(null);
  const [retirementAgeOverrides, setRetirementAgeOverrides] = useState<Record<string, number>>({});
  const [targetIncomeOverride, setTargetIncomeOverride] = useState<number | null>(null);

  // Current savings rate calculation
  const { currentSavingsRate, totalGrossIncome, contribsByPerson } = useMemo(() => {
    let totalContribs = 0;
    let totalGross = 0;
    const byPerson: Record<string, { isa: number; pension: number; gia: number; total: number }> = {};

    for (const person of household.persons) {
      const gross = getPersonGrossIncome(household.income, household.bonusStructures, person.id);
      totalGross += gross;

      const totals = getPersonContributionTotals(household.contributions, person.id);
      const personTotal = totals.isaContribution + totals.pensionContribution + totals.giaContribution;
      totalContribs += personTotal;

      byPerson[person.id] = {
        isa: totals.isaContribution,
        pension: totals.pensionContribution,
        gia: totals.giaContribution,
        total: personTotal,
      };
    }

    return {
      currentSavingsRate: totalGross > 0 ? (totalContribs / totalGross) * 100 : 0,
      totalGrossIncome: totalGross,
      contribsByPerson: byPerson,
    };
  }, [household]);

  // Reset form state when panel closes (if not in scenario mode)
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen);
      if (!newOpen && !isScenarioMode) {
        setPensionOverrides({});
        setIncomeOverrides({});
        setContributionOverrides({});
        setMarketShock("");
        setSavingsRateOverride(null);
        setRetirementAgeOverrides({});
        setTargetIncomeOverride(null);
      }
    },
    [isScenarioMode]
  );

  // Live impact preview
  const impactByPerson = useMemo(
    () => calculateScenarioImpact(household.persons, household.income, pensionOverrides),
    [household.persons, household.income, pensionOverrides]
  );

  const hasAnyChange = useMemo(() => {
    return (
      Object.keys(pensionOverrides).length > 0 ||
      Object.keys(incomeOverrides).some((k) => {
        const personIncome = household.income.find((i) => i.personId === k);
        return personIncome !== undefined && incomeOverrides[k] !== personIncome.grossSalary;
      }) ||
      Object.keys(contributionOverrides).length > 0 ||
      marketShock !== "" ||
      savingsRateOverride !== null ||
      Object.keys(retirementAgeOverrides).length > 0 ||
      targetIncomeOverride !== null
    );
  }, [pensionOverrides, incomeOverrides, contributionOverrides, marketShock, savingsRateOverride, retirementAgeOverrides, targetIncomeOverride, household.income]);

  const applyCustomScenario = useCallback(() => {
    const newOverrides: ScenarioOverrides = {};

    // Merge pension slider changes and salary input changes into a single
    // income overrides array, keyed by personId so both are applied together.
    const incomeByPerson = new Map<string, Partial<import("@/types").PersonIncome>>();

    // Pension overrides (from sliders)
    for (const [personId, newPension] of Object.entries(pensionOverrides)) {
      const income = household.income.find((i) => i.personId === personId);
      incomeByPerson.set(personId, {
        personId,
        employeePensionContribution: newPension,
        employerPensionContribution: income?.employerPensionContribution,
        pensionContributionMethod: income?.pensionContributionMethod,
      });
    }

    // Income overrides (salary) — merge into existing pension entries or create new ones.
    // BUG-013: Allow zero income (val >= 0) for redundancy scenarios.
    for (const [personId, grossSalary] of Object.entries(incomeOverrides)) {
      if (grossSalary >= 0 && incomeOverrides[personId] !== undefined) {
        const existing = incomeByPerson.get(personId) ?? { personId };
        incomeByPerson.set(personId, { ...existing, grossSalary });
      }
    }

    if (incomeByPerson.size > 0) {
      newOverrides.income = Array.from(incomeByPerson.values());
    }

    // Contribution overrides — savings rate slider takes priority over manual contribution inputs
    if (savingsRateOverride !== null && totalGrossIncome > 0) {
      newOverrides.contributionOverrides = scaleSavingsRateContributions(
        household.persons,
        household.income,
        household.bonusStructures,
        household.contributions,
        savingsRateOverride
      );
    } else {
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
    }

    // Market shock
    if (marketShock) {
      const pct = parseFloat(marketShock);
      if (!isNaN(pct)) newOverrides.marketShockPercent = pct / 100;
    }

    // Person overrides (retirement age)
    const personChanges = Object.entries(retirementAgeOverrides);
    if (personChanges.length > 0) {
      newOverrides.personOverrides = personChanges.map(([personId, plannedRetirementAge]) => ({
        id: personId,
        plannedRetirementAge,
      }));
    }

    // Retirement target income override
    if (targetIncomeOverride !== null) {
      newOverrides.retirement = {
        ...newOverrides.retirement,
        targetAnnualIncome: targetIncomeOverride,
      };
    }

    enableScenario("Custom Scenario", newOverrides);
  }, [household, pensionOverrides, incomeOverrides, contributionOverrides, marketShock, savingsRateOverride, totalGrossIncome, retirementAgeOverrides, targetIncomeOverride, enableScenario]);

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
      setSavingsRateOverride(null);
      setRetirementAgeOverrides({});
      setTargetIncomeOverride(null);
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
    setSavingsRateOverride(null);
    setRetirementAgeOverrides({});
    setTargetIncomeOverride(null);
  }, [disableScenario]);

  // Precompute scaled contributions for savings rate preview
  const scaledContributions = useMemo(() => {
    if (savingsRateOverride === null || totalGrossIncome <= 0) return null;
    return scaleSavingsRateContributions(
      household.persons,
      household.income,
      household.bonusStructures,
      household.contributions,
      savingsRateOverride
    );
  }, [savingsRateOverride, totalGrossIncome, household.persons, household.income, household.bonusStructures, household.contributions]);

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
          className="gap-1.5 min-h-[44px] min-w-[44px]"
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
                    <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{formatCurrencyCompact(totalImpact.totalSaved)}/yr
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Take-Home Change</p>
                    <p className={`text-lg font-bold tabular-nums ${totalImpact.totalTakeHomeChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
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

          {/* FEAT-019: Saved Scenarios */}
          {savedScenarios.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Saved Scenarios
              </h3>
              <div className="space-y-2">
                {savedScenarios.map((scenario) => (
                  <div
                    key={scenario.name}
                    className="flex items-start gap-2 rounded-lg border p-3"
                  >
                    <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => {
                          loadScenario(scenario.name);
                          setOpen(false);
                        }}
                        className="text-left"
                      >
                        <p className="text-sm font-medium">{scenario.name}</p>
                        {scenario.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {scenario.description}
                          </p>
                        )}
                      </button>
                    </div>
                    <button
                      onClick={() => deleteScenario(scenario.name)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${scenario.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                      <div className="flex gap-3 rounded-md bg-muted/50 px-2 py-1.5 tabular-nums">
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

          {/* Savings Rate Slider */}
          <Section title="Savings Rate" icon={Percent} defaultOpen={true}>
            <div className="space-y-3">
              <RangeInput
                label="Household savings rate"
                value={savingsRateOverride ?? Math.round(currentSavingsRate * 10) / 10}
                min={0}
                max={50}
                step={0.5}
                current={Math.round(currentSavingsRate * 10) / 10}
                format={(v) => `${v.toFixed(1)}%`}
                onChange={(v) => setSavingsRateOverride(v)}
              />
              {scaledContributions && (
                <div className="rounded-md bg-muted/50 px-2 py-1.5 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Total contributions: <span className="tabular-nums font-medium text-foreground">{formatCurrencyCompact(Math.round((savingsRateOverride! / 100) * totalGrossIncome))}/yr</span>
                    <span className="text-muted-foreground/60"> (was {formatCurrencyCompact(Math.round((currentSavingsRate / 100) * totalGrossIncome))})</span>
                  </p>
                  {scaledContributions.map((co) => {
                    const person = household.persons.find((p) => p.id === co.personId);
                    if (!person) return null;
                    return (
                      <p key={co.personId} className="text-xs text-muted-foreground tabular-nums">
                        {person.name}: ISA {formatCurrencyCompact(co.isaContribution ?? 0)} · Pension {formatCurrencyCompact(co.pensionContribution ?? 0)} · GIA {formatCurrencyCompact(co.giaContribution ?? 0)}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>

          {/* Target Retirement Income */}
          <Section title="Target Retirement Income" icon={Target} defaultOpen={true}>
            <div className="space-y-3">
              <RangeInput
                label="Annual income in retirement"
                value={targetIncomeOverride ?? household.retirement.targetAnnualIncome}
                min={10000}
                max={200000}
                step={1000}
                current={household.retirement.targetAnnualIncome}
                format={(v) => formatCurrencyCompact(v)}
                onChange={(v) => setTargetIncomeOverride(v)}
              />
              {targetIncomeOverride !== null && targetIncomeOverride !== household.retirement.targetAnnualIncome && (
                <div className="rounded-md bg-muted/50 px-2 py-1.5 space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    Required pot changes from{" "}
                    <span className="tabular-nums font-medium text-foreground">
                      {formatCurrencyCompact(household.retirement.targetAnnualIncome / household.retirement.withdrawalRate)}
                    </span>
                    {" → "}
                    <span className="tabular-nums font-medium text-foreground">
                      {formatCurrencyCompact(targetIncomeOverride / household.retirement.withdrawalRate)}
                    </span>
                    <span className="text-muted-foreground/60"> at {(household.retirement.withdrawalRate * 100).toFixed(0)}% SWR</span>
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Retirement Age */}
          <Section title="Retirement Age" icon={CalendarClock}>
            <div className="space-y-4">
              {household.persons.map((person) => {
                const currentPlannedAge = person.plannedRetirementAge;
                const sliderValue = retirementAgeOverrides[person.id] ?? currentPlannedAge;
                const age = calculateAge(person.dateOfBirth);
                const yearsToRetirement = Math.max(0, sliderValue - age);

                // Project total pot at chosen retirement age
                const personAccounts = household.accounts.filter((a) => a.personId === person.id);
                const currentPot = personAccounts.reduce((s, a) => s + a.currentValue, 0);
                const personContribs = contribsByPerson[person.id] ?? { isa: 0, pension: 0, gia: 0, total: 0 };
                const personIncome = household.income.find((i) => i.personId === person.id);
                const annualContrib = personContribs.total + (personIncome?.employeePensionContribution ?? 0) + (personIncome?.employerPensionContribution ?? 0);
                const growthRate = household.retirement.scenarioRates[Math.floor(household.retirement.scenarioRates.length / 2)] ?? 0.05;
                const projectedPot = projectFinalValue(currentPot, annualContrib, growthRate, yearsToRetirement);
                const withdrawalRate = household.retirement.withdrawalRate;
                const sustainableIncome = calculateSWR(projectedPot, withdrawalRate);
                const statePension = household.retirement.includeStatePension
                  ? calculateProRataStatePension(person.niQualifyingYears)
                  : 0;

                const changed = sliderValue !== currentPlannedAge;

                return (
                  <div key={person.id} className="space-y-2">
                    <RangeInput
                      label={`${person.name} — retire at`}
                      value={sliderValue}
                      min={Math.max(45, age + 1)}
                      max={75}
                      step={1}
                      current={currentPlannedAge}
                      format={(v) => `${v}`}
                      onChange={(v) =>
                        setRetirementAgeOverrides((prev) => ({
                          ...prev,
                          [person.id]: v,
                        }))
                      }
                    />
                    {changed && (
                      <div className="rounded-md bg-muted/50 px-2 py-1.5 space-y-0.5">
                        <p className="text-xs text-muted-foreground">
                          {yearsToRetirement > 0
                            ? <><span className="tabular-nums font-medium text-foreground">{yearsToRetirement}yr</span> until retirement</>
                            : <span className="font-medium text-amber-600 dark:text-amber-400">Already past this age</span>}
                        </p>
                        {yearsToRetirement > 0 && (
                          <>
                            {sliderValue < person.pensionAccessAge && (
                              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                Pension locked until age {person.pensionAccessAge} ({person.pensionAccessAge - sliderValue}yr gap — need accessible savings to bridge)
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Projected pot: <span className="tabular-nums font-medium text-foreground">{formatCurrencyCompact(projectedPot)}</span>
                              <span className="text-muted-foreground/60"> at {(growthRate * 100).toFixed(0)}% growth</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Sustainable income: <span className="tabular-nums font-medium text-foreground">{formatCurrencyCompact(sustainableIncome)}/yr</span>
                              <span className="text-muted-foreground/60"> at {(withdrawalRate * 100).toFixed(0)}% SWR</span>
                              {statePension > 0 && (
                                <span className="text-muted-foreground/60"> + {formatCurrencyCompact(statePension)} state pension</span>
                              )}
                            </p>
                            {statePension > 0 && (
                              <p className="text-xs font-medium text-foreground tabular-nums">
                                Total: {formatCurrencyCompact(sustainableIncome + statePension)}/yr
                              </p>
                            )}
                          </>
                        )}
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
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setIncomeOverrides((prev) => {
                            const next = { ...prev };
                            delete next[person.id];
                            return next;
                          });
                        } else {
                          setIncomeOverrides((prev) => ({
                            ...prev,
                            [person.id]: parseFloat(raw),
                          }));
                        }
                      }}
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
                                isa: e.target.value === "" ? undefined : parseFloat(e.target.value),
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
                                pension: e.target.value === "" ? undefined : parseFloat(e.target.value),
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
                                gia: e.target.value === "" ? undefined : parseFloat(e.target.value),
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

          {/* Apply / Save / Reset — sticky footer with safe-area padding for mobile browser chrome */}
          <div className="sticky bottom-0 -mx-4 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {/* FEAT-019: Save current scenario */}
            {isScenarioMode && (
              <div className="mb-2 flex gap-2">
                <Input
                  placeholder="Save as..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && saveName.trim()) {
                      const desc = generateScenarioDescription(activeOverrides, household);
                      saveScenario(saveName.trim(), desc);
                      setSaveName("");
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!saveName.trim()}
                  onClick={() => {
                    const desc = generateScenarioDescription(activeOverrides, household);
                    saveScenario(saveName.trim(), desc);
                    setSaveName("");
                  }}
                >
                  <Save className="mr-1 size-3.5" />
                  Save
                </Button>
              </div>
            )}
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
