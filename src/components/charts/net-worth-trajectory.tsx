"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import type { NetWorthSnapshot } from "@/types";
import type { ScenarioProjection } from "@/lib/projections";
import { formatCurrencyAxis, formatCurrencyTooltip } from "@/lib/format";

interface MilestoneMarker {
  label: string;
  value: number;
}

interface NetWorthTrajectoryChartProps {
  snapshots: NetWorthSnapshot[];
  scenarios: ScenarioProjection[];
  milestones?: MilestoneMarker[];
}

const SCENARIO_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function NetWorthTrajectoryChart({
  snapshots,
  scenarios,
  milestones = [],
}: NetWorthTrajectoryChartProps) {
  // Build unified data array: historical snapshots + projected future years
  // Historical points use the snapshot date's year as the label
  const currentYear = new Date().getFullYear();

  const historicalData = snapshots.map((s) => {
    const year = new Date(s.date).getFullYear();
    const entry: Record<string, number | string> = {
      year,
      label: year.toString(),
      historical: s.totalNetWorth,
    };
    return entry;
  });

  // Deduplicate historical by year (take the latest snapshot per year)
  const historicalByYear = new Map<number, Record<string, number | string>>();
  for (const entry of historicalData) {
    historicalByYear.set(entry.year as number, entry);
  }

  const uniqueHistorical = Array.from(historicalByYear.values()).sort(
    (a, b) => (a.year as number) - (b.year as number)
  );

  // Build projected data from scenarios
  const projectedData: Record<string, number | string>[] = [];
  if (scenarios.length > 0) {
    const maxYears = Math.max(
      ...scenarios.map((s) => s.projections.length)
    );
    for (let i = 0; i < maxYears; i++) {
      const projYear = currentYear + i + 1;
      const entry: Record<string, number | string> = {
        year: projYear,
        label: projYear.toString(),
      };
      for (const scenario of scenarios) {
        if (i < scenario.projections.length) {
          const rateLabel = `${(scenario.rate * 100).toFixed(0)}%`;
          entry[rateLabel] = scenario.projections[i].value;
        }
      }
      projectedData.push(entry);
    }
  }

  // Bridge: last historical point should also appear as the first projection point
  const lastHistorical = uniqueHistorical[uniqueHistorical.length - 1];
  if (lastHistorical && scenarios.length > 0) {
    const bridgeEntry: Record<string, number | string> = { ...lastHistorical };
    for (const scenario of scenarios) {
      const rateLabel = `${(scenario.rate * 100).toFixed(0)}%`;
      bridgeEntry[rateLabel] = lastHistorical.historical as number;
    }
    // Replace the last historical entry with the bridge entry
    uniqueHistorical[uniqueHistorical.length - 1] = bridgeEntry;
  }

  const chartData = [...uniqueHistorical, ...projectedData];

  // Collect rate labels for scenario lines
  const rateLabels = scenarios.map(
    (s) => `${(s.rate * 100).toFixed(0)}%`
  );

  return (
    <div className="h-[300px] sm:h-[400px] w-full" role="img" aria-label="Net worth projection trajectory across growth scenarios">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
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
              name === "historical" ? "Historical" : `Growth ${name}`,
            ]}
            labelFormatter={(label) => `Year: ${label}`}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Legend />

          {/* Milestone reference lines */}
          {milestones.map((m) => (
            <ReferenceLine
              key={m.label}
              y={m.value}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: `${m.label} (${formatCurrencyAxis(m.value)})`,
                position: "insideTopRight",
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
          ))}

          {/* Historical line */}
          <Line
            type="monotone"
            dataKey="historical"
            name="Historical"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={{ r: 4 }}
            connectNulls={false}
          />

          {/* Scenario projection lines */}
          {rateLabels.map((rateLabel, i) => (
            <Line
              key={rateLabel}
              type="monotone"
              dataKey={rateLabel}
              name={`Growth ${rateLabel}`}
              stroke={SCENARIO_COLORS[(i + 1) % SCENARIO_COLORS.length]}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
