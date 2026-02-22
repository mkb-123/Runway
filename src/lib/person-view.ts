// ============================================================
// Person-View Filtering Utility
// ============================================================
// Shared utility for filtering household data by person view.
// Eliminates the duplicated pattern across pages:
//   if (selectedView === "household") return data;
//   return data.filter(x => x.personId === selectedView);

import type {
  HouseholdData,
  Person,
  Account,
  PersonIncome,
  BonusStructure,
  Contribution,
} from "@/types";

export type PersonViewFilter = "household" | string;

export interface FilteredHouseholdView {
  persons: Person[];
  accounts: Account[];
  income: PersonIncome[];
  contributions: Contribution[];
  bonusStructures: BonusStructure[];
}

/**
 * Filter household data by person view.
 * Returns all data when view is "household", or
 * only the selected person's data when a personId is given.
 */
export function filterHouseholdByView(
  household: HouseholdData,
  selectedView: PersonViewFilter
): FilteredHouseholdView {
  if (selectedView === "household") {
    return {
      persons: household.persons,
      accounts: household.accounts,
      income: household.income,
      contributions: household.contributions,
      bonusStructures: household.bonusStructures,
    };
  }

  return {
    persons: household.persons.filter((p) => p.id === selectedView),
    accounts: household.accounts.filter((a) => a.personId === selectedView),
    income: household.income.filter((i) => i.personId === selectedView),
    contributions: household.contributions.filter((c) => c.personId === selectedView),
    bonusStructures: household.bonusStructures.filter((b) => b.personId === selectedView),
  };
}
