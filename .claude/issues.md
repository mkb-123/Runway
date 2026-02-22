# Open Issues — Agent Team Review

> This file is maintained by the agent team. Review it at the start of every session.

---

## Bugs

### BUG-021: CGT rate is all-or-nothing (single rate based on total income) [LOW]

**Status:** OPEN
**Reported by:** Financial Advisor (Audit)
**Files:** `src/lib/cgt.ts`

The code applies a single CGT rate (basic or higher) based on total income, rather than splitting gains across the basic/higher rate bands. This is conservative — it overstates CGT for taxpayers near the basic rate boundary.

---

### BUG-022: Projection model uses inconsistent compounding (monthly vs annual) [LOW]

**Status:** OPEN
**Reported by:** Financial Advisor (Audit)
**Files:** `src/lib/projections.ts`

`projectCompoundGrowth` uses monthly compounding while `projectCompoundGrowthWithGrowingContributions` uses annual compounding. Results from these two functions are not directly comparable for the same inputs.

---

### BUG-023: Pension bridge does not account for investment growth [LOW]

**Status:** OPEN
**Reported by:** Financial Advisor (Audit)
**Files:** `src/lib/projections.ts`

The bridge calculation uses flat `years * annualSpend` without investment growth during the bridge period. Conservative but could overstate required bridge funding.

---

### BUG-024: Bed & ISA annualTaxSaved naming is misleading [LOW]

**Status:** OPEN
**Reported by:** Financial Advisor (Audit)
**Files:** `src/lib/cgt.ts`

The field name suggests an annual saving, but it actually represents the total CGT that would be payable on the full unrealised gain — a one-time crystallised avoidance, not an annual figure.

---

### BUG-026: Required pot does not account for tax on pension drawdown [MEDIUM]

**Status:** OPEN
**Reported by:** Financial Advisor (Audit)
**Files:** `src/lib/projections.ts`

`calculateRequiredPot(annualIncome, rate)` returns `annualIncome / rate` assuming gross = net. In reality, pension drawdown is taxed (25% PCLS tax-free, 75% at income tax rates). A £40k target income requires a larger gross drawdown (~£47k for basic rate taxpayers), meaning the required pot is understated by 15-20%.

---

### BUG-027: RNRB not capped at property value [MEDIUM]

**Status:** OPEN
**Reported by:** Financial Advisor (Audit)
**Files:** `src/lib/iht.ts`

The Residence Nil-Rate Band is applied at the full £175k per person regardless of actual property value. Per IHTA 1984 s.8FE, RNRB is limited to the lower of £175k and the property value passing to direct descendants. For a £150k property, the RNRB should be £150k, not £175k.

---

### BUG-028: IHT gift taper relief not modelled [MEDIUM]

**Status:** OPEN
**Reported by:** Financial Advisor (Audit)
**Files:** `src/lib/iht.ts`

Gifts within 7 years are applied in full against NRB. Per IHTA 1984 s.7(4), gifts 3-7 years old benefit from taper relief: 3-4yr = 80%, 4-5yr = 60%, 5-6yr = 40%, 6-7yr = 20% of the IHT rate. Current model overstates IHT for older gifts.

---

### BUG-029: Bed & ISA recommendation always uses higher CGT rate [MEDIUM]

**Status:** OPEN
**Reported by:** Financial Advisor (Audit)
**Files:** `src/lib/recommendations.ts`

`estimatedCGT = taxableGain * higherRate (24%)` regardless of the person's actual tax band. Basic rate taxpayers should use 18%. This overstates CGT cost for basic rate taxpayers.

---

### BUG-030: Relief at source not accounted for in CGT rate determination [LOW]

**Status:** OPEN
**Reported by:** Financial Advisor (Audit)
**Files:** `src/lib/cgt.ts`

`determineCgtRate` does not account for the basic rate band extension from relief at source pension contributions. Could incorrectly assign higher CGT rate to someone whose extended basic rate band covers their gains.

---

## Feature Requests

### FEAT-002: Add pension carry-forward rules [MEDIUM]

**Status:** OPEN
**Reported by:** Financial Advisor
**Files:** `src/lib/recommendations.ts`, `src/lib/tax-constants.ts`

Unused pension annual allowance from previous 3 tax years can be carried forward. The engine only checks current year's £60k. Clients with low prior contributions could have up to £180k additional headroom.

---

### FEAT-006: Dismissable recommendations with "done" state [LOW]

**Status:** OPEN
**Reported by:** HNW Customer (Sarah)
**Files:** `src/app/page.tsx`, `src/lib/recommendations.ts`

Once a recommendation is actioned, users should be able to mark it complete. Persist dismissed IDs in localStorage.

---

### FEAT-007: Side-by-side scenario comparison [MEDIUM]

**Status:** OPEN
**Reported by:** HNW Customer (James)
**Files:** `src/context/scenario-context.tsx`

Save and compare multiple named scenarios side by side (e.g., "Current Plan" vs "Sarah Part-Time" vs "Market Crash + Part-Time").

---

### FEAT-015: Surplus income not reinvested in lifetime cashflow [LOW]

**Status:** OPEN
**Reported by:** Devil's Advocate (Round 5)
**Files:** `src/lib/lifetime-cashflow.ts`

When total income exceeds expenditure, the surplus is reported but not reinvested into accessible wealth. In reality, surplus cash would accumulate and grow. This means the model understates wealth in later years.

---

### FEAT-016: Pension contributions don't grow with salary [LOW]

**Status:** OPEN
**Reported by:** Devil's Advocate (Round 5)
**Files:** `src/lib/lifetime-cashflow.ts`

Employment pension contributions are fixed at today's amount even when salaryGrowthRate is set. If salary grows 3%/yr, pension contributions should also grow proportionally (especially for salary sacrifice where the contribution is usually a % of salary).

---

### FEAT-017: Lifestyle spending not inflation-adjusted in lifetime cashflow [LOW]

**Status:** OPEN
**Reported by:** Devil's Advocate (Round 5)
**Files:** `src/lib/lifetime-cashflow.ts`

`monthlyLifestyleSpending * 12` is constant across all years. Committed outgoings support per-item `inflationRate`, but lifestyle spending has no inflation adjustment. Over 30+ years this significantly understates expenditure.

---

### FEAT-018: Cash runway metric not person-view filtered [LOW]

**Status:** OPEN
**Reported by:** QA Engineer (Round 5)
**Files:** `src/app/page.tsx`, `src/lib/cash-flow.ts`

The `calculateCashRunway` function uses all household accounts regardless of person-view selection. When viewing a single person's dashboard, cash runway should reflect only that person's liquid assets.

---

### FEAT-019: Saved scenario descriptions and preview [MEDIUM]

**Status:** OPEN
**Reported by:** HNW Customer (James), HNW Customer (Priya)
**Files:** `src/context/scenario-context.tsx`, `src/components/scenario-panel.tsx`

Saved scenarios show only the name (e.g. "Custom Scenario") with no description of what changed. Auto-generate a human-readable summary from `ScenarioOverrides` (e.g. "Tom salary: £80k → £30k, Market: -30%"). Show impact preview (net worth delta) without needing to fully load the scenario.

---

### FEAT-020: Life-stage dashboard metrics (school fees, pension bridge, next bonus) [MEDIUM]

**Status:** OPEN
**Reported by:** HNW Customer (James), HNW Customer (Priya)
**Files:** `src/app/page.tsx`, `src/types/index.ts`

Expand `HeroMetricType` with life-stage-appropriate metrics:
- **School fee countdown** — years until last child finishes (Priya)
- **Next income event** — next bonus vesting date and amount (Priya)
- **Pension bridge gap** — years of accessible savings needed before pension access (James)
- **Per-person retirement countdown** — separate countdowns for each person (James)

---

### FEAT-021: Scenario-aware recommendations diff [MEDIUM]

**Status:** OPEN
**Reported by:** HNW Customer (James), HNW Customer (Priya)
**Files:** `src/app/page.tsx`, `src/lib/recommendations.ts`

When a scenario is applied, the recommendations engine already re-runs against scenario data (line 384-387 of page.tsx). But there is no visual diff between base and scenario recommendations. Add "New in this scenario" / "Resolved by this scenario" badges to show which recommendations changed and why.

---

### FEAT-022: Multi-year time-phased scenarios [HIGH]

**Status:** OPEN
**Reported by:** HNW Customer (James), HNW Customer (Priya)
**Files:** `src/context/scenario-context.tsx`, `src/lib/scenario.ts`

Scenarios are static snapshots — overrides apply to current data instantly with no concept of time. James wants "retire at 57, keep saving until then, then draw down." Priya wants "Tom earns 30k for 2 years then recovers." Needs a scenario timeline allowing overrides at specific dates or age milestones.

---
