import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatDate,
  formatNumber,
} from "../format";

describe("formatCurrency", () => {
  it("formats positive amounts with two decimals", () => {
    expect(formatCurrency(1234.56)).toBe("£1,234.56");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("£0.00");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-500)).toBe("-£500.00");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency(1000000)).toBe("£1,000,000.00");
  });

  it("rounds to two decimal places", () => {
    expect(formatCurrency(99.999)).toBe("£100.00");
  });

  it("formats small amounts", () => {
    expect(formatCurrency(0.01)).toBe("£0.01");
  });
});

describe("formatCurrencyCompact", () => {
  it("formats thousands as k", () => {
    expect(formatCurrencyCompact(1200)).toBe("£1.2k");
  });

  it("formats millions as m", () => {
    expect(formatCurrencyCompact(1500000)).toBe("£1.5m");
  });

  it("formats billions as bn", () => {
    expect(formatCurrencyCompact(2300000000)).toBe("£2.3bn");
  });

  it("formats small amounts normally", () => {
    expect(formatCurrencyCompact(500)).toBe("£500.00");
  });

  it("handles negative values", () => {
    expect(formatCurrencyCompact(-1500000)).toBe("-£1.5m");
  });

  it("handles zero", () => {
    expect(formatCurrencyCompact(0)).toBe("£0.00");
  });
});

describe("formatPercent", () => {
  it("converts decimal to percentage string", () => {
    expect(formatPercent(0.07)).toBe("7.00%");
  });

  it("handles zero", () => {
    expect(formatPercent(0)).toBe("0.00%");
  });

  it("handles 100%", () => {
    expect(formatPercent(1)).toBe("100.00%");
  });

  it("handles small percentages", () => {
    expect(formatPercent(0.0023)).toBe("0.23%");
  });

  it("handles negative percentages", () => {
    expect(formatPercent(-0.05)).toBe("-5.00%");
  });
});

describe("formatDate", () => {
  it("formats ISO date to readable UK format", () => {
    expect(formatDate("2024-06-15")).toBe("15 Jun 2024");
  });

  it("formats January dates", () => {
    expect(formatDate("2025-01-01")).toBe("1 Jan 2025");
  });

  it("formats December dates", () => {
    expect(formatDate("2024-12-25")).toBe("25 Dec 2024");
  });
});

describe("formatNumber", () => {
  it("formats numbers with thousand separators", () => {
    expect(formatNumber(1234)).toBe("1,234");
  });

  it("formats large numbers", () => {
    expect(formatNumber(1000000)).toBe("1,000,000");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats negative numbers", () => {
    expect(formatNumber(-5000)).toBe("-5,000");
  });
});
