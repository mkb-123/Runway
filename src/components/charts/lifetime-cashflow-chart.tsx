"use client";

// ============================================================
// Lifetime Cash Flow Chart
// ============================================================
// Stacked area chart showing income sources over a lifetime,
// with expenditure as a separate overlay line. The gap between
// stacked income and the expenditure line shows surplus/shortfall.
//
// Design decisions (per charting expert):
// - Stacked areas for income composition (employment, pension, state pension, investment)
// - Expenditure as a bold line (NOT stacked with income)
// - stepAfter interpolation for annual discrete data
// - Vertical reference lines for key life events
// - Colorblind-safe palette with semantic meaning

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Line,
  ComposedChart,
} from "recharts";
import { formatCurrencyAxis, formatCurrencyTooltip } from "@/lib/format";
import type { LifetimeCashFlowYear, LifetimeCashFlowEvent } from "@/lib/lifetime-cashflow";

interface LifetimeCashFlowChartProps {
  data: LifetimeCashFlowYear[];
  events: LifetimeCashFlowEvent[];
  primaryPersonName: string;
}

// Colorblind-safe palette with semantic meaning
const COLORS = {
  employment: "hsl(220, 70%, 50%)",    // blue — earned income
  pension: "hsl(150, 55%, 42%)",       // green — pension drawdown
  statePension: "hsl(40, 75%, 50%)",   // gold — state pension
  investment: "hsl(280, 55%, 55%)",    // purple — investment drawdown
  expenditure: "hsl(0, 65%, 55%)",     // coral red — expenditure line
} as const;

export function LifetimeCashFlowChart({ data, events, primaryPersonName }: LifetimeCashFlowChartProps) {
  if (data.length === 0) return null;

  // Determine which income sources are active
  const hasEmployment = data.some((d) => d.employmentIncome > 0);
  const hasPension = data.some((d) => d.pensionIncome > 0);
  const hasStatePension = data.some((d) => d.statePensionIncome > 0);
  const hasInvestment = data.some((d) => d.investmentIncome > 0);

  // Build accessible summary
  const startAge = data[0].age;
  const endAge = data[data.length - 1].age;
  const shortfallYears = data.filter((d) => d.surplus < 0).length;
  const accessibleSummary = `Lifetime cash flow from age ${startAge} to ${endAge} for ${primaryPersonName}'s household. ${
    shortfallYears > 0
      ? `Income falls short of expenditure in ${shortfallYears} year${shortfallYears !== 1 ? "s" : ""}.`
      : "Income covers expenditure throughout."
  }`;

  return (
    <div className="h-[500px] w-full" role="img" aria-label={accessibleSummary}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <XAxis
            dataKey="age"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            label={{ value: `${primaryPersonName}'s Age`, position: "insideBottom", offset: -5, style: { fontSize: 11, fill: "var(--muted-foreground)" } }}
          />
          <YAxis
            tickFormatter={formatCurrencyAxis}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={80}
            label={{ value: "Annual (£)", angle: -90, position: "insideLeft", offset: 5, style: { fontSize: 11, fill: "var(--muted-foreground)" } }}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const num = Number(value ?? 0);
              if (num === 0) return [null, null] as unknown as [string, string];
              return [formatCurrencyTooltip(num), String(name)];
            }}
            labelFormatter={(age) => `Age ${age}`}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            itemSorter={(item: any) => -(Number(item.value) || 0)}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
          />

          {/* Vertical reference lines for key life events */}
          {events.map((event, idx) => (
            <ReferenceLine
              key={`event-${event.age}-${idx}`}
              x={event.age}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              strokeOpacity={0.4}
              label={{
                value: event.label,
                position: "top",
                fontSize: 9,
                fill: "var(--muted-foreground)",
              }}
            />
          ))}

          {/* Income sources — stacked areas */}
          {hasEmployment && (
            <Area
              type="stepAfter"
              dataKey="employmentIncome"
              stackId="income"
              name="Employment"
              stroke={COLORS.employment}
              fill={COLORS.employment}
              fillOpacity={0.55}
              strokeWidth={1}
            />
          )}
          {hasPension && (
            <Area
              type="stepAfter"
              dataKey="pensionIncome"
              stackId="income"
              name="Pension Drawdown"
              stroke={COLORS.pension}
              fill={COLORS.pension}
              fillOpacity={0.55}
              strokeWidth={1}
            />
          )}
          {hasStatePension && (
            <Area
              type="stepAfter"
              dataKey="statePensionIncome"
              stackId="income"
              name="State Pension"
              stroke={COLORS.statePension}
              fill={COLORS.statePension}
              fillOpacity={0.55}
              strokeWidth={1}
            />
          )}
          {hasInvestment && (
            <Area
              type="stepAfter"
              dataKey="investmentIncome"
              stackId="income"
              name="Savings Drawdown"
              stroke={COLORS.investment}
              fill={COLORS.investment}
              fillOpacity={0.55}
              strokeWidth={1}
            />
          )}

          {/* Expenditure — bold line overlay (NOT stacked with income) */}
          <Line
            type="stepAfter"
            dataKey="totalExpenditure"
            name="Expenditure"
            stroke={COLORS.expenditure}
            strokeWidth={2.5}
            dot={false}
            strokeDasharray="6 3"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
