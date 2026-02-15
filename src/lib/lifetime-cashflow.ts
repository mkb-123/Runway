// ============================================================
// Lifetime Cash Flow — Year-by-year household cash flow projection
// ============================================================
// Generates a full lifetime projection from the primary person's
// current age to a configurable end age (default 95), showing:
//   - Employment income (net, per person, until planned retirement)
//   - Pension drawdown (from pension access age)
//   - State pension (from state retirement age)
//   - Savings/investment drawdown (to bridge remaining gaps)
//   - Expenditure (committed outgoings with date bounds + lifestyle)
//
// All figures are in real terms (today's money) unless inflation
// adjustment is explicitly requested.

import type { HouseholdData, Person, PersonIncome } from "@/types";
import { annualiseOutgoing, annualiseContribution } from "@/types";
import { calculateTakeHomePay } from "@/lib/tax";
import { calculateProRataStatePension, calculateAge } from "@/lib/projections";

// --- Types ---

export interface LifetimeCashFlowYear {
  /** Primary person's age for this year */
  age: number;
  /** Calendar year */
  calendarYear: number;
  /** Net employment income (salary + bonus, after tax/NI) */
  employmentIncome: number;
  /** DC pension drawdown amount */
  pensionIncome: number;
  /** State pension income */
  statePensionIncome: number;
  /** ISA/GIA/cash drawdown */
  investmentIncome: number;
  /** Sum of all income sources */
  totalIncome: number;
  /** Committed outgoings + lifestyle spending */
  totalExpenditure: number;
  /** totalIncome - totalExpenditure (positive = surplus, negative = shortfall) */
  surplus: number;
}

export interface LifetimeCashFlowResult {
  data: LifetimeCashFlowYear[];
  /** Key events for reference line annotations */
  events: LifetimeCashFlowEvent[];
  /** Primary person used for age axis */
  primaryPersonName: string;
}

export interface LifetimeCashFlowEvent {
  age: number;
  label: string;
}

interface PersonState {
  person: Person;
  personIncome: PersonIncome | undefined;
  currentAge: number;
  pensionPot: number;
  accessibleWealth: number;
  annualCashBonus: number;
  /** Annual deferred bonus (in steady state, this vests each year) */
  annualDeferredBonus: number;
  statePensionAnnual: number;
  /** Annual pension contribution (employee + employer) */
  annualPensionContribution: number;
  /** Annual ISA/GIA contribution */
  annualSavingsContribution: number;
}

// --- Main function ---

/**
 * Generate a lifetime cash flow projection for the household.
 *
 * @param household - Full household data
 * @param growthRate - Annual investment growth rate (decimal, e.g. 0.05)
 * @param endAge - Age to project to (default 95)
 */
export function generateLifetimeCashFlow(
  household: HouseholdData,
  growthRate: number,
  endAge: number = 95
): LifetimeCashFlowResult {
  const { persons, income, accounts, committedOutgoings, emergencyFund, bonusStructures, contributions } = household;

  if (persons.length === 0) {
    return { data: [], events: [], primaryPersonName: "" };
  }

  // Primary person = "self", or first person
  const primaryPerson = persons.find((p) => p.relationship === "self") ?? persons[0];
  const primaryCurrentAge = calculateAge(primaryPerson.dateOfBirth);

  // Build per-person mutable state
  const personStates: PersonState[] = persons.map((person) => {
    const personIncome = income.find((i) => i.personId === person.id);

    const pensionPot = accounts
      .filter((a) => a.personId === person.id && (a.type === "workplace_pension" || a.type === "sipp"))
      .reduce((sum, a) => sum + a.currentValue, 0);

    const accessibleWealth = accounts
      .filter((a) => a.personId === person.id && a.type !== "workplace_pension" && a.type !== "sipp")
      .reduce((sum, a) => sum + a.currentValue, 0);

    const bonusStructure = bonusStructures.find((b) => b.personId === person.id);
    const annualCashBonus = bonusStructure?.cashBonusAnnual ?? 0;
    const annualDeferredBonus = bonusStructure?.deferredBonusAnnual ?? 0;

    // Pension contributions: employment-based
    const annualPensionContribution = personIncome
      ? personIncome.employeePensionContribution + personIncome.employerPensionContribution
      : 0;

    // Discretionary contributions to ISA/GIA
    const personContribs = contributions.filter((c) => c.personId === person.id);
    const annualSavingsContribution = personContribs.reduce(
      (sum, c) => sum + annualiseContribution(c.amount, c.frequency),
      0
    );

    return {
      person,
      personIncome,
      currentAge: calculateAge(person.dateOfBirth),
      pensionPot,
      accessibleWealth,
      annualCashBonus,
      annualDeferredBonus,
      statePensionAnnual: calculateProRataStatePension(person.niQualifyingYears),
      annualPensionContribution,
      annualSavingsContribution,
    };
  });

  // Build events list for reference lines
  const events: LifetimeCashFlowEvent[] = [];
  for (const state of personStates) {
    const ageDiff = state.currentAge - primaryCurrentAge;
    const retirementAgePrimary = state.person.plannedRetirementAge - ageDiff;
    const pensionAccessAgePrimary = state.person.pensionAccessAge - ageDiff;
    const stateRetAgePrimary = state.person.stateRetirementAge - ageDiff;

    if (retirementAgePrimary >= primaryCurrentAge && retirementAgePrimary <= endAge) {
      events.push({ age: retirementAgePrimary, label: `${state.person.name} retires` });
    }
    if (pensionAccessAgePrimary >= primaryCurrentAge && pensionAccessAgePrimary <= endAge) {
      events.push({ age: pensionAccessAgePrimary, label: `${state.person.name} pension access` });
    }
    if (stateRetAgePrimary >= primaryCurrentAge && stateRetAgePrimary <= endAge) {
      events.push({ age: stateRetAgePrimary, label: `${state.person.name} state pension` });
    }
  }

  // Add committed outgoing end events
  const currentYear = new Date().getFullYear();
  for (const outgoing of committedOutgoings) {
    if (outgoing.endDate) {
      const endYear = new Date(outgoing.endDate).getFullYear();
      const agePrimary = primaryCurrentAge + (endYear - currentYear);
      if (agePrimary >= primaryCurrentAge && agePrimary <= endAge) {
        events.push({ age: agePrimary, label: `${outgoing.label || outgoing.category} ends` });
      }
    }
  }

  // Deduplicate events by age (keep all labels but avoid same-age duplicates)
  const uniqueEvents = events.filter(
    (event, idx, arr) => arr.findIndex((e) => e.age === event.age && e.label === event.label) === idx
  );

  // --- Year-by-year simulation ---
  const data: LifetimeCashFlowYear[] = [];

  for (let yearOffset = 0; yearOffset <= endAge - primaryCurrentAge; yearOffset++) {
    const primaryAge = primaryCurrentAge + yearOffset;
    const calendarYear = currentYear + yearOffset;

    // 1. Employment income
    const employmentIncome = calculateEmploymentIncome(personStates, yearOffset);

    // 2. State pension
    const statePensionIncome = calculateStatePensionIncome(personStates, yearOffset);

    // 3. Expenditure
    const totalExpenditure = calculateExpenditure(
      committedOutgoings,
      emergencyFund.monthlyLifestyleSpending,
      calendarYear
    );

    // 4. During working years: add contributions to pots
    for (const state of personStates) {
      const personAge = state.currentAge + yearOffset;
      if (personAge < state.person.plannedRetirementAge) {
        state.pensionPot += state.annualPensionContribution;
        state.accessibleWealth += state.annualSavingsContribution;
      }
    }

    // 5. Pension + investment drawdown (to cover expenditure shortfall after employment + state pension)
    const incomeBeforeDrawdown = employmentIncome + statePensionIncome;
    const drawdownNeeded = Math.max(0, totalExpenditure - incomeBeforeDrawdown);

    const { pensionDrawn, investmentDrawn } = executeDrawdown(personStates, yearOffset, drawdownNeeded);

    // 6. Grow all pots (after draw, per BUG-003 convention)
    for (const state of personStates) {
      state.pensionPot *= 1 + growthRate;
      state.accessibleWealth *= 1 + growthRate;
    }

    const totalIncome = employmentIncome + pensionDrawn + statePensionIncome + investmentDrawn;

    data.push({
      age: primaryAge,
      calendarYear,
      employmentIncome: Math.round(employmentIncome),
      pensionIncome: Math.round(pensionDrawn),
      statePensionIncome: Math.round(statePensionIncome),
      investmentIncome: Math.round(investmentDrawn),
      totalIncome: Math.round(totalIncome),
      totalExpenditure: Math.round(totalExpenditure),
      surplus: Math.round(totalIncome - totalExpenditure),
    });
  }

  return { data, events: uniqueEvents, primaryPersonName: primaryPerson.name };
}

// --- Helper functions ---

/**
 * Calculate net employment income for a given year offset.
 * Includes salary (after tax/NI/pension deductions) and bonus.
 */
function calculateEmploymentIncome(personStates: PersonState[], yearOffset: number): number {
  let total = 0;
  for (const state of personStates) {
    const personAge = state.currentAge + yearOffset;
    if (personAge >= state.person.plannedRetirementAge || !state.personIncome) continue;

    const salaryGrowthRate = state.personIncome.salaryGrowthRate ?? 0;
    const grownSalary = state.personIncome.grossSalary * Math.pow(1 + salaryGrowthRate, yearOffset);

    // Compute total bonus income (cash + deferred vesting) and include in gross
    // so that tax is calculated on the full income, not just salary
    const bonusGrowthRate = state.personIncome.bonusGrowthRate ?? 0;
    const grownCashBonus = state.annualCashBonus > 0
      ? state.annualCashBonus * Math.pow(1 + bonusGrowthRate, yearOffset)
      : 0;
    const grownDeferredBonus = state.annualDeferredBonus > 0
      ? state.annualDeferredBonus * Math.pow(1 + bonusGrowthRate, yearOffset)
      : 0;
    const totalGrossIncome = grownSalary + grownCashBonus + grownDeferredBonus;

    // Tax is calculated on the full gross (salary + bonus), preserving pension method
    const grownIncome: PersonIncome = { ...state.personIncome, grossSalary: totalGrossIncome };
    const takeHome = calculateTakeHomePay(grownIncome);
    total += takeHome.takeHome;
  }
  return total;
}

/**
 * Calculate state pension income for a given year offset.
 */
function calculateStatePensionIncome(personStates: PersonState[], yearOffset: number): number {
  let total = 0;
  for (const state of personStates) {
    const personAge = state.currentAge + yearOffset;
    if (personAge >= state.person.stateRetirementAge) {
      total += state.statePensionAnnual;
    }
  }
  return total;
}

/**
 * Calculate total annual expenditure for a calendar year.
 * Respects start/end dates on committed outgoings.
 */
export function calculateExpenditure(
  committedOutgoings: HouseholdData["committedOutgoings"],
  monthlyLifestyleSpending: number,
  calendarYear: number
): number {
  let total = 0;

  for (const outgoing of committedOutgoings) {
    if (!isOutgoingActiveInYear(outgoing, calendarYear)) continue;
    total += annualiseOutgoing(outgoing.amount, outgoing.frequency);
  }

  total += monthlyLifestyleSpending * 12;
  return total;
}

/**
 * Check if a committed outgoing is active in a given calendar year.
 */
function isOutgoingActiveInYear(
  outgoing: HouseholdData["committedOutgoings"][number],
  calendarYear: number
): boolean {
  if (outgoing.startDate) {
    const startYear = new Date(outgoing.startDate).getFullYear();
    if (calendarYear < startYear) return false;
  }
  if (outgoing.endDate) {
    const endYear = new Date(outgoing.endDate).getFullYear();
    if (calendarYear > endYear) return false;
  }
  return true;
}

/**
 * Execute drawdown from pension pots and accessible wealth.
 * Draws from pensions first (once accessible), then from ISA/GIA.
 * Uses proportional drawdown across persons (per BUG-005 convention).
 */
function executeDrawdown(
  personStates: PersonState[],
  yearOffset: number,
  needed: number
): { pensionDrawn: number; investmentDrawn: number } {
  if (needed <= 0) return { pensionDrawn: 0, investmentDrawn: 0 };

  // Pension drawdown (proportional)
  const availablePension = personStates
    .filter((s) => s.currentAge + yearOffset >= s.person.pensionAccessAge && s.pensionPot > 0)
    .map((s) => ({ state: s, available: s.pensionPot }));

  const totalPensionAvailable = availablePension.reduce((sum, x) => sum + x.available, 0);
  let pensionDrawn = 0;

  if (totalPensionAvailable > 0) {
    for (const { state } of availablePension) {
      const share = (state.pensionPot / totalPensionAvailable) * needed;
      const draw = Math.min(share, state.pensionPot);
      state.pensionPot -= draw;
      pensionDrawn += draw;
    }
  }

  // Investment drawdown (ISA/GIA/cash — proportional)
  const remainingNeed = Math.max(0, needed - pensionDrawn);
  let investmentDrawn = 0;

  if (remainingNeed > 0) {
    const availableInvestment = personStates
      .filter((s) => s.accessibleWealth > 0)
      .map((s) => ({ state: s, available: s.accessibleWealth }));

    const totalInvestmentAvailable = availableInvestment.reduce((sum, x) => sum + x.available, 0);

    if (totalInvestmentAvailable > 0) {
      for (const { state } of availableInvestment) {
        const share = (state.accessibleWealth / totalInvestmentAvailable) * remainingNeed;
        const draw = Math.min(share, state.accessibleWealth);
        state.accessibleWealth -= draw;
        investmentDrawn += draw;
      }
    }
  }

  return { pensionDrawn, investmentDrawn };
}
