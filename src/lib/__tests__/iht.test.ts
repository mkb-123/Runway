import { describe, it, expect } from "vitest";
import {
  calculateEffectiveNRB,
  calculateRnrbTaperReduction,
  calculateEffectiveRNRB,
  calculateIHT,
  calculateYearsUntilIHTExceeded,
  yearsSince,
} from "../iht";

describe("IHT Calculations", () => {
  // --- Effective NRB ---

  describe("calculateEffectiveNRB", () => {
    it("returns full NRB for single person with no gifts", () => {
      expect(calculateEffectiveNRB(325_000, 1, 0)).toBe(325_000);
    });

    it("returns double NRB for couple with no gifts", () => {
      expect(calculateEffectiveNRB(325_000, 2, 0)).toBe(650_000);
    });

    it("reduces NRB by gifts within 7 years", () => {
      expect(calculateEffectiveNRB(325_000, 1, 100_000)).toBe(225_000);
    });

    it("floors NRB at zero when gifts exceed full band", () => {
      expect(calculateEffectiveNRB(325_000, 1, 400_000)).toBe(0);
    });

    it("reduces couple NRB correctly", () => {
      expect(calculateEffectiveNRB(325_000, 2, 500_000)).toBe(150_000);
    });
  });

  // --- RNRB Taper Reduction ---

  describe("calculateRnrbTaperReduction", () => {
    it("returns 0 when estate is at or below threshold", () => {
      expect(calculateRnrbTaperReduction(2_000_000)).toBe(0);
      expect(calculateRnrbTaperReduction(1_500_000)).toBe(0);
    });

    it("returns 0 for estate exactly at £2,000,000", () => {
      expect(calculateRnrbTaperReduction(2_000_000)).toBe(0);
    });

    // Devil's Advocate kill question: estate of £2,000,001
    it("returns £0 reduction for estate of £2,000,001 (£1 over, floor of 0.5 = 0)", () => {
      expect(calculateRnrbTaperReduction(2_000_001)).toBe(0);
    });

    it("returns £1 reduction for estate of £2,000,002", () => {
      expect(calculateRnrbTaperReduction(2_000_002)).toBe(1);
    });

    it("returns £175,000 reduction (full RNRB taper) for estate of £2,350,000", () => {
      // (2,350,000 - 2,000,000) / 2 = 175,000
      expect(calculateRnrbTaperReduction(2_350_000)).toBe(175_000);
    });

    it("returns correct reduction for estate of £2,500,000", () => {
      // (2,500,000 - 2,000,000) / 2 = 250,000
      expect(calculateRnrbTaperReduction(2_500_000)).toBe(250_000);
    });

    it("handles odd amounts correctly with floor", () => {
      // (2,000,003 - 2,000,000) / 2 = 1.5, floor = 1
      expect(calculateRnrbTaperReduction(2_000_003)).toBe(1);
    });

    it("uses custom threshold when provided", () => {
      expect(calculateRnrbTaperReduction(1_000_000, 800_000)).toBe(100_000);
    });
  });

  // --- Effective RNRB ---

  describe("calculateEffectiveRNRB", () => {
    it("returns full RNRB for single person under taper threshold", () => {
      expect(calculateEffectiveRNRB(175_000, 1, 1_500_000)).toBe(175_000);
    });

    it("returns double RNRB for couple under taper threshold", () => {
      expect(calculateEffectiveRNRB(175_000, 2, 1_800_000)).toBe(350_000);
    });

    it("returns 0 when not passing to descendants", () => {
      expect(calculateEffectiveRNRB(0, 2, 1_000_000)).toBe(0);
    });

    it("fully tapers RNRB for estate of £2,350,000 (single)", () => {
      // Taper: (2,350,000 - 2,000,000) / 2 = 175,000
      // 175,000 - 175,000 = 0
      expect(calculateEffectiveRNRB(175_000, 1, 2_350_000)).toBe(0);
    });

    it("partially tapers RNRB for couple at £2,200,000", () => {
      // Taper: (2,200,000 - 2,000,000) / 2 = 100,000
      // Couple RNRB: 175,000 * 2 = 350,000
      // 350,000 - 100,000 = 250,000
      expect(calculateEffectiveRNRB(175_000, 2, 2_200_000)).toBe(250_000);
    });

    it("floors RNRB at zero when taper exceeds gross RNRB", () => {
      // Taper: (3,000,000 - 2,000,000) / 2 = 500,000
      // Single RNRB: 175,000 - 500,000 = -325,000, floored to 0
      expect(calculateEffectiveRNRB(175_000, 1, 3_000_000)).toBe(0);
    });
  });

  // --- Full IHT Calculation ---

  describe("calculateIHT", () => {
    it("returns zero liability for small estate under NRB", () => {
      const result = calculateIHT(300_000, 1, 0, true);
      expect(result.ihtLiability).toBe(0);
      expect(result.taxableAmount).toBe(0);
      expect(result.combinedThreshold).toBe(500_000); // 325k + 175k
    });

    it("calculates liability for estate over threshold (single, no gifts)", () => {
      // Estate: 600,000
      // NRB: 325,000, RNRB: 175,000 = 500,000
      // Taxable: 100,000 at 40% = 40,000
      const result = calculateIHT(600_000, 1, 0, true);
      expect(result.effectiveNRB).toBe(325_000);
      expect(result.effectiveRNRB).toBe(175_000);
      expect(result.combinedThreshold).toBe(500_000);
      expect(result.taxableAmount).toBe(100_000);
      expect(result.ihtLiability).toBe(40_000);
    });

    it("calculates liability for couple", () => {
      // Estate: 1,200,000
      // NRB: 650,000, RNRB: 350,000 = 1,000,000
      // Taxable: 200,000 at 40% = 80,000
      const result = calculateIHT(1_200_000, 2, 0, true);
      expect(result.combinedThreshold).toBe(1_000_000);
      expect(result.taxableAmount).toBe(200_000);
      expect(result.ihtLiability).toBe(80_000);
    });

    it("reduces NRB by gifts within 7 years", () => {
      // Estate: 800,000, Couple, Gifts: 200,000
      // NRB: 650,000 - 200,000 = 450,000
      // RNRB: 350,000 (no taper, estate under 2M)
      // Combined: 800,000
      // Taxable: 0
      const result = calculateIHT(800_000, 2, 200_000, true);
      expect(result.effectiveNRB).toBe(450_000);
      expect(result.effectiveRNRB).toBe(350_000);
      expect(result.combinedThreshold).toBe(800_000);
      expect(result.ihtLiability).toBe(0);
    });

    it("applies RNRB taper for estates over £2M", () => {
      // Estate: 2,350,000, Single, no gifts, passing to descendants
      // NRB: 325,000
      // RNRB taper: (2,350,000 - 2,000,000) / 2 = 175,000
      // RNRB: 175,000 - 175,000 = 0
      // Taxable: 2,350,000 - 325,000 = 2,025,000
      // IHT: 2,025,000 * 0.4 = 810,000
      const result = calculateIHT(2_350_000, 1, 0, true);
      expect(result.effectiveRNRB).toBe(0);
      expect(result.rnrbTaperReduction).toBe(175_000);
      expect(result.taxableAmount).toBe(2_025_000);
      expect(result.ihtLiability).toBe(810_000);
    });

    it("returns no RNRB when not passing to direct descendants", () => {
      const result = calculateIHT(600_000, 1, 0, false);
      expect(result.effectiveRNRB).toBe(0);
      expect(result.combinedThreshold).toBe(325_000);
      expect(result.taxableAmount).toBe(275_000);
      expect(result.ihtLiability).toBe(110_000);
    });

    it("handles edge case: zero estate", () => {
      const result = calculateIHT(0, 1, 0, true);
      expect(result.ihtLiability).toBe(0);
      expect(result.taxableAmount).toBe(0);
    });

    it("handles gifts exceeding full NRB", () => {
      // Single, gifts: 400,000 (exceeds 325k NRB)
      // NRB: 0 (floored)
      // Estate: 500,000, RNRB: 175,000
      // Taxable: 325,000 at 40% = 130,000
      const result = calculateIHT(500_000, 1, 400_000, true);
      expect(result.effectiveNRB).toBe(0);
      expect(result.effectiveRNRB).toBe(175_000);
      expect(result.taxableAmount).toBe(325_000);
      expect(result.ihtLiability).toBe(130_000);
    });
  });

  // --- Years Until IHT Exceeded ---

  describe("calculateYearsUntilIHTExceeded", () => {
    it("returns 0 when estate already exceeds threshold", () => {
      expect(calculateYearsUntilIHTExceeded(600_000, 500_000, 20_000)).toBe(0);
    });

    it("returns null when no savings flowing into estate", () => {
      expect(calculateYearsUntilIHTExceeded(300_000, 500_000, 0)).toBeNull();
    });

    it("calculates years correctly", () => {
      // Gap: 500,000 - 300,000 = 200,000
      // At 50,000/yr: 200,000 / 50,000 = 4 years
      expect(calculateYearsUntilIHTExceeded(300_000, 500_000, 50_000)).toBe(4);
    });

    it("rounds up to next year", () => {
      // Gap: 500,000 - 400,000 = 100,000
      // At 30,000/yr: 100,000 / 30,000 = 3.33, ceil = 4
      expect(calculateYearsUntilIHTExceeded(400_000, 500_000, 30_000)).toBe(4);
    });

    it("returns null for negative savings rate", () => {
      expect(calculateYearsUntilIHTExceeded(300_000, 500_000, -10_000)).toBeNull();
    });
  });

  // --- yearsSince ---

  describe("yearsSince", () => {
    it("calculates years since a date", () => {
      const refDate = new Date("2024-06-15");
      const result = yearsSince("2017-06-15", refDate);
      expect(result).toBeCloseTo(7.0, 0);
    });

    it("returns value less than 7 for recent gift", () => {
      const refDate = new Date("2024-06-15");
      const result = yearsSince("2020-01-01", refDate);
      expect(result).toBeGreaterThan(4);
      expect(result).toBeLessThan(5);
    });

    it("returns value greater than 7 for old gift", () => {
      const refDate = new Date("2024-06-15");
      const result = yearsSince("2015-01-01", refDate);
      expect(result).toBeGreaterThan(9);
    });
  });
});
