"use client";

import { useState, useEffect } from "react";
import { TAX_YEAR, TAX_YEAR_END } from "@/lib/tax-constants";
import { AlertTriangle, X } from "lucide-react";

export function TaxYearBanner() {
  const [isStale, setIsStale] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const now = new Date();
    const endDate = new Date(TAX_YEAR_END);
    setIsStale(now >= endDate);

    // Check if dismissed this session
    const key = `nw-tax-year-dismissed-${TAX_YEAR}`;
    if (sessionStorage.getItem(key) === "true") {
      setDismissed(true);
    }
  }, []);

  if (!isStale || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    const key = `nw-tax-year-dismissed-${TAX_YEAR}`;
    try { sessionStorage.setItem(key, "true"); } catch { /* ignore */ }
  }

  return (
    <div
      role="status"
      className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2"
    >
      <AlertTriangle className="size-4 shrink-0" />
      <span className="flex-1">
        Tax rates are based on the {TAX_YEAR} tax year and may be outdated. Check HMRC for current rates before making financial decisions.
      </span>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded p-1 hover:bg-amber-200/50 dark:hover:bg-amber-800/50"
        aria-label="Dismiss tax year warning"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
