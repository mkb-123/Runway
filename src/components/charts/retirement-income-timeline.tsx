"use client";

// ============================================================
// Combined Retirement Income Timeline Chart
// ============================================================
// Stacked area chart showing all household income sources by year:
// - Per-person DC pension drawdown
// - Per-person state pension
// - ISA/GIA drawdown to fill the gap
// Displays from earliest retirement age to age 95.
//
// Fixes applied:
// - BUG-003: Draw-then-grow ordering (correct convention)
// - BUG-004: State pension paid in full (not capped to remainingNeed)
// - BUG-005: Proportional drawdown across persons (not first-person priority)
// - BUG-016: stepAfter interpolation for discrete annual data
// - BUG-017: Shortfall shown as separate annotation (not stacked with income)
// - BUG-015: Accessible aria-label on chart container
// - FEAT-008: Vertical reference lines for pension access and state pension ages
// - FEAT-009: Colorblind-safe palette with increased hue separation
// - FEAT-011: Y-axis label
// - FEAT-012: Filter zero-value tooltip entries

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

    // BUG-004: State pensions paid in full (not capped to target).
    // Total income may exceed target — that's a surplus, which is correct.
    let totalIncome = 0;

    // 1. State pensions first (guaranteed income, paid in full)
    for (const p of pots) {
      const key = `${p.name} State Pension`;
      if (age >= p.stateRetirementAge) {
        point[key] = Math.round(p.statePensionAnnual);
        totalIncome += p.statePensionAnnual;
      } else {
        point[key] = 0;
      }
    }

    // 2. DC Pension drawdown (once accessible)
    // BUG-005: Proportional drawdown across persons
    const remainingNeedAfterStatePension = Math.max(0, targetAnnualIncome - totalIncome);

    // Calculate total available pension pot for proportional split
    const availablePensionPots = pots
      .filter((p) => age >= p.pensionAccessAge && p.pensionPot > 0)
      .map((p) => ({ p, available: p.pensionPot }));
    const totalAvailablePension = availablePensionPots.reduce((s, x) => s + x.available, 0);

    for (const p of pots) {
      const key = `${p.name} Pension`;
      if (age >= p.pensionAccessAge && p.pensionPot > 0) {
        // BUG-005: Split need proportionally by pot size
        const share = totalAvailablePension > 0
          ? (p.pensionPot / totalAvailablePension) * remainingNeedAfterStatePension
          : 0;
        // BUG-003: Draw first, then grow
        const draw = Math.min(share, p.pensionPot);
        p.pensionPot -= draw;
        p.pensionPot *= 1 + growthRate;
        point[key] = Math.round(draw);
        totalIncome += draw;
      } else {
        // Grow even if not drawing
        if (p.pensionPot > 0) {
          p.pensionPot *= 1 + growthRate;
        }
        point[key] = 0;
      }
    }

    // 3. ISA/Accessible drawdown (bridge before pension, or supplement after)
    const remainingNeedAfterPension = Math.max(0, targetAnnualIncome - totalIncome);

    // BUG-005: Proportional drawdown for ISA/savings too
    const availableISAPots = pots
      .filter((p) => p.accessibleWealth > 0)
      .map((p) => ({ p, available: p.accessibleWealth }));
    const totalAvailableISA = availableISAPots.reduce((s, x) => s + x.available, 0);

    for (const p of pots) {
      const key = `${p.name} ISA/Savings`;
      if (p.accessibleWealth > 0 && remainingNeedAfterPension > 0) {
        // Split need proportionally
        const share = totalAvailableISA > 0
          ? (p.accessibleWealth / totalAvailableISA) * remainingNeedAfterPension
          : 0;
        // BUG-003: Draw first, then grow
        const draw = Math.min(share, p.accessibleWealth);
        p.accessibleWealth -= draw;
        p.accessibleWealth *= 1 + growthRate;
        point[key] = Math.round(draw);
        totalIncome += draw;
      } else {
        if (p.accessibleWealth > 0) {
          p.accessibleWealth *= 1 + growthRate;
        }
        point[key] = 0;
      }
    }

    // BUG-017: Shortfall tracked separately (not in income stack)
    point["Shortfall"] = Math.round(Math.max(0, targetAnnualIncome - totalIncome));

    data.push(point);
  }

  return data;
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
