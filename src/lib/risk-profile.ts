// ============================================================
// Risk Profile — Questionnaire & Scoring Engine
// ============================================================
// Provides a standardised risk tolerance questionnaire and scoring
// algorithm. Each question maps to a 1–5 scale; the composite score
// determines a conservative / moderate / aggressive categorisation.

import type { RiskProfileAnswer, RiskToleranceLevel, RiskProfile } from "@/types";

// ============================================================
// Questionnaire definition
// ============================================================

export interface RiskProfileQuestionOption {
  value: number; // 1-5
  label: string;
}

export interface RiskProfileQuestion {
  id: string;
  text: string;
  options: RiskProfileQuestionOption[];
}

export const RISK_PROFILE_QUESTIONS: RiskProfileQuestion[] = [
  {
    id: "time_horizon",
    text: "How many years until you expect to need this money?",
    options: [
      { value: 1, label: "Less than 3 years" },
      { value: 2, label: "3–5 years" },
      { value: 3, label: "5–10 years" },
      { value: 4, label: "10–20 years" },
      { value: 5, label: "More than 20 years" },
    ],
  },
  {
    id: "market_drop",
    text: "If your portfolio dropped 20% in a month, what would you do?",
    options: [
      { value: 1, label: "Sell everything immediately" },
      { value: 2, label: "Sell some to limit losses" },
      { value: 3, label: "Hold and wait for recovery" },
      { value: 4, label: "Buy a little more at lower prices" },
      { value: 5, label: "Buy significantly more — great opportunity" },
    ],
  },
  {
    id: "return_vs_safety",
    text: "Which best describes your investment priority?",
    options: [
      { value: 1, label: "Preserving capital — I can't afford any losses" },
      { value: 2, label: "Mostly safe with small growth" },
      { value: 3, label: "Balanced — some risk for reasonable growth" },
      { value: 4, label: "Growth-focused — willing to accept volatility" },
      { value: 5, label: "Maximum growth — comfort with large swings" },
    ],
  },
  {
    id: "income_stability",
    text: "How stable is your household income?",
    options: [
      { value: 1, label: "Very unstable — irregular or self-employed" },
      { value: 2, label: "Somewhat unstable — variable bonuses/commissions" },
      { value: 3, label: "Stable with some variability" },
      { value: 4, label: "Very stable — secure employment" },
      { value: 5, label: "Multiple stable income sources" },
    ],
  },
  {
    id: "experience",
    text: "What is your experience with investing?",
    options: [
      { value: 1, label: "None — never invested" },
      { value: 2, label: "Limited — only cash savings and pensions" },
      { value: 3, label: "Some — ISAs and basic funds" },
      { value: 4, label: "Experienced — diverse portfolio" },
      { value: 5, label: "Very experienced — including alternative assets" },
    ],
  },
  {
    id: "max_drawdown",
    text: "What is the largest portfolio loss you could tolerate in a year?",
    options: [
      { value: 1, label: "5% or less" },
      { value: 2, label: "10%" },
      { value: 3, label: "20%" },
      { value: 4, label: "30%" },
      { value: 5, label: "40% or more" },
    ],
  },
];

// ============================================================
// Scoring
// ============================================================

const DRAWDOWN_MAP: Record<number, number> = {
  1: 0.05,
  2: 0.10,
  3: 0.20,
  4: 0.30,
  5: 0.40,
};

/**
 * Calculate risk profile score from questionnaire answers.
 * Pure function — no side effects.
 *
 * @returns overallScore (0-100), tolerance category, and maxDrawdownTolerance
 */
export function calculateRiskScore(answers: RiskProfileAnswer[]): {
  overallScore: number;
  tolerance: RiskToleranceLevel;
  maxDrawdownTolerance: number;
} {
  if (answers.length === 0) {
    return { overallScore: 0, tolerance: "moderate", maxDrawdownTolerance: 0.20 };
  }

  const maxPossible = answers.length * 5;
  const totalScore = answers.reduce((sum, a) => sum + a.answer, 0);
  const overallScore = Math.round((totalScore / maxPossible) * 100);

  const tolerance: RiskToleranceLevel =
    overallScore <= 33 ? "conservative"
      : overallScore <= 66 ? "moderate"
        : "aggressive";

  // Extract drawdown tolerance from the specific question
  const drawdownAnswer = answers.find((a) => a.questionId === "max_drawdown");
  const maxDrawdownTolerance = drawdownAnswer
    ? (DRAWDOWN_MAP[drawdownAnswer.answer] ?? 0.20)
    : 0.20;

  return { overallScore, tolerance, maxDrawdownTolerance };
}

/**
 * Build a complete RiskProfile from questionnaire answers.
 */
export function buildRiskProfile(answers: RiskProfileAnswer[]): RiskProfile {
  const { overallScore, tolerance, maxDrawdownTolerance } = calculateRiskScore(answers);
  return {
    answers,
    overallScore,
    tolerance,
    maxDrawdownTolerance,
    lastUpdated: new Date().toISOString(),
  };
}

export const RISK_TOLERANCE_LABELS: Record<RiskToleranceLevel, string> = {
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
};
