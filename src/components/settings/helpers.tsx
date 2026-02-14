"use client";

import { Label } from "@/components/ui/label";
import type { TransactionType, StudentLoanPlan } from "@/types";

/** Deep clone via JSON round-trip */
export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Type-safe field setter (avoids TS2352 with a double assertion). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setField<T>(obj: T, field: keyof T, value: any): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (obj as any)[field] = value;
}

/** Reusable labelled field wrapper */
export function renderField(
  label: string,
  children: React.ReactNode,
  key?: string
) {
  return (
    <div className="space-y-1.5" key={key}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export const STUDENT_LOAN_LABELS: Record<StudentLoanPlan, string> = {
  none: "None",
  plan1: "Plan 1",
  plan2: "Plan 2",
  plan4: "Plan 4",
  plan5: "Plan 5",
  postgrad: "Postgraduate",
};

export const PENSION_METHOD_LABELS: Record<string, string> = {
  salary_sacrifice: "Salary Sacrifice",
  net_pay: "Net Pay",
  relief_at_source: "Relief at Source",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  dividend: "Dividend",
  contribution: "Contribution",
};
