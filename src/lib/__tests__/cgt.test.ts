import { describe, it, expect } from "vitest";
import {
  calculateSection104Pool,
  calculateGainsForTaxYear,
  getUnrealisedGains,
  calculateBedAndISA,
  getTaxYear,
  parseTaxYearDates,
} from "../cgt";
import type { Transaction, Account } from "@/types";

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

describe("calculateSection104Pool", () => {
  it("builds pool from buy transactions", () => {
    const transactions: Transaction[] = [
      {
        id: "1",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "buy",
        date: "2023-01-01",
        units: 100,
        pricePerUnit: 10,
        amount: 1000,
      },
      {
        id: "2",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "buy",
        date: "2023-06-01",
        units: 100,
        pricePerUnit: 12,
        amount: 1200,
      },
    ];

    const pools = calculateSection104Pool(transactions);
    expect(pools).toHaveLength(1);
    expect(pools[0].totalUnits).toBe(200);
    expect(pools[0].pooledCost).toBe(2200);
    expect(pools[0].averageCost).toBe(11);
  });

  it("reduces pool on sell transactions", () => {
    const transactions: Transaction[] = [
      {
        id: "1",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "buy",
        date: "2023-01-01",
        units: 200,
        pricePerUnit: 10,
        amount: 2000,
      },
      {
        id: "2",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "sell",
        date: "2023-06-01",
        units: 50,
        pricePerUnit: 15,
        amount: 750,
      },
    ];

    const pools = calculateSection104Pool(transactions);
    expect(pools[0].totalUnits).toBe(150);
    // Sold 50 at avg cost 10 = removed £500 from pool
    expect(pools[0].pooledCost).toBe(1500);
    expect(pools[0].averageCost).toBe(10);
  });

  it("handles multiple funds separately", () => {
    const transactions: Transaction[] = [
      {
        id: "1",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "buy",
        date: "2023-01-01",
        units: 100,
        pricePerUnit: 10,
        amount: 1000,
      },
      {
        id: "2",
        accountId: "acc-1",
        fundId: "fund-2",
        type: "buy",
        date: "2023-01-01",
        units: 50,
        pricePerUnit: 20,
        amount: 1000,
      },
    ];

    const pools = calculateSection104Pool(transactions);
    expect(pools).toHaveLength(2);
  });

  it("ignores dividend transactions for pool cost", () => {
    const transactions: Transaction[] = [
      {
        id: "1",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "buy",
        date: "2023-01-01",
        units: 100,
        pricePerUnit: 10,
        amount: 1000,
      },
      {
        id: "2",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "dividend",
        date: "2023-06-01",
        units: 0,
        pricePerUnit: 0,
        amount: 50,
      },
    ];

    const pools = calculateSection104Pool(transactions);
    expect(pools[0].totalUnits).toBe(100);
    expect(pools[0].pooledCost).toBe(1000);
  });
});

describe("calculateGainsForTaxYear", () => {
  it("calculates gains for sells in the tax year", () => {
    const transactions: Transaction[] = [
      {
        id: "1",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "buy",
        date: "2023-01-01",
        units: 200,
        pricePerUnit: 10,
        amount: 2000,
      },
      {
        id: "2",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "sell",
        date: "2024-06-01", // In 2024/25 tax year
        units: 100,
        pricePerUnit: 15,
        amount: 1500,
      },
    ];

    const result = calculateGainsForTaxYear(transactions, "2024/25");
    expect(result.taxYear).toBe("2024/25");
    // Gain: 100 units * (£15 - £10) = £500
    expect(result.totalGains).toBe(500);
    expect(result.totalLosses).toBe(0);
    expect(result.netGain).toBe(500);
  });

  it("applies annual exempt amount", () => {
    const transactions: Transaction[] = [
      {
        id: "1",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "buy",
        date: "2023-01-01",
        units: 200,
        pricePerUnit: 10,
        amount: 2000,
      },
      {
        id: "2",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "sell",
        date: "2024-06-01",
        units: 100,
        pricePerUnit: 15,
        amount: 1500,
      },
    ];

    const result = calculateGainsForTaxYear(transactions, "2024/25");
    // Gain: £500, allowance: £3,000
    expect(result.taxableGain).toBe(0);
    expect(result.taxDue).toBe(0);
  });

  it("charges tax on gains above allowance", () => {
    const transactions: Transaction[] = [
      {
        id: "1",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "buy",
        date: "2023-01-01",
        units: 1000,
        pricePerUnit: 10,
        amount: 10000,
      },
      {
        id: "2",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "sell",
        date: "2024-06-01",
        units: 1000,
        pricePerUnit: 20,
        amount: 20000,
      },
    ];

    const result = calculateGainsForTaxYear(transactions, "2024/25");
    // Gain: £10,000, allowance: £3,000, taxable: £7,000
    // Default to higher rate: £7,000 * 0.24 = £1,680
    expect(result.totalGains).toBe(10000);
    expect(result.taxableGain).toBe(7000);
    expect(result.taxDue).toBe(1680);
  });

  it("ignores sells outside the tax year", () => {
    const transactions: Transaction[] = [
      {
        id: "1",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "buy",
        date: "2023-01-01",
        units: 200,
        pricePerUnit: 10,
        amount: 2000,
      },
      {
        id: "2",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "sell",
        date: "2023-06-01", // In 2023/24, not 2024/25
        units: 100,
        pricePerUnit: 15,
        amount: 1500,
      },
    ];

    const result = calculateGainsForTaxYear(transactions, "2024/25");
    expect(result.totalGains).toBe(0);
    expect(result.disposals).toHaveLength(0);
  });

  it("handles losses", () => {
    const transactions: Transaction[] = [
      {
        id: "1",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "buy",
        date: "2023-01-01",
        units: 200,
        pricePerUnit: 20,
        amount: 4000,
      },
      {
        id: "2",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "sell",
        date: "2024-06-01",
        units: 100,
        pricePerUnit: 15,
        amount: 1500,
      },
    ];

    const result = calculateGainsForTaxYear(transactions, "2024/25");
    // Loss: 100 * (15 - 20) = -£500
    expect(result.totalGains).toBe(0);
    expect(result.totalLosses).toBe(500);
    expect(result.netGain).toBe(-500);
    expect(result.taxableGain).toBe(0);
    expect(result.taxDue).toBe(0);
  });
});

describe("getUnrealisedGains", () => {
  it("calculates unrealised gains using section 104 pool", () => {
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

    const transactions: Transaction[] = [
      {
        id: "1",
        accountId: "acc-1",
        fundId: "fund-1",
        type: "buy",
        date: "2023-01-01",
        units: 100,
        pricePerUnit: 10,
        amount: 1000,
      },
    ];

    const gains = getUnrealisedGains(accounts, transactions);
    expect(gains).toHaveLength(1);
    expect(gains[0].unrealisedGain).toBe(500); // 100 * (15 - 10)
    expect(gains[0].units).toBe(100);
    expect(gains[0].averageCost).toBe(10);
    expect(gains[0].currentPrice).toBe(15);
  });

  it("uses holding purchase price when no transactions exist", () => {
    const accounts: Account[] = [
      {
        id: "acc-2",
        personId: "person-1",
        type: "gia",
        provider: "Test",
        name: "Test GIA",
        currentValue: 15000,
        holdings: [
          {
            fundId: "fund-2",
            units: 100,
            purchasePrice: 12,
            currentPrice: 15,
          },
        ],
      },
    ];

    const gains = getUnrealisedGains(accounts, []);
    expect(gains[0].averageCost).toBe(12);
    expect(gains[0].unrealisedGain).toBe(300); // 100 * (15 - 12)
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
