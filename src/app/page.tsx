"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Settings,
  TrendingUp,
  TrendingDown,
  X,
  Lightbulb,
  ArrowRight,
  Wallet2,
  Banknote,
  Clock,
  BarChart3,
  PiggyBank,
  Target,
  Shield,
  Sunrise,
  FlaskConical,
  GraduationCap,
  CalendarDays,
  Users,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
} from "@/lib/format";
import { useData } from "@/context/data-context";
import { useScenarioData } from "@/context/use-scenario-data";
import { useScenario } from "@/context/scenario-context";
import { ScenarioPanel } from "@/components/scenario-panel";
import { usePersonView } from "@/context/person-view-context";
import { PersonToggle } from "@/components/person-toggle";
import { CollapsibleSection } from "@/components/collapsible-section";
import { projectScenarios } from "@/lib/projections";
import { calculateAdjustedRequiredPot } from "@/lib/projections";
import {
  generateRecommendations,
  type RecommendationPriority,
  type Recommendation,
} from "@/lib/recommendations";
import { annualiseOutgoing, OUTGOING_CATEGORY_LABELS, OUTGOING_FREQUENCY_LABELS } from "@/types";
import { TAX_WRAPPER_LABELS } from "@/types";
import type { TaxWrapper, HeroMetricType } from "@/types";
import { calculateTotalAnnualContributions, calculateHouseholdStatePension } from "@/lib/aggregations";
import {
  computeHeroData,
  getNextCashEvents,
  getStatusSentence,
  detectLifeStage,
  getRecommendationUrgency,
  type HeroMetricData,
  type RecommendationUrgency,
} from "@/lib/dashboard";

import { NetWorthTrajectoryChart } from "@/components/charts/net-worth-trajectory";
import { ByPersonChart } from "@/components/charts/by-person-chart";
import { WrapperSplitChart } from "@/components/charts/wrapper-split-chart";
import { LiquiditySplitChart } from "@/components/charts/liquidity-split-chart";
import { ScenarioDelta } from "@/components/scenario-delta";
import { SchoolFeeSummary } from "@/components/school-fee-summary";
import { SchoolFeeTimelineChart } from "@/components/charts/school-fee-timeline-chart";
import { generateSchoolFeeTimeline, findLastSchoolFeeYear } from "@/lib/school-fees";

// ============================================================
// Hero Metric — resolve type to display properties
// ============================================================

interface ResolvedMetric {
  label: string;
  value: string;
  rawValue: number;
  format: (n: number) => string;
  subtext?: string;
  color: string;
  trend?: "up" | "down";
  icon: LucideIcon;
}

function resolveMetric(
  type: HeroMetricType,
  data: HeroMetricData
): ResolvedMetric {
  switch (type) {
    case "net_worth":
      return {
        label: data.isPersonView ? "Net Worth (Personal)" : "Net Worth",
        value: formatCurrencyCompact(data.totalNetWorth),
        rawValue: data.totalNetWorth,
        format: formatCurrencyCompact,
        color: "",
        icon: Wallet2,
      };
    case "cash_position":
      return {
        label: "Cash Position",
        value: formatCurrencyCompact(data.cashPosition),
        rawValue: data.cashPosition,
        format: formatCurrencyCompact,
        color: "",
        icon: Banknote,
      };
    case "retirement_countdown": {
      const y = data.retirementCountdownYears;
      const m = data.retirementCountdownMonths;
      const onTrack = y === 0 && m === 0;
      return {
        label: "Retirement",
        value: onTrack ? "On track" : `${y}y ${m}m`,
        rawValue: y * 12 + m,
        format: (n: number) => {
          if (n === 0) return "On track";
          return `${Math.floor(n / 12)}y ${n % 12}m`;
        },
        subtext: onTrack ? "Target pot reached" : "to target",
        color: onTrack ? "text-emerald-600 dark:text-emerald-400" : "",
        icon: Clock,
      };
    }
    case "period_change": {
      // QA-3: Show "N/A" when insufficient snapshots instead of "+0.0"
      if (!data.hasEnoughSnapshotsForMoM) {
        return {
          label: "Period Change",
          value: "N/A",
          rawValue: 0,
          format: () => "N/A",
          subtext: "Needs 2+ months of history",
          color: "text-muted-foreground",
          icon: TrendingUp,
        };
      }
      const v = data.monthOnMonthChange;
      const color = v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-600 dark:text-red-400" : "";
      // REC-H: Period change attribution — show contribution context
      const contribNote = data.monthlyContributionRate > 0
        ? ` (incl. ~${formatCurrencyCompact(data.monthlyContributionRate)}/mo contributions)`
        : "";
      return {
        label: "Period Change",
        value: `${v >= 0 ? "+" : ""}${formatCurrencyCompact(v)}`,
        rawValue: v,
        format: (n: number) => `${n >= 0 ? "+" : ""}${formatCurrencyCompact(n)}`,
        subtext: `${v >= 0 ? "+" : ""}${formatPercent(data.monthOnMonthPercent)} MoM${contribNote}`,
        color,
        trend: v > 0 ? "up" : v < 0 ? "down" : undefined,
        icon: TrendingUp,
      };
    }
    case "year_on_year_change": {
      // QA-3: Show "N/A" when insufficient snapshots
      if (!data.hasEnoughSnapshotsForYoY) {
        return {
          label: "Year-on-Year",
          value: "N/A",
          rawValue: 0,
          format: () => "N/A",
          subtext: "Needs ~12 months of history",
          color: "text-muted-foreground",
          icon: BarChart3,
        };
      }
      const v = data.yearOnYearChange;
      const color = v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-600 dark:text-red-400" : "";
      return {
        label: "Year-on-Year",
        value: `${v >= 0 ? "+" : ""}${formatCurrencyCompact(v)}`,
        rawValue: v,
        format: (n: number) => `${n >= 0 ? "+" : ""}${formatCurrencyCompact(n)}`,
        subtext: `${v >= 0 ? "+" : ""}${formatPercent(data.yearOnYearPercent)} YoY`,
        color,
        trend: v > 0 ? "up" : v < 0 ? "down" : undefined,
        icon: BarChart3,
      };
    }
    case "savings_rate":
      return {
        label: data.isPersonView ? "Savings Rate (Personal)" : "Savings Rate",
        value: `${data.savingsRate.toFixed(1)}%`,
        rawValue: data.savingsRate,
        format: (n: number) => `${n.toFixed(1)}%`,
        subtext: `${data.personalSavingsRate.toFixed(1)}% personal`,
        color: data.savingsRate >= 20
          ? "text-emerald-600 dark:text-emerald-400"
          : data.savingsRate < 10
            ? "text-amber-600 dark:text-amber-400"
            : "",
        icon: PiggyBank,
      };
    case "fire_progress":
      return {
        label: "FIRE Progress",
        value: `${data.fireProgress.toFixed(1)}%`,
        rawValue: data.fireProgress,
        format: (n: number) => `${n.toFixed(1)}%`,
        subtext: "of target pot",
        color: data.fireProgress >= 100
          ? "text-emerald-600 dark:text-emerald-400"
          : data.fireProgress < 25
            ? "text-amber-600 dark:text-amber-400"
            : "",
        icon: Target,
      };
    case "net_worth_after_commitments":
      // REC-K: "years of net worth vs annual outgoings"
      return {
        label: "Commitments Covered",
        value: data.commitmentCoverageYears >= 999
          ? "N/A"
          : `${data.commitmentCoverageYears.toFixed(1)}yr`,
        rawValue: data.commitmentCoverageYears,
        format: (n: number) => n >= 999 ? "N/A" : `${n.toFixed(1)}yr`,
        subtext: data.totalAnnualCommitments > 0
          ? `yrs net worth covers ${formatCurrencyCompact(data.totalAnnualCommitments)}/yr outgoings`
          : "No committed outgoings",
        color: data.commitmentCoverageYears >= 15
          ? "text-emerald-600 dark:text-emerald-400"
          : data.commitmentCoverageYears < 5
            ? "text-amber-600 dark:text-amber-400"
            : "",
        icon: Shield,
      };
    case "projected_retirement_income": {
      const target = data.targetAnnualIncome;
      const projected = data.projectedRetirementIncome;
      const incomeColor = target > 0 && projected >= target
        ? "text-emerald-600 dark:text-emerald-400"
        : target > 0 && projected < target * 0.5
          ? "text-red-600 dark:text-red-400"
          : target > 0 && projected < target * 0.75
            ? "text-amber-600 dark:text-amber-400"
            : "";
      // QA-6: Disclose growth rate assumption
      const growthPct = (data.projectedGrowthRate * 100).toFixed(0);
      const statePensionNote = data.projectedRetirementIncomeStatePension > 0
        ? `incl. ${formatCurrencyCompact(data.projectedRetirementIncomeStatePension)} state pension`
        : `at ${growthPct}% growth`;
      return {
        label: "Retirement Income",
        value: `${formatCurrencyCompact(projected)}/yr`,
        rawValue: projected,
        format: (n: number) => `${formatCurrencyCompact(n)}/yr`,
        subtext: statePensionNote,
        color: incomeColor,
        icon: Sunrise,
      };
    }
    case "cash_runway": {
      const months = data.cashRunway;
      // QA-4: Show "No outgoings" instead of green "∞" when nothing configured
      if (!data.hasOutgoings) {
        return {
          label: "Cash Cushion",
          value: "N/A",
          rawValue: 0,
          format: () => "N/A",
          subtext: "No outgoings configured",
          color: "text-muted-foreground",
          icon: Shield,
        };
      }
      const color = months < 3 ? "text-red-600 dark:text-red-400" : months < 6 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
      return {
        label: "Cash Cushion",
        value: `${months.toFixed(1)}mo`,
        rawValue: months,
        format: (n: number) => `${n.toFixed(1)}mo`,
        subtext: "months of outgoings if income stopped",
        color,
        icon: Shield,
      };
    }
    case "school_fee_countdown": {
      const yrs = data.schoolFeeYearsRemaining;
      return {
        label: "School Fees End",
        value: yrs <= 0 ? "Done" : `${yrs}yr`,
        rawValue: yrs,
        format: (n: number) => n <= 0 ? "Done" : `${n}yr`,
        subtext: yrs <= 0 ? "No children in school" : "until last child finishes",
        color: yrs <= 0 ? "text-emerald-600 dark:text-emerald-400" : "",
        icon: GraduationCap,
      };
    }
    case "pension_bridge_gap": {
      const yrs = data.pensionBridgeYears;
      return {
        label: "Pension Bridge",
        value: yrs <= 0 ? "None" : `${yrs}yr`,
        rawValue: yrs,
        format: (n: number) => n <= 0 ? "None" : `${n}yr`,
        subtext: yrs <= 0 ? "Pension accessible at retirement" : "gap before pension access",
        color: yrs > 5 ? "text-amber-600 dark:text-amber-400" : yrs > 0 ? "" : "text-emerald-600 dark:text-emerald-400",
        icon: Clock,
      };
    }
    case "per_person_retirement": {
      const parts = data.perPersonRetirement;
      if (parts.length === 0) {
        return {
          label: "Retirement",
          value: "N/A",
          rawValue: 0,
          format: () => "N/A",
          color: "",
          icon: Clock,
        };
      }
      const primary = parts[0];
      // QA-7: Truncate subtext for 3+ persons to prevent overflow
      const subtextParts = parts.length > 2
        ? parts.slice(0, 2).map((p) => `${p.name}: ${p.years}y ${p.months}m`).join(" · ") + ` +${parts.length - 2} more`
        : parts.map((p) => `${p.name}: ${p.years}y ${p.months}m`).join(" · ");
      return {
        label: "Retirement",
        value: `${primary.years}y ${primary.months}m`,
        rawValue: primary.years * 12 + primary.months,
        format: (n: number) => `${Math.floor(n / 12)}y ${n % 12}m`,
        subtext: subtextParts,
        color: "",
        icon: Clock,
      };
    }
    case "iht_liability": {
      const liability = data.ihtLiability;
      return {
        label: "IHT Liability",
        value: liability <= 0 ? "£0" : formatCurrencyCompact(liability),
        rawValue: liability,
        format: (n: number) => n <= 0 ? "£0" : formatCurrencyCompact(n),
        subtext: liability <= 0 ? "Below IHT threshold" : "estimated on current estate",
        color: liability > 500_000
          ? "text-red-600 dark:text-red-400"
          : liability > 100_000
            ? "text-amber-600 dark:text-amber-400"
            : liability <= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "",
        icon: Shield,
      };
    }
  }
}

// ============================================================
// Recommendation Card
// ============================================================

const priorityConfig: Record<
  RecommendationPriority,
  { label: string; color: string; bg: string; border: string }
> = {
  high: {
    label: "High",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-900",
  },
  medium: {
    label: "Medium",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950",
    border: "border-amber-200 dark:border-amber-900",
  },
  low: {
    label: "Low",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-200 dark:border-blue-900",
  },
};

const urgencyConfig: Record<RecommendationUrgency, { label: string; color: string } | null> = {
  act_now: { label: "Act now", color: "bg-red-600 text-white" },
  act_this_month: { label: "This month", color: "bg-amber-500 text-white" },
  standing: null,
};

function RecommendationCard({ rec, scenarioBadge, urgency, onDismiss }: {
  rec: Recommendation;
  scenarioBadge?: "new" | "resolved";
  urgency?: RecommendationUrgency;
  onDismiss?: (id: string) => void;
}) {
  const config = priorityConfig[rec.priority];
  const urgencyBadge = urgency ? urgencyConfig[urgency] : null;
  const content = (
    <div className="flex items-start gap-3">
      <Lightbulb className={`mt-0.5 size-4 shrink-0 ${config.color}`} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{rec.title}</h3>
          <Badge variant="outline" className={`text-[10px] ${config.color}`}>
            {config.label}
          </Badge>
          {urgencyBadge && (
            <Badge className={`text-[10px] ${urgencyBadge.color}`}>
              {urgencyBadge.label}
            </Badge>
          )}
          {rec.personName && (
            <Badge variant="secondary" className="text-[10px]">
              {rec.personName}
            </Badge>
          )}
          {scenarioBadge === "new" && (
            <Badge className="bg-amber-500 text-[10px] text-white">
              New in scenario
            </Badge>
          )}
          {scenarioBadge === "resolved" && (
            <Badge className="bg-emerald-500 text-[10px] text-white">
              Resolved by scenario
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{rec.description}</p>
        {rec.plainAction && (
          <p className="text-xs text-foreground/80 italic">{rec.plainAction}</p>
        )}
        <p className="text-xs font-medium">{rec.impact}</p>
        <div className="flex items-center gap-3">
          {rec.actionUrl && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              Take action <ArrowRight className="size-3" />
            </span>
          )}
          {onDismiss && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(rec.id); }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" /> Done
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (rec.actionUrl) {
    return (
      <Link href={rec.actionUrl} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Card className={`border ${config.border} ${config.bg} transition-shadow hover:shadow-md active:shadow-sm`}>
          <CardContent className="py-4">{content}</CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Card className={`border ${config.border} ${config.bg}`}>
      <CardContent className="py-4">{content}</CardContent>
    </Card>
  );
}

// ============================================================
// Status sentence color mapping (REC-A)
// ============================================================

const statusColorClasses = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
  neutral: "text-muted-foreground",
} as const;

// ============================================================
// Main Dashboard
// ============================================================

export default function Home() {
  const { snapshots: snapshotsData } = useData();
  const { isScenarioMode, savedScenarios } = useScenario();
  const scenarioData = useScenarioData();
  const household = scenarioData.household;
  const baseHousehold = scenarioData.baseHousehold;
  const { selectedView } = usePersonView();
  const { snapshots } = snapshotsData;

  // =============================================
  // REC-L: Two calls replace 30+ useMemo blocks
  // =============================================
  const heroData = useMemo(
    () => computeHeroData(household, snapshots, selectedView),
    [household, snapshots, selectedView]
  );
  const baseHeroData = useMemo(
    () => computeHeroData(baseHousehold, snapshots, selectedView),
    [baseHousehold, snapshots, selectedView]
  );

  // REC-A: Contextual status sentence
  const statusSentence = useMemo(
    () => getStatusSentence(heroData, household),
    [heroData, household]
  );

  // REC-B: Life-stage detection for conditional FIRE bar
  const lifeStage = useMemo(
    () => detectLifeStage(household),
    [household]
  );

  // REC-E: Next cash events
  const cashEvents = useMemo(
    () => getNextCashEvents(household),
    [household]
  );

  // =============================================
  // Dismissed recommendations (FEAT-006)
  // =============================================
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("nw-dismissed-recs");
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const dismissRecommendation = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("nw-dismissed-recs", JSON.stringify([...next]));
      return next;
    });
  }, []);
  const undismissAll = useCallback(() => {
    setDismissedIds(new Set());
    localStorage.removeItem("nw-dismissed-recs");
  }, []);

  // =============================================
  // Chart and display data
  // =============================================
  const totalNetWorth = scenarioData.getTotalNetWorth();
  const byPerson = scenarioData.getNetWorthByPerson();
  const byWrapper = scenarioData.getNetWorthByWrapper();

  const filteredAccounts = useMemo(() => {
    if (selectedView === "household") return household.accounts;
    return household.accounts.filter((a) => a.personId === selectedView);
  }, [household.accounts, selectedView]);

  // =============================================
  // Recommendations + urgency tiers (REC-F)
  // =============================================
  const recommendations = useMemo(
    () => generateRecommendations(household),
    [household]
  );

  const baseRecommendations = useMemo(
    () => isScenarioMode ? generateRecommendations(baseHousehold) : [],
    [baseHousehold, isScenarioMode]
  );

  const { newInScenario, resolvedByScenario } = useMemo(() => {
    if (!isScenarioMode) return { newInScenario: new Set<string>(), resolvedByScenario: new Set<string>() };
    const baseIds = new Set(baseRecommendations.map((r) => r.title));
    const scenarioIds = new Set(recommendations.map((r) => r.title));
    return {
      newInScenario: new Set([...scenarioIds].filter((id) => !baseIds.has(id))),
      resolvedByScenario: new Set([...baseIds].filter((id) => !scenarioIds.has(id))),
    };
  }, [recommendations, baseRecommendations, isScenarioMode]);

  // REC-F: Assign urgency tiers and sort: act_now > act_this_month > standing
  const filteredRecommendations = useMemo(() => {
    let recs = recommendations;
    if (dismissedIds.size > 0) {
      recs = recs.filter((r) => !dismissedIds.has(r.id));
    }
    if (selectedView !== "household") {
      recs = recs.filter(
        (r) =>
          !r.personName ||
          r.personName === household.persons.find((p) => p.id === selectedView)?.name
      );
    }
    // Assign urgency and sort by urgency tier, then priority
    const urgencyOrder: Record<RecommendationUrgency, number> = { act_now: 0, act_this_month: 1, standing: 2 };
    const priorityOrder: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };
    return recs
      .map((r) => ({ rec: r, urgency: getRecommendationUrgency(r.id) }))
      .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || priorityOrder[a.rec.priority] - priorityOrder[b.rec.priority]);
  }, [recommendations, selectedView, household.persons, dismissedIds]);

  // REC-D: Cap mobile recommendations — show 2 by default, expand for more
  const [showAllRecs, setShowAllRecs] = useState(false);
  const visibleRecs = showAllRecs ? filteredRecommendations : filteredRecommendations.slice(0, 4);
  const hiddenRecCount = filteredRecommendations.length - visibleRecs.length;

  // =============================================
  // Projections (for trajectory chart)
  // =============================================
  const totalStatePensionAnnual = useMemo(
    () => calculateHouseholdStatePension(household.persons),
    [household.persons]
  );

  const { scenarios, scenarioRates, projectionYears, milestones, retirementTargetYear } = useMemo(() => {
    const monthlyContrib = calculateTotalAnnualContributions(household.contributions, household.income) / 12;
    const rates = household.retirement.scenarioRates;
    const years = 30;
    const projScenarios = projectScenarios(totalNetWorth, monthlyContrib, rates, years);
    const targetPot = calculateAdjustedRequiredPot(
      household.retirement.targetAnnualIncome, household.retirement.withdrawalRate,
      household.retirement.includeStatePension, totalStatePensionAnnual
    );
    const ms = [
      { label: "FIRE Target", value: targetPot },
      { label: "\u00A31m", value: 1_000_000 },
      { label: "\u00A32m", value: 2_000_000 },
    ].filter((m) => m.value > 0);

    // Find the year the mid-scenario crosses the FIRE target (vertical marker on chart)
    const currentYear = new Date().getFullYear();
    let retirementTargetYear: number | null = null;
    if (targetPot > 0 && projScenarios.length > 0) {
      const midScenario = projScenarios[Math.floor(projScenarios.length / 2)];
      for (let i = 0; i < midScenario.projections.length; i++) {
        if (midScenario.projections[i].value >= targetPot) {
          retirementTargetYear = currentYear + i + 1;
          break;
        }
      }
    }

    return { scenarios: projScenarios, scenarioRates: rates, projectionYears: years, milestones: ms, retirementTargetYear };
  }, [household, totalNetWorth, totalStatePensionAnnual]);

  // =============================================
  // Chart data
  // =============================================
  const personChartData = useMemo(() => byPerson.map((p) => ({ name: p.name, value: p.value })), [byPerson]);

  const wrapperData = useMemo(() => {
    const order: TaxWrapper[] = ["pension", "isa", "gia", "cash", "premium_bonds"];
    return order
      .map((wrapper) => {
        const found = byWrapper.find((bw) => bw.wrapper === wrapper);
        return {
          wrapper,
          label: TAX_WRAPPER_LABELS[wrapper],
          value: found?.value ?? 0,
          percent: found && totalNetWorth > 0 ? found.value / totalNetWorth : 0,
        };
      })
      .filter((w) => w.value > 0);
  }, [byWrapper, totalNetWorth]);

  const wrapperSummary = wrapperData.map((w) => `${Math.round(w.percent * 100)}% ${w.label}`).join(", ");

  // =============================================
  // Banner
  // =============================================
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem("nw-banner-dismissed") === "true";
    } catch {
      return false;
    }
  });

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try {
      localStorage.setItem("nw-banner-dismissed", "true");
    } catch {
      // ignore
    }
  }, []);

  // =============================================
  // Education section data
  // =============================================
  const schoolFeeTimeline = useMemo(
    () => generateSchoolFeeTimeline(household.children),
    [household.children]
  );
  const lastSchoolFeeYear = useMemo(
    () => findLastSchoolFeeYear(household.children),
    [household.children]
  );

  const latestSnapshot = snapshots[snapshots.length - 1];
  const heroMetrics = household.dashboardConfig.heroMetrics;
  // REC-B + QA-2: Check if fire_progress is already selected as a configurable metric
  const fireSelectedAsMetric = heroMetrics.includes("fire_progress");

  // REC-D: Collapse What-If CTA after first scenario is saved
  const hasUsedScenarios = savedScenarios.length > 0;

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Print header */}
      <div className="print-report-header hidden print:block">
        <h1>Runway — Financial Report</h1>
        <p>
          Generated{" "}
          {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}
          {" | "}
          Household net worth: <span className="tabular-nums">{formatCurrency(totalNetWorth)}</span>
        </p>
      </div>

      {/* Getting Started — always shown when no accounts exist, otherwise dismissible */}
      {(!bannerDismissed || household.persons.length === 0 || household.accounts.length === 0) && (
        <div className="relative rounded-lg border-2 border-primary/20 bg-primary/5 p-4 sm:p-6">
          <button
            onClick={dismissBanner}
            className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            aria-label="Dismiss getting started banner"
          >
            <X className="size-4" />
          </button>
          <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">Getting Started</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Head to <strong>Settings</strong> first to enter your personal financial data.
              </p>
            </div>
            <Link href="/settings">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                <Settings className="size-4" />
                Open Settings
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* REC-D: Removed "Dashboard" PageHeader title (redundant with nav)
          PersonToggle is embedded in hero card instead */}

      {/* HERO — bold primary metric + supporting metrics */}
      {(() => {
        const primary = resolveMetric(heroMetrics[0], heroData);
        const basePrimary = resolveMetric(heroMetrics[0], baseHeroData);
        const PrimaryIcon = primary.icon;
        const secondaryMetrics = heroMetrics.slice(1).map((m) => resolveMetric(m, heroData));
        const baseSecondaryMetrics = heroMetrics.slice(1).map((m) => resolveMetric(m, baseHeroData));

        // REC-B: Determine what to show in the sub-hero strip
        // Pre-retirement → FIRE progress bar
        // School fees → School Fee Funding Status
        // Accumulator → FIRE progress bar
        // QA-2: Suppress hardcoded FIRE bar when fire_progress is already a selected metric
        const showFireBar = !fireSelectedAsMetric && heroData.fireProgress > 0;
        const showSchoolFeeStrip = lifeStage === "school_fees" && !showFireBar;

        return (
          <div className="space-y-3">
            {/* Primary metric card */}
            <Card className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-card">
              <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-primary/[0.04] hidden sm:block" />
              <div className="pointer-events-none absolute right-12 -bottom-6 size-24 rounded-full bg-primary/[0.03] hidden sm:block" />
              <CardContent className="relative pt-4 pb-3 sm:pt-6 sm:pb-5">
                {/* REC-D: Person toggle embedded top-right of hero card */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                        <PrimaryIcon className="size-4 text-primary" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {primary.label}
                      </span>
                      {/* Latest snapshot date */}
                      {latestSnapshot && (
                        <span className="hidden text-xs text-muted-foreground/60 sm:inline">
                          {new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(latestSnapshot.date))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className={`${isScenarioMode ? "text-2xl sm:text-4xl" : "text-4xl sm:text-5xl"} font-bold tracking-tight leading-none tabular-nums ${primary.color}`}>
                        <ScenarioDelta base={basePrimary.rawValue} scenario={primary.rawValue} format={primary.format} />
                      </span>
                      {primary.trend === "up" && <TrendingUp className="size-6 text-emerald-500" />}
                      {primary.trend === "down" && <TrendingDown className="size-6 text-red-500" />}
                    </div>
                    {/* REC-A: Status sentence replaces plain subtext */}
                    <span className={`mt-1 block text-sm ${statusColorClasses[statusSentence.color]}`}>
                      {statusSentence.text}
                    </span>
                  </div>
                  {/* REC-D: PersonToggle embedded in hero top-right */}
                  <div className="shrink-0 print:hidden">
                    <PersonToggle />
                  </div>
                </div>

                {/* REC-B: Conditional sub-hero strip */}
                {showFireBar && (
                  <div className="mt-5 pt-4 border-t border-primary/10">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Target className="size-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">FIRE Progress</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums">
                        <ScenarioDelta
                          base={baseHeroData.fireProgress}
                          scenario={heroData.fireProgress}
                          format={(n: number) => `${n.toFixed(1)}%`}
                          epsilon={0.05}
                        />
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(heroData.fireProgress, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>{formatCurrencyCompact(heroData.totalNetWorth)} saved</span>
                      <span>
                        Target: {formatCurrencyCompact(
                          heroData.fireProgress > 0 ? heroData.totalNetWorth / (heroData.fireProgress / 100) : 0
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* REC-B: School fee funding strip for school-fee households */}
                {showSchoolFeeStrip && heroData.schoolFeeYearsRemaining > 0 && (
                  <div className="mt-5 pt-4 border-t border-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="size-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">School Fee Commitment</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums">
                        {heroData.schoolFeeYearsRemaining}yr remaining
                      </span>
                    </div>
                  </div>
                )}

                {/* REC-G: Couples snapshot for multi-person households */}
                {household.persons.length >= 2 && selectedView === "household" && (
                  <div className="mt-4 pt-3 border-t border-primary/10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="size-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">At a Glance</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {heroData.perPersonRetirement.map((p) => (
                        <div key={p.name} className="rounded-md bg-muted/40 px-3 py-2">
                          <span className="text-xs font-medium">{p.name}</span>
                          <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                            {p.years === 0 && p.months === 0 ? "Retired" : `${p.years}y ${p.months}m to retirement`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Secondary metrics — compact row */}
            {secondaryMetrics.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {secondaryMetrics.map((metric, i) => {
                  const MetricIcon = metric.icon;
                  const baseMetric = baseSecondaryMetrics[i];
                  return (
                    <Card key={i} className="border-muted-foreground/10 transition-shadow duration-200 hover:shadow-md">
                      <CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex size-6 items-center justify-center rounded-md bg-muted">
                            <MetricIcon className="size-3.5 text-muted-foreground" />
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {metric.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${metric.color}`}>
                            <ScenarioDelta base={baseMetric.rawValue} scenario={metric.rawValue} format={metric.format} />
                          </span>
                          {metric.trend === "up" && <TrendingUp className="size-4 text-emerald-500" />}
                          {metric.trend === "down" && <TrendingDown className="size-4 text-red-500" />}
                        </div>
                        {metric.subtext && (
                          <span className="mt-0.5 block text-[11px] text-muted-foreground line-clamp-2">{metric.subtext}</span>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* REC-E: Next Cash Events strip — links to Income page for detail */}
      {cashEvents.length > 0 && (
        <Link href="/income" className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-muted-foreground/10 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-1.5 shrink-0">
              <CalendarDays className="size-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Events</span>
            </div>
            {cashEvents.slice(0, 3).map((event, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(event.date)}
                </span>
                <span className="text-xs">{event.label}</span>
                <span className={`text-xs font-semibold tabular-nums ${event.type === "inflow" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {event.type === "inflow" ? "+" : ""}{formatCurrencyCompact(Math.abs(event.amount))}
                </span>
              </div>
            ))}
            <ArrowRight className="ml-auto size-3.5 text-muted-foreground shrink-0" />
          </div>
        </Link>
      )}

      {/* RECOMMENDATIONS — with urgency tiers (REC-F), capped on mobile (REC-D)
          Placed before charts: actionable content above exploratory content */}
      {(filteredRecommendations.length > 0 || resolvedByScenario.size > 0) && (
        <CollapsibleSection
          title="Recommendations"
          summary={`${filteredRecommendations.length} suggestion${filteredRecommendations.length !== 1 ? "s" : ""}${isScenarioMode && resolvedByScenario.size > 0 ? ` · ${resolvedByScenario.size} resolved` : ""}`}
          defaultOpen
          storageKey="recommendations"
        >
          <div className="grid gap-3">
            {visibleRecs.map(({ rec, urgency }) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                urgency={urgency}
                scenarioBadge={newInScenario.has(rec.title) ? "new" : undefined}
                onDismiss={dismissRecommendation}
              />
            ))}
            {/* REC-D: Show more button when recommendations are capped */}
            {hiddenRecCount > 0 && (
              <button
                onClick={() => setShowAllRecs(true)}
                className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Show {hiddenRecCount} more <ChevronDown className="size-3" />
              </button>
            )}
            {/* FEAT-021: Show resolved recommendations with badge */}
            {isScenarioMode && baseRecommendations
              .filter((r) => resolvedByScenario.has(r.title))
              .map((rec) => (
                <RecommendationCard
                  key={`resolved-${rec.id}`}
                  rec={rec}
                  scenarioBadge="resolved"
                />
              ))
            }
            {/* FEAT-006: Show undo link when recommendations are dismissed */}
            {dismissedIds.size > 0 && (
              <button
                onClick={undismissAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Show {dismissedIds.size} dismissed recommendation{dismissedIds.size !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* EDUCATION — school fee summary and timeline */}
      {household.children.length > 0 && household.children.some((c) => c.schoolFeeAnnual > 0) && (
        <CollapsibleSection
          title="Education Commitment"
          summary={`${household.children.filter((c) => c.schoolFeeAnnual > 0).length} child${household.children.filter((c) => c.schoolFeeAnnual > 0).length !== 1 ? "ren" : ""} — ${formatCurrencyCompact(household.children.reduce((s, c) => s + c.schoolFeeAnnual, 0))}/yr`}
          defaultOpen
          storageKey="education"
        >
          <div className="space-y-4">
            <SchoolFeeSummary childrenList={household.children} />
            {schoolFeeTimeline.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-baseline justify-between">
                    <CardTitle>School Fee Timeline</CardTitle>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      Annual fees by child (including inflation)
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <SchoolFeeTimelineChart
                    data={schoolFeeTimeline}
                    childrenList={household.children}
                    lastSchoolFeeYear={lastSchoolFeeYear}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* What-If CTA — after actionable content, before exploratory charts */}
      {!isScenarioMode && (
        hasUsedScenarios ? (
          <div className="flex items-center gap-2">
            <ScenarioPanel />
            <span className="text-xs text-muted-foreground">Open scenario panel</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <FlaskConical className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">What would happen if...?</p>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Model salary changes, pension sacrifice, market crashes, or early retirement
              </p>
              <p className="text-xs text-muted-foreground sm:hidden">
                Model scenarios and see the impact
              </p>
            </div>
            <ScenarioPanel />
          </div>
        )
      )}

      {/* PRIMARY CHARTS — collapsible like all other content sections */}
      <CollapsibleSection
        title="Net Worth Trajectory & Allocation"
        summary={`${scenarioRates.map((r) => `${(r * 100).toFixed(0)}%`).join("/")} over ${projectionYears}yr · ${wrapperSummary}`}
        defaultOpen
        storageKey="charts-primary"
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-t border-t-primary/20">
            <CardHeader>
              <div className="flex items-baseline justify-between">
                <CardTitle>Net Worth Trajectory</CardTitle>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {scenarioRates.map((r) => `${(r * 100).toFixed(0)}%`).join("/")} over {projectionYears}yr
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <NetWorthTrajectoryChart snapshots={snapshots} scenarios={scenarios} milestones={milestones} retirementTargetYear={retirementTargetYear} />
              <p className="mt-3 text-[11px] text-muted-foreground">
                Projections are estimates, not guarantees. Capital is at risk. Past performance does not predict future returns.
              </p>
            </CardContent>
          </Card>

          <Card className="border-t border-t-primary/20">
            <CardHeader>
              <div className="flex items-baseline justify-between">
                <CardTitle>Net Worth by Wrapper</CardTitle>
                <span className="hidden text-xs text-muted-foreground sm:inline">{wrapperSummary}</span>
              </div>
            </CardHeader>
            <CardContent>
              <WrapperSplitChart data={byWrapper} />
            </CardContent>
          </Card>
        </div>
      </CollapsibleSection>

      {selectedView === "household" && (
        <CollapsibleSection
          title="Net Worth by Person"
          summary={byPerson.map((p) => `${p.name}: ${formatCurrencyCompact(p.value)}`).join(", ")}
          defaultOpen
          storageKey="by-person"
        >
          <Card>
            <CardContent className="pt-6">
              <ByPersonChart data={personChartData} />
            </CardContent>
          </Card>
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Liquid vs Illiquid" summary="Accessible wealth vs locked pensions" defaultOpen storageKey="liquidity">
        <Card>
          <CardContent className="pt-6">
            <LiquiditySplitChart accounts={filteredAccounts} />
          </CardContent>
        </Card>
      </CollapsibleSection>

      {household.committedOutgoings.length > 0 && (() => {
        const categoryTotals = household.committedOutgoings.reduce<Record<string, number>>((acc, o) => {
          const annual = annualiseOutgoing(o.amount, o.frequency);
          acc[o.category] = (acc[o.category] ?? 0) + annual;
          return acc;
        }, {});
        const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);

        return (
          <CollapsibleSection
            title="Committed Outgoings"
            summary={`${formatCurrencyCompact(heroData.totalAnnualCommitments)}/yr across ${household.committedOutgoings.length} items`}
            storageKey="commitments"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {sortedCategories.map(([category, total]) => (
                  <div key={category} className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5">
                    <span className="text-xs text-muted-foreground">{OUTGOING_CATEGORY_LABELS[category as keyof typeof OUTGOING_CATEGORY_LABELS]}</span>
                    <span className="text-xs font-semibold tabular-nums">{formatCurrencyCompact(total)}/yr</span>
                  </div>
                ))}
              </div>

              <Card>
                <CardContent className="pt-4 pb-2">
                  <div className="space-y-1">
                    {[...household.committedOutgoings]
                      .sort((a, b) => annualiseOutgoing(b.amount, b.frequency) - annualiseOutgoing(a.amount, a.frequency))
                      .map((o) => {
                        const annual = annualiseOutgoing(o.amount, o.frequency);
                        return (
                          <div key={o.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                            <Badge variant="outline" className="text-[10px] shrink-0 w-20 justify-center">
                              {OUTGOING_CATEGORY_LABELS[o.category]}
                            </Badge>
                            <span className="text-sm flex-1 truncate">{o.label || OUTGOING_CATEGORY_LABELS[o.category]}</span>
                            <span className="hidden text-xs text-muted-foreground shrink-0 sm:inline">
                              {OUTGOING_FREQUENCY_LABELS[o.frequency]}
                            </span>
                            <span className="text-sm font-medium tabular-nums shrink-0 w-20 text-right">
                              {formatCurrencyCompact(annual)}/yr
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </CollapsibleSection>
        );
      })()}
    </div>
  );
}
