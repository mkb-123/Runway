"use client";

import { AlertTriangle } from "lucide-react";
import { TAX_YEAR, isTaxYearStale } from "@/lib/tax-constants";

/**
 * Displays a prominent warning when the embedded UK tax constants
 * are from a previous tax year. This is critical for user trust —
 * stale rates mean all tax, NI, pension, and recommendation
 * calculations may be inaccurate.
 */
export function StaleTaxBanner() {
  if (!isTaxYearStale()) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Tax rates may be outdated
        </p>
        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
          Calculations use {TAX_YEAR} rates. The current tax year may have different
          thresholds and allowances. Verify figures with HMRC or your financial advisor.
        </p>
      </div>
    </div>
  );
}
