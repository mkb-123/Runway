"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import type { MortgageAmortizationMonth } from "@/lib/property";
import { formatCurrencyAxis, formatCurrencyTooltip } from "@/lib/format";

interface MortgageAmortizationChartProps {
  schedule: MortgageAmortizationMonth[];
  /** Property label for chart title context */
  label?: string;
}

/**
 * Stacked area chart showing interest vs principal split over the mortgage term.
 * X-axis: year (derived from month / 12), Y-axis: monthly payment breakdown.
 * The classic amortization visual: interest shrinks, principal grows.
 */
export function MortgageAmortizationChart({
  schedule,
  label,
}: MortgageAmortizationChartProps) {
  if (schedule.length === 0) return null;

  // Aggregate monthly data into annual buckets for readability
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const annualData: {
    year: number;
    label: string;
    interest: number;
    principal: number;
    balance: number;
  }[] = [];

  let yearInterest = 0;
  let yearPrincipal = 0;
  let lastBalance = schedule[0].openingBalance;

  for (let i = 0; i < schedule.length; i++) {
    const entry = schedule[i];
    yearInterest += entry.interestPayment;
    yearPrincipal += entry.principalPayment;
    lastBalance = entry.closingBalance;

    // At every 12-month boundary or end of schedule, emit an annual row
    const calendarMonth = (currentMonth + entry.month) % 12;
    const isYearEnd = calendarMonth === 0 || i === schedule.length - 1;

    if (isYearEnd) {
      const calendarYear = currentYear + Math.ceil(entry.month / 12);
      annualData.push({
        year: calendarYear,
        label: calendarYear.toString(),
        interest: Math.round(yearInterest),
        principal: Math.round(yearPrincipal),
        balance: Math.round(lastBalance),
      });
      yearInterest = 0;
      yearPrincipal = 0;
    }
  }

  // Find the crossover year (where principal > interest)
  const crossoverYear = annualData.find((d) => d.principal > d.interest);

  return (
    <div className="h-[300px] sm:h-[400px] w-full" role="img" aria-label={`Mortgage amortization${label ? ` for ${label}` : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={annualData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
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
              name === "interest" ? "Interest" : "Principal",
            ]}
            labelFormatter={(label) => `Year: ${label}`}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Legend
            formatter={(value) =>
              value === "interest" ? "Interest" : "Principal"
            }
          />

          {crossoverYear && (
            <ReferenceLine
              x={crossoverYear.label}
              stroke="var(--primary)"
              strokeDasharray="5 3"
              strokeWidth={1}
              label={{
                value: "Principal > Interest",
                position: "insideTopRight",
                fontSize: 10,
                fill: "var(--primary)",
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="interest"
            name="interest"
            stackId="1"
            stroke="var(--chart-4)"
            fill="var(--chart-4)"
            fillOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="principal"
            name="principal"
            stackId="1"
            stroke="var(--chart-2)"
            fill="var(--chart-2)"
            fillOpacity={0.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
