"use client";

// ============================================================
// Combined Retirement Income Timeline Chart
// ============================================================
// Stacked area chart showing all household income sources by year:
// - Per-person DC pension drawdown
// - Per-person state pension
// - ISA/GIA drawdown to fill the gap
// Displays from earliest retirement age to age 95.

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

export interface PersonRetirementInput {
  name: string;
  pensionAccessAge: number;
  stateRetirementAge: number;
  /** Total DC pension pot at retirement */
  pensionPot: number;
  /** Accessible (non-pension) wealth */
  accessibleWealth: number;
  /** Annual state pension entitlement */
  statePensionAnnual: number;
}

interface RetirementIncomeTimelineProps {
  persons: PersonRetirementInput[];
  targetAnnualIncome: number;
  retirementAge: number;
  endAge?: number;
  growthRate: number;
}

interface DataPoint {
  age: number;
  [key: string]: number;
}

function buildIncomeTimeline(
  persons: PersonRetirementInput[],
  targetAnnualIncome: number,
  retirementAge: number,
  endAge: number,
  growthRate: number
): DataPoint[] {
  const data: DataPoint[] = [];

  // Track mutable pots
  const pots = persons.map((p) => ({
    name: p.name,
    pensionPot: p.pensionPot,
    accessibleWealth: p.accessibleWealth,
    pensionAccessAge: p.pensionAccessAge,
    stateRetirementAge: p.stateRetirementAge,
    statePensionAnnual: p.statePensionAnnual,
  }));

  for (let age = retirementAge; age <= endAge; age++) {
    const point: DataPoint = { age };
    let remainingNeed = targetAnnualIncome;

    // 1. State pensions first (guaranteed income)
    for (const p of pots) {
      const key = `${p.name} State Pension`;
      if (age >= p.stateRetirementAge) {
        const statePension = Math.min(p.statePensionAnnual, remainingNeed);
        point[key] = Math.round(statePension);
        remainingNeed -= statePension;
      } else {
        point[key] = 0;
      }
    }

    // 2. DC Pension drawdown (once accessible)
    for (const p of pots) {
      const key = `${p.name} Pension`;
      if (age >= p.pensionAccessAge && p.pensionPot > 0) {
        // Grow the pot
        p.pensionPot *= 1 + growthRate;
        // Draw what we need (or what's left)
        const draw = Math.min(remainingNeed, p.pensionPot);
        p.pensionPot -= draw;
        point[key] = Math.round(draw);
        remainingNeed -= draw;
      } else {
        // Grow even if not drawing
        if (age < p.pensionAccessAge) {
          p.pensionPot *= 1 + growthRate;
        }
        point[key] = 0;
      }
    }

    // 3. ISA/Accessible drawdown (bridge before pension, or supplement after)
    for (const p of pots) {
      const key = `${p.name} ISA/Savings`;
      if (p.accessibleWealth > 0 && remainingNeed > 0) {
        // Grow accessible wealth
        p.accessibleWealth *= 1 + growthRate;
        const draw = Math.min(remainingNeed, p.accessibleWealth);
        p.accessibleWealth -= draw;
        point[key] = Math.round(draw);
        remainingNeed -= draw;
      } else {
        if (p.accessibleWealth > 0) {
          p.accessibleWealth *= 1 + growthRate;
        }
        point[key] = 0;
      }
    }

    // Track shortfall
    point["Shortfall"] = Math.round(Math.max(0, remainingNeed));

    data.push(point);
  }

  return data;
}

const COLORS = [
  "hsl(221, 83%, 53%)", // blue - state pension
  "hsl(262, 83%, 58%)", // purple - state pension 2
  "hsl(142, 71%, 45%)", // green - DC pension
  "hsl(160, 60%, 45%)", // teal - DC pension 2
  "hsl(38, 92%, 50%)",  // amber - ISA
  "hsl(25, 95%, 53%)",  // orange - ISA 2
  "hsl(0, 72%, 51%)",   // red - shortfall
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

  // Build area keys in order: state pensions, DC pensions, ISA/savings, shortfall
  const areaKeys: { key: string; color: string }[] = [];
  let colorIdx = 0;
  for (const p of persons) {
    areaKeys.push({
      key: `${p.name} State Pension`,
      color: COLORS[colorIdx++ % COLORS.length],
    });
  }
  for (const p of persons) {
    areaKeys.push({
      key: `${p.name} Pension`,
      color: COLORS[colorIdx++ % COLORS.length],
    });
  }
  for (const p of persons) {
    areaKeys.push({
      key: `${p.name} ISA/Savings`,
      color: COLORS[colorIdx++ % COLORS.length],
    });
  }
  areaKeys.push({
    key: "Shortfall",
    color: COLORS[COLORS.length - 1],
  });

  // Filter out series that are always 0
  const activeKeys = areaKeys.filter(({ key }) =>
    data.some((d) => (d[key] ?? 0) > 0)
  );

  return (
    <div className="h-[450px] w-full">
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
          <YAxis
            tickFormatter={formatCurrencyAxis}
            tick={{ fontSize: 12 }}
            width={70}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              formatCurrencyTooltip(Number(value ?? 0)),
              String(name),
            ]}
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
          {activeKeys.map(({ key, color }) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="income"
              stroke={color}
              fill={color}
              fillOpacity={key === "Shortfall" ? 0.3 : 0.6}
              strokeWidth={key === "Shortfall" ? 2 : 1}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
