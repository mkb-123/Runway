// ============================================================
// UK Tax Constants - 2024/25 Tax Year
// ============================================================

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

  // --- Student Loan Repayment ---
  studentLoan: {
    plan1: { threshold: 22_015, rate: 0.09 },
    plan2: { threshold: 27_295, rate: 0.09 },
    plan4: { threshold: 27_660, rate: 0.09 },
    plan5: { threshold: 25_000, rate: 0.09 },
    postgrad: { threshold: 21_000, rate: 0.06 },
  },

  // --- Capital Gains Tax ---
  cgt: {
    annualExemptAmount: 3_000,
    basicRate: 0.1,
    higherRate: 0.2,
  },

  // --- ISA ---
  isaAnnualAllowance: 20_000,

  // --- Pension ---
  pensionAnnualAllowance: 60_000,
  pensionTaxFreeLumpSum: 268_275, // max tax-free lump sum (25% of LTA equivalent)

  // --- Dividends ---
  dividendAllowance: 500,
  dividendBasicRate: 0.0875,
  dividendHigherRate: 0.3375,
  dividendAdditionalRate: 0.3938,

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
