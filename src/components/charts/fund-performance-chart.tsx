"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface FundPerformanceDataItem {
  name: string;
  "1yr"?: number;
  "3yr"?: number;
  "5yr"?: number;
}

interface FundPerformanceChartProps {
  data: FundPerformanceDataItem[];
  height?: number;
}

const PERIOD_COLORS = {
  "1yr": "var(--chart-1)",
  "3yr": "var(--chart-2)",
  "5yr": "var(--chart-3)",
};

export function FundPerformanceChart({
  data,
  height = 350,
}: FundPerformanceChartProps) {
  const hasAnyData = data.some(
    (d) => d["1yr"] != null || d["3yr"] != null || d["5yr"] != null
  );

  if (!hasAnyData) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        No historical return data available
      </div>
    );
  }

  // Convert decimals to percentages for display
  const chartData = data.map((d) => ({
    name: d.name,
    "1yr": d["1yr"] != null ? Math.round(d["1yr"] * 10000) / 100 : undefined,
    "3yr": d["3yr"] != null ? Math.round(d["3yr"] * 10000) / 100 : undefined,
    "5yr": d["5yr"] != null ? Math.round(d["5yr"] * 10000) / 100 : undefined,
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 12 }}
            width={50}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              `${Number(value ?? 0).toFixed(2)}%`,
              name === "1yr"
                ? "1 Year"
                : name === "3yr"
                  ? "3 Year (ann.)"
                  : "5 Year (ann.)",
            ]}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Legend
            formatter={(value: string) =>
              value === "1yr"
                ? "1 Year"
                : value === "3yr"
                  ? "3 Year (ann.)"
                  : "5 Year (ann.)"
            }
          />
          <Bar dataKey="1yr" fill={PERIOD_COLORS["1yr"]} radius={[4, 4, 0, 0]} />
          <Bar dataKey="3yr" fill={PERIOD_COLORS["3yr"]} radius={[4, 4, 0, 0]} />
          <Bar dataKey="5yr" fill={PERIOD_COLORS["5yr"]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
