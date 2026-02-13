"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrencyAxis, formatCurrencyTooltip } from "@/lib/format";

export interface AllocationBarDataItem {
  name: string;
  value: number;
}

interface AllocationBarProps {
  data: AllocationBarDataItem[];
  height?: number;
  color?: string;
  layout?: "horizontal" | "vertical";
}

const DEFAULT_BAR_COLOR = "var(--chart-1)";

const MULTI_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "hsl(210, 70%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(30, 80%, 55%)",
];

export function AllocationBar({
  data,
  height = 350,
  color,
  layout = "horizontal",
}: AllocationBarProps) {
  const filteredData = data.filter((d) => d.value > 0);

  if (filteredData.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  const useMultiColor = !color;

  if (layout === "vertical") {
    return (
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={filteredData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis
              type="number"
              tickFormatter={formatCurrencyAxis}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              width={120}
            />
            <Tooltip
              formatter={(value: number | undefined) => formatCurrencyTooltip(value ?? 0)}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {filteredData.map((_, index) => (
                <Cell
                  key={index}
                  fill={
                    useMultiColor
                      ? MULTI_COLORS[index % MULTI_COLORS.length]
                      : color ?? DEFAULT_BAR_COLOR
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={filteredData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={formatCurrencyAxis}
            tick={{ fontSize: 12 }}
            width={70}
          />
          <Tooltip
            formatter={(value: number | undefined) => formatCurrencyTooltip(value ?? 0)}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {filteredData.map((_, index) => (
              <Cell
                key={index}
                fill={
                  useMultiColor
                    ? MULTI_COLORS[index % MULTI_COLORS.length]
                    : color ?? DEFAULT_BAR_COLOR
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
