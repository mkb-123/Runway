// ============================================================
// Dashboard Hero Metrics — Extracted computation (REC-L)
// ============================================================
// Pure function that computes all 14 hero metric values.
// Called twice on the dashboard: once for scenario, once for base.
// Person-view aware: all metrics respect the selectedView filter (REC-C / QA-1).
//
// Also includes: next cash events (REC-E), status sentence (REC-A),
// period change attribution (REC-H).

import type { HouseholdData, NetWorthSnapshot, HeroMetricType } from "@/types";
import { annualiseOutgoing, getHouseholdGrossIncome, getPersonGrossIncome } from "@/types";
import {
  calculateRetirementCountdown,
  calculateAdjustedRequiredPot,
  calculateSWR,
  projectFinalValue,
  calculateAge,
  getMidScenarioRate,
  calculateProRataStatePension,
} from "@/lib/projections";
import { calculateCashRunway } from "@/lib/cash-flow";
import {
  calculateTotalAnnualContributions,
  calculatePersonalAnnualContributions,
  calculateHouseholdStatePension,
} from "@/lib/aggregations";
import { findLastSchoolFeeYear } from "@/lib/school-fees";
import { generateDeferredTranches } from "@/lib/deferred-bonus";
import { calculateIHT } from "@/lib/iht";
import { yearsSince } from "@/lib/iht";

// ============================================================
// Types
// ============================================================

export interface HeroMetricData {
  totalNetWorth: number;
  cashPosition: number;
  monthOnMonthChange: number;
  monthOnMonthPercent: number;
  yearOnYearChange: number;
  yearOnYearPercent: number;
  /** QA-3: false when < 2 snapshots — display "N/A" instead of "+0.0" */
  hasEnoughSnapshotsForMoM: boolean;
  /** QA-3: false when no snapshot close to 1 year ago */
  hasEnoughSnapshotsForYoY: boolean;
  retirementCountdownYears: number;
  retirementCountdownMonths: number;
  savingsRate: number;
  personalSavingsRate: number;
  fireProgress: number;
  netWorthAfterCommitments: number;
  totalAnnualCommitments: number;
  /** REC-K: years of outgoing coverage (stock / flow = time) */
  commitmentCoverageYears: number;
  projectedRetirementIncome: number;
  projectedRetirementIncomeStatePension: number;
  /** QA-6: disclose growth rate assumption used in projection */
  projectedGrowthRate: number;
  targetAnnualIncome: number;
  cashRunway: number;
  /** QA-4: false when no outgoings configured — show "No outgoings" not "∞" */
  hasOutgoings: boolean;
  schoolFeeYearsRemaining: number;
  pensionBridgeYears: number;
  perPersonRetirement: Array<{ name: string; years: number; months: number }>;
  /** REC-H: monthly contribution run-rate for period change attribution */
  monthlyContributionRate: number;
  /** Whether this data is filtered to a specific person */
  isPersonView: boolean;
  /** IHT liability (£) based on current estate value, persons, gifts, and RNRB eligibility */
  ihtLiability: number;
}

/** REC-E: Upcoming cash event */
export interface CashEvent {
  date: Date;
  label: string;
  amount: number;
  type: "inflow" | "outflow";
}

/** REC-A: Contextual status sentence */
export interface StatusSentence {
  text: string;
  color: "green" | "amber" | "red" | "neutral";
}

// ============================================================
// Main computation
// ============================================================

/**
 * Compute all hero metric values.
 * Pure function — no React hooks, no side effects.
 * All metrics respect the selectedView filter (REC-C / QA-1).
 */
export function computeHeroData(
  household: HouseholdData,
  snapshots: NetWorthSnapshot[],
  selectedView: string
): HeroMetricData {
  const isPersonView = selectedView !== "household";
  const personId = isPersonView ? selectedView : undefined;

  // --- Accounts filtering ---
  const accounts = personId
    ? household.accounts.filter((a) => a.personId === personId)
    : household.accounts;

  const totalNetWorth = accounts.reduce((sum, a) => sum + a.currentValue, 0);

  // --- Cash position ---
  const cashPosition = accounts
    .filter((a) => a.type === "cash_savings" || a.type === "cash_isa" || a.type === "premium_bonds")
    .reduce((sum, a) => sum + a.currentValue, 0);

  // --- Snapshot changes (person-filtered) ---
  const snapshotChanges = computeSnapshotChanges(snapshots, personId);

  // --- Contributions (person-filtered) ---
  const contributions = personId
    ? household.contributions.filter((c) => c.personId === personId)
    : household.contributions;
  const income = personId
    ? household.income.filter((i) => i.personId === personId)
    : household.income;

  const totalContrib = calculateTotalAnnualContributions(contributions, income);
  const personalContrib = calculatePersonalAnnualContributions(contributions, income);

  // --- Gross income (person-filtered) ---
  const grossIncome = personId
    ? getPersonGrossIncome(household.income, household.bonusStructures, personId)
    : getHouseholdGrossIncome(household.income, household.bonusStructures);

  const savingsRate = grossIncome > 0 ? (totalContrib / grossIncome) * 100 : 0;
  const personalSavingsRate = grossIncome > 0 ? (personalContrib / grossIncome) * 100 : 0;

  // --- State pension (person-filtered) ---
  const persons = personId
    ? household.persons.filter((p) => p.id === personId)
    : household.persons;
  const statePensionAnnual = personId
    ? calculateProRataStatePension(persons[0]?.niQualifyingYears ?? 0)
    : calculateHouseholdStatePension(household.persons);

  // --- Retirement countdown (person-filtered) ---
  const { retirement } = household;
  const requiredPot = calculateAdjustedRequiredPot(
    retirement.targetAnnualIncome,
    retirement.withdrawalRate,
    retirement.includeStatePension,
    statePensionAnnual
  );
  const midRate = getMidScenarioRate(retirement.scenarioRates);
  const countdown = calculateRetirementCountdown(totalNetWorth, totalContrib, requiredPot, midRate);

  // --- FIRE progress ---
  const fireProgress = requiredPot > 0 ? (totalNetWorth / requiredPot) * 100 : 0;

  // --- Committed outgoings (person-filtered) ---
  const outgoings = personId
    ? household.committedOutgoings.filter((o) => !o.personId || o.personId === personId)
    : household.committedOutgoings;
  const committedAnnual = outgoings.reduce(
    (sum, o) => sum + annualiseOutgoing(o.amount, o.frequency),
    0
  );
  const lifestyleAnnual = household.emergencyFund.monthlyLifestyleSpending * 12;
  const totalAnnualCommitments = committedAnnual + lifestyleAnnual;

  // REC-K: commitment coverage in years (stock / flow = time)
  const commitmentCoverageYears =
    totalAnnualCommitments > 0 ? totalNetWorth / totalAnnualCommitments : 999;

  // --- Projected retirement income (person-filtered) ---
  const primaryPerson = personId
    ? household.persons.find((p) => p.id === personId)
    : household.persons.find((p) => p.relationship === "self");
  const currentAge = primaryPerson ? calculateAge(primaryPerson.dateOfBirth) : 35;
  const yearsToRetirement = Math.max(
    0,
    (primaryPerson?.plannedRetirementAge ?? 60) - currentAge
  );
  const projectedPot = projectFinalValue(totalNetWorth, totalContrib, midRate, yearsToRetirement);
  const sustainableIncome = calculateSWR(projectedPot, retirement.withdrawalRate);
  const statePensionPortion = retirement.includeStatePension ? statePensionAnnual : 0;

  // --- Cash runway (person-filtered) ---
  const cashRunway = calculateCashRunway(household, personId);
  const hasOutgoings = totalAnnualCommitments > 0;

  // --- School fee countdown (household-level) ---
  const lastSchoolYear = findLastSchoolFeeYear(household.children);
  const schoolFeeYearsRemaining = lastSchoolYear
    ? Math.max(0, lastSchoolYear - new Date().getFullYear())
    : 0;

  // --- Pension bridge (person-filtered) ---
  const bridgePerson = personId
    ? household.persons.find((p) => p.id === personId)
    : household.persons.find((p) => p.relationship === "self");
  const pensionBridgeYears = bridgePerson
    ? Math.max(0, bridgePerson.pensionAccessAge - bridgePerson.plannedRetirementAge)
    : 0;

  // --- Per-person retirement (always shows all persons) ---
  const perPersonRetirement = household.persons.map((person) => {
    const age = calculateAge(person.dateOfBirth);
    const yearsLeft = Math.max(0, person.plannedRetirementAge - age);
    return {
      name: person.name,
      years: Math.floor(yearsLeft),
      months: Math.round((yearsLeft - Math.floor(yearsLeft)) * 12),
    };
  });

  // --- IHT liability (household-level, always computed against full estate) ---
  // In-estate assets: all non-pension accounts + estimated property value
  const estateAccountsValue = household.accounts
    .filter((a) => a.type !== "workplace_pension" && a.type !== "sipp")
    .reduce((s, a) => s + a.currentValue, 0);
  const estateValue = estateAccountsValue + household.iht.estimatedPropertyValue;
  const numberOfPersons = household.persons.length;
  const giftsWithin7Years = household.iht.gifts
    .filter((g) => yearsSince(g.date) < 7)
    .reduce((s, g) => s + g.amount, 0);
  const ihtResult = calculateIHT(
    estateValue,
    numberOfPersons,
    giftsWithin7Years,
    household.iht.passingToDirectDescendants
  );

  return {
    totalNetWorth,
    cashPosition,
    ...snapshotChanges,
    retirementCountdownYears: countdown.years,
    retirementCountdownMonths: countdown.months,
    savingsRate,
    personalSavingsRate,
    fireProgress,
    netWorthAfterCommitments: totalNetWorth - totalAnnualCommitments,
    totalAnnualCommitments,
    commitmentCoverageYears,
    projectedRetirementIncome: sustainableIncome + statePensionPortion,
    projectedRetirementIncomeStatePension: statePensionPortion,
    projectedGrowthRate: midRate,
    targetAnnualIncome: retirement.targetAnnualIncome,
    cashRunway,
    hasOutgoings,
    schoolFeeYearsRemaining,
    pensionBridgeYears,
    perPersonRetirement,
    monthlyContributionRate: totalContrib / 12,
    isPersonView,
    ihtLiability: ihtResult.ihtLiability,
  };
}

// ============================================================
// Snapshot change computation (extracted helper)
// ============================================================

function computeSnapshotChanges(
  snapshots: NetWorthSnapshot[],
  personId?: string
): {
  monthOnMonthChange: number;
  monthOnMonthPercent: number;
  yearOnYearChange: number;
  yearOnYearPercent: number;
  hasEnoughSnapshotsForMoM: boolean;
  hasEnoughSnapshotsForYoY: boolean;
} {
  const getValue = (snap: NetWorthSnapshot): number => {
    if (!personId) return snap.totalNetWorth;
    return snap.byPerson?.find((p) => p.personId === personId)?.value ?? 0;
  };

  const hasEnoughForMoM = snapshots.length >= 2;
  const latest = snapshots[snapshots.length - 1];
  const previous = hasEnoughForMoM ? snapshots[snapshots.length - 2] : null;

  const latestVal = latest ? getValue(latest) : 0;
  const prevVal = previous ? getValue(previous) : 0;
  const moMChange = hasEnoughForMoM ? latestVal - prevVal : 0;
  const moMPercent = hasEnoughForMoM && prevVal > 0 ? moMChange / prevVal : 0;

  // YoY — find snapshot closest to one year ago
  const latestDate = new Date(latest?.date ?? new Date());
  const oneYearAgo = new Date(latestDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const yearAgoSnapshot = snapshots.reduce<NetWorthSnapshot | null>((closest, snap) => {
    const snapDate = new Date(snap.date);
    if (!closest) return snap;
    return Math.abs(snapDate.getTime() - oneYearAgo.getTime()) <
      Math.abs(new Date(closest.date).getTime() - oneYearAgo.getTime())
      ? snap
      : closest;
  }, null);

  // Require the "year ago" snapshot to be within 3 months of a year ago
  const hasEnoughForYoY =
    !!yearAgoSnapshot &&
    !!latest &&
    Math.abs(new Date(yearAgoSnapshot.date).getTime() - oneYearAgo.getTime()) <
      90 * 24 * 60 * 60 * 1000;

  const yearAgoVal = yearAgoSnapshot ? getValue(yearAgoSnapshot) : 0;
  const yoYChange = hasEnoughForYoY && latest ? latestVal - yearAgoVal : 0;
  const yoYPercent = hasEnoughForYoY && yearAgoVal > 0 ? yoYChange / yearAgoVal : 0;

  return {
    monthOnMonthChange: moMChange,
    monthOnMonthPercent: moMPercent,
    yearOnYearChange: yoYChange,
    yearOnYearPercent: yoYPercent,
    hasEnoughSnapshotsForMoM: hasEnoughForMoM,
    hasEnoughSnapshotsForYoY: hasEnoughForYoY,
  };
}

// ============================================================
// Next Cash Events (REC-E)
// ============================================================

/**
 * Generate the next upcoming cash events (inflows and outflows).
 * Scans bonus payment dates, deferred vesting dates, and
 * large committed outgoings with known dates.
 */
export function getNextCashEvents(
  household: HouseholdData,
  maxEvents = 5
): CashEvent[] {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setMonth(horizon.getMonth() + 6);
  const events: CashEvent[] = [];

  // 1. Cash bonus payment dates
  for (const bonus of household.bonusStructures) {
    if (bonus.cashBonusAnnual <= 0) continue;
    const person = household.persons.find((p) => p.id === bonus.personId);
    const paymentMonth = bonus.bonusPaymentMonth ?? 2;
    const year = now.getMonth() <= paymentMonth ? now.getFullYear() : now.getFullYear() + 1;
    const bonusDate = new Date(year, paymentMonth, 15);
    if (bonusDate > now && bonusDate <= horizon) {
      events.push({
        date: bonusDate,
        label: `${person?.name ?? "Bonus"} cash bonus`,
        amount: bonus.cashBonusAnnual,
        type: "inflow",
      });
    }
  }

  // 2. Deferred vesting dates
  for (const bonus of household.bonusStructures) {
    const tranches = generateDeferredTranches(bonus);
    const person = household.persons.find((p) => p.id === bonus.personId);
    for (const tranche of tranches) {
      const vestDate = new Date(tranche.vestingDate);
      if (vestDate > now && vestDate <= horizon) {
        events.push({
          date: vestDate,
          label: `${person?.name ?? "Deferred"} tranche vests`,
          amount: tranche.amount,
          type: "inflow",
        });
      }
    }
  }

  // 3. Large committed outgoings with known schedules
  for (const outgoing of household.committedOutgoings) {
    if (outgoing.frequency === "monthly") continue;
    const annual = annualiseOutgoing(outgoing.amount, outgoing.frequency);
    if (annual < 1000) continue;

    if (outgoing.frequency === "termly") {
      const termMonths = [0, 3, 8]; // Jan, Apr, Sep
      for (const month of termMonths) {
        const year = now.getMonth() <= month ? now.getFullYear() : now.getFullYear() + 1;
        const termDate = new Date(year, month, 1);
        if (termDate > now && termDate <= horizon) {
          events.push({
            date: termDate,
            label: outgoing.label || outgoing.category,
            amount: -outgoing.amount,
            type: "outflow",
          });
        }
      }
    } else if (outgoing.frequency === "annually" && outgoing.startDate) {
      const startDate = new Date(outgoing.startDate);
      const nextDate = new Date(now.getFullYear(), startDate.getMonth(), startDate.getDate());
      if (nextDate <= now) nextDate.setFullYear(nextDate.getFullYear() + 1);
      if (nextDate <= horizon) {
        events.push({
          date: nextDate,
          label: outgoing.label || outgoing.category,
          amount: -outgoing.amount,
          type: "outflow",
        });
      }
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events.slice(0, maxEvents);
}

// ============================================================
// Status Sentence (REC-A)
// ============================================================

/**
 * Generate a contextual status sentence for the hero card.
 * Life-stage aware: pre-retirees see retirement readiness,
 * school-fee households see cash coverage, others see growth.
 */
export function getStatusSentence(
  heroData: HeroMetricData,
  household: HouseholdData
): StatusSentence {
  const primaryPerson = household.persons.find((p) => p.relationship === "self");
  const currentAge = primaryPerson ? calculateAge(primaryPerson.dateOfBirth) : 35;
  const yearsToRetirement = primaryPerson
    ? Math.max(0, primaryPerson.plannedRetirementAge - currentAge)
    : 25;

  // Pre-retiree (within 10 years): retirement income vs target
  if (yearsToRetirement <= 10 && household.retirement.targetAnnualIncome > 0) {
    const projected = heroData.projectedRetirementIncome;
    const target = heroData.targetAnnualIncome;
    if (projected >= target) {
      return {
        text: `Projected retirement income £${Math.round(projected / 1000)}k/yr vs £${Math.round(target / 1000)}k target — on track`,
        color: "green",
      };
    }
    const shortfallPct = Math.round(((target - projected) / target) * 100);
    return {
      text: `Projected retirement income £${Math.round(projected / 1000)}k/yr — ${shortfallPct}% below £${Math.round(target / 1000)}k target`,
      color: shortfallPct > 25 ? "red" : "amber",
    };
  }

  // School fee households with constrained cash
  if (household.children.some((c) => c.schoolFeeAnnual > 0) && heroData.hasOutgoings) {
    const months = heroData.cashRunway;
    if (months >= 18) {
      return {
        text: `Cash covers ${Math.round(months)} months of committed outgoings`,
        color: "green",
      };
    }
    if (months >= 6) {
      return {
        text: `Cash covers ${months.toFixed(0)} months of outgoings — monitor closely`,
        color: "amber",
      };
    }
    return {
      text: `Cash covers only ${months.toFixed(1)} months of outgoings`,
      color: "red",
    };
  }

  // FIRE progress
  if (heroData.fireProgress >= 100) {
    return { text: "FIRE target reached — financially independent", color: "green" };
  }
  if (heroData.fireProgress >= 50) {
    return {
      text: `${heroData.fireProgress.toFixed(0)}% to financial independence target`,
      color: "green",
    };
  }
  if (heroData.fireProgress >= 25) {
    return {
      text: `${heroData.fireProgress.toFixed(0)}% to FIRE target — building momentum`,
      color: "neutral",
    };
  }

  // Net worth trend
  if (heroData.hasEnoughSnapshotsForMoM && heroData.monthOnMonthChange !== 0) {
    const direction = heroData.monthOnMonthChange > 0 ? "up" : "down";
    const absK = Math.abs(Math.round(heroData.monthOnMonthChange / 1000));
    return {
      text: `Net worth ${direction} £${absK}k this month`,
      color: heroData.monthOnMonthChange > 0 ? "green" : "amber",
    };
  }

  // Savings rate fallback — better than a generic message
  if (heroData.savingsRate > 0) {
    const rate = heroData.savingsRate;
    const rateText = `Saving ${rate.toFixed(0)}% of income`;
    if (rate >= 20) return { text: `${rateText} — strong savings discipline`, color: "green" };
    if (rate >= 10) return { text: `${rateText} — consider increasing contributions`, color: "neutral" };
    return { text: `${rateText} — building towards financial security`, color: "neutral" };
  }

  return { text: "Your financial overview at a glance", color: "neutral" };
}

// ============================================================
// Life-stage detection for conditional FIRE bar (REC-B)
// ============================================================

export type LifeStage = "accumulator" | "school_fees" | "pre_retirement";

/**
 * Detect the household's primary life stage for conditional
 * display of the sub-hero strip (REC-B).
 */
export function detectLifeStage(household: HouseholdData): LifeStage {
  const primary = household.persons.find((p) => p.relationship === "self");
  if (primary) {
    const age = calculateAge(primary.dateOfBirth);
    const yearsToRetirement = primary.plannedRetirementAge - age;
    if (yearsToRetirement <= 10) return "pre_retirement";
  }
  if (household.children.some((c) => c.schoolFeeAnnual > 0)) {
    return "school_fees";
  }
  return "accumulator";
}

// ============================================================
// Recommendation urgency (REC-F)
// ============================================================

export type RecommendationUrgency = "act_now" | "act_this_month" | "standing";

/**
 * Assign urgency tier to a recommendation based on time-sensitivity.
 * ISA deadline, tax year end, and bonus-related items get higher urgency.
 */
export function getRecommendationUrgency(
  recId: string
): RecommendationUrgency {
  const now = new Date();
  const currentMonth = now.getMonth();
  const isQ1 = currentMonth >= 0 && currentMonth <= 2; // Jan–Mar
  const isQ4orQ1 = currentMonth >= 9 || currentMonth <= 2; // Oct–Mar

  // ISA-related recommendations are urgent near tax year end (Jan-Mar)
  if (recId.startsWith("isa-") || recId.startsWith("bed-isa")) {
    return isQ1 ? "act_now" : isQ4orQ1 ? "act_this_month" : "standing";
  }

  // CGT allowance is also tax-year bound
  if (recId.startsWith("cgt-") || recId.includes("cgt")) {
    return isQ1 ? "act_now" : "standing";
  }

  // Salary sacrifice / pension taper recommendations — act sooner
  if (recId.startsWith("salary-sacrifice") || recId.startsWith("pension-headroom")) {
    return "act_this_month";
  }

  // Emergency fund / retirement behind — standing but important
  return "standing";
}

// ============================================================
// Metric Resolution (extracted from page.tsx)
// ============================================================

/** Icon key — maps to lucide-react imports in the consuming component */
export type MetricIconKey =
  | "banknote"
  | "clock"
  | "trending-up"
  | "bar-chart"
  | "piggy-bank"
  | "target"
  | "shield"
  | "sunrise"
  | "graduation-cap";

/** Resolved metric data — pure values, no React dependencies */
export interface ResolvedMetricData {
  label: string;
  value: string;
  rawValue: number;
  format: (n: number) => string;
  subtext?: string;
  color: string;
  trend?: "up" | "down";
  iconKey: MetricIconKey;
}

/**
 * Resolve a hero metric type to its display values.
 * Pure function — no React dependencies (icon is a key, not a component).
 */
export function resolveMetricData(
  type: HeroMetricType,
  data: HeroMetricData
): ResolvedMetricData {
  switch (type) {
    case "cash_position":
      return {
        label: "Cash Position",
        value: formatCompact(data.cashPosition),
        rawValue: data.cashPosition,
        format: formatCompact,
        color: "",
        iconKey: "banknote",
      };
    case "retirement_countdown": {
      const y = data.retirementCountdownYears;
      const m = data.retirementCountdownMonths;
      const onTrack = y === 0 && m === 0;
      return {
        label: "Retirement",
        value: onTrack ? "On track" : `${y}y ${m}m`,
        rawValue: y * 12 + m,
        format: (n: number) => {
          if (n === 0) return "On track";
          return `${Math.floor(n / 12)}y ${n % 12}m`;
        },
        subtext: onTrack ? "Target pot reached" : "to target",
        color: onTrack ? "text-emerald-600 dark:text-emerald-400" : "",
        iconKey: "clock",
      };
    }
    case "period_change": {
      if (!data.hasEnoughSnapshotsForMoM) {
        return {
          label: "Period Change",
          value: "N/A",
          rawValue: 0,
          format: () => "N/A",
          subtext: "Needs 2+ months of history",
          color: "text-muted-foreground",
          iconKey: "trending-up",
        };
      }
      const v = data.monthOnMonthChange;
      const color =
        v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-600 dark:text-red-400" : "";
      const contribNote =
        data.monthlyContributionRate > 0
          ? ` (incl. ~${formatCompact(data.monthlyContributionRate)}/mo contributions)`
          : "";
      return {
        label: "Period Change",
        value: `${v >= 0 ? "+" : ""}${formatCompact(v)}`,
        rawValue: v,
        format: (n: number) => `${n >= 0 ? "+" : ""}${formatCompact(n)}`,
        subtext: `${v >= 0 ? "+" : ""}${formatPct(data.monthOnMonthPercent)} MoM${contribNote}`,
        color,
        trend: v > 0 ? "up" : v < 0 ? "down" : undefined,
        iconKey: "trending-up",
      };
    }
    case "year_on_year_change": {
      if (!data.hasEnoughSnapshotsForYoY) {
        return {
          label: "Year-on-Year",
          value: "N/A",
          rawValue: 0,
          format: () => "N/A",
          subtext: "Needs ~12 months of history",
          color: "text-muted-foreground",
          iconKey: "bar-chart",
        };
      }
      const v = data.yearOnYearChange;
      const color =
        v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-600 dark:text-red-400" : "";
      return {
        label: "Year-on-Year",
        value: `${v >= 0 ? "+" : ""}${formatCompact(v)}`,
        rawValue: v,
        format: (n: number) => `${n >= 0 ? "+" : ""}${formatCompact(n)}`,
        subtext: `${v >= 0 ? "+" : ""}${formatPct(data.yearOnYearPercent)} YoY`,
        color,
        trend: v > 0 ? "up" : v < 0 ? "down" : undefined,
        iconKey: "bar-chart",
      };
    }
    case "savings_rate":
      return {
        label: data.isPersonView ? "Savings Rate (Personal)" : "Savings Rate",
        value: `${data.savingsRate.toFixed(1)}%`,
        rawValue: data.savingsRate,
        format: (n: number) => `${n.toFixed(1)}%`,
        subtext: `${data.personalSavingsRate.toFixed(1)}% personal`,
        color:
          data.savingsRate >= 20
            ? "text-emerald-600 dark:text-emerald-400"
            : data.savingsRate < 10
              ? "text-amber-600 dark:text-amber-400"
              : "",
        iconKey: "piggy-bank",
      };
    case "fire_progress":
      return {
        label: "FIRE Progress",
        value: `${data.fireProgress.toFixed(1)}%`,
        rawValue: data.fireProgress,
        format: (n: number) => `${n.toFixed(1)}%`,
        subtext: "of target pot",
        color:
          data.fireProgress >= 100
            ? "text-emerald-600 dark:text-emerald-400"
            : data.fireProgress < 25
              ? "text-amber-600 dark:text-amber-400"
              : "",
        iconKey: "target",
      };
    case "net_worth_after_commitments":
      return {
        label: "Commitments Covered",
        value:
          data.commitmentCoverageYears >= 999
            ? "N/A"
            : `${data.commitmentCoverageYears.toFixed(1)}yr`,
        rawValue: data.commitmentCoverageYears,
        format: (n: number) => (n >= 999 ? "N/A" : `${n.toFixed(1)}yr`),
        subtext:
          data.totalAnnualCommitments > 0
            ? `yrs net worth covers ${formatCompact(data.totalAnnualCommitments)}/yr outgoings`
            : "No committed outgoings",
        color:
          data.commitmentCoverageYears >= 15
            ? "text-emerald-600 dark:text-emerald-400"
            : data.commitmentCoverageYears < 5
              ? "text-amber-600 dark:text-amber-400"
              : "",
        iconKey: "shield",
      };
    case "projected_retirement_income": {
      const target = data.targetAnnualIncome;
      const projected = data.projectedRetirementIncome;
      const incomeColor =
        target > 0 && projected >= target
          ? "text-emerald-600 dark:text-emerald-400"
          : target > 0 && projected < target * 0.5
            ? "text-red-600 dark:text-red-400"
            : target > 0 && projected < target * 0.75
              ? "text-amber-600 dark:text-amber-400"
              : "";
      const growthPct = (data.projectedGrowthRate * 100).toFixed(0);
      const statePensionNote =
        data.projectedRetirementIncomeStatePension > 0
          ? `incl. ${formatCompact(data.projectedRetirementIncomeStatePension)} state pension`
          : `at ${growthPct}% growth`;
      return {
        label: "Retirement Income",
        value: `${formatCompact(projected)}/yr`,
        rawValue: projected,
        format: (n: number) => `${formatCompact(n)}/yr`,
        subtext: statePensionNote,
        color: incomeColor,
        iconKey: "sunrise",
      };
    }
    case "cash_runway": {
      const months = data.cashRunway;
      if (!data.hasOutgoings) {
        return {
          label: "Cash Cushion",
          value: "N/A",
          rawValue: 0,
          format: () => "N/A",
          subtext: "No outgoings configured",
          color: "text-muted-foreground",
          iconKey: "shield",
        };
      }
      const color =
        months < 3
          ? "text-red-600 dark:text-red-400"
          : months < 6
            ? "text-amber-600 dark:text-amber-400"
            : "text-emerald-600 dark:text-emerald-400";
      return {
        label: "Cash Cushion",
        value: `${months.toFixed(1)}mo`,
        rawValue: months,
        format: (n: number) => `${n.toFixed(1)}mo`,
        subtext: "months of outgoings if income stopped",
        color,
        iconKey: "shield",
      };
    }
    case "school_fee_countdown": {
      const yrs = data.schoolFeeYearsRemaining;
      return {
        label: "School Fees End",
        value: yrs <= 0 ? "Done" : `${yrs}yr`,
        rawValue: yrs,
        format: (n: number) => (n <= 0 ? "Done" : `${n}yr`),
        subtext: yrs <= 0 ? "No children in school" : "until last child finishes",
        color: yrs <= 0 ? "text-emerald-600 dark:text-emerald-400" : "",
        iconKey: "graduation-cap",
      };
    }
    case "pension_bridge_gap": {
      const yrs = data.pensionBridgeYears;
      return {
        label: "Pension Bridge",
        value: yrs <= 0 ? "None" : `${yrs}yr`,
        rawValue: yrs,
        format: (n: number) => (n <= 0 ? "None" : `${n}yr`),
        subtext: yrs <= 0 ? "Pension accessible at retirement" : "gap before pension access",
        color:
          yrs > 5
            ? "text-amber-600 dark:text-amber-400"
            : yrs > 0
              ? ""
              : "text-emerald-600 dark:text-emerald-400",
        iconKey: "clock",
      };
    }
    case "per_person_retirement": {
      const parts = data.perPersonRetirement;
      if (parts.length === 0) {
        return {
          label: "Retirement",
          value: "N/A",
          rawValue: 0,
          format: () => "N/A",
          color: "",
          iconKey: "clock",
        };
      }
      const primary = parts[0];
      const subtextParts =
        parts.length > 2
          ? parts
              .slice(0, 2)
              .map((p) => `${p.name}: ${p.years}y ${p.months}m`)
              .join(" · ") + ` +${parts.length - 2} more`
          : parts.map((p) => `${p.name}: ${p.years}y ${p.months}m`).join(" · ");
      return {
        label: "Retirement",
        value: `${primary.years}y ${primary.months}m`,
        rawValue: primary.years * 12 + primary.months,
        format: (n: number) => `${Math.floor(n / 12)}y ${n % 12}m`,
        subtext: subtextParts,
        color: "",
        iconKey: "clock",
      };
    }
    case "iht_liability": {
      const liability = data.ihtLiability;
      return {
        label: "IHT Liability",
        value: liability <= 0 ? "£0" : formatCompact(liability),
        rawValue: liability,
        format: (n: number) => (n <= 0 ? "£0" : formatCompact(n)),
        subtext: liability <= 0 ? "Below IHT threshold" : "estimated on current estate",
        color:
          liability > 500_000
            ? "text-red-600 dark:text-red-400"
            : liability > 100_000
              ? "text-amber-600 dark:text-amber-400"
              : liability <= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "",
        iconKey: "shield",
      };
    }
    default:
      return {
        label: "Retirement Income",
        value: `${formatCompact(data.projectedRetirementIncome)}/yr`,
        rawValue: data.projectedRetirementIncome,
        format: (n: number) => `${formatCompact(n)}/yr`,
        color: "",
        iconKey: "sunrise",
      };
  }
}

// Internal format helpers (avoid importing from format.ts to keep dependency tight)
function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `£${(n / 1_000).toFixed(1)}k`;
  return `£${n.toFixed(0)}`;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
