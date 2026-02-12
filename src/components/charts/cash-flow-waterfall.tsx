"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

export interface WaterfallDataPoint {
  name: string;
  value: number;
  type: "income" | "deduction" | "subtotal";
}

interface CashFlowWaterfallProps {
  data: WaterfallDataPoint[];
}

interface WaterfallBarEntry {
  name: string;
  value: number;
  base: number;
  visible: number;
  type: "income" | "deduction" | "subtotal";
}

function formatCompactValue(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}\u00A3${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}\u00A3${(abs / 1_000).toFixed(0)}k`;
  return `${sign}\u00A3${abs.toFixed(0)}`;
}

function formatTooltipValue(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function computeWaterfallBars(data: WaterfallDataPoint[]): WaterfallBarEntry[] {
  const entries: WaterfallBarEntry[] = [];
  let runningTotal = 0;

  for (const point of data) {
    if (point.type === "income") {
      // Income bars grow upward from the current running total
      entries.push({
        name: point.name,
        value: point.value,
        base: runningTotal,
        visible: point.value,
        type: point.type,
      });
      runningTotal += point.value;
    } else if (point.type === "deduction") {
      // Deduction bars hang downward from the current running total
      runningTotal -= point.value;
      entries.push({
        name: point.name,
        value: point.value,
        base: runningTotal,
        visible: point.value,
        type: point.type,
      });
    } else {
      // Subtotal bars start from zero and go up to the running total
      entries.push({
        name: point.name,
        value: runningTotal,
        base: 0,
        visible: runningTotal,
        type: point.type,
      });
    }
  }

  return entries;
}

function getBarColor(type: "income" | "deduction" | "subtotal"): string {
  switch (type) {
    case "income":
      return "hsl(142, 71%, 45%)"; // green
    case "deduction":
      return "hsl(0, 72%, 51%)"; // red
    case "subtotal":
      return "hsl(221, 83%, 53%)"; // blue
  }
}

export function CashFlowWaterfall({ data }: CashFlowWaterfallProps) {
  const bars = computeWaterfallBars(data);

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={bars}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            height={80}
            interval={0}
          />
          <YAxis
            tickFormatter={formatCompactValue}
            tick={{ fontSize: 12 }}
            width={70}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any, props: any) => {
              const entry = props.payload as WaterfallBarEntry;
              const label =
                entry.type === "deduction"
                  ? `- ${formatTooltipValue(entry.value)}`
                  : formatTooltipValue(entry.value);
              return [label, entry.name];
            }}
            labelFormatter={(label) => String(label)}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          {/* Invisible base bar */}
          <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
          {/* Visible portion */}
          <Bar dataKey="visible" stackId="waterfall" isAnimationActive={true}>
            {bars.map((entry, index) => (
              <Cell key={index} fill={getBarColor(entry.type)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
