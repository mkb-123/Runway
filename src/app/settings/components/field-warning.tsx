"use client";

import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface FieldWarningProps {
  value: number;
  min: number;
  max: number;
  label: string;
  isCurrency?: boolean;
  suffix?: string;
  maxLabel?: string;
}

export function FieldWarning({
  value,
  min,
  max,
  label,
  isCurrency,
  suffix,
  maxLabel,
}: FieldWarningProps) {
  if (value === 0) return null;

  function fmt(n: number): string {
    if (isCurrency) return formatCurrency(n);
    if (suffix) return `${n}${suffix}`;
    return String(n);
  }

  if (value < min) {
    return (
      <p className="flex items-center gap-1 text-xs text-amber-600">
        <AlertTriangle className="size-3 shrink-0" />
        {fmt(value)} is below the expected minimum ({fmt(min)}) for {label}
      </p>
    );
  }

  if (value > max) {
    const overLabel = maxLabel ? `This exceeds ${maxLabel}` : `${fmt(value)} is unusually high for ${label}`;
    return (
      <p className="flex items-center gap-1 text-xs text-amber-600">
        <AlertTriangle className="size-3 shrink-0" />
        {overLabel} — did you mean {fmt(Math.round(value / 10))}?
      </p>
    );
  }

  return null;
}
