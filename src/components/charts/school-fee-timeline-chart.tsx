"use client";

// ============================================================
// School Fee Timeline Chart
// ============================================================
// Stacked bar chart showing annual school fees per child over time.
// Each child gets its own coloured bar segment so users can see
// the overlap years (expensive) vs single-child years (lighter).
// The "last child finishes" year is annotated with a reference line.

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { formatCurrencyAxis, formatCurrencyTooltip } from "@/lib/format";
import type { Child } from "@/types";
import type { SchoolFeeTimelineYear } from "@/lib/school-fees";

interface SchoolFeeTimelineChartProps {
  data: SchoolFeeTimelineYear[];
  childrenList: Child[];
  lastSchoolFeeYear: number | null;
}

// Colorblind-safe palette for up to 6 children
const CHILD_COLORS = [
  "hsl(220, 70%, 55%)",   // blue
  "hsl(340, 65%, 55%)",   // rose
  "hsl(150, 55%, 45%)",   // green
  "hsl(35, 80%, 50%)",    // amber
  "hsl(280, 55%, 55%)",   // purple
  "hsl(180, 55%, 45%)",   // teal
] as const;

export function SchoolFeeTimelineChart({ data, childrenList, lastSchoolFeeYear }: SchoolFeeTimelineChartProps) {
  if (data.length === 0) return null;

  const activeChildren = childrenList.filter((c) => c.schoolFeeAnnual > 0);

  // Build accessible summary
  const startYear = data[0].calendarYear;
  const endYear = data[data.length - 1].calendarYear;
  const peakYear = data.reduce((max, d) => (d.total > max.total ? d : max), data[0]);
  const accessibleSummary = `School fee timeline from ${startYear} to ${endYear} for ${activeChildren.length} child${activeChildren.length !== 1 ? "ren" : ""}. Peak annual cost of ${formatCurrencyTooltip(peakYear.total)} in ${peakYear.calendarYear}.`;

  return (
    <div className="h-[350px] w-full" role="img" aria-label={accessibleSummary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
          <XAxis
            dataKey="calendarYear"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
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
            formatter={(value: any, name: any) => {
              const num = Number(value ?? 0);
              if (num === 0) return [null, null] as unknown as [string, string];
              return [formatCurrencyTooltip(num), String(name)];
            }}
            labelFormatter={(year) => String(year)}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />

          {/* Reference line for last child finishing */}
          {lastSchoolFeeYear && (
            <ReferenceLine
              x={lastSchoolFeeYear}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
              label={{
                value: "Last child finishes",
                position: "top",
                fontSize: 10,
                fill: "var(--muted-foreground)",
              }}
            />
          )}

          {/* Stacked bars — one per child */}
          {activeChildren.map((child, i) => (
            <Bar
              key={child.id}
              dataKey={child.id}
              stackId="fees"
              name={child.name || `Child ${i + 1}`}
              fill={CHILD_COLORS[i % CHILD_COLORS.length]}
              radius={i === activeChildren.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
