"use client";

// ============================================================
// Retirement Drawdown Chart
// ============================================================
// Rendering layer only — financial logic lives in src/lib/retirement.ts.

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { formatCurrencyAxis, formatCurrencyTooltip } from "@/lib/format";
import { buildDrawdownData } from "@/lib/retirement";

interface RetirementDrawdownChartProps {
  startingPot: number;
  annualSpend: number;
  retirementAge: number;
  endAge?: number;
  scenarioRates: number[];
  statePensionAge?: number;
  statePensionAnnual?: number;
}

const SCENARIO_COLORS = [
  "var(--chart-3)",
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function RetirementDrawdownChart({
  startingPot,
  annualSpend,
  retirementAge,
  endAge = 95,
  scenarioRates,
  statePensionAge = 67,
  statePensionAnnual = 11_502,
}: RetirementDrawdownChartProps) {
  const data = buildDrawdownData(
    startingPot,
    annualSpend,
    retirementAge,
    endAge,
    scenarioRates,
    statePensionAge,
    statePensionAnnual,
    true // Tax-aware: gross up pension withdrawals for income tax
  );

  const rateLabels = scenarioRates.map((r) => `${(r * 100).toFixed(0)}%`);

  return (
    <>
    <div className="h-[300px] sm:h-[400px] w-full" role="img" aria-label="Retirement pot drawdown projection over time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <XAxis
            dataKey="age"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            label={{ value: "Age", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            tickFormatter={formatCurrencyAxis}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={70}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              formatCurrencyTooltip(Number(value ?? 0)),
              `Growth ${name}`,
            ]}
            labelFormatter={(age) => `Age ${age}`}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Legend formatter={(value: string) => `Growth ${value}`} />

          {/* State pension reference line */}
          <ReferenceLine
            x={statePensionAge}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: `State Pension (${statePensionAge})`,
              position: "top",
              fontSize: 11,
              fill: "var(--muted-foreground)",
            }}
          />

          {rateLabels.map((label, i) => (
            <Area
              key={label}
              type="monotone"
              dataKey={label}
              stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
              fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
              fillOpacity={0.08}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <p className="mt-2 text-[11px] text-muted-foreground">
      Withdrawals are grossed up for income tax (25% PCLS tax-free, remainder taxed as income).
    </p>
    </>
  );
}
