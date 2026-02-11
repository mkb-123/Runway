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

export type AssetClass =
  | "equity"
  | "bonds"
  | "property"
  | "cash"
  | "commodities"
  | "mixed";

export type Region =
  | "uk"
  | "us"
  | "europe"
  | "asia"
  | "emerging_markets"
  | "global";

export type TaxWrapper =
  | "pension"
  | "isa"
  | "gia"
  | "cash"
  | "premium_bonds";

export type TransactionType = "buy" | "sell" | "dividend" | "contribution";

export type StudentLoanPlan = "plan1" | "plan2" | "plan4" | "plan5" | "postgrad" | "none";

// --- Core Data Structures ---

export interface Person {
  id: string;
  name: string;
  relationship: "self" | "spouse";
  dateOfBirth: string; // ISO date
  pensionAccessAge: number;
  stateRetirementAge: number;
  niQualifyingYears: number;
  studentLoanPlan: StudentLoanPlan;
}

export interface Fund {
  id: string;
  name: string;
  ticker: string;
  isin: string;
  ocf: number; // ongoing charge figure, e.g. 0.0022 for 0.22%
  assetClass: AssetClass;
  region: Region;
  historicalReturns?: {
    "1yr"?: number;
    "3yr"?: number;
    "5yr"?: number;
    "10yr"?: number;
  };
}

export interface Holding {
  fundId: string;
  units: number;
  purchasePrice: number; // average cost per unit
  currentPrice: number;
}

export interface Account {
  id: string;
  personId: string;
  type: AccountType;
  provider: string;
  name: string;
  currentValue: number;
  holdings: Holding[];
}

// --- Income & Compensation ---

export interface DeferredBonusTranche {
  grantDate: string;
  vestingDate: string;
  amount: number;
  fundId?: string;
  estimatedAnnualReturn: number;
}

export interface BonusStructure {
  personId: string;
  cashBonusAnnual: number;
  deferredTranches: DeferredBonusTranche[];
}

export interface PersonIncome {
  personId: string;
  grossSalary: number;
  employerPensionContribution: number; // annual amount
  employeePensionContribution: number; // annual amount (salary sacrifice or net pay)
  pensionContributionMethod: "salary_sacrifice" | "net_pay" | "relief_at_source";
}

// --- Contributions & Planning ---

export interface AnnualContributions {
  personId: string;
  isaContribution: number;
  pensionContribution: number; // total employee + employer
  giaContribution: number;
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

// --- Transactions (CGT) ---

export interface Transaction {
  id: string;
  accountId: string;
  fundId: string;
  type: TransactionType;
  date: string; // ISO date
  units: number;
  pricePerUnit: number;
  amount: number; // total = units * pricePerUnit
  notes?: string;
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
  accounts: Account[];
  funds: Fund[];
  income: PersonIncome[];
  bonusStructures: BonusStructure[];
  annualContributions: AnnualContributions[];
  retirement: RetirementConfig;
  emergencyFund: EmergencyFundConfig;
  iht: IHTConfig;
  estimatedAnnualExpenses: number;
}

export interface TransactionsData {
  transactions: Transaction[];
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

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: "Equity",
  bonds: "Bonds",
  property: "Property",
  cash: "Cash",
  commodities: "Commodities",
  mixed: "Mixed",
};

export const REGION_LABELS: Record<Region, string> = {
  uk: "UK",
  us: "US",
  europe: "Europe",
  asia: "Asia",
  emerging_markets: "Emerging Markets",
  global: "Global",
};
