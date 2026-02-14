// ============================================================
// UK Income Tax, NI & Student Loan Calculations
// ============================================================

import type { PersonIncome, StudentLoanPlan } from "@/types";
import { UK_TAX_CONSTANTS } from "@/lib/tax-constants";
import { roundPence } from "@/lib/format";

// --- Types ---

export interface TaxBandBreakdown {
  band: string;
  rate: number;
  taxableAmount: number;
  tax: number;
}

export interface IncomeTaxResult {
  tax: number;
  effectiveRate: number;
  breakdown: TaxBandBreakdown[];
}

export interface NIResult {
  ni: number;
  breakdown: {
    band: string;
    rate: number;
    earnings: number;
    ni: number;
  }[];
}

export interface TakeHomeResult {
  gross: number;
  adjustedGross: number; // after salary sacrifice if applicable
  incomeTax: number;
  ni: number;
  studentLoan: number;
  pensionDeduction: number;
  takeHome: number;
  monthlyTakeHome: number;
}

// --- Helpers ---

/**
 * Calculate the adjusted gross for tax/NI purposes based on pension method.
 * - salary_sacrifice: pension deducted before tax and NI
 * - net_pay: pension deducted before tax but NOT NI
 * - relief_at_source: pension from net pay, HMRC adds basic rate relief
 */
function getAdjustedGrossForTax(
  grossSalary: number,
  pensionContribution: number,
  pensionMethod: PersonIncome["pensionContributionMethod"]
): number {
  switch (pensionMethod) {
    case "salary_sacrifice":
    case "net_pay":
      return grossSalary - pensionContribution;
    case "relief_at_source":
      // No adjustment to gross for tax - but basic rate relief is added to the pension pot
      // The contribution is from net pay, so taxable income is the full gross
      // However, the basic rate band is effectively extended by the gross contribution amount
      // For simplicity and HMRC convention, relief at source means gross is not reduced,
      // but the individual's basic rate band is extended by the gross pension contribution
      return grossSalary;
  }
}

function getAdjustedGrossForNI(
  grossSalary: number,
  pensionContribution: number,
  pensionMethod: PersonIncome["pensionContributionMethod"]
): number {
  switch (pensionMethod) {
    case "salary_sacrifice":
      return grossSalary - pensionContribution;
    case "net_pay":
    case "relief_at_source":
      // NI is calculated on full gross (pension doesn't reduce NI for these methods)
      return grossSalary;
  }
}

/**
 * Calculate the personal allowance taking into account the taper
 * for income over £100,000. For every £2 over £100k, lose £1 of allowance.
 */
function calculatePersonalAllowance(adjustedNetIncome: number): number {
  const { personalAllowance, personalAllowanceTaperThreshold } = UK_TAX_CONSTANTS;

  if (adjustedNetIncome <= personalAllowanceTaperThreshold) {
    return personalAllowance;
  }

  const excess = adjustedNetIncome - personalAllowanceTaperThreshold;
  const reduction = Math.floor(excess * UK_TAX_CONSTANTS.personalAllowanceTaperRate);
  return Math.max(0, personalAllowance - reduction);
}

// --- Public Functions ---

/**
 * Calculate income tax for a given gross salary, accounting for pension contributions.
 */
export function calculateIncomeTax(
  grossSalary: number,
  pensionContribution: number = 0,
  pensionMethod: PersonIncome["pensionContributionMethod"] = "salary_sacrifice"
): IncomeTaxResult {
  const adjustedGross = getAdjustedGrossForTax(grossSalary, pensionContribution, pensionMethod);
  const personalAllowance = calculatePersonalAllowance(adjustedGross);
  const { basicRate, basicRateUpperLimit, higherRate, higherRateUpperLimit, additionalRate } =
    UK_TAX_CONSTANTS.incomeTax;

  const breakdown: TaxBandBreakdown[] = [];
  let totalTax = 0;

  // For relief at source, extend the basic rate band by the gross pension contribution
  // Gross contribution = net contribution / 0.8
  let basicRateLimit = basicRateUpperLimit;
  if (pensionMethod === "relief_at_source" && pensionContribution > 0) {
    const grossPensionContribution = pensionContribution / 0.8;
    basicRateLimit += grossPensionContribution;
  }

  // Personal Allowance band (0%)
  const personalAllowanceBand = Math.min(adjustedGross, personalAllowance);
  breakdown.push({
    band: "Personal Allowance",
    rate: 0,
    taxableAmount: personalAllowanceBand,
    tax: 0,
  });

  // Taxable income after personal allowance
  const taxableIncome = Math.max(0, adjustedGross - personalAllowance);

  if (taxableIncome <= 0) {
    return { tax: 0, effectiveRate: 0, breakdown };
  }

  // Basic rate band
  const basicRateBandWidth = basicRateLimit - personalAllowance;
  const basicRateTaxable = Math.min(taxableIncome, Math.max(0, basicRateBandWidth));
  const basicRateTax = basicRateTaxable * basicRate;
  if (basicRateTaxable > 0) {
    breakdown.push({
      band: "Basic Rate",
      rate: basicRate,
      taxableAmount: basicRateTaxable,
      tax: basicRateTax,
    });
    totalTax += basicRateTax;
  }

  // Higher rate band
  const higherRateBandWidth = higherRateUpperLimit - basicRateLimit;
  const incomeAboveBasic = Math.max(0, taxableIncome - basicRateBandWidth);
  const higherRateTaxable = Math.min(incomeAboveBasic, Math.max(0, higherRateBandWidth));
  const higherRateTax = higherRateTaxable * higherRate;
  if (higherRateTaxable > 0) {
    breakdown.push({
      band: "Higher Rate",
      rate: higherRate,
      taxableAmount: higherRateTaxable,
      tax: higherRateTax,
    });
    totalTax += higherRateTax;
  }

  // Additional rate band
  const additionalRateTaxable = Math.max(0, incomeAboveBasic - Math.max(0, higherRateBandWidth));
  const additionalRateTax = additionalRateTaxable * additionalRate;
  if (additionalRateTaxable > 0) {
    breakdown.push({
      band: "Additional Rate",
      rate: additionalRate,
      taxableAmount: additionalRateTaxable,
      tax: additionalRateTax,
    });
    totalTax += additionalRateTax;
  }

  const effectiveRate = adjustedGross > 0 ? totalTax / adjustedGross : 0;

  return {
    tax: roundPence(totalTax),
    effectiveRate: Math.round(effectiveRate * 10000) / 10000,
    breakdown,
  };
}

/**
 * Calculate National Insurance contributions.
 */
export function calculateNI(
  grossSalary: number,
  pensionContribution: number = 0,
  pensionMethod: PersonIncome["pensionContributionMethod"] = "salary_sacrifice"
): NIResult {
  const adjustedGross = getAdjustedGrossForNI(grossSalary, pensionContribution, pensionMethod);
  const { primaryThreshold, upperEarningsLimit, employeeRate, employeeRateAboveUEL } =
    UK_TAX_CONSTANTS.nationalInsurance;

  const breakdown: NIResult["breakdown"] = [];
  let totalNI = 0;

  // Below primary threshold: no NI
  const belowThreshold = Math.min(adjustedGross, primaryThreshold);
  breakdown.push({
    band: "Below Primary Threshold",
    rate: 0,
    earnings: belowThreshold,
    ni: 0,
  });

  // Between primary threshold and upper earnings limit: employee rate
  const earningsBetween = Math.max(
    0,
    Math.min(adjustedGross, upperEarningsLimit) - primaryThreshold
  );
  const niBetween = earningsBetween * employeeRate;
  if (earningsBetween > 0) {
    breakdown.push({
      band: "Primary Threshold to Upper Earnings Limit",
      rate: employeeRate,
      earnings: earningsBetween,
      ni: niBetween,
    });
    totalNI += niBetween;
  }

  // Above upper earnings limit: reduced rate
  const earningsAboveUEL = Math.max(0, adjustedGross - upperEarningsLimit);
  const niAboveUEL = earningsAboveUEL * employeeRateAboveUEL;
  if (earningsAboveUEL > 0) {
    breakdown.push({
      band: "Above Upper Earnings Limit",
      rate: employeeRateAboveUEL,
      earnings: earningsAboveUEL,
      ni: niAboveUEL,
    });
    totalNI += niAboveUEL;
  }

  return {
    ni: roundPence(totalNI),
    breakdown,
  };
}

/**
 * Calculate student loan repayment for a given plan.
 */
export function calculateStudentLoan(
  grossSalary: number,
  plan: StudentLoanPlan
): number {
  if (plan === "none") return 0;

  const planConfig = UK_TAX_CONSTANTS.studentLoan[plan];
  if (!planConfig) return 0;

  const { threshold, rate } = planConfig;
  const repayable = Math.max(0, grossSalary - threshold);
  return roundPence(repayable * rate);
}

/**
 * Calculate complete take-home pay breakdown for a person.
 */
export function calculateTakeHomePay(income: PersonIncome): TakeHomeResult {
  const { grossSalary, employeePensionContribution, pensionContributionMethod } = income;

  // For the purpose of student loan, the threshold is applied against the gross salary
  // (student loan repayment is not affected by pension method choice)

  const adjustedGrossForTax = getAdjustedGrossForTax(
    grossSalary,
    employeePensionContribution,
    pensionContributionMethod
  );

  const incomeTaxResult = calculateIncomeTax(
    grossSalary,
    employeePensionContribution,
    pensionContributionMethod
  );

  const niResult = calculateNI(
    grossSalary,
    employeePensionContribution,
    pensionContributionMethod
  );

  // Student loan is omitted here — callers should use calculateStudentLoan with the person's plan
  const studentLoan = 0;

  // Calculate actual deduction from pay packet
  let pensionDeduction: number;
  switch (pensionContributionMethod) {
    case "salary_sacrifice":
      // Already deducted from gross - no additional deduction from net
      pensionDeduction = employeePensionContribution;
      break;
    case "net_pay":
      // Deducted from gross before tax, but reflected in lower taxable pay
      pensionDeduction = employeePensionContribution;
      break;
    case "relief_at_source":
      // Paid from net pay (80% of gross contribution, HMRC adds 20%)
      pensionDeduction = employeePensionContribution;
      break;
  }

  // Take-home calculation
  let takeHome: number;
  switch (pensionContributionMethod) {
    case "salary_sacrifice":
      // Gross is already reduced; tax and NI calculated on reduced gross
      takeHome = (grossSalary - employeePensionContribution) - incomeTaxResult.tax - niResult.ni - studentLoan;
      break;
    case "net_pay":
      // Tax calculated on reduced gross, NI on full gross, pension deducted from pay
      takeHome = grossSalary - employeePensionContribution - incomeTaxResult.tax - niResult.ni - studentLoan;
      break;
    case "relief_at_source":
      // Tax on full gross, NI on full gross, pension deducted from net pay
      takeHome = grossSalary - incomeTaxResult.tax - niResult.ni - studentLoan - employeePensionContribution;
      break;
  }

  return {
    gross: grossSalary,
    adjustedGross: adjustedGrossForTax,
    incomeTax: incomeTaxResult.tax,
    ni: niResult.ni,
    studentLoan,
    pensionDeduction,
    takeHome: roundPence(takeHome),
    monthlyTakeHome: roundPence(takeHome / 12),
  };
}

/**
 * Convenience: Calculate full take-home including student loan.
 * Pass the student loan plan from the Person record.
 */
export function calculateTakeHomePayWithStudentLoan(
  income: PersonIncome,
  studentLoanPlan: StudentLoanPlan
): TakeHomeResult {
  const base = calculateTakeHomePay(income);

  const studentLoanGross =
    income.pensionContributionMethod === "salary_sacrifice"
      ? income.grossSalary - income.employeePensionContribution
      : income.grossSalary;

  const studentLoan = calculateStudentLoan(studentLoanGross, studentLoanPlan);

  return {
    ...base,
    studentLoan,
    takeHome: roundPence(base.takeHome - studentLoan),
    monthlyTakeHome: roundPence((base.takeHome - studentLoan) / 12),
  };
}
