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
import { formatCurrencyAxis, formatCurrencyTooltip } from "@/lib/format";

interface FeeImpactChartProps {
  currentValue: number;
  monthlyContribution: number;
  annualReturn: number;
  weightedOCF: number;
  years?: number;
}

interface DataPoint {
  year: number;
  withoutFees: number;
  withFees: number;
  feeDrag: number;
}

function buildFeeImpactData(
  currentValue: number,
  monthlyContribution: number,
  annualReturn: number,
  weightedOCF: number,
  years: number
): DataPoint[] {
  const data: DataPoint[] = [
    { year: 0, withoutFees: currentValue, withFees: currentValue, feeDrag: 0 },
  ];

  let valueGross = currentValue;
  let valueNet = currentValue;
  const monthlyGross = annualReturn / 12;
  const monthlyNet = (annualReturn - weightedOCF) / 12;

  for (let year = 1; year <= years; year++) {
    for (let m = 0; m < 12; m++) {
      valueGross = valueGross * (1 + monthlyGross) + monthlyContribution;
      valueNet = valueNet * (1 + monthlyNet) + monthlyContribution;
    }
    data.push({
      year,
      withoutFees: Math.round(valueGross),
      withFees: Math.round(valueNet),
      feeDrag: Math.round(valueGross - valueNet),
    });
  }

  return data;
}

export function FeeImpactChart({
  currentValue,
  monthlyContribution,
  annualReturn,
  weightedOCF,
  years = 30,
}: FeeImpactChartProps) {
  const data = buildFeeImpactData(
    currentValue,
    monthlyContribution,
    annualReturn,
    weightedOCF,
    years
  );

  const totalFeeDrag = data[data.length - 1]?.feeDrag ?? 0;

  return (
    <div className="space-y-2">
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12 }}
              label={{ value: "Years", position: "insideBottom", offset: -5 }}
            />
            <YAxis
              tickFormatter={formatCurrencyAxis}
              tick={{ fontSize: 12 }}
              width={70}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                formatCurrencyTooltip(Number(value ?? 0)),
                name === "withoutFees"
                  ? "Without Fees"
                  : name === "withFees"
                    ? "With Fees (after OCF)"
                    : "Fee Drag",
              ]}
              labelFormatter={(label) => `Year ${label}`}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}
            />
            <Legend
              formatter={(value: string) =>
                value === "withoutFees"
                  ? "Without Fees"
                  : "With Fees (after OCF)"
              }
            />
            <Area
              type="monotone"
              dataKey="withoutFees"
              stroke="var(--chart-1)"
              fill="var(--chart-1)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="withFees"
              stroke="var(--chart-2)"
              fill="var(--chart-2)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Estimated fee drag over {years} years:{" "}
        <span className="font-semibold text-red-600">
          {formatCurrencyTooltip(totalFeeDrag)}
        </span>
      </p>
    </div>
  );
}
