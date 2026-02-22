// ============================================================
// UK Tax Constants - 2024/25 Tax Year
// ============================================================

/** The tax year these constants apply to. Format: "YYYY/YY" */
export const TAX_YEAR = "2024/25";
/** The April start date of the NEXT tax year (when these constants become stale) */
export const TAX_YEAR_END = "2025-04-06";

export const UK_TAX_CONSTANTS = {
  // --- Income Tax ---
  personalAllowance: 12_570,
  personalAllowanceTaperThreshold: 100_000, // starts reducing £1 for every £2 over this
  personalAllowanceTaperRate: 0.5, // lose £1 for every £2 over threshold

  incomeTax: {
    basicRate: 0.2,
    basicRateUpperLimit: 50_270,
    higherRate: 0.4,
    higherRateUpperLimit: 125_140,
    additionalRate: 0.45,
  },

  // --- National Insurance (Class 1 Employee) ---
  nationalInsurance: {
    primaryThreshold: 12_570, // annual
    upperEarningsLimit: 50_270, // annual
    employeeRate: 0.08, // 8% between PT and UEL
    employeeRateAboveUEL: 0.02, // 2% above UEL
  },

  // --- National Insurance (Self-Employment) ---
  selfEmploymentNI: {
    /** Class 2: flat-rate weekly contribution (£3.45/wk × 52 = £179.40/yr) */
    class2WeeklyRate: 3.45,
    /** Class 2: small profits threshold — exempt below this */
    class2SmallProfitsThreshold: 6_725,
    /** Class 4: lower profits limit */
    class4LowerProfitsLimit: 12_570,
    /** Class 4: upper profits limit */
    class4UpperProfitsLimit: 50_270,
    /** Class 4: main rate (between LPL and UPL) */
    class4MainRate: 0.06, // 6% for 2024/25
    /** Class 4: additional rate (above UPL) */
    class4AdditionalRate: 0.02, // 2% above UPL
  },

  // --- Student Loan Repayment ---
  studentLoan: {
    plan1: { threshold: 24_990, rate: 0.09 },
    plan2: { threshold: 27_295, rate: 0.09 },
    plan4: { threshold: 31_395, rate: 0.09 },
    plan5: { threshold: 25_000, rate: 0.09 },
    postgrad: { threshold: 21_000, rate: 0.06 },
  },

  // --- Capital Gains Tax ---
  cgt: {
    annualExemptAmount: 3_000,
    basicRate: 0.18,
    higherRate: 0.24,
  },

  // --- ISA ---
  isaAnnualAllowance: 20_000,

  // --- Pension ---
  pensionAnnualAllowance: 60_000,
  pensionTaperThresholdIncome: 200_000,    // threshold income for taper
  pensionTaperAdjustedIncomeThreshold: 260_000, // adjusted income where taper starts
  pensionTaperRate: 0.5,                   // lose £1 of allowance for every £2 over threshold
  pensionMinimumTaperedAllowance: 10_000,  // floor for tapered allowance
  pensionTaxFreeLumpSum: 268_275, // max tax-free lump sum (25% of LTA equivalent)

  // --- Dividends ---
  dividendAllowance: 500,
  dividendBasicRate: 0.0875,
  dividendHigherRate: 0.3375,
  dividendAdditionalRate: 0.3935,

  // --- Personal Savings Allowance ---
  personalSavingsAllowance: {
    basicRate: 1_000,
    higherRate: 500,
    additionalRate: 0,
  },

  // --- Inheritance Tax ---
  iht: {
    nilRateBand: 325_000,
    residenceNilRateBand: 175_000,
    rnrbTaperThreshold: 2_000_000, // RNRB tapers by £1 for every £2 above this
    rate: 0.4,
  },

  // --- Marriage Allowance ---
  marriageAllowance: {
    transferableAmount: 1_260,
    taxSaving: 252, // 1260 * 0.2
  },

  // --- State Pension ---
  statePension: {
    fullNewStatePensionWeekly: 221.20, // 2024/25
    fullNewStatePensionAnnual: 11_502.40, // 52 * weekly
    qualifyingYearsRequired: 35,
    minimumQualifyingYears: 10,
  },
} as const;

export type UKTaxConstants = typeof UK_TAX_CONSTANTS;

/**
 * Returns true if the current date is past the end of the tax year
 * these constants apply to. When stale, recommendations and tax
 * calculations should display a prominent warning.
 */
export function isTaxYearStale(now: Date = new Date()): boolean {
  return now >= new Date(TAX_YEAR_END);
}

/**
 * Pension tax-free lump sum fraction (25% PCLS).
 * Used to estimate tax on pension drawdown.
 */
export const PENSION_TAX_FREE_LUMP_SUM_FRACTION = 0.25;
