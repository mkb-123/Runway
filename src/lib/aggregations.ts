// ============================================================
// Aggregation Functions - Shared net worth aggregation logic
// ============================================================
// Single source of truth for net worth aggregation.
// Used by both DataContext and useScenarioData.

import { roundPence } from "@/lib/format";
import { calculateProRataStatePension } from "@/lib/projections";
import type { HouseholdData, TaxWrapper, AccountType, Contribution, PersonIncome, Person } from "@/types";
import { getAccountTaxWrapper, annualiseContribution, getTotalPropertyEquity, getPropertyEquity } from "@/types";

/** Total net worth across all accounts + property equity */
export function getTotalNetWorth(household: HouseholdData): number {
  const accountsValue = household.accounts.reduce((sum, acc) => sum + acc.currentValue, 0);
  const propertyEquity = getTotalPropertyEquity(household.properties);
  return roundPence(accountsValue + propertyEquity);
}

/** Net worth from financial accounts only (excludes property) */
export function getInvestableNetWorth(household: HouseholdData): number {
  return roundPence(
    household.accounts.reduce((sum, acc) => sum + acc.currentValue, 0)
  );
}

/** Net worth broken down by person (includes property equity for owners) */
export function getNetWorthByPerson(
  household: HouseholdData
): { personId: string; name: string; value: number }[] {
  return household.persons.map((person) => {
    const accountValue = household.accounts
      .filter((a) => a.personId === person.id)
      .reduce((sum, acc) => sum + acc.currentValue, 0);
    // Property equity split equally among owners
    const propertyValue = household.properties
      .filter((p) => p.ownerPersonIds.includes(person.id))
      .reduce((sum, p) => {
        const ownerCount = Math.max(1, p.ownerPersonIds.length);
        return sum + getPropertyEquity(p) / ownerCount;
      }, 0);
    return {
      personId: person.id,
      name: person.name,
      value: roundPence(accountValue + propertyValue),
    };
  });
}

/** Net worth broken down by tax wrapper (ISA, Pension, GIA, Cash) */
export function getNetWorthByWrapper(
  household: HouseholdData
): { wrapper: TaxWrapper; value: number }[] {
  const totals = new Map<TaxWrapper, number>();
  for (const account of household.accounts) {
    const wrapper = getAccountTaxWrapper(account.type);
    totals.set(wrapper, (totals.get(wrapper) ?? 0) + account.currentValue);
  }
  return Array.from(totals.entries()).map(([wrapper, value]) => ({
    wrapper,
    value: roundPence(value),
  }));
}

/** Net worth broken down by account type */
export function getNetWorthByAccountType(
  household: HouseholdData
): { type: AccountType; value: number }[] {
  const totals = new Map<AccountType, number>();
  for (const account of household.accounts) {
    totals.set(
      account.type,
      (totals.get(account.type) ?? 0) + account.currentValue
    );
  }
  return Array.from(totals.entries()).map(([type, value]) => ({
    type,
    value: roundPence(value),
  }));
}

/**
 * Calculate total annual contributions across discretionary and employment pension.
 * Use this anywhere that sums "all contributions" — avoids duplicating the pattern.
 */
export function calculateTotalAnnualContributions(
  contributions: Contribution[],
  income: PersonIncome[]
): number {
  const discretionary = contributions.reduce(
    (sum, c) => sum + annualiseContribution(c.amount, c.frequency),
    0
  );
  const employmentPension = income.reduce(
    (sum, i) => sum + i.employeePensionContribution + i.employerPensionContribution,
    0
  );
  return discretionary + employmentPension;
}

/**
 * Calculate personal annual contributions (excluding employer pension contributions).
 * Shows the individual's discretionary savings effort.
 */
export function calculatePersonalAnnualContributions(
  contributions: Contribution[],
  income: PersonIncome[]
): number {
  const discretionary = contributions.reduce(
    (sum, c) => sum + annualiseContribution(c.amount, c.frequency),
    0
  );
  const employeePension = income.reduce(
    (sum, i) => sum + i.employeePensionContribution,
    0
  );
  return discretionary + employeePension;
}

/**
 * Calculate the household's total annual state pension entitlement.
 * Pro-rates based on each person's NI qualifying years.
 */
export function calculateHouseholdStatePension(persons: Person[]): number {
  return persons.reduce(
    (sum, p) => sum + calculateProRataStatePension(p.niQualifyingYears ?? 0),
    0
  );
}
