import { describe, it, expect } from "vitest";
import {
  parseEmmaCSV,
  analyzeEmmaSpending,
  toCommittedOutgoings,
  parseCSVRow,
  parseDate,
  parseAmount,
} from "../emma-import";

// ============================================================
// Unit tests: CSV row parsing
// ============================================================

describe("parseCSVRow", () => {
  it("splits simple comma-separated values", () => {
    expect(parseCSVRow("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCSVRow('"hello, world",b,c')).toEqual(["hello, world", "b", "c"]);
  });

  it("handles escaped quotes within quoted fields", () => {
    expect(parseCSVRow('"say ""hello""",b')).toEqual(['say "hello"', "b"]);
  });

  it("handles empty fields", () => {
    expect(parseCSVRow(",b,")).toEqual(["", "b", ""]);
  });

  it("handles single field", () => {
    expect(parseCSVRow("hello")).toEqual(["hello"]);
  });
});

// ============================================================
// Unit tests: Date parsing
// ============================================================

describe("parseDate", () => {
  it("parses ISO format YYYY-MM-DD", () => {
    expect(parseDate("2024-06-15")).toBe("2024-06-15");
  });

  it("parses UK format DD/MM/YYYY", () => {
    expect(parseDate("15/06/2024")).toBe("2024-06-15");
  });

  it("parses UK format with dashes DD-MM-YYYY", () => {
    expect(parseDate("15-06-2024")).toBe("2024-06-15");
  });

  it("parses UK short year DD/MM/YY", () => {
    expect(parseDate("15/06/24")).toBe("2024-06-15");
  });

  it("pads single-digit day and month", () => {
    expect(parseDate("1/2/2024")).toBe("2024-02-01");
  });

  it("returns null for empty string", () => {
    expect(parseDate("")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseDate("not-a-date")).toBeNull();
  });

  it("handles short year >= 50 as 19xx", () => {
    expect(parseDate("01/01/99")).toBe("1999-01-01");
  });
});

// ============================================================
// Unit tests: Amount parsing
// ============================================================

describe("parseAmount", () => {
  it("parses simple positive number", () => {
    expect(parseAmount("123.45")).toBe(123.45);
  });

  it("parses negative number", () => {
    expect(parseAmount("-50.00")).toBe(-50);
  });

  it("strips pound sign", () => {
    expect(parseAmount("£1,234.56")).toBe(1234.56);
  });

  it("strips dollar sign", () => {
    expect(parseAmount("$100")).toBe(100);
  });

  it("strips euro sign", () => {
    expect(parseAmount("€99.99")).toBe(99.99);
  });

  it("handles parentheses for negatives", () => {
    expect(parseAmount("(50.00)")).toBe(-50);
  });

  it("handles thousands separators", () => {
    expect(parseAmount("1,234,567.89")).toBe(1234567.89);
  });

  it("returns null for empty string", () => {
    expect(parseAmount("")).toBeNull();
  });

  it("returns null for non-numeric", () => {
    expect(parseAmount("abc")).toBeNull();
  });

  it("handles zero", () => {
    expect(parseAmount("0")).toBe(0);
  });
});

// ============================================================
// Integration tests: CSV parsing
// ============================================================

describe("parseEmmaCSV", () => {
  it("parses a standard Emma CSV with headers", () => {
    const csv = [
      "Date,Amount,Description,Category,Account",
      "15/06/2024,-25.50,Tesco,Groceries,Barclays",
      "16/06/2024,-12.00,Netflix,Entertainment,Barclays",
      "17/06/2024,3000.00,Salary,Income,Barclays",
    ].join("\n");

    const result = parseEmmaCSV(csv);
    expect(result.transactions).toHaveLength(3);
    expect(result.warnings).toHaveLength(0);

    expect(result.transactions[0]).toEqual({
      date: "2024-06-15",
      amount: -25.5,
      description: "Tesco",
      category: "Groceries",
      account: "Barclays",
    });

    expect(result.dateRange).toEqual({
      from: "2024-06-15",
      to: "2024-06-17",
    });
  });

  it("parses minimal 3-column CSV (Date, Payment Reference, Amount)", () => {
    const csv = [
      "Date,Payment Reference,Amount",
      "2024-06-15,Tesco Superstore,-25.50",
      "2024-06-16,Monthly salary,3000.00",
    ].join("\n");

    const result = parseEmmaCSV(csv);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].description).toBe("Tesco Superstore");
    expect(result.transactions[0].amount).toBe(-25.5);
  });

  it("warns on unparseable dates and skips those rows", () => {
    const csv = [
      "Date,Amount,Description",
      "bad-date,-10,Something",
      "15/06/2024,-20,Valid",
    ].join("\n");

    const result = parseEmmaCSV(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Could not parse date");
  });

  it("warns on unparseable amounts and skips those rows", () => {
    const csv = [
      "Date,Amount,Description",
      "15/06/2024,abc,Something",
      "16/06/2024,-20,Valid",
    ].join("\n");

    const result = parseEmmaCSV(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes("Could not parse amount"))).toBe(true);
  });

  it("returns empty result for single-line file", () => {
    const result = parseEmmaCSV("Date,Amount,Description");
    expect(result.transactions).toHaveLength(0);
    expect(result.warnings).toContain("File has no data rows.");
  });

  it("handles quoted fields in CSV", () => {
    const csv = [
      "Date,Amount,Description",
      '15/06/2024,-25.50,"Tesco, Large Store"',
    ].join("\n");

    const result = parseEmmaCSV(csv);
    expect(result.transactions[0].description).toBe("Tesco, Large Store");
  });

  it("handles Windows line endings (CRLF)", () => {
    const csv = "Date,Amount,Description\r\n15/06/2024,-25.50,Tesco\r\n";
    const result = parseEmmaCSV(csv);
    expect(result.transactions).toHaveLength(1);
  });

  it("handles alternate column names", () => {
    const csv = [
      "Transaction Date,Value,Memo,Type,Account Name",
      "15/06/2024,-25.50,Tesco,Groceries,Barclays Current",
    ].join("\n");

    const result = parseEmmaCSV(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe("Tesco");
    expect(result.transactions[0].category).toBe("Groceries");
    expect(result.transactions[0].account).toBe("Barclays Current");
  });
});

// ============================================================
// Integration tests: Spending analysis
// ============================================================

describe("analyzeEmmaSpending", () => {
  it("returns zeros for empty transaction list", () => {
    const result = analyzeEmmaSpending([]);
    expect(result.monthlyTotal).toBe(0);
    expect(result.monthsCovered).toBe(0);
    expect(result.byCategory).toHaveLength(0);
  });

  it("calculates monthly averages from outgoings", () => {
    const transactions = [
      { date: "2024-01-15", amount: -100, description: "Shop", category: "Groceries", account: "" },
      { date: "2024-01-20", amount: -50, description: "Pub", category: "Entertainment", account: "" },
      { date: "2024-02-15", amount: -120, description: "Shop", category: "Groceries", account: "" },
      { date: "2024-02-20", amount: -60, description: "Pub", category: "Entertainment", account: "" },
      { date: "2024-01-25", amount: 3000, description: "Salary", category: "Income", account: "" },
    ];

    const result = analyzeEmmaSpending(transactions);
    expect(result.monthsCovered).toBe(2);
    // Total outgoings: 100 + 50 + 120 + 60 = 330, over 2 months = 165
    expect(result.monthlyTotal).toBe(165);
    expect(result.byCategory).toHaveLength(2);
    // Groceries: (100+120)/2 = 110
    expect(result.byCategory.find((c) => c.category === "Groceries")?.monthlyAverage).toBe(110);
  });

  it("ignores income transactions (positive amounts)", () => {
    const transactions = [
      { date: "2024-01-15", amount: 5000, description: "Salary", category: "Income", account: "" },
      { date: "2024-01-16", amount: -200, description: "Rent", category: "Housing", account: "" },
    ];

    const result = analyzeEmmaSpending(transactions);
    expect(result.monthlyTotal).toBe(200);
    expect(result.byCategory).toHaveLength(1);
    expect(result.byCategory[0].category).toBe("Housing");
  });

  it("detects recurring monthly payments", () => {
    // Netflix at ~£15/mo for 4 months
    const transactions = [
      { date: "2024-01-01", amount: -15.99, description: "Netflix", category: "Entertainment", account: "" },
      { date: "2024-02-01", amount: -15.99, description: "Netflix", category: "Entertainment", account: "" },
      { date: "2024-03-01", amount: -15.99, description: "Netflix", category: "Entertainment", account: "" },
      { date: "2024-04-01", amount: -15.99, description: "Netflix", category: "Entertainment", account: "" },
      // Random one-off
      { date: "2024-01-15", amount: -250, description: "Unique purchase", category: "Shopping", account: "" },
    ];

    const result = analyzeEmmaSpending(transactions);
    expect(result.suggestedOutgoings.length).toBeGreaterThanOrEqual(1);
    const netflix = result.suggestedOutgoings.find((o) =>
      o.label.toLowerCase().includes("netflix")
    );
    expect(netflix).toBeDefined();
    expect(netflix!.monthlyAmount).toBe(15.99);
  });

  it("classifies mortgage payments correctly", () => {
    const transactions = Array.from({ length: 6 }, (_, i) => ({
      date: `2024-0${i + 1}-01`,
      amount: -1500,
      description: "Mortgage Payment",
      category: "Housing",
      account: "",
    }));

    const result = analyzeEmmaSpending(transactions);
    const mortgage = result.suggestedOutgoings.find((o) =>
      o.label.toLowerCase().includes("mortgage")
    );
    expect(mortgage).toBeDefined();
    expect(mortgage!.category).toBe("mortgage");
    expect(mortgage!.monthlyAmount).toBe(1500);
  });

  it("classifies insurance payments correctly", () => {
    const transactions = Array.from({ length: 4 }, (_, i) => ({
      date: `2024-0${i + 1}-05`,
      amount: -45,
      description: "Car Insurance Direct Debit",
      category: "Bills",
      account: "",
    }));

    const result = analyzeEmmaSpending(transactions);
    const insurance = result.suggestedOutgoings.find((o) =>
      o.label.toLowerCase().includes("insurance")
    );
    expect(insurance).toBeDefined();
    expect(insurance!.category).toBe("insurance");
  });

  it("separates essential and lifestyle spending", () => {
    const transactions = [
      // Essential: groceries
      { date: "2024-01-10", amount: -200, description: "Tesco", category: "Groceries", account: "" },
      { date: "2024-02-10", amount: -220, description: "Tesco", category: "Groceries", account: "" },
      // Essential: transport
      { date: "2024-01-15", amount: -100, description: "Train", category: "Transport", account: "" },
      { date: "2024-02-15", amount: -100, description: "Train", category: "Transport", account: "" },
      // Lifestyle: entertainment
      { date: "2024-01-20", amount: -80, description: "Restaurant", category: "Eating out", account: "" },
      { date: "2024-02-20", amount: -60, description: "Cinema", category: "Entertainment", account: "" },
    ];

    const result = analyzeEmmaSpending(transactions);
    expect(result.monthlyEssentialExpenses).toBeGreaterThan(0);
    expect(result.monthlyLifestyleSpending).toBeGreaterThan(0);
    // Essential should include groceries + transport
    expect(result.monthlyEssentialExpenses).toBeGreaterThanOrEqual(300);
  });
});

// ============================================================
// Unit tests: toCommittedOutgoings conversion
// ============================================================

describe("toCommittedOutgoings", () => {
  it("converts suggestions to CommittedOutgoing shape", () => {
    const suggestions = [
      { label: "Netflix", monthlyAmount: 15.99, category: "other" as const, frequency: "monthly" as const },
      { label: "Mortgage Payment", monthlyAmount: 1500, category: "mortgage" as const, frequency: "monthly" as const },
    ];

    const result = toCommittedOutgoings(suggestions);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      category: "other",
      label: "Netflix",
      amount: 15.99,
      frequency: "monthly",
    });
    expect(result[1]).toEqual({
      category: "mortgage",
      label: "Mortgage Payment",
      amount: 1500,
      frequency: "monthly",
    });
  });

  it("returns empty array for empty input", () => {
    expect(toCommittedOutgoings([])).toEqual([]);
  });
});
