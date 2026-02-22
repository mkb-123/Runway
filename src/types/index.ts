// ============================================================
// Net Worth Tracker - Core TypeScript Types
// ============================================================

// --- Enums & Unions ---

export type AccountType =
  | "workplace_pension"
  | "sipp"
  | "stocks_and_shares_isa"
  | "cash_isa"
  | "lifetime_isa"
  | "gia"
  | "cash_savings"
  | "premium_bonds";

export type TaxWrapper =
  | "pension"
  | "isa"
  | "gia"
  | "cash"
  | "premium_bonds";

export type StudentLoanPlan = "plan1" | "plan2" | "plan4" | "plan5" | "postgrad" | "none";

// --- Core Data Structures ---

export interface Person {
  id: string;
  name: string;
  relationship: "self" | "spouse";
  dateOfBirth: string; // ISO date
  plannedRetirementAge: number; // when they plan to stop working
  pensionAccessAge: number; // when private pension is accessible (e.g. 57)
  stateRetirementAge: number; // when state pension starts (e.g. 67)
  niQualifyingYears: number; // kept for data compat, not shown in UI
  studentLoanPlan: StudentLoanPlan;
}

export interface Account {
  id: string;
  personId: string;
  type: AccountType;
  provider: string;
  name: string;
  currentValue: number;
  costBasis?: number; // total amount originally invested (for CGT estimation on GIA accounts)
}

// --- Income & Compensation ---

export interface DeferredBonusTranche {
  grantDate: string;
  vestingDate: string;
  amount: number;
  estimatedAnnualReturn: number;
}

export interface BonusStructure {
  personId: string;
  /** Total annual bonus (cash + deferred). Grows at bonusGrowthRate. */
  totalBonusAnnual: number;
  /** Cash portion paid immediately each year. Base amount; grows at bonusGrowthRate in projections. */
  cashBonusAnnual: number;
  /** Number of years for equal vesting (e.g. 3 = 1/3 vests each year) */
  vestingYears: number;
  /** Gap years before first vesting tranche (e.g. 1 = vest starts year 2 after grant) */
  vestingGapYears: number;
  /** Expected annual return on deferred amounts while vesting */
  estimatedAnnualReturn: number;
  /** Month cash bonus is paid (0=Jan, 1=Feb, ..., 11=Dec). Defaults to 2 (March). */
  bonusPaymentMonth?: number;
}

/** Derived: deferred portion = total - cash (never negative) */
export function getDeferredBonus(bonus: BonusStructure): number {
  return Math.max(0, bonus.totalBonusAnnual - bonus.cashBonusAnnual);
}

export interface PersonIncome {
  personId: string;
  grossSalary: number;
  employerPensionContribution: number; // annual amount
  employeePensionContribution: number; // annual amount (salary sacrifice or net pay)
  pensionContributionMethod: "salary_sacrifice" | "net_pay" | "relief_at_source";
  /** Expected annual salary growth rate as a decimal (e.g. 0.03 for 3%). Defaults to 0. */
  salaryGrowthRate?: number;
  /** Expected annual bonus growth rate as a decimal (e.g. 0.05 for 5%). Defaults to 0. */
  bonusGrowthRate?: number;
}

// --- Contributions & Planning ---

export type ContributionTarget = "isa" | "pension" | "gia";
export type ContributionFrequency = "monthly" | "annually";

export const CONTRIBUTION_TARGET_LABELS: Record<ContributionTarget, string> = {
  isa: "ISA",
  pension: "SIPP / Additional Pension",
  gia: "GIA",
};

export const CONTRIBUTION_FREQUENCY_LABELS: Record<ContributionFrequency, string> = {
  monthly: "Monthly",
  annually: "Annually",
};

export interface Contribution {
  id: string;
  personId: string;
  label: string;
  target: ContributionTarget;
  amount: number;
  frequency: ContributionFrequency;
}

/** Annualise a contribution amount based on its frequency */
export function annualiseContribution(amount: number, frequency: ContributionFrequency): number {
  return frequency === "monthly" ? amount * 12 : amount;
}

/** Get annualised contribution totals for a person */
export function getPersonContributionTotals(
  contributions: Contribution[],
  personId: string
): { isaContribution: number; pensionContribution: number; giaContribution: number } {
  const personContribs = contributions.filter((c) => c.personId === personId);
  return {
    isaContribution: personContribs
      .filter((c) => c.target === "isa")
      .reduce((s, c) => s + annualiseContribution(c.amount, c.frequency), 0),
    pensionContribution: personContribs
      .filter((c) => c.target === "pension")
      .reduce((s, c) => s + annualiseContribution(c.amount, c.frequency), 0),
    giaContribution: personContribs
      .filter((c) => c.target === "gia")
      .reduce((s, c) => s + annualiseContribution(c.amount, c.frequency), 0),
  };
}

/**
 * Get a person's total gross income (salary + cash bonus).
 * Use this anywhere you need "gross income" — never use grossSalary alone.
 */
export function getPersonGrossIncome(
  income: PersonIncome[],
  bonusStructures: BonusStructure[],
  personId: string
): number {
  const personIncome = income.find((i) => i.personId === personId);
  const personBonus = bonusStructures.find((b) => b.personId === personId);
  return (personIncome?.grossSalary ?? 0) + (personBonus?.cashBonusAnnual ?? 0);
}

/**
 * Get the household's total gross income (all persons' salary + cash bonus).
 * Use this for savings rate, tax threshold comparisons, etc.
 */
export function getHouseholdGrossIncome(
  income: PersonIncome[],
  bonusStructures: BonusStructure[]
): number {
  let total = 0;
  for (const inc of income) {
    const bonus = bonusStructures.find((b) => b.personId === inc.personId);
    total += inc.grossSalary + (bonus?.cashBonusAnnual ?? 0);
  }
  return total;
}

export interface RetirementConfig {
  targetAnnualIncome: number;
  withdrawalRate: number; // e.g. 0.04 for 4% SWR
  includeStatePension: boolean;
  scenarioRates: number[]; // e.g. [0.05, 0.07, 0.09]
}

export interface EmergencyFundConfig {
  monthlyEssentialExpenses: number;
  targetMonths: number; // e.g. 6
  monthlyLifestyleSpending: number; // groceries, transport, leisure — non-committed spending
}

// --- Children ---

export interface Child {
  id: string;
  name: string;
  dateOfBirth: string; // ISO date
  schoolFeeAnnual: number; // current annual cost (today's money)
  feeInflationRate: number; // annual fee increase rate, e.g. 0.05 for 5%
  schoolStartAge: number; // age private school starts, e.g. 4
  schoolEndAge: number; // age school ends, e.g. 18
}

// --- Committed Outgoings ---

export type CommittedOutgoingCategory =
  | "school_fees"
  | "mortgage"
  | "rent"
  | "childcare"
  | "insurance"
  | "utilities"
  | "subscriptions"
  | "transport"
  | "health"
  | "loan_repayment"
  | "other";

export type OutgoingFrequency = "monthly" | "termly" | "annually";

export interface CommittedOutgoing {
  id: string;
  category: CommittedOutgoingCategory;
  label: string;
  amount: number; // per-occurrence amount
  frequency: OutgoingFrequency;
  startDate?: string; // ISO date
  endDate?: string; // ISO date (ongoing if omitted)
  personId?: string; // optional, for person-specific outgoings
  inflationRate?: number; // annual increase rate (e.g. 0.05 for 5%/yr)
  linkedChildId?: string; // links to a Child record (for school fees)
}

export const OUTGOING_CATEGORY_LABELS: Record<CommittedOutgoingCategory, string> = {
  school_fees: "School Fees",
  mortgage: "Mortgage",
  rent: "Rent",
  childcare: "Childcare",
  insurance: "Insurance",
  utilities: "Utilities",
  subscriptions: "Subscriptions",
  transport: "Transport",
  health: "Health",
  loan_repayment: "Loan Repayment",
  other: "Other",
};

export const OUTGOING_FREQUENCY_LABELS: Record<OutgoingFrequency, string> = {
  monthly: "Monthly",
  termly: "Termly (3x/year)",
  annually: "Annually",
};

/** Annualise an outgoing amount based on its frequency */
export function annualiseOutgoing(amount: number, frequency: OutgoingFrequency): number {
  switch (frequency) {
    case "monthly":
      return amount * 12;
    case "termly":
      return amount * 3;
    case "annually":
      return amount;
  }
}

// --- Dashboard Configuration ---

export type HeroMetricType =
  | "net_worth"
  | "cash_position"
  | "retirement_countdown"
  | "period_change"
  | "year_on_year_change"
  | "savings_rate"
  | "fire_progress"
  | "net_worth_after_commitments"
  | "projected_retirement_income"
  | "cash_runway";

export const HERO_METRIC_LABELS: Record<HeroMetricType, string> = {
  net_worth: "Total Net Worth",
  cash_position: "Cash Position",
  retirement_countdown: "Retirement Countdown",
  period_change: "Period Change",
  year_on_year_change: "Year-on-Year Change",
  savings_rate: "Savings Rate",
  fire_progress: "FIRE Progress",
  net_worth_after_commitments: "Net Worth After Commitments",
  projected_retirement_income: "Projected Retirement Income",
  cash_runway: "Cash Runway",
};

export interface DashboardConfig {
  heroMetrics: [HeroMetricType, HeroMetricType, HeroMetricType];
}

// --- IHT ---

export interface Gift {
  id: string;
  date: string;
  amount: number;
  recipient: string;
  description: string;
}

export interface IHTConfig {
  estimatedPropertyValue: number;
  passingToDirectDescendants: boolean;
  gifts: Gift[];
}

// --- Snapshots ---

export interface SnapshotByPerson {
  personId: string;
  value: number;
}

export interface SnapshotByType {
  type: AccountType;
  value: number;
}

export interface SnapshotByWrapper {
  wrapper: TaxWrapper;
  value: number;
}

export interface NetWorthSnapshot {
  date: string; // ISO date (monthly)
  totalNetWorth: number;
  byPerson: SnapshotByPerson[];
  byType: SnapshotByType[];
  byWrapper: SnapshotByWrapper[];
}

// --- Top-Level Data Files ---

export interface HouseholdData {
  persons: Person[];
  children: Child[];
  accounts: Account[];
  income: PersonIncome[];
  bonusStructures: BonusStructure[];
  contributions: Contribution[];
  retirement: RetirementConfig;
  emergencyFund: EmergencyFundConfig;
  iht: IHTConfig;
  committedOutgoings: CommittedOutgoing[];
  dashboardConfig: DashboardConfig;
}

export interface SnapshotsData {
  snapshots: NetWorthSnapshot[];
}

// --- Computed / Derived Types ---

export function getAccountTaxWrapper(type: AccountType): TaxWrapper {
  switch (type) {
    case "workplace_pension":
    case "sipp":
      return "pension";
    case "stocks_and_shares_isa":
    case "cash_isa":
    case "lifetime_isa":
      return "isa";
    case "gia":
      return "gia";
    case "cash_savings":
      return "cash";
    case "premium_bonds":
      return "premium_bonds";
  }
}

/**
 * Returns true if the account is accessible before pension access age
 * (ISA, GIA, cash, premium bonds). Pensions are not accessible.
 */
export function isAccountAccessible(type: AccountType): boolean {
  const wrapper = getAccountTaxWrapper(type);
  return wrapper !== "pension";
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  workplace_pension: "Workplace Pension",
  sipp: "SIPP",
  stocks_and_shares_isa: "Stocks & Shares ISA",
  cash_isa: "Cash ISA",
  lifetime_isa: "Lifetime ISA",
  gia: "General Investment Account",
  cash_savings: "Cash / Savings",
  premium_bonds: "Premium Bonds",
};

export const TAX_WRAPPER_LABELS: Record<TaxWrapper, string> = {
  pension: "Pension",
  isa: "ISA",
  gia: "GIA",
  cash: "Cash",
  premium_bonds: "Premium Bonds",
};

