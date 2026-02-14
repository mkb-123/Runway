import { describe, it, expect } from "vitest";
import { UK_TAX_CONSTANTS } from "../tax-constants";

describe("UK_TAX_CONSTANTS", () => {
  it("has correct personal allowance", () => {
    expect(UK_TAX_CONSTANTS.personalAllowance).toBe(12570);
  });

  it("has correct personal allowance taper threshold", () => {
    expect(UK_TAX_CONSTANTS.personalAllowanceTaperThreshold).toBe(100000);
  });

  it("has correct income tax rates", () => {
    expect(UK_TAX_CONSTANTS.incomeTax.basicRate).toBe(0.2);
    expect(UK_TAX_CONSTANTS.incomeTax.higherRate).toBe(0.4);
    expect(UK_TAX_CONSTANTS.incomeTax.additionalRate).toBe(0.45);
  });

  it("has correct income tax band limits", () => {
    expect(UK_TAX_CONSTANTS.incomeTax.basicRateUpperLimit).toBe(50270);
    expect(UK_TAX_CONSTANTS.incomeTax.higherRateUpperLimit).toBe(125140);
  });

  it("has correct NI rates", () => {
    expect(UK_TAX_CONSTANTS.nationalInsurance.employeeRate).toBe(0.08);
    expect(UK_TAX_CONSTANTS.nationalInsurance.employeeRateAboveUEL).toBe(0.02);
    expect(UK_TAX_CONSTANTS.nationalInsurance.primaryThreshold).toBe(12570);
    expect(UK_TAX_CONSTANTS.nationalInsurance.upperEarningsLimit).toBe(50270);
  });

  it("has correct student loan thresholds", () => {
    expect(UK_TAX_CONSTANTS.studentLoan.plan1.threshold).toBe(22015);
    expect(UK_TAX_CONSTANTS.studentLoan.plan2.threshold).toBe(27295);
    expect(UK_TAX_CONSTANTS.studentLoan.plan4.threshold).toBe(27660);
    expect(UK_TAX_CONSTANTS.studentLoan.plan5.threshold).toBe(25000);
    expect(UK_TAX_CONSTANTS.studentLoan.postgrad.threshold).toBe(21000);
    expect(UK_TAX_CONSTANTS.studentLoan.postgrad.rate).toBe(0.06);
  });

  it("has correct CGT values", () => {
    expect(UK_TAX_CONSTANTS.cgt.annualExemptAmount).toBe(3000);
    expect(UK_TAX_CONSTANTS.cgt.basicRate).toBe(0.18);
    expect(UK_TAX_CONSTANTS.cgt.higherRate).toBe(0.24);
  });

  it("has correct ISA allowance", () => {
    expect(UK_TAX_CONSTANTS.isaAnnualAllowance).toBe(20000);
  });

  it("has correct pension allowance", () => {
    expect(UK_TAX_CONSTANTS.pensionAnnualAllowance).toBe(60000);
  });

  it("has correct pension lump sum allowance", () => {
    expect(UK_TAX_CONSTANTS.pensionTaxFreeLumpSum).toBe(268275);
  });

  it("has correct IHT thresholds including RNRB taper", () => {
    expect(UK_TAX_CONSTANTS.iht.nilRateBand).toBe(325000);
    expect(UK_TAX_CONSTANTS.iht.residenceNilRateBand).toBe(175000);
    expect(UK_TAX_CONSTANTS.iht.rnrbTaperThreshold).toBe(2000000);
    expect(UK_TAX_CONSTANTS.iht.rate).toBe(0.4);
  });

  it("has correct state pension values", () => {
    expect(UK_TAX_CONSTANTS.statePension.fullNewStatePensionAnnual).toBe(11502.4);
    expect(UK_TAX_CONSTANTS.statePension.qualifyingYearsRequired).toBe(35);
    expect(UK_TAX_CONSTANTS.statePension.minimumQualifyingYears).toBe(10);
  });

  it("has correct dividend rates (2024/25)", () => {
    expect(UK_TAX_CONSTANTS.dividendAllowance).toBe(500);
    expect(UK_TAX_CONSTANTS.dividendBasicRate).toBe(0.0875);
    expect(UK_TAX_CONSTANTS.dividendHigherRate).toBe(0.3375);
    expect(UK_TAX_CONSTANTS.dividendAdditionalRate).toBe(0.3935);
  });

  it("has correct marriage allowance", () => {
    expect(UK_TAX_CONSTANTS.marriageAllowance.transferableAmount).toBe(1260);
    expect(UK_TAX_CONSTANTS.marriageAllowance.taxSaving).toBe(252);
  });
});
