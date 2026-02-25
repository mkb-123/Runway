"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DrawdownPlan } from "@/lib/drawdown";
import { formatCurrencyCompact } from "@/lib/format";

interface DrawdownStrategyChartProps {
  plan: DrawdownPlan;
}

/**
 * Stacked area chart showing remaining pot balances by wrapper type
 * during drawdown, visualising the sequencing strategy.
 */
export function DrawdownStrategyChart({ plan }: DrawdownStrategyChartProps) {
  const chartData = plan.years.map((yr) => ({
    age: yr.age,
    Pension: yr.pensionRemaining,
    ISA: yr.isaRemaining,
    GIA: yr.giaRemaining,
    Cash: yr.cashRemaining,
  }));

  return (
    <div className="h-[300px] sm:h-[400px] w-full" role="img" aria-label="Drawdown strategy showing remaining pot balances by wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="age"
            label={{ value: "Age", position: "insideBottom", offset: -5 }}
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
            labelFormatter={(label: any) => `Age ${label}`}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Area
            type="stepAfter"
            dataKey="GIA"
            stackId="1"
            stroke="var(--chart-4)"
            fill="var(--chart-4)"
            fillOpacity={0.6}
          />
          <Area
            type="stepAfter"
            dataKey="Cash"
            stackId="1"
            stroke="var(--chart-5)"
            fill="var(--chart-5)"
            fillOpacity={0.6}
          />
          <Area
            type="stepAfter"
            dataKey="ISA"
            stackId="1"
            stroke="var(--chart-2)"
            fill="var(--chart-2)"
            fillOpacity={0.6}
          />
          <Area
            type="stepAfter"
            dataKey="Pension"
            stackId="1"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
