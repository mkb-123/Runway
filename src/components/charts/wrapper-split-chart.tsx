"use client";

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { TAX_WRAPPER_LABELS, type TaxWrapper } from "@/types";
import { formatCurrency, formatPercent, roundPence } from "@/lib/format";

interface WrapperSplitData {
  wrapper: TaxWrapper;
  value: number;
}

interface WrapperSplitChartProps {
  data: WrapperSplitData[];
}

const WRAPPER_COLORS: Record<TaxWrapper, string> = {
  pension: "#6366f1",
  isa: "#22c55e",
  gia: "#f59e0b",
  cash: "#3b82f6",
  premium_bonds: "#8b5cf6",
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: { name: string; value: number; percent: number } }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    const item = payload[0].payload;
    return (
      <div className="bg-card rounded-lg border p-3 shadow-sm">
        <p className="font-medium">{item.name}</p>
        <p className="text-muted-foreground text-sm">{formatCurrency(item.value)}</p>
        <p className="text-muted-foreground text-sm">{formatPercent(item.percent)}</p>
      </div>
    );
  }
  return null;
}

export function WrapperSplitChart({ data }: WrapperSplitChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const chartData = data
    .filter((d) => d.value > 0)
    .map((d) => ({
      name: TAX_WRAPPER_LABELS[d.wrapper],
      value: roundPence(d.value),
      wrapper: d.wrapper,
      percent: total > 0 ? d.value / total : 0,
    }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={110}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }: { name?: string; percent?: number }) =>
            `${name ?? ""} ${formatPercent(percent ?? 0)}`
          }
          labelLine={true}
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.wrapper}
              fill={WRAPPER_COLORS[entry.wrapper]}
              strokeWidth={1}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="bottom"
          formatter={(value: string) => (
            <span className="text-foreground text-sm">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
