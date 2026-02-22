import { describe, it, expect } from "vitest";
import {
  estimatePensionWithdrawalTax,
  calculateGrossPensionWithdrawal,
  buildIncomeTimeline,
  buildDrawdownData,
} from "@/lib/retirement";

describe("estimatePensionWithdrawalTax", () => {
  it("returns 0 for zero withdrawal", () => {
    expect(estimatePensionWithdrawalTax(0)).toBe(0);
  });

  it("returns 0 for negative withdrawal", () => {
    expect(estimatePensionWithdrawalTax(-1000)).toBe(0);
  });

  it("calculates tax on pension withdrawal with 25% PCLS tax-free", () => {
    // £20k withdrawal: £5k tax-free (25%), £15k taxable
    // £15k taxable income — within personal allowance (£12,570)
    // Tax on £15k = (£15k - £12,570) * 0.20 = £486
    const tax = estimatePensionWithdrawalTax(20_000);
    expect(tax).toBeGreaterThan(0);
    expect(tax).toBeLessThan(20_000 * 0.45); // Can't exceed 45%
  });

  it("accounts for other income (state pension) when calculating tax", () => {
    const taxWithOtherIncome = estimatePensionWithdrawalTax(30_000, 11_502);
    const taxWithoutOtherIncome = estimatePensionWithdrawalTax(30_000, 0);
    // Having other income pushes you into higher bands
    expect(taxWithOtherIncome).toBeGreaterThan(taxWithoutOtherIncome);
  });

  it("handles high-income scenario correctly", () => {
    const tax = estimatePensionWithdrawalTax(100_000, 11_502);
    // 75% of £100k = £75k taxable + £11.5k state pension = £86.5k total
    // Should include some higher-rate tax
    expect(tax).toBeGreaterThan(10_000);
  });
});

describe("calculateGrossPensionWithdrawal", () => {
  it("returns 0 for zero target net", () => {
    expect(calculateGrossPensionWithdrawal(0)).toBe(0);
  });

  it("returns more than target net (must gross up for tax)", () => {
    const gross = calculateGrossPensionWithdrawal(40_000);
    // For £40k net, gross must be >= £40k
    expect(gross).toBeGreaterThanOrEqual(40_000);
  });

  it("gives back approximately the target net after tax", () => {
    const targetNet = 50_000;
    const gross = calculateGrossPensionWithdrawal(targetNet, 11_502);
    const tax = estimatePensionWithdrawalTax(gross, 11_502);
    const actualNet = gross - tax;
    expect(Math.abs(actualNet - targetNet)).toBeLessThan(10);
  });

  it("grosses up more when there is higher other income", () => {
    const grossLow = calculateGrossPensionWithdrawal(30_000, 0);
    const grossHigh = calculateGrossPensionWithdrawal(30_000, 50_000);
    // Higher other income means higher marginal rate, so more gross-up needed
    expect(grossHigh).toBeGreaterThan(grossLow);
  });
});

describe("buildIncomeTimeline", () => {
  const basicPersons = [
    {
      name: "Alice",
      pensionAccessAge: 57,
      stateRetirementAge: 67,
      pensionPot: 500_000,
      accessibleWealth: 200_000,
      statePensionAnnual: 11_502,
    },
  ];

  it("produces data points from retirement age to end age", () => {
    const data = buildIncomeTimeline(basicPersons, 40_000, 55, 95, 0.05);
    expect(data).toHaveLength(41); // 55 to 95 inclusive
    expect(data[0].age).toBe(55);
    expect(data[data.length - 1].age).toBe(95);
  });

  it("state pension starts only at state retirement age", () => {
    const data = buildIncomeTimeline(basicPersons, 40_000, 55, 70, 0.05);
    // Before age 67: no state pension
    const atAge60 = data.find((d) => d.age === 60)!;
    expect(atAge60["Alice State Pension"]).toBe(0);
    // At age 67+: state pension active
    const atAge67 = data.find((d) => d.age === 67)!;
    expect(atAge67["Alice State Pension"]).toBeGreaterThan(0);
  });

  it("pension drawdown starts only at pension access age", () => {
    const data = buildIncomeTimeline(basicPersons, 40_000, 55, 70, 0.05);
    // Before age 57: no pension drawdown
    const atAge56 = data.find((d) => d.age === 56)!;
    expect(atAge56["Alice Pension"]).toBe(0);
    // At age 57+: pension drawdown active
    const atAge57 = data.find((d) => d.age === 57)!;
    expect(atAge57["Alice Pension"]).toBeGreaterThan(0);
  });

  it("uses ISA/Savings to bridge the gap before pension access", () => {
    const data = buildIncomeTimeline(basicPersons, 40_000, 55, 70, 0.05);
    const atAge55 = data.find((d) => d.age === 55)!;
    // At 55: no pension, no state pension, so ISA must cover all
    expect(atAge55["Alice ISA/Savings"]).toBeGreaterThan(0);
  });

  it("records shortfall when income is insufficient", () => {
    const poorPersons = [{
      ...basicPersons[0],
      pensionPot: 10_000,
      accessibleWealth: 5_000,
    }];
    const data = buildIncomeTimeline(poorPersons, 40_000, 55, 95, 0.05);
    // Eventually money runs out
    const hasShortfall = data.some((d) => d["Shortfall"] > 0);
    expect(hasShortfall).toBe(true);
  });

  it("proportionally splits drawdown across two persons", () => {
    const twoPersons = [
      { ...basicPersons[0], pensionPot: 300_000 },
      {
        name: "Bob",
        pensionAccessAge: 57,
        stateRetirementAge: 67,
        pensionPot: 100_000,
        accessibleWealth: 50_000,
        statePensionAnnual: 11_502,
      },
    ];
    const data = buildIncomeTimeline(twoPersons, 40_000, 57, 58, 0.05);
    const point = data[0];
    // Alice has 75% of total pension, Bob has 25%
    const aliceDraw = point["Alice Pension"];
    const bobDraw = point["Bob Pension"];
    // Alice should draw roughly 3x what Bob draws
    if (aliceDraw > 0 && bobDraw > 0) {
      expect(aliceDraw / bobDraw).toBeCloseTo(3, 0);
    }
  });
});

describe("buildDrawdownData", () => {
  it("produces data points from retirement age to end age", () => {
    const data = buildDrawdownData(1_000_000, 40_000, 60, 95, [0.05], 67, 11_502);
    expect(data).toHaveLength(36); // 60 to 95 inclusive
    expect(data[0].age).toBe(60);
    expect(data[data.length - 1].age).toBe(95);
  });

  it("pot depletes over time with withdrawals", () => {
    const data = buildDrawdownData(500_000, 40_000, 60, 95, [0.04], 67, 11_502);
    const firstPot = data[0]["4%"];
    const lastPot = data[data.length - 1]["4%"];
    expect(lastPot).toBeLessThan(firstPot);
  });

  it("state pension reduces withdrawal from pot after state pension age", () => {
    // Without state pension (age=99 so it never kicks in)
    const withoutSP = buildDrawdownData(500_000, 40_000, 60, 70, [0.04], 99, 11_502, false);
    // With state pension starting at 67
    const withSP = buildDrawdownData(500_000, 40_000, 60, 70, [0.04], 67, 11_502, false);
    // At age 70, pot should be higher with state pension
    const potWithoutSP = withoutSP.find((d) => d.age === 70)!["4%"];
    const potWithSP = withSP.find((d) => d.age === 70)!["4%"];
    expect(potWithSP).toBeGreaterThan(potWithoutSP);
  });

  it("higher growth rate preserves more pot", () => {
    const data = buildDrawdownData(1_000_000, 40_000, 60, 95, [0.03, 0.07], 67, 11_502, false);
    const lastPoint = data[data.length - 1];
    expect(lastPoint["7%"]).toBeGreaterThan(lastPoint["3%"]);
  });

  it("tax-aware mode depletes pot faster than non-tax mode", () => {
    const withTax = buildDrawdownData(500_000, 40_000, 60, 80, [0.05], 67, 11_502, true);
    const withoutTax = buildDrawdownData(500_000, 40_000, 60, 80, [0.05], 67, 11_502, false);
    const potWithTax = withTax.find((d) => d.age === 75)!["5%"];
    const potWithoutTax = withoutTax.find((d) => d.age === 75)!["5%"];
    // Tax-aware mode should deplete faster (withdrawing more gross for same net)
    expect(potWithTax).toBeLessThan(potWithoutTax);
  });

  it("pot never goes negative", () => {
    const data = buildDrawdownData(100_000, 80_000, 60, 95, [0.02], 67, 11_502, false);
    for (const point of data) {
      expect(point["2%"]).toBeGreaterThanOrEqual(0);
    }
  });
});
