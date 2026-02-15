"use client";

// ============================================================
// School Fee Summary — Reusable summary card for school fees
// ============================================================
// Shows key metrics: children count, current annual fees,
// total projected cost, and last child finishes year.
// Used on dashboard and cashflow pages.

import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { calculateAge } from "@/lib/projections";
import {
  calculateSchoolYearsRemaining,
  calculateTotalEducationCommitment,
  findLastSchoolFeeYear,
} from "@/lib/school-fees";
import type { Child } from "@/types";

interface SchoolFeeSummaryProps {
  childrenList: Child[];
  /** Show a link to settings for editing */
  showSettingsLink?: boolean;
  /** Compact layout for dashboard cards */
  compact?: boolean;
}

export function SchoolFeeSummary({ childrenList, showSettingsLink = true, compact = false }: SchoolFeeSummaryProps) {
  if (childrenList.length === 0) return null;

  const activeChildren = childrenList.filter((c) => c.schoolFeeAnnual > 0);
  if (activeChildren.length === 0) return null;

  const totalAnnualFees = activeChildren.reduce((sum, c) => sum + c.schoolFeeAnnual, 0);
  const totalProjectedCost = calculateTotalEducationCommitment(activeChildren);
  const lastYear = findLastSchoolFeeYear(activeChildren);
  const currentYear = new Date().getFullYear();
  const yearsUntilFree = lastYear ? lastYear - currentYear : null;

  const childrenInSchool = activeChildren.filter((c) => {
    const age = calculateAge(c.dateOfBirth);
    return age >= c.schoolStartAge && age < c.schoolEndAge;
  });

  if (compact) {
    return (
      <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-card dark:border-amber-900/30 dark:from-amber-950/20">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
                <GraduationCap className="size-4 text-amber-700 dark:text-amber-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Education
              </span>
            </div>
            {showSettingsLink && (
              <Link
                href="/settings?tab=children"
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                Edit <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
          <p className="text-2xl font-bold tracking-tight tabular-nums">
            {formatCurrencyCompact(totalProjectedCost)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            remaining commitment
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground">
            <span>{formatCurrencyCompact(totalAnnualFees)}/yr current</span>
            {yearsUntilFree !== null && yearsUntilFree > 0 && (
              <span>{yearsUntilFree}yr until free</span>
            )}
          </div>
          {/* Per-child badges */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {activeChildren.map((child) => {
              const remaining = calculateSchoolYearsRemaining(child);
              return (
                <Badge key={child.id} variant="secondary" className="text-[10px]">
                  {child.name || "Child"}: {remaining}yr
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full layout
  return (
    <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50/30 to-card dark:border-amber-900/30 dark:from-amber-950/10">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
              <GraduationCap className="size-4 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <span className="text-sm font-semibold">Education Commitment</span>
              <p className="text-xs text-muted-foreground">
                {activeChildren.length} child{activeChildren.length !== 1 ? "ren" : ""} in private education
              </p>
            </div>
          </div>
          {showSettingsLink && (
            <Link
              href="/settings?tab=children"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Edit children <ArrowRight className="size-3" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Current annual fees</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(totalAnnualFees)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total projected cost</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrencyCompact(totalProjectedCost)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">In school now</p>
            <p className="text-lg font-bold tabular-nums">
              {childrenInSchool.length} of {activeChildren.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fees end</p>
            <p className="text-lg font-bold tabular-nums">
              {lastYear ?? "N/A"}
              {yearsUntilFree !== null && yearsUntilFree > 0 && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({yearsUntilFree}yr)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Per-child status */}
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
          {activeChildren.map((child) => {
            const age = calculateAge(child.dateOfBirth);
            const remaining = calculateSchoolYearsRemaining(child);
            const inSchool = age >= child.schoolStartAge && age < child.schoolEndAge;
            return (
              <Badge
                key={child.id}
                variant={inSchool ? "default" : "secondary"}
                className="text-xs"
              >
                {child.name || "Child"}: {formatCurrencyCompact(child.schoolFeeAnnual)}/yr
                {remaining > 0 ? ` (${remaining}yr left)` : " (done)"}
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
