"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { formatCurrencyAxis, formatCurrencyTooltip } from "@/lib/format";

export interface GainLossDataItem {
  name: string;
  value: number;
}

interface GainLossChartProps {
  data: GainLossDataItem[];
  height?: number;
}

export function GainLossChart({ data, height = 350 }: GainLossChartProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);

  if (sorted.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        No holdings data available
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
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
            width={140}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [
              formatCurrencyTooltip(Number(value ?? 0)),
              Number(value ?? 0) >= 0 ? "Unrealised Gain" : "Unrealised Loss",
            ]}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <ReferenceLine x={0} stroke="var(--border)" />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {sorted.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.value >= 0
                    ? "hsl(142, 71%, 45%)"
                    : "hsl(0, 84%, 60%)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
