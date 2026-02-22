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
  plannedRetirementAge: z.number().int().min(0).max(120).default(60),
  // Default 57: minimum pension access age from April 2028 (was 55, rises to 57)
  pensionAccessAge: z.number().int().min(0).max(120).default(57),
  // Default 67: current state pension age for those born after April 1960
  stateRetirementAge: z.number().int().min(0).max(120).default(67),
  niQualifyingYears: z.number().int().min(0).max(100).default(35),
  studentLoanPlan: StudentLoanPlanSchema.default("none"),
});

export const AccountSchema = z.object({
  id: z.string().min(1),
  personId: z.string().min(1),
  type: AccountTypeSchema,
  provider: z.string(),
  name: z.string(),
  currentValue: z.number().min(0),
  costBasis: z.number().min(0).optional(),
});

// --- Income & Compensation ---

export const DeferredBonusTrancheSchema = z.object({
  grantDate: z.string(),
  vestingDate: z.string(),
  amount: z.number().min(0),
  estimatedAnnualReturn: z.number(),
});

export const BonusStructureSchema = z.object({
  personId: z.string().min(1),
  totalBonusAnnual: z.number().min(0),
  cashBonusAnnual: z.number().min(0),
  vestingYears: z.number().int().min(0).max(10).default(0),
  vestingGapYears: z.number().int().min(0).max(5).default(0),
  estimatedAnnualReturn: z.number().min(-0.5).max(0.5).default(0.08),
  bonusPaymentMonth: z.number().int().min(0).max(11).optional(),
});

export const PersonIncomeSchema = z.object({
  personId: z.string().min(1),
  grossSalary: z.number().min(0),
  employerPensionContribution: z.number().min(0),
  employeePensionContribution: z.number().min(0),
  pensionContributionMethod: PensionContributionMethodSchema,
  salaryGrowthRate: z.number().min(-0.5).max(0.5).optional(),
  bonusGrowthRate: z.number().min(-0.5).max(0.5).optional(),
  priorYearPensionContributions: z.array(z.number().min(0)).max(3).optional(),
});

// --- Contributions & Planning ---

export const ContributionTargetSchema = z.enum(["isa", "pension", "gia"]);
export const ContributionFrequencySchema = z.enum(["monthly", "annually"]);

export const ContributionSchema = z.object({
  id: z.string().min(1),
  personId: z.string().min(1),
  label: z.string(),
  target: ContributionTargetSchema,
  amount: z.number().min(0),
  frequency: ContributionFrequencySchema,
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
  monthlyLifestyleSpending: z.number().min(0).default(0),
});

// --- Children ---

export const ChildSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  dateOfBirth: z.string(),
  schoolFeeAnnual: z.number().min(0).default(0),
  feeInflationRate: z.number().min(-0.2).max(0.2).default(0.05),
  schoolStartAge: z.number().int().min(0).max(25).default(4),
  schoolEndAge: z.number().int().min(0).max(25).default(18),
});

// --- Committed Outgoings ---

export const CommittedOutgoingCategorySchema = z.enum([
  "school_fees",
  "mortgage",
  "rent",
  "childcare",
  "insurance",
  "utilities",
  "subscriptions",
  "transport",
  "health",
  "loan_repayment",
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
  inflationRate: z.number().min(-0.2).max(0.2).optional(),
  linkedChildId: z.string().optional(),
});

// --- Dashboard Configuration ---

export const HeroMetricTypeSchema = z.enum([
  "cash_position",
  "retirement_countdown",
  "period_change",
  "year_on_year_change",
  "savings_rate",
  "fire_progress",
  "net_worth_after_commitments",
  "projected_retirement_income",
  "cash_runway",
  "school_fee_countdown",
  "pension_bridge_gap",
  "per_person_retirement",
  "iht_liability",
]);

export const DashboardConfigSchema = z.object({
  heroMetrics: z.array(HeroMetricTypeSchema).min(1).max(5),
});

// --- Property & Mortgage ---

export const PropertySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  estimatedValue: z.number().min(0),
  ownerPersonIds: z.array(z.string().min(1)).default([]),
  mortgageBalance: z.number().min(0).default(0),
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
  children: z.array(ChildSchema).default([]),
  accounts: z.array(AccountSchema),
  income: z.array(PersonIncomeSchema),
  bonusStructures: z.array(BonusStructureSchema),
  contributions: z.array(ContributionSchema),
  retirement: RetirementConfigSchema,
  emergencyFund: EmergencyFundConfigSchema,
  properties: z.array(PropertySchema).default([]),
  committedOutgoings: z.array(CommittedOutgoingSchema).default([]),
  dashboardConfig: DashboardConfigSchema.default({
    heroMetrics: ["projected_retirement_income", "retirement_countdown", "fire_progress", "period_change", "cash_runway"],
  }),
  iht: IHTConfigSchema,
});

export const SnapshotsDataSchema = z.object({
  snapshots: z.array(NetWorthSnapshotSchema),
});
