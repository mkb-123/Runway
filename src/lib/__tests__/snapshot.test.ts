// ============================================================
// Snapshot Tests — createAutoSnapshot pure function
// ============================================================

import { describe, it, expect } from "vitest";
import { createAutoSnapshot } from "@/context/data-context";
import { makeTestHousehold, makeEmptyHousehold, makeAccount } from "./test-fixtures";

describe("createAutoSnapshot", () => {
  it("creates a snapshot with correct date", () => {
    const household = makeTestHousehold();
    const date = new Date("2025-06-15T10:30:00Z");
    const snapshot = createAutoSnapshot(household, date);

    expect(snapshot.date).toBe("2025-06-15");
  });

  it("computes totalNetWorth as sum of all accounts", () => {
    const household = makeTestHousehold();
    const expectedTotal = household.accounts.reduce((s, a) => s + a.currentValue, 0);
    const snapshot = createAutoSnapshot(household, new Date());

    expect(snapshot.totalNetWorth).toBe(expectedTotal);
  });

  it("breaks down by person correctly", () => {
    const household = makeTestHousehold();
    const snapshot = createAutoSnapshot(household, new Date());

    const p1Total = household.accounts
      .filter((a) => a.personId === "p1")
      .reduce((s, a) => s + a.currentValue, 0);
    const p2Total = household.accounts
      .filter((a) => a.personId === "p2")
      .reduce((s, a) => s + a.currentValue, 0);

    const p1Entry = snapshot.byPerson.find((bp) => bp.personId === "p1");
    const p2Entry = snapshot.byPerson.find((bp) => bp.personId === "p2");

    expect(p1Entry).toBeDefined();
    expect(p1Entry!.value).toBe(p1Total);
    expect(p1Entry!.name).toBe("James");

    expect(p2Entry).toBeDefined();
    expect(p2Entry!.value).toBe(p2Total);
    expect(p2Entry!.name).toBe("Sarah");
  });

  it("breaks down by account type correctly", () => {
    const household = makeTestHousehold();
    const snapshot = createAutoSnapshot(household, new Date());

    // The test household has sipp, workplace_pension, stocks_and_shares_isa, cash_savings
    const sippTotal = household.accounts
      .filter((a) => a.type === "sipp")
      .reduce((s, a) => s + a.currentValue, 0);
    const sippEntry = snapshot.byType.find((bt) => bt.type === "sipp");
    expect(sippEntry).toBeDefined();
    expect(sippEntry!.value).toBe(sippTotal);
  });

  it("breaks down by tax wrapper correctly", () => {
    const household = makeTestHousehold();
    const snapshot = createAutoSnapshot(household, new Date());

    // Pension wrapper = sipp (800k) + workplace_pension (320k)
    const pensionEntry = snapshot.byWrapper.find((bw) => bw.wrapper === "pension");
    expect(pensionEntry).toBeDefined();
    expect(pensionEntry!.value).toBe(1120000);

    // ISA wrapper = stocks_and_shares_isa (200k)
    const isaEntry = snapshot.byWrapper.find((bw) => bw.wrapper === "isa");
    expect(isaEntry).toBeDefined();
    expect(isaEntry!.value).toBe(200000);

    // Cash wrapper = cash_savings (50k + 30k)
    const cashEntry = snapshot.byWrapper.find((bw) => bw.wrapper === "cash");
    expect(cashEntry).toBeDefined();
    expect(cashEntry!.value).toBe(80000);
  });

  it("returns empty arrays for household with no accounts", () => {
    const household = makeEmptyHousehold();
    const snapshot = createAutoSnapshot(household, new Date());

    expect(snapshot.totalNetWorth).toBe(0);
    expect(snapshot.byPerson).toEqual([]);
    expect(snapshot.byType).toEqual([]);
    expect(snapshot.byWrapper).toEqual([]);
  });

  it("rounds values to pence", () => {
    const household = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "cash_savings", currentValue: 100.005 }),
        makeAccount({ id: "a2", personId: "p1", type: "cash_savings", currentValue: 200.003 }),
      ],
    });
    const snapshot = createAutoSnapshot(household, new Date());

    // roundPence should handle floating point
    expect(snapshot.totalNetWorth).toBe(300.01);
    expect(snapshot.byPerson[0].value).toBe(300.01);
  });

  it("resolves person names from household", () => {
    const household = makeTestHousehold();
    const snapshot = createAutoSnapshot(household, new Date());

    const names = snapshot.byPerson.map((bp) => bp.name);
    expect(names).toContain("James");
    expect(names).toContain("Sarah");
  });

  it("falls back to personId when person not found", () => {
    const household = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a-orphan", personId: "unknown-person", type: "cash_savings", currentValue: 5000 }),
      ],
    });
    const snapshot = createAutoSnapshot(household, new Date());

    const entry = snapshot.byPerson.find((bp) => bp.personId === "unknown-person");
    expect(entry).toBeDefined();
    expect(entry!.name).toBe("unknown-person");
  });

  it("aggregates multiple accounts for same person", () => {
    const household = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 100000 }),
        makeAccount({ id: "a2", personId: "p1", type: "stocks_and_shares_isa", currentValue: 50000 }),
        makeAccount({ id: "a3", personId: "p1", type: "cash_savings", currentValue: 25000 }),
      ],
    });
    const snapshot = createAutoSnapshot(household, new Date());

    expect(snapshot.byPerson).toHaveLength(1);
    expect(snapshot.byPerson[0].value).toBe(175000);
    expect(snapshot.totalNetWorth).toBe(175000);
  });

  it("aggregates multiple account types into same wrapper", () => {
    const household = makeTestHousehold({
      accounts: [
        makeAccount({ id: "a1", personId: "p1", type: "sipp", currentValue: 100000 }),
        makeAccount({ id: "a2", personId: "p1", type: "workplace_pension", currentValue: 200000 }),
      ],
    });
    const snapshot = createAutoSnapshot(household, new Date());

    // Both are pension wrapper
    const pensionEntry = snapshot.byWrapper.find((bw) => bw.wrapper === "pension");
    expect(pensionEntry).toBeDefined();
    expect(pensionEntry!.value).toBe(300000);

    // But different types
    expect(snapshot.byType).toHaveLength(2);
    const sippEntry = snapshot.byType.find((bt) => bt.type === "sipp");
    const wpEntry = snapshot.byType.find((bt) => bt.type === "workplace_pension");
    expect(sippEntry!.value).toBe(100000);
    expect(wpEntry!.value).toBe(200000);
  });
});
