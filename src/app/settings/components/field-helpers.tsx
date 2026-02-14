"use client";

import { Label } from "@/components/ui/label";

export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setField<T>(obj: T, field: keyof T, value: any): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (obj as any)[field] = value;
}

export function renderField(
  label: string,
  children: React.ReactNode,
  hint?: string,
  key?: string
) {
  return (
    <div className="space-y-1.5" key={key}>
      <Label>{label}</Label>
      {children}
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
