import { describe, it, expect } from "vitest";
import {
  calculateIncomeTax,
  calculateNI,
  calculateStudentLoan,
  calculateTakeHomePay,
  calculateTakeHomePayWithStudentLoan,
} from "../tax";
import type { PersonIncome } from "@/types";

describe("calculateIncomeTax", () => {
  it("returns zero tax for income below personal allowance", () => {
    const result = calculateIncomeTax(10000);
    expect(result.tax).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it("calculates basic rate tax correctly", () => {
    // £30,000 salary, no pension
    // Personal allowance: £12,570
    // Taxable: £17,430
    // Basic rate: £17,430 * 0.20 = £3,486
    const result = calculateIncomeTax(30000);
    expect(result.tax).toBe(3486);
    expect(result.breakdown.length).toBeGreaterThanOrEqual(2);
    expect(result.breakdown[0].band).toBe("Personal Allowance");
    expect(result.breakdown[1].band).toBe("Basic Rate");
  });

  it("calculates higher rate tax correctly", () => {
    // £80,000 salary, no pension
    // Personal allowance: £12,570
    // Basic rate: (£50,270 - £12,570) = £37,700 * 0.20 = £7,540
    // Higher rate: (£80,000 - £50,270) = £29,730 * 0.40 = £11,892
    // Total: £19,432
    const result = calculateIncomeTax(80000);
    expect(result.tax).toBe(19432);
  });

  it("calculates additional rate tax correctly", () => {
    // £200,000 salary, no pension
    // Personal allowance tapered: £200k > £125,140, so PA = 0
    // Basic rate: (£50,270 - 0) = £50,270 * 0.20 = £10,054
    // Higher rate: (£125,140 - £50,270) = £74,870 * 0.40 = £29,948
    // Additional: (£200,000 - £125,140) = £74,860 * 0.45 = £33,687
    // Total: £73,689
    const result = calculateIncomeTax(200000);
    expect(result.tax).toBe(73689);
  });

  it("tapers personal allowance for income over £100k", () => {
    // £120,000 salary
    // Excess over £100k: £20,000
    // PA reduction: £20,000 * 0.5 = £10,000
    // Adjusted PA: £12,570 - £10,000 = £2,570
    const result = calculateIncomeTax(120000);
    const paBreakdown = result.breakdown.find(
      (b) => b.band === "Personal Allowance"
    );
    expect(paBreakdown?.taxableAmount).toBe(2570);
  });

  it("reduces personal allowance to zero for high incomes", () => {
    // £125,140 or more: PA = 0
    const result = calculateIncomeTax(130000);
    const paBreakdown = result.breakdown.find(
      (b) => b.band === "Personal Allowance"
    );
    expect(paBreakdown?.taxableAmount).toBe(0);
  });

  it("reduces taxable income with salary sacrifice pension", () => {
    // £50,000 salary, £5,000 salary sacrifice pension
    // Adjusted gross: £45,000
    // Tax on £45,000: PA £12,570 + basic rate on (£45,000 - £12,570) = £32,430
    // Tax: £32,430 * 0.20 = £6,486
    const result = calculateIncomeTax(50000, 5000, "salary_sacrifice");
    expect(result.tax).toBe(6486);
  });

  it("reduces taxable income with net pay pension", () => {
    // Same behaviour as salary sacrifice for tax purposes
    const result = calculateIncomeTax(50000, 5000, "net_pay");
    expect(result.tax).toBe(6486);
  });

  it("extends basic rate band for relief at source pension", () => {
    // £55,000 salary, £4,000 net pension contribution
    // Gross pension contribution: £4,000 / 0.8 = £5,000
    // Basic rate limit extended: £50,270 + £5,000 = £55,270
    // All income falls within basic rate band
    const result = calculateIncomeTax(55000, 4000, "relief_at_source");
    // Without relief at source: higher rate on £4,730
    // With: all basic rate
    const noRelief = calculateIncomeTax(55000, 0, "salary_sacrifice");
    expect(result.tax).toBeLessThan(noRelief.tax);
  });

  it("handles zero salary", () => {
    const result = calculateIncomeTax(0);
    expect(result.tax).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });
});

describe("calculateNI", () => {
  it("returns zero NI for income below threshold", () => {
    const result = calculateNI(10000);
    expect(result.ni).toBe(0);
  });

  it("calculates NI between thresholds correctly", () => {
    // £30,000 salary
    // Earnings between PT (£12,570) and UEL (£50,270): £17,430
    // NI: £17,430 * 0.08 = £1,394.40
    const result = calculateNI(30000);
    expect(result.ni).toBe(1394.4);
  });

  it("calculates NI above upper earnings limit", () => {
    // £60,000 salary
    // Between PT and UEL: (£50,270 - £12,570) = £37,700 * 0.08 = £3,016
    // Above UEL: (£60,000 - £50,270) = £9,730 * 0.02 = £194.60
    // Total: £3,210.60
    const result = calculateNI(60000);
    expect(result.ni).toBe(3210.6);
  });

  it("reduces NI-able income for salary sacrifice", () => {
    // £60,000 salary, £10,000 salary sacrifice
    // Adjusted: £50,000
    // NI: (£50,000 - £12,570) = £37,430 * 0.08 = £2,994.40
    const result = calculateNI(60000, 10000, "salary_sacrifice");
    expect(result.ni).toBe(2994.4);
  });

  it("does not reduce NI for net pay pension", () => {
    // £60,000 salary, £10,000 net pay pension
    // NI calculated on full £60,000
    const result = calculateNI(60000, 10000, "net_pay");
    const resultNoContrib = calculateNI(60000);
    expect(result.ni).toBe(resultNoContrib.ni);
  });

  it("does not reduce NI for relief at source pension", () => {
    const result = calculateNI(60000, 10000, "relief_at_source");
    const resultNoContrib = calculateNI(60000);
    expect(result.ni).toBe(resultNoContrib.ni);
  });

  it("handles zero salary", () => {
    const result = calculateNI(0);
    expect(result.ni).toBe(0);
  });
});

describe("calculateStudentLoan", () => {
  it("returns zero for no student loan", () => {
    expect(calculateStudentLoan(50000, "none")).toBe(0);
  });

  it("calculates Plan 1 repayment correctly", () => {
    // £50,000 salary, Plan 1 threshold: £22,015, rate: 9%
    // Repayable: (£50,000 - £22,015) = £27,985 * 0.09 = £2,518.65
    expect(calculateStudentLoan(50000, "plan1")).toBe(2518.65);
  });

  it("calculates Plan 2 repayment correctly", () => {
    // £50,000 salary, Plan 2 threshold: £27,295, rate: 9%
    // Repayable: (£50,000 - £27,295) = £22,705 * 0.09 = £2,043.45
    expect(calculateStudentLoan(50000, "plan2")).toBe(2043.45);
  });

  it("calculates Plan 4 repayment correctly", () => {
    // £50,000, Plan 4 threshold: £27,660
    // (£50,000 - £27,660) = £22,340 * 0.09 = £2,010.60
    expect(calculateStudentLoan(50000, "plan4")).toBe(2010.6);
  });

  it("calculates Plan 5 repayment correctly", () => {
    // £50,000, Plan 5 threshold: £25,000
    // (£50,000 - £25,000) = £25,000 * 0.09 = £2,250
    expect(calculateStudentLoan(50000, "plan5")).toBe(2250);
  });

  it("calculates Postgrad repayment correctly", () => {
    // £50,000, Postgrad threshold: £21,000, rate: 6%
    // (£50,000 - £21,000) = £29,000 * 0.06 = £1,740
    expect(calculateStudentLoan(50000, "postgrad")).toBe(1740);
  });

  it("returns zero when salary below threshold", () => {
    expect(calculateStudentLoan(20000, "plan2")).toBe(0);
  });
});

describe("calculateTakeHomePay", () => {
  it("calculates full take-home breakdown for salary sacrifice", () => {
    const income: PersonIncome = {
      personId: "test",
      grossSalary: 60000,
      employerPensionContribution: 6000,
      employeePensionContribution: 3000,
      pensionContributionMethod: "salary_sacrifice",
    };

    const result = calculateTakeHomePay(income);

    expect(result.gross).toBe(60000);
    expect(result.adjustedGross).toBe(57000); // 60k - 3k salary sacrifice
    expect(result.incomeTax).toBeGreaterThan(0);
    expect(result.ni).toBeGreaterThan(0);
    expect(result.pensionDeduction).toBe(3000);
    expect(result.takeHome).toBeGreaterThan(0);
    expect(result.monthlyTakeHome).toBeCloseTo(result.takeHome / 12, 0);

    // Take-home should be: adjusted gross - tax - NI
    expect(result.takeHome).toBe(
      Math.round(
        (60000 - 3000 - result.incomeTax - result.ni) * 100
      ) / 100
    );
  });

  it("calculates take-home for net pay pension correctly", () => {
    const income: PersonIncome = {
      personId: "test",
      grossSalary: 60000,
      employerPensionContribution: 6000,
      employeePensionContribution: 3000,
      pensionContributionMethod: "net_pay",
    };

    const result = calculateTakeHomePay(income);
    // NI is on full gross, tax is on reduced gross
    expect(result.adjustedGross).toBe(57000);
    expect(result.takeHome).toBeGreaterThan(0);
  });

  it("calculates take-home for relief at source pension correctly", () => {
    const income: PersonIncome = {
      personId: "test",
      grossSalary: 60000,
      employerPensionContribution: 6000,
      employeePensionContribution: 3000,
      pensionContributionMethod: "relief_at_source",
    };

    const result = calculateTakeHomePay(income);
    // Tax and NI both on full gross
    expect(result.adjustedGross).toBe(60000);
    expect(result.takeHome).toBeGreaterThan(0);
  });

  it("salary sacrifice gives higher take-home than net pay due to NI saving", () => {
    const salSac: PersonIncome = {
      personId: "test",
      grossSalary: 60000,
      employerPensionContribution: 0,
      employeePensionContribution: 5000,
      pensionContributionMethod: "salary_sacrifice",
    };

    const netPay: PersonIncome = {
      ...salSac,
      pensionContributionMethod: "net_pay",
    };

    const salSacResult = calculateTakeHomePay(salSac);
    const netPayResult = calculateTakeHomePay(netPay);

    // Salary sacrifice saves NI, so take-home should be higher
    expect(salSacResult.takeHome).toBeGreaterThan(netPayResult.takeHome);
  });
});

describe("calculateTakeHomePayWithStudentLoan", () => {
  it("includes student loan in take-home calculation", () => {
    const income: PersonIncome = {
      personId: "test",
      grossSalary: 50000,
      employerPensionContribution: 0,
      employeePensionContribution: 0,
      pensionContributionMethod: "salary_sacrifice",
    };

    const withLoan = calculateTakeHomePayWithStudentLoan(income, "plan2");
    const withoutLoan = calculateTakeHomePay(income);

    expect(withLoan.studentLoan).toBeGreaterThan(0);
    expect(withLoan.takeHome).toBeLessThan(withoutLoan.takeHome);
    expect(withLoan.takeHome).toBe(
      Math.round((withoutLoan.takeHome - withLoan.studentLoan) * 100) / 100
    );
  });

  it("returns zero student loan for none plan", () => {
    const income: PersonIncome = {
      personId: "test",
      grossSalary: 50000,
      employerPensionContribution: 0,
      employeePensionContribution: 0,
      pensionContributionMethod: "salary_sacrifice",
    };

    const result = calculateTakeHomePayWithStudentLoan(income, "none");
    expect(result.studentLoan).toBe(0);
  });
});
