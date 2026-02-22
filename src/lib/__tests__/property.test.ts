import { describe, it, expect } from "vitest";
import {
  getPropertyEquity,
  getTotalPropertyEquity,
  getTotalPropertyValue,
  getTotalMortgageBalance,
} from "@/types";
import type { Property, HouseholdData } from "@/types";
import {
  getTotalNetWorth,
  getInvestableNetWorth,
  getNetWorthByPerson,
} from "../aggregations";
import { makeTestHousehold, makeProperty } from "./test-fixtures";

// ============================================================
// Property helper functions (src/types/index.ts)
// ============================================================

describe("getPropertyEquity", () => {
  it("returns value minus mortgage", () => {
    const p: Property = { id: "p1", label: "Home", estimatedValue: 500000, ownerPersonIds: [], mortgageBalance: 200000 };
    expect(getPropertyEquity(p)).toBe(300000);
  });

  it("returns full value when no mortgage", () => {
    const p: Property = { id: "p1", label: "Home", estimatedValue: 500000, ownerPersonIds: [], mortgageBalance: 0 };
    expect(getPropertyEquity(p)).toBe(500000);
  });

  it("floors at zero (negative equity clamped)", () => {
    const p: Property = { id: "p1", label: "Home", estimatedValue: 200000, ownerPersonIds: [], mortgageBalance: 300000 };
    expect(getPropertyEquity(p)).toBe(0);
  });
});

describe("getTotalPropertyEquity", () => {
  it("sums equity across multiple properties", () => {
    const properties: Property[] = [
      { id: "p1", label: "Home", estimatedValue: 500000, ownerPersonIds: [], mortgageBalance: 200000 },
      { id: "p2", label: "Holiday Home", estimatedValue: 300000, ownerPersonIds: [], mortgageBalance: 0 },
    ];
    expect(getTotalPropertyEquity(properties)).toBe(600000);
  });

  it("returns 0 for empty array", () => {
    expect(getTotalPropertyEquity([])).toBe(0);
  });
});

describe("getTotalPropertyValue", () => {
  it("sums raw values ignoring mortgage", () => {
    const properties: Property[] = [
      { id: "p1", label: "Home", estimatedValue: 500000, ownerPersonIds: [], mortgageBalance: 200000 },
      { id: "p2", label: "Other", estimatedValue: 300000, ownerPersonIds: [], mortgageBalance: 100000 },
    ];
    expect(getTotalPropertyValue(properties)).toBe(800000);
  });
});

describe("getTotalMortgageBalance", () => {
  it("sums mortgage balances", () => {
    const properties: Property[] = [
      { id: "p1", label: "Home", estimatedValue: 500000, ownerPersonIds: [], mortgageBalance: 200000 },
      { id: "p2", label: "Other", estimatedValue: 300000, ownerPersonIds: [], mortgageBalance: 100000 },
    ];
    expect(getTotalMortgageBalance(properties)).toBe(300000);
  });
});

// ============================================================
// Net worth aggregations with property
// ============================================================

describe("getTotalNetWorth with properties", () => {
  it("includes property equity in net worth", () => {
    const h = makeTestHousehold({
      accounts: [
        { id: "a1", personId: "p1", type: "cash_savings", provider: "Marcus", name: "Cash", currentValue: 100000 },
      ],
      properties: [makeProperty({ estimatedValue: 500000, mortgageBalance: 200000 })],
    });
    // 100k accounts + 300k equity = 400k
    expect(getTotalNetWorth(h)).toBe(400000);
  });

  it("returns accounts-only for no properties", () => {
    const h = makeTestHousehold({
      accounts: [
        { id: "a1", personId: "p1", type: "cash_savings", provider: "Marcus", name: "Cash", currentValue: 100000 },
      ],
      properties: [],
    });
    expect(getTotalNetWorth(h)).toBe(100000);
  });
});

describe("getInvestableNetWorth", () => {
  it("excludes property from investable net worth", () => {
    const h = makeTestHousehold({
      accounts: [
        { id: "a1", personId: "p1", type: "cash_savings", provider: "Marcus", name: "Cash", currentValue: 100000 },
      ],
      properties: [makeProperty({ estimatedValue: 500000, mortgageBalance: 200000 })],
    });
    expect(getInvestableNetWorth(h)).toBe(100000);
  });
});

describe("getNetWorthByPerson with properties", () => {
  it("splits property equity equally among owners", () => {
    const h = makeTestHousehold({
      persons: [
        { id: "p1", name: "Alice", relationship: "self", dateOfBirth: "1980-01-01", plannedRetirementAge: 60, niQualifyingYears: 35 },
        { id: "p2", name: "Bob", relationship: "spouse", dateOfBirth: "1982-01-01", plannedRetirementAge: 60, niQualifyingYears: 30 },
      ],
      accounts: [],
      properties: [makeProperty({ estimatedValue: 400000, mortgageBalance: 0, ownerPersonIds: ["p1", "p2"] })],
    });
    const result = getNetWorthByPerson(h);
    expect(result.find((r) => r.name === "Alice")?.value).toBe(200000);
    expect(result.find((r) => r.name === "Bob")?.value).toBe(200000);
  });

  it("assigns full equity to sole owner", () => {
    const h = makeTestHousehold({
      persons: [
        { id: "p1", name: "Alice", relationship: "self", dateOfBirth: "1980-01-01", plannedRetirementAge: 60, niQualifyingYears: 35 },
        { id: "p2", name: "Bob", relationship: "spouse", dateOfBirth: "1982-01-01", plannedRetirementAge: 60, niQualifyingYears: 30 },
      ],
      accounts: [],
      properties: [makeProperty({ estimatedValue: 400000, mortgageBalance: 100000, ownerPersonIds: ["p1"] })],
    });
    const result = getNetWorthByPerson(h);
    expect(result.find((r) => r.name === "Alice")?.value).toBe(300000);
    expect(result.find((r) => r.name === "Bob")?.value).toBe(0);
  });
});
