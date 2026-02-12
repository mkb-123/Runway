"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { NetWorthSnapshot, TaxWrapper } from "@/types";
import { TAX_WRAPPER_LABELS } from "@/types";

interface NetWorthHistoryChartProps {
  snapshots: NetWorthSnapshot[];
}

const WRAPPER_ORDER: TaxWrapper[] = [
  "pension",
  "isa",
  "gia",
  "cash",
  "premium_bonds",
];

const WRAPPER_COLORS: Record<TaxWrapper, string> = {
  pension: "var(--chart-1)",
  isa: "var(--chart-2)",
  gia: "var(--chart-3)",
  cash: "var(--chart-4)",
  premium_bonds: "var(--chart-5)",
};

function formatCompactValue(value: number): string {
  if (value >= 1_000_000) return `\u00A3${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `\u00A3${(value / 1_000).toFixed(0)}k`;
  return `\u00A3${value.toFixed(0)}`;
}

function formatTooltipValue(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
  }).format(date);
}

export function NetWorthHistoryChart({
  snapshots,
}: NetWorthHistoryChartProps) {
  const chartData = snapshots.map((snapshot) => {
    const entry: Record<string, number | string> = {
      date: snapshot.date,
      label: formatDateLabel(snapshot.date),
    };
    for (const wrapper of WRAPPER_ORDER) {
      const found = snapshot.byWrapper.find((bw) => bw.wrapper === wrapper);
      entry[wrapper] = found ? found.value : 0;
    }
    return entry;
  });

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={formatCompactValue}
            tick={{ fontSize: 12 }}
            width={70}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              formatTooltipValue(Number(value ?? 0)),
              TAX_WRAPPER_LABELS[name as TaxWrapper] ?? name,
            ]}
            labelFormatter={(_, payload) => {
              if (payload && payload.length > 0) {
                const dateStr = payload[0]?.payload?.date;
                if (dateStr) {
                  const date = new Date(dateStr);
                  return new Intl.DateTimeFormat("en-GB", {
                    month: "long",
                    year: "numeric",
                  }).format(date);
                }
              }
              return "";
            }}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Legend
            formatter={(value: string) =>
              TAX_WRAPPER_LABELS[value as TaxWrapper] ?? value
            }
          />

          {WRAPPER_ORDER.map((wrapper) => (
            <Area
              key={wrapper}
              type="monotone"
              dataKey={wrapper}
              name={wrapper}
              stackId="1"
              stroke={WRAPPER_COLORS[wrapper]}
              fill={WRAPPER_COLORS[wrapper]}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
