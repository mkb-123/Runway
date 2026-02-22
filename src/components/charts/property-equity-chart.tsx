"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import type { PropertyProjectionYear } from "@/lib/property";
import { formatCurrencyAxis, formatCurrencyTooltip } from "@/lib/format";

interface PropertyEquityChartProps {
  /** Per-property projections, keyed by property label */
  projections: { label: string; data: PropertyProjectionYear[] }[];
  /** Year when mortgage is paid off (optional vertical marker) */
  mortgagePayoffYear?: number | null;
}

const PROPERTY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function PropertyEquityChart({
  projections,
  mortgagePayoffYear,
}: PropertyEquityChartProps) {
  if (projections.length === 0) return null;

  const currentYear = new Date().getFullYear();

  // Build unified chart data: one row per year, columns for each property's equity + total
  const maxYears = Math.max(...projections.map((p) => p.data.length));
  const chartData: Record<string, number | string>[] = [];

  for (let i = 0; i < maxYears; i++) {
    const year = currentYear + i;
    const entry: Record<string, number | string> = {
      year,
      label: year.toString(),
    };

    let totalEquity = 0;
    for (const prop of projections) {
      const yearData = prop.data[i];
      if (yearData) {
        entry[`${prop.label} equity`] = yearData.equity;
        totalEquity += yearData.equity;
      }
    }

    if (projections.length > 1) {
      entry["Total Equity"] = totalEquity;
    }

    chartData.push(entry);
  }

  const showTotal = projections.length > 1;

  return (
    <div className="h-[300px] sm:h-[400px] w-full" role="img" aria-label="Property equity trajectory over time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatCurrencyAxis}
            tick={{ fontSize: 12 }}
            width={70}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              formatCurrencyTooltip(Number(value ?? 0)),
              name,
            ]}
            labelFormatter={(label) => `Year: ${label}`}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Legend />

          {mortgagePayoffYear != null && (
            <ReferenceLine
              x={(currentYear + mortgagePayoffYear).toString()}
              stroke="var(--primary)"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{
                value: "Mortgage free",
                position: "insideTopLeft",
                fontSize: 11,
                fill: "var(--primary)",
              }}
            />
          )}

          {projections.map((prop, i) => (
            <Area
              key={prop.label}
              type="monotone"
              dataKey={`${prop.label} equity`}
              name={`${prop.label} equity`}
              stackId={showTotal ? undefined : "1"}
              stroke={PROPERTY_COLORS[i % PROPERTY_COLORS.length]}
              fill={PROPERTY_COLORS[i % PROPERTY_COLORS.length]}
              fillOpacity={0.3}
            />
          ))}

          {showTotal && (
            <Area
              type="monotone"
              dataKey="Total Equity"
              name="Total Equity"
              stroke="var(--primary)"
              fill="var(--primary)"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="6 3"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
