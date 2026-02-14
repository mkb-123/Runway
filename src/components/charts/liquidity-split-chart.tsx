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
import { formatCurrencyCompact } from "@/lib/format";
import type { Account } from "@/types";
import { getAccountTaxWrapper } from "@/types";

interface LiquiditySplitChartProps {
  accounts: Account[];
}

interface LiquidityBucket {
  name: string;
  value: number;
  color: string;
}

function classifyLiquidity(accounts: Account[]): {
  liquid: number;
  illiquid: number;
  buckets: LiquidityBucket[];
} {
  let cash = 0;
  let isa = 0;
  let gia = 0;
  let pension = 0;

  for (const account of accounts) {
    const wrapper = getAccountTaxWrapper(account.type);
    switch (wrapper) {
      case "cash":
      case "premium_bonds":
        cash += account.currentValue;
        break;
      case "isa":
        isa += account.currentValue;
        break;
      case "gia":
        gia += account.currentValue;
        break;
      case "pension":
        pension += account.currentValue;
        break;
    }
  }

  const buckets: LiquidityBucket[] = [];
  if (cash > 0) buckets.push({ name: "Cash & Bonds", value: cash, color: "hsl(142, 60%, 45%)" });
  if (isa > 0) buckets.push({ name: "ISA", value: isa, color: "hsl(220, 70%, 55%)" });
  if (gia > 0) buckets.push({ name: "GIA", value: gia, color: "hsl(40, 80%, 50%)" });
  if (pension > 0) buckets.push({ name: "Pension", value: pension, color: "hsl(0, 0%, 55%)" });

  return {
    liquid: cash + isa + gia,
    illiquid: pension,
    buckets,
  };
}

export function LiquiditySplitChart({ accounts }: LiquiditySplitChartProps) {
  const { liquid, illiquid, buckets } = classifyLiquidity(accounts);
  const total = liquid + illiquid;
  const liquidPercent = total > 0 ? Math.round((liquid / total) * 100) : 0;
  const illiquidPercent = total > 0 ? Math.round((illiquid / total) * 100) : 0;

  if (buckets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No accounts to display.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Liquid</p>
          <p className="text-xl font-bold font-mono">
            {formatCurrencyCompact(liquid)}
          </p>
          <p className="text-xs text-muted-foreground">
            {liquidPercent}% — Cash, ISA, GIA
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Illiquid</p>
          <p className="text-xl font-bold font-mono">
            {formatCurrencyCompact(illiquid)}
          </p>
          <p className="text-xs text-muted-foreground">
            {illiquidPercent}% — Pensions (locked)
          </p>
        </div>
      </div>

      {/* Horizontal bar chart */}
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={buckets}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              tickFormatter={formatCurrencyAxis}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              width={90}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number | undefined) => [
                formatCurrencyTooltip(value ?? 0),
                "Value",
              ]}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
              {buckets.map((bucket, index) => (
                <Cell key={index} fill={bucket.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked bar */}
      <div className="space-y-1">
        <div className="relative h-5 w-full overflow-hidden rounded-full bg-muted">
          <div className="flex h-full">
            {buckets.map((bucket) => {
              const pct = total > 0 ? (bucket.value / total) * 100 : 0;
              return (
                <div
                  key={bucket.name}
                  className="h-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: bucket.color }}
                  title={`${bucket.name}: ${formatCurrencyCompact(bucket.value)}`}
                />
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {buckets.map((bucket) => (
            <div key={bucket.name} className="flex items-center gap-1.5">
              <div
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: bucket.color }}
              />
              <span>{bucket.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
