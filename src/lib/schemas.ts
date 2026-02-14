// ============================================================
// Zod Schemas for Runtime Validation
// ============================================================
// Mirrors the types in @/types/index.ts, providing parse-at-boundary
// validation for localStorage hydration and data imports.
//
// Design principle: Parse, don't validate. Transform unstructured
// input into types that are correct by construction.

import { z } from "zod";

// --- Enums ---

export const AccountTypeSchema = z.enum([
  "workplace_pension",
  "sipp",
  "stocks_and_shares_isa",
  "cash_isa",
  "lifetime_isa",
  "gia",
  "cash_savings",
  "premium_bonds",
]);

export const AssetClassSchema = z.enum([
  "equity",
  "bonds",
  "property",
  "cash",
  "commodities",
  "mixed",
]);

export const RegionSchema = z.enum([
  "uk",
  "us",
  "europe",
  "asia",
  "emerging_markets",
  "global",
]);

export const TaxWrapperSchema = z.enum([
  "pension",
  "isa",
  "gia",
  "cash",
  "premium_bonds",
]);

export const StudentLoanPlanSchema = z.enum([
  "plan1",
  "plan2",
  "plan4",
  "plan5",
  "postgrad",
  "none",
]);

export const PensionContributionMethodSchema = z.enum([
  "salary_sacrifice",
  "net_pay",
  "relief_at_source",
]);

export const RelationshipSchema = z.enum(["self", "spouse"]);

// --- Core Data Structures ---

export const PersonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  relationship: RelationshipSchema,
  dateOfBirth: z.string(),
  pensionAccessAge: z.number().int().min(0).max(120),
  stateRetirementAge: z.number().int().min(0).max(120),
  niQualifyingYears: z.number().int().min(0).max(100),
  studentLoanPlan: StudentLoanPlanSchema,
});

export const FundSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ticker: z.string(),
  isin: z.string(),
  ocf: z.number().min(0),
  assetClass: AssetClassSchema,
  region: RegionSchema,
  historicalReturns: z
    .object({
      "1yr": z.number().optional(),
      "3yr": z.number().optional(),
      "5yr": z.number().optional(),
      "10yr": z.number().optional(),
    })
    .optional(),
});

export const HoldingSchema = z.object({
  fundId: z.string().min(1),
  units: z.number().min(0),
  purchasePrice: z.number().min(0),
  currentPrice: z.number().min(0),
});

export const AccountSchema = z.object({
  id: z.string().min(1),
  personId: z.string().min(1),
  type: AccountTypeSchema,
  provider: z.string(),
  name: z.string(),
  currentValue: z.number().min(0),
  holdings: z.array(HoldingSchema),
});

// --- Income & Compensation ---

export const DeferredBonusTrancheSchema = z.object({
  grantDate: z.string(),
  vestingDate: z.string(),
  amount: z.number().min(0),
  fundId: z.string().optional(),
  estimatedAnnualReturn: z.number(),
});

export const BonusStructureSchema = z.object({
  personId: z.string().min(1),
  cashBonusAnnual: z.number().min(0),
  deferredTranches: z.array(DeferredBonusTrancheSchema),
});

export const PersonIncomeSchema = z.object({
  personId: z.string().min(1),
  grossSalary: z.number().min(0),
  employerPensionContribution: z.number().min(0),
  employeePensionContribution: z.number().min(0),
  pensionContributionMethod: PensionContributionMethodSchema,
});

// --- Contributions & Planning ---

export const AnnualContributionsSchema = z.object({
  personId: z.string().min(1),
  isaContribution: z.number().min(0),
  pensionContribution: z.number().min(0),
  giaContribution: z.number().min(0),
});

export const RetirementConfigSchema = z.object({
  targetAnnualIncome: z.number().min(0),
  withdrawalRate: z.number().min(0).max(1),
  includeStatePension: z.boolean(),
  scenarioRates: z.array(z.number().min(-1).max(1)).min(1).max(10),
});

export const EmergencyFundConfigSchema = z.object({
  monthlyEssentialExpenses: z.number().min(0),
  targetMonths: z.number().int().min(0),
});

// --- Committed Outgoings ---

export const CommittedOutgoingCategorySchema = z.enum([
  "school_fees",
  "mortgage",
  "rent",
  "childcare",
  "insurance",
  "other",
]);

export const OutgoingFrequencySchema = z.enum(["monthly", "termly", "annually"]);

export const CommittedOutgoingSchema = z.object({
  id: z.string().min(1),
  category: CommittedOutgoingCategorySchema,
  label: z.string().min(1),
  amount: z.number().min(0),
  frequency: OutgoingFrequencySchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  personId: z.string().optional(),
});

// --- Dashboard Configuration ---

export const HeroMetricTypeSchema = z.enum([
  "net_worth",
  "cash_position",
  "retirement_countdown",
  "period_change",
  "year_on_year_change",
  "savings_rate",
  "fire_progress",
  "net_worth_after_commitments",
]);

export const DashboardConfigSchema = z.object({
  heroMetrics: z.tuple([HeroMetricTypeSchema, HeroMetricTypeSchema, HeroMetricTypeSchema]),
});

// --- IHT ---

export const GiftSchema = z.object({
  id: z.string().min(1),
  date: z.string(),
  amount: z.number().min(0),
  recipient: z.string(),
  description: z.string(),
});

export const IHTConfigSchema = z.object({
  estimatedPropertyValue: z.number().min(0),
  passingToDirectDescendants: z.boolean(),
  gifts: z.array(GiftSchema),
});

// --- Snapshots ---

export const SnapshotByPersonSchema = z.object({
  personId: z.string().min(1),
  value: z.number(),
});

export const SnapshotByTypeSchema = z.object({
  type: AccountTypeSchema,
  value: z.number(),
});

export const SnapshotByWrapperSchema = z.object({
  wrapper: TaxWrapperSchema,
  value: z.number(),
});

export const NetWorthSnapshotSchema = z.object({
  date: z.string(),
  totalNetWorth: z.number(),
  byPerson: z.array(SnapshotByPersonSchema),
  byType: z.array(SnapshotByTypeSchema),
  byWrapper: z.array(SnapshotByWrapperSchema),
});

// --- Top-Level Data Files ---

export const HouseholdDataSchema = z.object({
  persons: z.array(PersonSchema),
  accounts: z.array(AccountSchema),
  funds: z.array(FundSchema),
  income: z.array(PersonIncomeSchema),
  bonusStructures: z.array(BonusStructureSchema),
  annualContributions: z.array(AnnualContributionsSchema),
  retirement: RetirementConfigSchema,
  emergencyFund: EmergencyFundConfigSchema,
  committedOutgoings: z.array(CommittedOutgoingSchema).default([]),
  dashboardConfig: DashboardConfigSchema.default({
    heroMetrics: ["net_worth", "fire_progress", "retirement_countdown"],
  }),
  iht: IHTConfigSchema,
  estimatedAnnualExpenses: z.number().min(0),
});

export const SnapshotsDataSchema = z.object({
  snapshots: z.array(NetWorthSnapshotSchema),
});
