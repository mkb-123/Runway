"use client";

import { Button } from "@/components/ui/button";
import { formatPercent } from "@/lib/format";

interface ScenarioControlsProps {
  effectiveRetirementAge: number;
  plannedRetirementAge: number;
  retirementAgeOverride: number | null;
  onRetirementAgeChange: (age: number) => void;
  onRetirementAgeReset: () => void;
  scenarioRates: number[];
  selectedRateIndex: number;
  onRateIndexChange: (index: number) => void;
}

export function ScenarioControls({
  effectiveRetirementAge,
  plannedRetirementAge,
  retirementAgeOverride,
  onRetirementAgeChange,
  onRetirementAgeReset,
  scenarioRates,
  selectedRateIndex,
  onRateIndexChange,
}: ScenarioControlsProps) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
        {/* Retirement age slider */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="retirement-age-slider"
              className="text-sm font-medium"
            >
              Retirement age:{" "}
              <span className="text-lg font-bold">
                {effectiveRetirementAge}
              </span>
            </label>
            {retirementAgeOverride !== null && (
              <button
                onClick={onRetirementAgeReset}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Reset to {plannedRetirementAge}
              </button>
            )}
          </div>
          <input
            id="retirement-age-slider"
            type="range"
            min={50}
            max={75}
            step={1}
            value={effectiveRetirementAge}
            onChange={(e) => onRetirementAgeChange(parseInt(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>50</span>
            <span>55</span>
            <span>60</span>
            <span>65</span>
            <span>70</span>
            <span>75</span>
          </div>
        </div>

        {/* Growth rate toggle */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Growth rate</span>
          <div className="flex gap-1">
            {scenarioRates.map((rate, idx) => (
              <Button
                key={rate}
                variant={idx === selectedRateIndex ? "default" : "outline"}
                size="sm"
                onClick={() => onRateIndexChange(idx)}
                className="min-w-[60px]"
              >
                {formatPercent(rate)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
