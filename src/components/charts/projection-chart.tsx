"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { ScenarioProjection } from "@/lib/projections";
import { formatCurrencyCompact } from "@/lib/format";

const SCENARIO_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface ProjectionChartProps {
  scenarios: ScenarioProjection[];
  targetPot: number;
  years: number;
}

export function ProjectionChart({
  scenarios,
  targetPot,
  years,
}: ProjectionChartProps) {
  // Transform scenario data into a single array of objects keyed by year
  const chartData = Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    const point: Record<string, number> = { year };
    for (const scenario of scenarios) {
      const projection = scenario.projections.find((p) => p.year === year);
      if (projection) {
        point[`${(scenario.rate * 100).toFixed(0)}%`] = Math.round(
          projection.value
        );
      }
    }
    return point;
  });

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="year"
            label={{ value: "Years", position: "insideBottom", offset: -5 }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value: number) => formatCurrencyCompact(value)}
            tick={{ fontSize: 12 }}
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
          <Legend />
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
          {scenarios.map((scenario, index) => (
            <Line
              key={scenario.rate}
              type="monotone"
              dataKey={`${(scenario.rate * 100).toFixed(0)}%`}
              stroke={SCENARIO_COLORS[index % SCENARIO_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
