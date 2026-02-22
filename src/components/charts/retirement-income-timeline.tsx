"use client";

// ============================================================
// Combined Retirement Income Timeline Chart
// ============================================================
// Rendering layer only — financial logic lives in src/lib/retirement.ts.

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
import { formatCurrencyAxis, formatCurrencyTooltip } from "@/lib/format";
import { buildIncomeTimeline, type PersonRetirementInput } from "@/lib/retirement";

export type { PersonRetirementInput };

interface RetirementIncomeTimelineProps {
  persons: PersonRetirementInput[];
  targetAnnualIncome: number;
  retirementAge: number;
  endAge?: number;
  growthRate: number;
}

// FEAT-009: Colorblind-safe palette with wider hue separation and distinct patterns
const COLORS = [
  "hsl(220, 70%, 50%)",  // blue - state pension 1
  "hsl(280, 60%, 55%)",  // violet - state pension 2
  "hsl(150, 60%, 40%)",  // green - DC pension 1
  "hsl(40, 80%, 50%)",   // gold - DC pension 2
  "hsl(190, 70%, 45%)",  // cyan - ISA 1
  "hsl(330, 65%, 50%)",  // pink - ISA 2
  "hsl(0, 70%, 50%)",    // red - shortfall
];

export function RetirementIncomeTimeline({
  persons,
  targetAnnualIncome,
  retirementAge,
  endAge = 95,
  growthRate,
}: RetirementIncomeTimelineProps) {
  const data = buildIncomeTimeline(
    persons,
    targetAnnualIncome,
    retirementAge,
    endAge,
    growthRate
  );

  // Build area keys in order: state pensions, DC pensions, ISA/savings
  const incomeKeys: { key: string; color: string }[] = [];
  let colorIdx = 0;
  for (const p of persons) {
    incomeKeys.push({
      key: `${p.name} State Pension`,
      color: COLORS[colorIdx++ % COLORS.length],
    });
  }
  for (const p of persons) {
    incomeKeys.push({
      key: `${p.name} Pension`,
      color: COLORS[colorIdx++ % COLORS.length],
    });
  }
  for (const p of persons) {
    incomeKeys.push({
      key: `${p.name} ISA/Savings`,
      color: COLORS[colorIdx++ % COLORS.length],
    });
  }

  // Filter out series that are always 0
  const activeIncomeKeys = incomeKeys.filter(({ key }) =>
    data.some((d) => (d[key] ?? 0) > 0)
  );

  const hasShortfall = data.some((d) => (d["Shortfall"] ?? 0) > 0);

  // FEAT-008: Collect unique reference line ages for pension access and state pension
  const referenceLines: { age: number; label: string }[] = [];
  for (const p of persons) {
    if (p.pensionAccessAge >= retirementAge && p.pensionAccessAge <= endAge) {
      referenceLines.push({ age: p.pensionAccessAge, label: `${p.name} Pension Access (${p.pensionAccessAge})` });
    }
    if (p.stateRetirementAge >= retirementAge && p.stateRetirementAge <= endAge) {
      referenceLines.push({ age: p.stateRetirementAge, label: `${p.name} State Pension (${p.stateRetirementAge})` });
    }
  }
  // Deduplicate by age
  const uniqueReferenceLines = referenceLines.filter(
    (line, idx, arr) => arr.findIndex((l) => l.age === line.age) === idx
  );

  // BUG-015: Build accessible summary
  const accessibleSummary = `Retirement income timeline from age ${retirementAge} to ${endAge}. ${
    hasShortfall
      ? `Income falls short of the ${formatCurrencyAxis(targetAnnualIncome)} annual target in some years.`
      : `Income meets or exceeds the ${formatCurrencyAxis(targetAnnualIncome)} annual target throughout.`
  }`;

  return (
    <div
      className="h-[300px] sm:h-[450px] w-full"
      role="img"
      aria-label={accessibleSummary}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis
            dataKey="age"
            tick={{ fontSize: 12 }}
            label={{ value: "Age", position: "insideBottom", offset: -5 }}
          />
          {/* FEAT-011: Y-axis label */}
          <YAxis
            tickFormatter={formatCurrencyAxis}
            tick={{ fontSize: 12 }}
            width={80}
            label={{ value: "Annual Income (£)", angle: -90, position: "insideLeft", offset: 5, style: { fontSize: 11, fill: "var(--muted-foreground)" } }}
          />
          {/* FEAT-012: Filter zero-value entries in tooltip */}
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const num = Number(value ?? 0);
              if (num === 0) return [null, null] as unknown as [string, string];
              return [formatCurrencyTooltip(num), String(name)];
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            itemSorter={(item: any) => -(Number(item.value) || 0)}
            labelFormatter={(age) => `Age ${age}`}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <ReferenceLine
            y={targetAnnualIncome}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: `Target: ${formatCurrencyAxis(targetAnnualIncome)}`,
              position: "right",
              fontSize: 11,
              fill: "var(--muted-foreground)",
            }}
          />
          {/* FEAT-008: Vertical reference lines for key ages */}
          {uniqueReferenceLines.map(({ age, label }) => (
            <ReferenceLine
              key={`ref-${age}`}
              x={age}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{
                value: label,
                position: "top",
                fontSize: 10,
                fill: "var(--muted-foreground)",
              }}
            />
          ))}
          {/* Income sources — stacked, BUG-016: stepAfter for discrete annual data */}
          {activeIncomeKeys.map(({ key, color }) => (
            <Area
              key={key}
              type="stepAfter"
              dataKey={key}
              stackId="income"
              stroke={color}
              fill={color}
              fillOpacity={0.6}
              strokeWidth={1}
            />
          ))}
          {/* BUG-017: Shortfall shown separately (not in income stack) */}
          {hasShortfall && (
            <Area
              key="Shortfall"
              type="stepAfter"
              dataKey="Shortfall"
              stackId="shortfall"
              stroke={COLORS[COLORS.length - 1]}
              fill={COLORS[COLORS.length - 1]}
              fillOpacity={0.2}
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
