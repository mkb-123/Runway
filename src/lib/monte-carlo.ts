// ============================================================
// Monte Carlo Simulation for Net Worth Projections
// ============================================================
// Runs N random-walk simulations using log-normal annual returns
// to produce probability bands (percentiles) for net worth over time.
//
// Uses a seeded PRNG for deterministic results (same inputs → same output).

// ============================================================
// Types
// ============================================================

export interface MonteCarloConfig {
  /** Current total portfolio value */
  currentValue: number;
  /** Annual contribution (constant in today's money) */
  annualContribution: number;
  /** Expected annual real return (geometric mean, e.g. 0.05 for 5%) */
  expectedReturn: number;
  /** Annual return standard deviation (e.g. 0.15 for 15%) */
  volatility: number;
  /** Number of years to project */
  years: number;
  /** Number of simulation runs (default 1000) */
  runs?: number;
  /** Percentiles to compute (default [10, 25, 50, 75, 90]) */
  percentiles?: number[];
}

export interface MonteCarloYearResult {
  year: number;
  percentiles: Record<number, number>;
  mean: number;
}

export interface MonteCarloResult {
  timeline: MonteCarloYearResult[];
  /** Probability of reaching the target (if provided) */
  probabilityOfSuccess?: number;
  config: MonteCarloConfig;
}

// ============================================================
// Seeded PRNG (Mulberry32)
// ============================================================

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform for normal distribution from uniform
function normalRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
}

// ============================================================
// Simulation
// ============================================================

/**
 * Run Monte Carlo simulation for net worth projection.
 *
 * Models annual returns as log-normal: each year's return is
 * drawn from N(μ, σ²) where μ and σ are the expected return
 * and volatility. This properly handles the multiplicative
 * nature of investment returns.
 *
 * Returns percentile bands for each year.
 */
export function runMonteCarloSimulation(config: MonteCarloConfig): MonteCarloResult {
  const {
    currentValue,
    annualContribution,
    expectedReturn,
    volatility,
    years,
    runs = 1000,
    percentiles = [10, 25, 50, 75, 90],
  } = config;

  // Convert expected arithmetic return to log-normal parameters
  // If expectedReturn is the arithmetic mean, the log-normal mu is:
  // mu = ln(1 + E[r]) - sigma^2/2
  const logMu = Math.log(1 + expectedReturn) - (volatility * volatility) / 2;
  const logSigma = volatility;

  const rng = mulberry32(42); // deterministic seed

  // Run simulations: each run produces a path of portfolio values
  // We store final values by year for percentile calculation
  const yearValues: number[][] = Array.from({ length: years + 1 }, () => []);

  for (let run = 0; run < runs; run++) {
    let value = currentValue;
    yearValues[0].push(value);

    for (let year = 1; year <= years; year++) {
      // Draw a random annual return from log-normal distribution
      const z = normalRandom(rng);
      const logReturn = logMu + logSigma * z;
      const annualReturn = Math.exp(logReturn) - 1;

      // Apply return and contribution
      value = value * (1 + annualReturn) + annualContribution;
      if (value < 0) value = 0;

      yearValues[year].push(value);
    }
  }

  // Compute percentiles for each year
  const timeline: MonteCarloYearResult[] = yearValues.map((values, year) => {
    values.sort((a, b) => a - b);
    const n = values.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;

    const pctMap: Record<number, number> = {};
    for (const p of percentiles) {
      const idx = Math.min(Math.floor((p / 100) * n), n - 1);
      pctMap[p] = Math.round(values[idx]);
    }

    return { year, percentiles: pctMap, mean: Math.round(mean) };
  });

  return { timeline, config };
}

/**
 * Compute the probability of the portfolio exceeding a target value
 * at a specific year.
 */
export function computeSuccessProbability(
  config: MonteCarloConfig,
  targetValue: number,
  atYear?: number
): number {
  const {
    currentValue,
    annualContribution,
    expectedReturn,
    volatility,
    years,
    runs = 1000,
  } = config;

  const checkYear = atYear ?? years;
  const logMu = Math.log(1 + expectedReturn) - (volatility * volatility) / 2;
  const logSigma = volatility;
  const rng = mulberry32(42);

  let successes = 0;

  for (let run = 0; run < runs; run++) {
    let value = currentValue;

    for (let year = 1; year <= checkYear; year++) {
      const z = normalRandom(rng);
      const logReturn = logMu + logSigma * z;
      const annualReturn = Math.exp(logReturn) - 1;
      value = value * (1 + annualReturn) + annualContribution;
      if (value < 0) value = 0;
    }

    if (value >= targetValue) successes++;
  }

  return successes / runs;
}
