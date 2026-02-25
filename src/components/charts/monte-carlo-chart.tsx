"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { MonteCarloResult } from "@/lib/monte-carlo";
import { formatCurrencyCompact } from "@/lib/format";

interface MonteCarloChartProps {
  result: MonteCarloResult;
  targetPot?: number;
}

export function MonteCarloChart({ result, targetPot }: MonteCarloChartProps) {
  const chartData = result.timeline.map((yr) => ({
    year: yr.year,
    p90: yr.percentiles[90] ?? 0,
    p75: yr.percentiles[75] ?? 0,
    p50: yr.percentiles[50] ?? 0,
    p25: yr.percentiles[25] ?? 0,
    p10: yr.percentiles[10] ?? 0,
    mean: yr.mean,
  }));

  return (
    <div className="h-[300px] sm:h-[400px] w-full" role="img" aria-label="Monte Carlo projection fan chart showing probability bands">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="year"
            label={{ value: "Years", position: "insideBottom", offset: -5 }}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(value: number) => formatCurrencyCompact(value)}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={70}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [
              formatCurrencyCompact(Number(value ?? 0)),
              undefined,
            ]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(label: any) => `Year ${label}`}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          {targetPot && (
            <ReferenceLine
              y={targetPot}
              stroke="var(--destructive)"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{
                value: `Target: ${formatCurrencyCompact(targetPot)}`,
                position: "right",
                fill: "var(--destructive)",
                fontSize: 12,
              }}
            />
          )}

          {/* Outer band: 10th-90th percentile */}
          <Area
            type="monotone"
            dataKey="p90"
            stroke="none"
            fill="var(--chart-1)"
            fillOpacity={0.08}
            name="90th percentile"
          />
          <Area
            type="monotone"
            dataKey="p10"
            stroke="none"
            fill="var(--background)"
            fillOpacity={1}
            name="10th percentile"
          />

          {/* Inner band: 25th-75th percentile */}
          <Area
            type="monotone"
            dataKey="p75"
            stroke="none"
            fill="var(--chart-1)"
            fillOpacity={0.15}
            name="75th percentile"
          />
          <Area
            type="monotone"
            dataKey="p25"
            stroke="none"
            fill="var(--background)"
            fillOpacity={1}
            name="25th percentile"
          />

          {/* Median line */}
          <Area
            type="monotone"
            dataKey="p50"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="var(--chart-1)"
            fillOpacity={0.25}
            name="Median (50th)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
