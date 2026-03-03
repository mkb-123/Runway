"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Sunset,
  Calculator,
  Shield,
  PiggyBank,
  TrendingUp,
  Wallet,
  BarChart3,
  Target,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useScenarioData } from "@/context/use-scenario-data";
import { PageHeader } from "@/components/page-header";
import { CollapsibleSection } from "@/components/collapsible-section";
import { generateDiagnosticReport } from "@/lib/fi-diagnostic";
import type {
  DiagnosticScore,
  DiagnosticRating,
  DiagnosticDimension,
  DiagnosticReport,
} from "@/types";
import { DIAGNOSTIC_DIMENSION_LABELS } from "@/types";

// ============================================================
// Icon + colour mapping for dimensions and ratings
// ============================================================

const DIMENSION_ICONS: Record<DiagnosticDimension, LucideIcon> = {
  retirement_readiness: Sunset,
  tax_efficiency: Calculator,
  emergency_fund: Shield,
  savings_rate: PiggyBank,
  iht_exposure: Shield,
  portfolio_diversification: BarChart3,
  cash_flow_health: Wallet,
  pension_adequacy: Target,
};

const RATING_CONFIG: Record<
  DiagnosticRating,
  { icon: LucideIcon; label: string; bgClass: string; textClass: string; badgeVariant: "default" | "secondary" | "destructive" | "outline" }
> = {
  green: {
    icon: CheckCircle2,
    label: "On Track",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    textClass: "text-emerald-700 dark:text-emerald-400",
    badgeVariant: "default",
  },
  amber: {
    icon: AlertTriangle,
    label: "Needs Attention",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-700 dark:text-amber-400",
    badgeVariant: "secondary",
  },
  red: {
    icon: XCircle,
    label: "Action Required",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    textClass: "text-red-700 dark:text-red-400",
    badgeVariant: "destructive",
  },
  insufficient_data: {
    icon: HelpCircle,
    label: "Insufficient Data",
    bgClass: "bg-muted/50",
    textClass: "text-muted-foreground",
    badgeVariant: "outline",
  },
};

// ============================================================
// Overall Score Ring
// ============================================================

function ScoreRing({ score, rating }: { score: number; rating: DiagnosticRating }) {
  const config = RATING_CONFIG[rating];
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const strokeColor =
    rating === "green"
      ? "stroke-emerald-500"
      : rating === "amber"
        ? "stroke-amber-500"
        : rating === "red"
          ? "stroke-red-500"
          : "stroke-muted-foreground";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative size-32">
        <svg className="size-32 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            className="text-muted/30"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            className={strokeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums" data-sensitive>
            {score}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <Badge variant={config.badgeVariant} className="gap-1">
        <config.icon className="size-3" />
        {config.label}
      </Badge>
    </div>
  );
}

// ============================================================
// Rating Summary Tiles
// ============================================================

function RatingSummary({ report }: { report: DiagnosticReport }) {
  const allTiles: Array<{ rating: DiagnosticRating; count: number }> = [
    { rating: "green" as const, count: report.ratingCounts.green },
    { rating: "amber" as const, count: report.ratingCounts.amber },
    { rating: "red" as const, count: report.ratingCounts.red },
    { rating: "insufficient_data" as const, count: report.ratingCounts.insufficient_data },
  ];
  const tiles = allTiles.filter((t) => t.count > 0);

  return (
    <div className="flex flex-wrap gap-2">
      {tiles.map(({ rating, count }) => {
        const config = RATING_CONFIG[rating];
        return (
          <div
            key={rating}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${config.bgClass} ${config.textClass}`}
          >
            <config.icon className="size-4" />
            <span className="tabular-nums">{count}</span>
            <span className="text-xs">{config.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Dimension Score Card
// ============================================================

function DimensionCard({ score }: { score: DiagnosticScore }) {
  const config = RATING_CONFIG[score.rating];
  const Icon = DIMENSION_ICONS[score.dimension];
  const label = DIAGNOSTIC_DIMENSION_LABELS[score.dimension];

  return (
    <Card className={`${config.bgClass} border-0`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className={`size-5 ${config.textClass}`} />
            <CardTitle className="text-base">{label}</CardTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {score.rating !== "insufficient_data" && (
              <span className={`text-2xl font-bold tabular-nums ${config.textClass}`} data-sensitive>
                {score.score}
              </span>
            )}
            <Badge variant={config.badgeVariant} className="gap-1">
              <config.icon className="size-3" />
              {config.label}
            </Badge>
          </div>
        </div>
        <CardDescription className="mt-1">{score.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {score.recommendation && (
          <div className="rounded-md bg-background/60 p-3 text-sm">
            <span className="font-medium">Recommendation: </span>
            {score.recommendation}
          </div>
        )}
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
            Show methodology ({score.details.length} data points)
          </summary>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {score.details.map((detail, i) => (
              <li key={i} className="tabular-nums" data-sensitive>
                {detail}
              </li>
            ))}
          </ul>
        </details>
        <Link
          href={score.actionUrl}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View detail
          <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Page Component
// ============================================================

export default function DiagnosticPage() {
  const scenarioData = useScenarioData();
  const { household } = scenarioData;

  const report = useMemo(() => generateDiagnosticReport(household), [household]);

  // Separate scored dimensions from insufficient data
  const scoredDimensions = report.scores.filter((s) => s.rating !== "insufficient_data");
  const insufficientData = report.scores.filter((s) => s.rating === "insufficient_data");

  // Sort scored: red first, then amber, then green
  const ratingOrder: Record<DiagnosticRating, number> = {
    red: 0,
    amber: 1,
    green: 2,
    insufficient_data: 3,
  };
  const sortedScored = [...scoredDimensions].sort(
    (a, b) => ratingOrder[a.rating] - ratingOrder[b.rating]
  );

  return (
    <main className="min-h-screen space-y-6 px-4 py-6 sm:px-6 lg:px-8 pb-20">
      <PageHeader
        title="Financial Independence Diagnostic"
        description="Institutional-quality assessment of your household's financial health across 8 key dimensions."
      />

      {/* Overall Score */}
      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-8 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center sm:items-start gap-3">
            <h2 className="text-lg font-semibold">Overall FI Score</h2>
            <RatingSummary report={report} />
            <p className="text-sm text-muted-foreground max-w-md">
              {report.overallRating === "green"
                ? "Your financial position is strong across most dimensions. Focus on maintaining discipline and optimising remaining areas."
                : report.overallRating === "amber"
                  ? "Your finances are broadly healthy but several areas need attention. Prioritise the red and amber items below."
                  : report.overallScore > 0
                    ? "Significant gaps identified. Address the red items below as a priority — small improvements can have a large compounding effect."
                    : "Add household data in Settings to generate your diagnostic scores."}
            </p>
          </div>
          <ScoreRing score={report.overallScore} rating={report.overallRating} />
        </CardContent>
      </Card>

      {/* Action Required (Red) */}
      {sortedScored.filter((s) => s.rating === "red").length > 0 && (
        <CollapsibleSection
          title="Action Required"
          storageKey="diagnostic-red"
          defaultOpen
          summary={`${sortedScored.filter((s) => s.rating === "red").length} items`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {sortedScored
              .filter((s) => s.rating === "red")
              .map((s) => (
                <DimensionCard key={s.dimension} score={s} />
              ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Needs Attention (Amber) */}
      {sortedScored.filter((s) => s.rating === "amber").length > 0 && (
        <CollapsibleSection
          title="Needs Attention"
          storageKey="diagnostic-amber"
          defaultOpen
          summary={`${sortedScored.filter((s) => s.rating === "amber").length} items`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {sortedScored
              .filter((s) => s.rating === "amber")
              .map((s) => (
                <DimensionCard key={s.dimension} score={s} />
              ))}
          </div>
        </CollapsibleSection>
      )}

      {/* On Track (Green) */}
      {sortedScored.filter((s) => s.rating === "green").length > 0 && (
        <CollapsibleSection
          title="On Track"
          storageKey="diagnostic-green"
          defaultOpen={false}
          summary={`${sortedScored.filter((s) => s.rating === "green").length} items`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {sortedScored
              .filter((s) => s.rating === "green")
              .map((s) => (
                <DimensionCard key={s.dimension} score={s} />
              ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Insufficient Data */}
      {insufficientData.length > 0 && (
        <CollapsibleSection
          title="Insufficient Data"
          storageKey="diagnostic-insufficient"
          defaultOpen={false}
          summary={`${insufficientData.length} items`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {insufficientData.map((s) => (
              <DimensionCard key={s.dimension} score={s} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Methodology */}
      <CollapsibleSection
        title="Methodology & Assumptions"
        storageKey="diagnostic-methodology"
        defaultOpen={false}
      >
        <Card>
          <CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
            <div>
              <h3 className="font-semibold text-foreground mb-1">Scoring Approach</h3>
              <p>
                Each dimension is scored 0-100 using the household data you have entered.
                Scores are classified as <span className="text-emerald-600 font-medium">Green (75+)</span>,{" "}
                <span className="text-amber-600 font-medium">Amber (40-74)</span>, or{" "}
                <span className="text-red-600 font-medium">Red (&lt;40)</span>.
                The overall score is a weighted average of all scored dimensions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Dimension Weights</h3>
              <ul className="space-y-0.5">
                <li>Retirement Readiness: 25%</li>
                <li>Tax Efficiency: 15%</li>
                <li>Savings Rate: 15%</li>
                <li>Emergency Fund: 10%</li>
                <li>IHT Exposure: 10%</li>
                <li>Portfolio Diversification: 10%</li>
                <li>Cash Flow Health: 10%</li>
                <li>Pension Adequacy: 5%</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Growth Assumptions</h3>
              <p>
                Retirement projections use the mid scenario growth rate from your Planning settings.
                All projections include ongoing contributions and compound investment growth.
                Values are shown in nominal (not inflation-adjusted) terms.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Limitations</h3>
              <p>
                This diagnostic is based on the data you have entered and uses simplified models.
                It does not constitute financial advice. Consult a qualified financial planner for
                personalised recommendations. Tax rules may change. Capital at risk.
              </p>
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>
    </main>
  );
}
