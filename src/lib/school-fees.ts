// ============================================================
// School Fees — Generate committed outgoings from children data
// ============================================================
// Children are lightweight reference data (name, DOB, fee config).
// This module generates CommittedOutgoing records from children,
// with correct start/end dates and inflation rates.
//
// Design principle: children[] is the source of truth for school
// fee configuration. Committed outgoings with linkedChildId are
// auto-generated and should not be manually edited.

import type { Child, CommittedOutgoing } from "@/types";
import { calculateAge } from "@/lib/projections";

/**
 * Calculate the school fee start date for a child.
 * Returns an ISO date string for September 1st of the year they turn schoolStartAge.
 */
export function calculateSchoolStartDate(child: Child): string {
  const dob = new Date(child.dateOfBirth);
  const startYear = dob.getFullYear() + child.schoolStartAge;
  return `${startYear}-09-01`;
}

/**
 * Calculate the school fee end date for a child.
 * Returns an ISO date string for July 31st of the year they turn schoolEndAge.
 */
export function calculateSchoolEndDate(child: Child): string {
  const dob = new Date(child.dateOfBirth);
  const endYear = dob.getFullYear() + child.schoolEndAge;
  return `${endYear}-07-31`;
}

/**
 * Calculate the number of school years remaining for a child.
 * Returns 0 if the child hasn't started or has finished school.
 */
export function calculateSchoolYearsRemaining(child: Child): number {
  const currentAge = calculateAge(child.dateOfBirth);
  if (currentAge < child.schoolStartAge) {
    return child.schoolEndAge - child.schoolStartAge;
  }
  if (currentAge >= child.schoolEndAge) {
    return 0;
  }
  return child.schoolEndAge - currentAge;
}

/**
 * Calculate the total projected cost of school fees for a child,
 * accounting for annual fee inflation from today until they finish school.
 */
export function calculateTotalSchoolFeeCost(child: Child): number {
  const yearsRemaining = calculateSchoolYearsRemaining(child);
  if (yearsRemaining <= 0 || child.schoolFeeAnnual <= 0) return 0;

  let total = 0;
  for (let year = 0; year < yearsRemaining; year++) {
    total += child.schoolFeeAnnual * Math.pow(1 + child.feeInflationRate, year);
  }
  return Math.round(total);
}

/**
 * Generate a CommittedOutgoing record for a child's school fees.
 * The outgoing is linked to the child via linkedChildId and includes
 * the fee inflation rate for cashflow projection.
 */
export function generateSchoolFeeOutgoing(child: Child): CommittedOutgoing {
  return {
    id: `school-fee-${child.id}`,
    category: "school_fees",
    label: `School fees (${child.name})`,
    amount: child.schoolFeeAnnual / 3, // termly = annual / 3
    frequency: "termly",
    startDate: calculateSchoolStartDate(child),
    endDate: calculateSchoolEndDate(child),
    inflationRate: child.feeInflationRate,
    linkedChildId: child.id,
  };
}

/**
 * Synchronise committed outgoings with the current children list.
 * - Removes outgoings linked to children that no longer exist
 * - Updates outgoings for children that have changed
 * - Adds outgoings for new children
 * - Preserves all non-linked (manual) outgoings
 *
 * Returns a new outgoings array — does not mutate the input.
 */
export function syncSchoolFeeOutgoings(
  children: Child[],
  existingOutgoings: CommittedOutgoing[]
): CommittedOutgoing[] {
  // Keep all manually-created outgoings (no linkedChildId)
  const manualOutgoings = existingOutgoings.filter((o) => !o.linkedChildId);

  // Generate outgoings for each child with school fees > 0
  const childOutgoings = children
    .filter((c) => c.schoolFeeAnnual > 0)
    .map(generateSchoolFeeOutgoing);

  return [...manualOutgoings, ...childOutgoings];
}
