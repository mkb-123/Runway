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
import { formatCurrencyAxis, formatCurrencyTooltip } from "@/lib/format";

export interface TaxBandDataItem {
  name: string;
  personalAllowance: number;
  basicRate: number;
  higherRate: number;
  additionalRate: number;
}

interface TaxBandChartProps {
  data: TaxBandDataItem[];
  height?: number;
}

const BAND_COLORS = {
  personalAllowance: "hsl(142, 71%, 45%)",
  basicRate: "var(--chart-1)",
  higherRate: "hsl(32, 95%, 52%)",
  additionalRate: "hsl(0, 84%, 60%)",
};

export function TaxBandChart({ data, height = 200 }: TaxBandChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        No income data available
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis
            type="number"
            tickFormatter={formatCurrencyAxis}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const labels: Record<string, string> = {
                personalAllowance: "Personal Allowance (0%)",
                basicRate: "Basic Rate (20%)",
                higherRate: "Higher Rate (40%)",
                additionalRate: "Additional Rate (45%)",
              };
              return [formatCurrencyTooltip(Number(value ?? 0)), labels[name] ?? name];
            }}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Legend
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                personalAllowance: "Personal Allowance (0%)",
                basicRate: "Basic (20%)",
                higherRate: "Higher (40%)",
                additionalRate: "Additional (45%)",
              };
              return labels[value] ?? value;
            }}
          />
          <Bar
            dataKey="personalAllowance"
            stackId="bands"
            fill={BAND_COLORS.personalAllowance}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="basicRate"
            stackId="bands"
            fill={BAND_COLORS.basicRate}
          />
          <Bar
            dataKey="higherRate"
            stackId="bands"
            fill={BAND_COLORS.higherRate}
          />
          <Bar
            dataKey="additionalRate"
            stackId="bands"
            fill={BAND_COLORS.additionalRate}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
