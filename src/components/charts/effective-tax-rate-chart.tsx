"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrencyAxis } from "@/lib/format";
import { calculateIncomeTax, calculateNI } from "@/lib/tax";

interface EffectiveTaxRateChartProps {
  /** Max income to plot on X-axis */
  maxIncome?: number;
  /** Step size for sampling (smaller = smoother, slower) */
  step?: number;
}

interface DataPoint {
  income: number;
  marginalRate: number;
  effectiveRate: number;
  effectiveTaxAndNI: number;
}

function buildTaxCurveData(maxIncome: number, step: number): DataPoint[] {
  const data: DataPoint[] = [];

  for (let income = 0; income <= maxIncome; income += step) {
    const taxResult = calculateIncomeTax(income);
    const niResult = calculateNI(income);

    const totalDeductions = taxResult.tax + niResult.ni;
    const effectiveRate = income > 0 ? totalDeductions / income : 0;

    // Marginal rate: calculate tax on income + £1 step to find the marginal rate
    const taxNext = calculateIncomeTax(income + step);
    const niNext = calculateNI(income + step);
    const totalNext = taxNext.tax + niNext.ni;
    const marginalRate = (totalNext - totalDeductions) / step;

    data.push({
      income,
      marginalRate: Math.round(marginalRate * 10000) / 100,
      effectiveRate: Math.round(effectiveRate * 10000) / 100,
      effectiveTaxAndNI: Math.round(effectiveRate * 10000) / 100,
    });
  }

  return data;
}

const THRESHOLDS = [
  { value: 12_570, label: "PA £12.6k" },
  { value: 50_270, label: "Higher £50.3k" },
  { value: 100_000, label: "PA Taper £100k" },
  { value: 125_140, label: "Additional £125.1k" },
];

export function EffectiveTaxRateChart({
  maxIncome = 200_000,
  step = 1_000,
}: EffectiveTaxRateChartProps) {
  const data = buildTaxCurveData(maxIncome, step);

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <XAxis
            dataKey="income"
            tickFormatter={formatCurrencyAxis}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            type="number"
            domain={[0, maxIncome]}
          />
          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={50}
            domain={[0, 70]}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              `${Number(value ?? 0).toFixed(1)}%`,
              name === "marginalRate" ? "Marginal Rate" : "Effective Rate",
            ]}
            labelFormatter={(income) =>
              `Income: ${formatCurrencyAxis(Number(income))}`
            }
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />

          {/* Threshold reference lines */}
          {THRESHOLDS.map((t) => (
            <ReferenceLine
              key={t.value}
              x={t.value}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{
                value: t.label,
                position: "top",
                fontSize: 10,
                fill: "var(--muted-foreground)",
              }}
            />
          ))}

          {/* 60% trap band highlight */}
          <Area
            type="stepAfter"
            dataKey="marginalRate"
            name="marginalRate"
            stroke="hsl(0, 84%, 60%)"
            fill="hsl(0, 84%, 60%)"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="effectiveRate"
            name="effectiveRate"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.1}
            strokeWidth={2.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
