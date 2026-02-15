import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScenarioDelta } from "../scenario-delta";
import { useScenario } from "@/context/scenario-context";

vi.mock("@/context/scenario-context", () => ({
  useScenario: vi.fn(),
}));

const mockUseScenario = useScenario as ReturnType<typeof vi.fn>;

/** Simple formatter for tests: prefixes with "£" and rounds to nearest integer */
function fmt(n: number): string {
  return `£${Math.round(n).toLocaleString()}`;
}

beforeEach(() => {
  mockUseScenario.mockReset();
});

describe("ScenarioDelta", () => {
  describe("when not in scenario mode", () => {
    beforeEach(() => {
      mockUseScenario.mockReturnValue({ isScenarioMode: false });
    });

    it("renders just the formatted scenario value", () => {
      render(
        <ScenarioDelta base={1000} scenario={1000} format={fmt} />
      );
      expect(screen.getByText("£1,000")).toBeInTheDocument();
      // No strikethrough or percentage should appear
      expect(screen.queryByText(/line-through/)).not.toBeInTheDocument();
    });

    it("renders the scenario value even when base and scenario differ", () => {
      render(
        <ScenarioDelta base={1000} scenario={2000} format={fmt} />
      );
      // Should show the scenario value, not the base
      expect(screen.getByText("£2,000")).toBeInTheDocument();
      // Should not show delta display since not in scenario mode
      expect(screen.queryByText("£1,000")).not.toBeInTheDocument();
    });
  });

  describe("when in scenario mode but values are the same", () => {
    beforeEach(() => {
      mockUseScenario.mockReturnValue({ isScenarioMode: true });
    });

    it("renders just the formatted value when base equals scenario", () => {
      render(
        <ScenarioDelta base={5000} scenario={5000} format={fmt} />
      );
      expect(screen.getByText("£5,000")).toBeInTheDocument();
      // No percentage shown for equal values
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it("renders just the formatted value when difference is within epsilon", () => {
      // Default epsilon is 0.50, so a 0.30 difference should be treated as "same"
      render(
        <ScenarioDelta base={1000} scenario={1000.3} format={fmt} />
      );
      // Both round to £1,000 with our formatter; only one should appear
      expect(screen.getByText("£1,000")).toBeInTheDocument();
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });
  });

  describe("when in scenario mode and values differ", () => {
    beforeEach(() => {
      mockUseScenario.mockReturnValue({ isScenarioMode: true });
    });

    it("renders strikethrough original and new value for an increase", () => {
      const { container } = render(
        <ScenarioDelta base={1000} scenario={1200} format={fmt} />
      );

      // The original value should be struck through
      const strikethrough = container.querySelector(".line-through");
      expect(strikethrough).not.toBeNull();
      expect(strikethrough!.textContent).toBe("£1,000");

      // The new value should also be present (not struck through)
      expect(screen.getByText("£1,200")).toBeInTheDocument();
    });

    it("renders strikethrough original and new value for a decrease", () => {
      const { container } = render(
        <ScenarioDelta base={2000} scenario={1500} format={fmt} />
      );

      const strikethrough = container.querySelector(".line-through");
      expect(strikethrough).not.toBeNull();
      expect(strikethrough!.textContent).toBe("£2,000");

      expect(screen.getByText("£1,500")).toBeInTheDocument();
    });

    it("shows positive percentage change", () => {
      render(
        <ScenarioDelta base={1000} scenario={1200} format={fmt} />
      );

      // +20.0% (pill badge format — no parentheses)
      expect(screen.getByText("+20.0%")).toBeInTheDocument();
    });

    it("shows negative percentage change", () => {
      render(
        <ScenarioDelta base={2000} scenario={1500} format={fmt} />
      );

      // (1500 - 2000) / |2000| * 100 = -25.0% (pill badge format — no parentheses)
      expect(screen.getByText("-25.0%")).toBeInTheDocument();
    });

    it("applies green color class for positive change", () => {
      const { container } = render(
        <ScenarioDelta base={1000} scenario={1500} format={fmt} />
      );

      const pctSpan = container.querySelector("[class*='text-emerald']");
      expect(pctSpan).not.toBeNull();
    });

    it("applies red color class for negative change", () => {
      const { container } = render(
        <ScenarioDelta base={1000} scenario={500} format={fmt} />
      );

      const pctSpan = container.querySelector("[class*='text-red']");
      expect(pctSpan).not.toBeNull();
    });

    it("hides percentage when showPercent is false", () => {
      render(
        <ScenarioDelta
          base={1000}
          scenario={1500}
          format={fmt}
          showPercent={false}
        />
      );

      // Strikethrough and new value should still appear
      expect(screen.getByText("£1,000")).toBeInTheDocument();
      expect(screen.getByText("£1,500")).toBeInTheDocument();

      // But no percentage
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });
  });

  describe("epsilon tolerance", () => {
    beforeEach(() => {
      mockUseScenario.mockReturnValue({ isScenarioMode: true });
    });

    it("treats values within default epsilon (0.50) as the same", () => {
      const { container } = render(
        <ScenarioDelta base={100} scenario={100.49} format={fmt} />
      );

      // Difference is 0.49 which is <= 0.50, so no delta display
      expect(container.querySelector(".line-through")).toBeNull();
    });

    it("treats values just beyond default epsilon as different", () => {
      const { container } = render(
        <ScenarioDelta base={100} scenario={100.51} format={fmt} />
      );

      // Difference is 0.51 which is > 0.50, so delta display should appear
      expect(container.querySelector(".line-through")).not.toBeNull();
    });

    it("respects custom epsilon", () => {
      const { container } = render(
        <ScenarioDelta
          base={100}
          scenario={105}
          format={fmt}
          epsilon={10}
        />
      );

      // Difference is 5 which is <= 10, so no delta display
      expect(container.querySelector(".line-through")).toBeNull();
    });

    it("shows delta when difference exceeds custom epsilon", () => {
      const { container } = render(
        <ScenarioDelta
          base={100}
          scenario={115}
          format={fmt}
          epsilon={10}
        />
      );

      // Difference is 15 which is > 10, so delta display should appear
      expect(container.querySelector(".line-through")).not.toBeNull();
    });
  });

  describe("base=0 edge case", () => {
    beforeEach(() => {
      mockUseScenario.mockReturnValue({ isScenarioMode: true });
    });

    it("does not show percentage when base is 0", () => {
      render(
        <ScenarioDelta base={0} scenario={500} format={fmt} />
      );

      // Should show strikethrough and new value
      expect(screen.getByText("£0")).toBeInTheDocument();
      expect(screen.getByText("£500")).toBeInTheDocument();

      // But no percentage (division by zero guard)
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it("does not show percentage when base is 0 even for negative scenario", () => {
      render(
        <ScenarioDelta base={0} scenario={-100} format={fmt} />
      );

      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });
  });
});
