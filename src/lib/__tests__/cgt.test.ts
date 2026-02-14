import { describe, it, expect } from "vitest";
import {
  getUnrealisedGains,
  calculateBedAndISA,
  getTaxYear,
  parseTaxYearDates,
  determineCgtRate,
  calculateBedAndISABreakEven,
} from "../cgt";
import type { Account } from "@/types";

describe("getTaxYear", () => {
  it("returns correct tax year for date after 6 April", () => {
    expect(getTaxYear("2024-04-06")).toBe("2024/25");
  });

  it("returns correct tax year for date before 6 April", () => {
    expect(getTaxYear("2024-04-05")).toBe("2023/24");
  });

  it("returns correct tax year for January", () => {
    expect(getTaxYear("2025-01-15")).toBe("2024/25");
  });

  it("returns correct tax year for September", () => {
    expect(getTaxYear("2024-09-01")).toBe("2024/25");
  });

  it("returns correct tax year for 5 April edge case", () => {
    expect(getTaxYear("2025-04-05")).toBe("2024/25");
  });

  it("returns correct tax year for 6 April edge case", () => {
    expect(getTaxYear("2025-04-06")).toBe("2025/26");
  });
});

describe("parseTaxYearDates", () => {
  it("parses 2024/25 correctly", () => {
    const result = parseTaxYearDates("2024/25");
    expect(result.start).toBe("2024-04-06");
    expect(result.end).toBe("2025-04-05");
  });

  it("parses 2023/24 correctly", () => {
    const result = parseTaxYearDates("2023/24");
    expect(result.start).toBe("2023-04-06");
    expect(result.end).toBe("2024-04-05");
  });
});

describe("getUnrealisedGains", () => {
  it("calculates unrealised gains using holding purchase price", () => {
    const accounts: Account[] = [
      {
        id: "acc-1",
        personId: "person-1",
        type: "gia",
        provider: "Test",
        name: "Test GIA",
        currentValue: 15000,
        holdings: [
          {
            fundId: "fund-1",
            units: 100,
            purchasePrice: 10,
            currentPrice: 15,
          },
        ],
      },
    ];

    const gains = getUnrealisedGains(accounts);
    expect(gains).toHaveLength(1);
    expect(gains[0].unrealisedGain).toBe(500); // 100 * (15 - 10)
    expect(gains[0].units).toBe(100);
    expect(gains[0].averageCost).toBe(10);
    expect(gains[0].currentPrice).toBe(15);
  });

  it("handles multiple holdings across accounts", () => {
    const accounts: Account[] = [
      {
        id: "acc-1",
        personId: "person-1",
        type: "gia",
        provider: "Test",
        name: "Test GIA 1",
        currentValue: 15000,
        holdings: [
          { fundId: "fund-1", units: 100, purchasePrice: 10, currentPrice: 15 },
          { fundId: "fund-2", units: 50, purchasePrice: 20, currentPrice: 25 },
        ],
      },
      {
        id: "acc-2",
        personId: "person-1",
        type: "gia",
        provider: "Test",
        name: "Test GIA 2",
        currentValue: 5000,
        holdings: [
          { fundId: "fund-1", units: 200, purchasePrice: 12, currentPrice: 15 },
        ],
      },
    ];

    const gains = getUnrealisedGains(accounts);
    expect(gains).toHaveLength(3);
    expect(gains[0].unrealisedGain).toBe(500); // 100 * (15 - 10)
    expect(gains[1].unrealisedGain).toBe(250); // 50 * (25 - 20)
    expect(gains[2].unrealisedGain).toBe(600); // 200 * (15 - 12)
  });

  it("handles negative unrealised gains (losses)", () => {
    const accounts: Account[] = [
      {
        id: "acc-1",
        personId: "person-1",
        type: "gia",
        provider: "Test",
        name: "Test GIA",
        currentValue: 8000,
        holdings: [
          { fundId: "fund-1", units: 100, purchasePrice: 15, currentPrice: 10 },
        ],
      },
    ];

    const gains = getUnrealisedGains(accounts);
    expect(gains[0].unrealisedGain).toBe(-500); // 100 * (10 - 15)
  });

  it("returns empty array for accounts with no holdings", () => {
    const accounts: Account[] = [
      {
        id: "acc-1",
        personId: "person-1",
        type: "cash_savings",
        provider: "Test",
        name: "Cash",
        currentValue: 5000,
        holdings: [],
      },
    ];

    expect(getUnrealisedGains(accounts)).toHaveLength(0);
  });
});

describe("calculateBedAndISA", () => {
  it("uses CGT allowance before charging tax", () => {
    const result = calculateBedAndISA(5000, 3000, 0.2);
    // Taxable: £5000 - £3000 = £2000
    // CGT: £2000 * 0.2 = £400
    expect(result.cgtCost).toBe(400);
  });

  it("zero cost when gain within allowance", () => {
    const result = calculateBedAndISA(2000, 3000, 0.2);
    expect(result.cgtCost).toBe(0);
  });

  it("full tax when no allowance remaining", () => {
    const result = calculateBedAndISA(5000, 0, 0.2);
    // CGT: £5000 * 0.2 = £1000
    expect(result.cgtCost).toBe(1000);
  });

  it("calculates annual tax saved", () => {
    const result = calculateBedAndISA(5000, 3000, 0.2);
    // annualTaxSaved based on the unrealised gain * rate
    expect(result.annualTaxSaved).toBe(1000); // £5000 * 0.2
  });
});

// --- Extracted function tests ---

describe("determineCgtRate", () => {

  it("returns basic rate for income under basic rate limit", () => {
    expect(determineCgtRate(40000)).toBe(0.18);
  });

  it("returns higher rate for income over basic rate limit", () => {
    expect(determineCgtRate(60000)).toBe(0.24);
  });

  it("returns basic rate for income exactly at basic rate limit", () => {
    // £50,270 is the limit, <= means basic rate
    expect(determineCgtRate(50270)).toBe(0.18);
  });

  it("returns higher rate for income just over basic rate limit", () => {
    expect(determineCgtRate(50271)).toBe(0.24);
  });

  it("accounts for salary sacrifice reducing taxable income", () => {
    // Gross: 55,000, pension: 10,000, salary sacrifice
    // Taxable: 45,000 (under 50,270) -> basic rate
    expect(determineCgtRate(55000, 10000, "salary_sacrifice")).toBe(0.18);
  });

  it("accounts for net pay reducing taxable income", () => {
    // Same as salary sacrifice — net pay also reduces taxable income
    expect(determineCgtRate(55000, 10000, "net_pay")).toBe(0.18);
  });

  it("does NOT reduce income for relief at source", () => {
    // Relief at source doesn't reduce gross for tax purposes
    // Gross: 55,000 > 50,270 -> higher rate
    expect(determineCgtRate(55000, 10000, "relief_at_source")).toBe(0.24);
  });

  it("defaults to relief_at_source when no method specified", () => {
    expect(determineCgtRate(55000, 10000)).toBe(0.24);
  });

  it("handles zero income", () => {
    expect(determineCgtRate(0)).toBe(0.18);
  });
});

describe("calculateBedAndISABreakEven", () => {

  it("returns 0 when no CGT cost", () => {
    expect(calculateBedAndISABreakEven(0, 50000, 0.24)).toBe(0);
  });

  it("calculates break-even period", () => {
    // CGT cost: 1000, GIA: 50000, rate: 0.24, return: 0.07
    // Annual saving: 50000 * 0.07 * 0.24 = 840
    // Break-even: 1000 / 840 = 1.19, ceil to 1 decimal = 1.2
    expect(calculateBedAndISABreakEven(1000, 50000, 0.24, 0.07)).toBe(1.2);
  });

  it("returns 0 when GIA value is 0", () => {
    expect(calculateBedAndISABreakEven(1000, 0, 0.24, 0.07)).toBe(0);
  });

  it("returns 0 when assumed return is 0", () => {
    expect(calculateBedAndISABreakEven(1000, 50000, 0.24, 0)).toBe(0);
  });

  it("handles large CGT costs with long break-even", () => {
    // CGT cost: 10000, GIA: 20000, rate: 0.18, return: 0.07
    // Annual saving: 20000 * 0.07 * 0.18 = 252
    // Break-even: 10000 / 252 = 39.68, ceil to 1 decimal = 39.7
    expect(calculateBedAndISABreakEven(10000, 20000, 0.18, 0.07)).toBe(39.7);
  });
});
