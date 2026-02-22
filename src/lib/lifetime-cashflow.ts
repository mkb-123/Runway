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
import { annualiseOutgoing, annualiseContribution, getDeferredBonus } from "@/types";
import { calculateTakeHomePay, calculateTakeHomePayWithStudentLoan, calculateIncomeTax } from "@/lib/tax";
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
  /** Annual pension contribution (employee + employer from employment) */
  annualPensionContribution: number;
  /** Annual discretionary pension contribution (SIPP top-ups) */
  annualDiscretionaryPension: number;
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
    const annualDeferredBonus = bonusStructure ? getDeferredBonus(bonusStructure) : 0;

    // Pension contributions: employment-based
    const annualPensionContribution = personIncome
      ? personIncome.employeePensionContribution + personIncome.employerPensionContribution
      : 0;

    // Discretionary contributions split by destination
    const personContribs = contributions.filter((c) => c.personId === person.id);
    // SIPP/additional pension contributions go to pension pot (locked until pensionAccessAge)
    const annualDiscretionaryPension = personContribs
      .filter((c) => c.target === "pension")
      .reduce((sum, c) => sum + annualiseContribution(c.amount, c.frequency), 0);
    // ISA/GIA contributions go to accessible wealth
    const annualSavingsContribution = personContribs
      .filter((c) => c.target !== "pension")
      .reduce((sum, c) => sum + annualiseContribution(c.amount, c.frequency), 0);

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
      annualDiscretionaryPension,
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

    // 3. Expenditure (baseYear = currentYear so inflation compounds from today)
    const totalExpenditure = calculateExpenditure(
      committedOutgoings,
      emergencyFund.monthlyLifestyleSpending,
      calendarYear,
      currentYear
    );

    // 4. During working years: add contributions to pots
    // FEAT-016: Pension contributions grow with salary growth rate
    for (const state of personStates) {
      const personAge = state.currentAge + yearOffset;
      if (personAge < state.person.plannedRetirementAge) {
        const salaryGrowthRate = state.personIncome?.salaryGrowthRate ?? 0;
        const growthFactor = Math.pow(1 + salaryGrowthRate, yearOffset);
        // Employment pension contributions grow with salary
        const grownPensionContrib = state.annualPensionContribution * growthFactor;
        // Discretionary SIPP and ISA/GIA contributions don't auto-grow (they're fixed amounts)
        state.pensionPot += grownPensionContrib + state.annualDiscretionaryPension;
        state.accessibleWealth += state.annualSavingsContribution;
      }
    }

    // 5. Pension + investment drawdown (to cover expenditure shortfall after employment + state pension)
    // Drawdown needs to cover the gap AFTER tax on pension income, so we iterate:
    // gross drawdown is needed to produce enough net income after pension drawdown tax.
    const incomeBeforeDrawdown = employmentIncome + statePensionIncome;
    const drawdownNeeded = Math.max(0, totalExpenditure - incomeBeforeDrawdown);

    const { pensionDrawn, investmentDrawn } = executeDrawdown(personStates, yearOffset, drawdownNeeded);

    // 5b. Apply income tax on pension drawdown (25% tax-free PCLS, 75% taxable)
    // Tax is calculated on the taxable portion added to state pension as total retirement income.
    const netPensionDrawn = calculateNetPensionDrawdown(pensionDrawn, statePensionIncome);

    // 6. Grow all pots (after draw, per BUG-003 convention)
    for (const state of personStates) {
      state.pensionPot *= 1 + growthRate;
      state.accessibleWealth *= 1 + growthRate;
    }

    // FEAT-015: Reinvest surplus income into accessible wealth
    const incomeBeforeSurplus = employmentIncome + netPensionDrawn + statePensionIncome + investmentDrawn;
    const surplus = incomeBeforeSurplus - totalExpenditure;
    if (surplus > 0) {
      // Distribute surplus proportionally across persons into accessible wealth
      const totalAccessible = personStates.reduce((s, st) => s + Math.max(0, st.accessibleWealth), 0);
      for (const state of personStates) {
        const share = totalAccessible > 0 ? state.accessibleWealth / totalAccessible : 1 / personStates.length;
        state.accessibleWealth += surplus * share;
      }
    }

    // Round components first, then derive totals from rounded values for internal consistency
    const roundedEmployment = Math.round(employmentIncome);
    const roundedPension = Math.round(netPensionDrawn);
    const roundedStatePension = Math.round(statePensionIncome);
    const roundedInvestment = Math.round(investmentDrawn);
    const roundedExpenditure = Math.round(totalExpenditure);
    const totalIncome = roundedEmployment + roundedPension + roundedStatePension + roundedInvestment;

    data.push({
      age: primaryAge,
      calendarYear,
      employmentIncome: roundedEmployment,
      pensionIncome: roundedPension,
      statePensionIncome: roundedStatePension,
      investmentIncome: roundedInvestment,
      totalIncome,
      totalExpenditure: roundedExpenditure,
      surplus: totalIncome - roundedExpenditure,
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
    const studentLoanPlan = state.person.studentLoanPlan ?? "none";
    const takeHome = studentLoanPlan !== "none"
      ? calculateTakeHomePayWithStudentLoan(grownIncome, studentLoanPlan)
      : calculateTakeHomePay(grownIncome);
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
 * Applies per-outgoing inflationRate when present (compounds from baseYear).
 */
export function calculateExpenditure(
  committedOutgoings: HouseholdData["committedOutgoings"],
  monthlyLifestyleSpending: number,
  calendarYear: number,
  baseYear?: number
): number {
  let total = 0;
  const effectiveBaseYear = baseYear ?? calendarYear;

  for (const outgoing of committedOutgoings) {
    if (!isOutgoingActiveInYear(outgoing, calendarYear)) continue;
    const baseAmount = annualiseOutgoing(outgoing.amount, outgoing.frequency);
    const inflationRate = outgoing.inflationRate ?? 0;
    const yearsElapsed = calendarYear - effectiveBaseYear;
    const inflatedAmount = inflationRate !== 0 && yearsElapsed > 0
      ? baseAmount * Math.pow(1 + inflationRate, yearsElapsed)
      : baseAmount;
    total += inflatedAmount;
  }

  // FEAT-017: Apply inflation to lifestyle spending (using general CPI-like 2% default)
  const yearsElapsed = calendarYear - effectiveBaseYear;
  const lifestyleInflationRate = 0.02; // general CPI assumption
  const inflatedLifestyle = yearsElapsed > 0
    ? monthlyLifestyleSpending * 12 * Math.pow(1 + lifestyleInflationRate, yearsElapsed)
    : monthlyLifestyleSpending * 12;
  total += inflatedLifestyle;
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

/**
 * Calculate net pension drawdown after income tax.
 * Per HMRC rules, 25% of pension drawdown is tax-free (PCLS),
 * and the remaining 75% is taxed as income. State pension is
 * also taxable income, so we calculate tax on the combined
 * taxable retirement income.
 *
 * Returns the net (after-tax) pension drawdown amount.
 */
function calculateNetPensionDrawdown(
  grossPensionDrawn: number,
  statePensionIncome: number
): number {
  if (grossPensionDrawn <= 0) return 0;

  // 25% pension commencement lump sum is tax-free
  const taxFreePortion = grossPensionDrawn * 0.25;
  const taxablePortion = grossPensionDrawn * 0.75;

  // Total taxable retirement income = state pension + taxable pension drawdown
  // No pension contribution or NI in retirement — just income tax
  const totalTaxableIncome = statePensionIncome + taxablePortion;

  // Tax on total taxable retirement income
  const taxOnTotal = calculateIncomeTax(totalTaxableIncome);
  // Tax attributable to state pension alone
  const taxOnStatePension = calculateIncomeTax(statePensionIncome);

  // Marginal tax on pension drawdown portion
  const pensionTax = taxOnTotal.tax - taxOnStatePension.tax;

  return taxFreePortion + taxablePortion - pensionTax;
}
