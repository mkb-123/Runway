"use client";

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

export interface CashFlowMonth {
  month: string; // "Jan 2025"
  salary: number;
  bonus: number;
  deferredVesting: number;
  committedOutgoings: number;
  lifestyleSpending: number;
  totalIncome: number;
  totalOutgoings: number;
}

interface CashFlowTimelineProps {
  data: CashFlowMonth[];
}

const INCOME_COLORS = {
  salary: "hsl(142, 71%, 45%)", // green
  bonus: "hsl(186, 72%, 42%)", // teal
  deferredVesting: "hsl(220, 70%, 55%)", // blue
};

const OUTGOING_COLOR = "hsl(0, 72%, 60%)"; // red

export function CashFlowTimeline({ data }: CashFlowTimelineProps) {
  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
        >
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
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
              formatCurrencyTooltip(Number(value)),
              String(name),
            ]}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Legend />

          {/* Income areas (stacked) */}
          <Area
            type="monotone"
            dataKey="salary"
            stackId="income"
            name="Salary"
            fill={INCOME_COLORS.salary}
            stroke={INCOME_COLORS.salary}
            fillOpacity={0.4}
          />
          <Area
            type="monotone"
            dataKey="bonus"
            stackId="income"
            name="Bonus"
            fill={INCOME_COLORS.bonus}
            stroke={INCOME_COLORS.bonus}
            fillOpacity={0.4}
          />
          <Area
            type="monotone"
            dataKey="deferredVesting"
            stackId="income"
            name="Deferred Vesting"
            fill={INCOME_COLORS.deferredVesting}
            stroke={INCOME_COLORS.deferredVesting}
            fillOpacity={0.4}
          />

          {/* Outgoing line */}
          <ReferenceLine y={0} stroke="var(--border)" />
          <Area
            type="monotone"
            dataKey="totalOutgoings"
            name="Total Outgoings"
            fill={OUTGOING_COLOR}
            stroke={OUTGOING_COLOR}
            fillOpacity={0.15}
            strokeDasharray="5 5"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
