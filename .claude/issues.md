# Open Issues — Agent Team Review

> This file is maintained by the agent team. Review it at the start of every session.
> Mark issues as `[CLOSED]` when resolved. Do not delete — keep for audit trail.

---

## Bugs

### BUG-001: Scenario banner shows on all pages but only 2 pages use scenario data [CLOSED]

**Status:** CLOSED
**Reported by:** UX Designer, Devil's Advocate
**Resolved:** All pages now use `useScenarioData()` — projections, income, tax-planning, iht, cashflow all scenario-aware.

---

### BUG-002: Retirement page NaN% and Infinity when income or withdrawal rate is zero [CLOSED]

**Status:** CLOSED
**Reported by:** Devil's Advocate
**Resolved:** `savingsRate` guarded with `totalGrossIncome > 0`, `calculateRequiredPot` returns 0 when `rate <= 0`, `progressPercent` guarded with `requiredPot > 0`.

---

### BUG-003: Income timeline grows pots before drawdown, overstating retirement income [CLOSED]

**Status:** CLOSED
**Reported by:** Charting Expert, Financial Advisor
**Resolved:** `retirement-income-timeline.tsx` now uses draw-first-then-grow pattern: `draw = min(share, pot); pot -= draw; pot *= (1 + rate)`.

---

### BUG-004: State pension capped to remainingNeed hides real entitlement [CLOSED]

**Status:** CLOSED
**Reported by:** Charting Expert
**Resolved:** State pension paid in full without `Math.min` cap. Total income can exceed target (showing surplus).

---

### BUG-005: First-person priority bias in drawdown ordering [CLOSED]

**Status:** CLOSED
**Reported by:** Charting Expert, Devil's Advocate
**Resolved:** Proportional drawdown across persons based on pot size ratio for both pension and ISA/savings.

---

### BUG-006: Scenario panel Sheet width overflows on 375px mobile screens [CLOSED]

**Status:** CLOSED
**Reported by:** UX Designer
**Resolved:** Replaced `w-96` with responsive `w-full sm:max-w-[420px]` and bottom sheet on mobile.

---

### BUG-007: No htmlFor/id linkage on scenario panel form inputs [CLOSED]

**Status:** CLOSED
**Reported by:** UX Designer
**Resolved:** All Label/Input pairs now have unique `id` and `htmlFor` attributes, including RangeInput components.

---

### BUG-008: ISA recommendation has coverage gap (50%-99% remaining) [CLOSED]

**Status:** CLOSED
**Reported by:** Devil's Advocate, Financial Advisor
**Resolved:** ISA recommendation triggers for any `isaRemaining > 0` — no gap between unused/partially-used.

---

### BUG-009: Bed & ISA only recommended when gains < £3,000 CGT exempt amount [CLOSED]

**Status:** CLOSED
**Reported by:** Financial Advisor
**Resolved:** Two branches: zero-cost for gains within exempt amount, CGT-cost analysis for gains above.

---

### BUG-010: Emergency fund check excludes Cash ISA and Premium Bonds [CLOSED]

**Status:** CLOSED
**Reported by:** Devil's Advocate, Financial Advisor
**Resolved:** Filter now includes `cash_savings`, `cash_isa`, and `premium_bonds`.

---

### BUG-011: Drawdown chart uses requiredPot not currentPot as starting value [CLOSED]

**Status:** CLOSED
**Reported by:** Financial Advisor
**Resolved:** Drawdown chart now uses `projectedPotAtRetirement` — current pot projected forward with contributions and growth.

---

### BUG-012: Drawdown chart uses full state pension ignoring NI qualifying years [CLOSED]

**Status:** CLOSED
**Reported by:** Financial Advisor
**Resolved:** Uses `primaryStatePensionAnnual` calculated via `calculateProRataStatePension(niQualifyingYears)`.

---

### BUG-013: Scenario panel prevents modelling zero income (redundancy) [CLOSED]

**Status:** CLOSED
**Reported by:** Devil's Advocate
**Resolved:** Income overrides now allow `grossSalary >= 0` for redundancy scenarios.

---

### BUG-014: Recommendation badge row overflows on mobile (no flex-wrap) [CLOSED]

**Status:** CLOSED
**Reported by:** UX Designer
**Resolved:** Badge container uses `flex flex-wrap items-center gap-2`.

---

### BUG-015: Retirement income timeline chart has no accessible text alternative [CLOSED]

**Status:** CLOSED
**Reported by:** UX Designer
**Resolved:** Chart container has `role="img"` and descriptive `aria-label` summarising timeline and shortfall status.

---

### BUG-016: Monotone interpolation creates misleading smooth curves for annual data [CLOSED]

**Status:** CLOSED
**Reported by:** Charting Expert
**Resolved:** All areas use `type="stepAfter"` for accurate discrete annual representation.

---

### BUG-017: Shortfall stacked with income visually reaches the target line — misleading [CLOSED]

**Status:** CLOSED
**Reported by:** Charting Expert, Devil's Advocate
**Resolved:** Shortfall uses separate `stackId="shortfall"` with dashed stroke and low opacity — visually distinct from income.

---

---

## Feature Requests

### FEAT-001: Missing pension tapered annual allowance [CLOSED]

**Status:** CLOSED
**Reported by:** Financial Advisor
**Resolved:** `calculateTaperedAnnualAllowance()` in `projections.ts` implements HMRC taper rules. Used in recommendations, tax-planning page, and scenario panel. Constants: threshold income £200k, adjusted income £260k, taper rate 1:2, minimum £10k.

---

### FEAT-002: Add pension carry-forward rules [MEDIUM]

**Status:** OPEN
**Reported by:** Financial Advisor
**Files:** `src/lib/recommendations.ts`, `src/lib/tax-constants.ts`

Unused pension annual allowance from previous 3 tax years can be carried forward. The engine only checks current year's £60k. Clients with low prior contributions could have up to £180k additional headroom.

---

### FEAT-003: Retirement age slider on income timeline [CLOSED]

**Status:** CLOSED
**Reported by:** HNW Customer (James), Devil's Advocate
**Resolved:** `ScenarioControls` component provides retirement age slider on the retirement page, updating charts in real-time.

---

### FEAT-004: Growth rate toggle on income timeline [CLOSED]

**Status:** CLOSED
**Reported by:** HNW Customer (James)
**Resolved:** `ScenarioControls` component provides growth rate toggle between all configured scenario rates.

---

### FEAT-005: Recommendations link to relevant pages [CLOSED]

**Status:** CLOSED
**Reported by:** HNW Customer (Sarah)
**Resolved:** All recommendations include `actionUrl` and `plainAction` fields. Dashboard renders links to relevant pages.

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

### FEAT-008: Vertical reference lines for pension access and state pension ages [CLOSED]

**Status:** CLOSED
**Reported by:** Charting Expert
**Resolved:** Reference lines added at pension access and state pension ages, deduplicated by age.

---

### FEAT-009: Colourblind-safe chart palette with pattern fills [CLOSED]

**Status:** CLOSED
**Reported by:** UX Designer, Charting Expert
**Resolved:** Increased hue separation with 7-colour palette (blue, violet, green, gold, cyan, pink, red) and distinct semantic colours per income source type.

---

### FEAT-010: Missing disclaimers on retirement projections [CLOSED]

**Status:** CLOSED
**Reported by:** Financial Advisor
**Resolved:** Disclaimer at bottom of retirement page: "Capital at risk — projections are illustrative only and do not constitute financial advice. Figures are shown in today's money with no inflation adjustment."

---

### FEAT-011: Y-axis label missing on income timeline chart [CLOSED]

**Status:** CLOSED
**Reported by:** Charting Expert
**Resolved:** Y-axis has `label={{ value: "Annual Income (£)", angle: -90, position: "insideLeft" }}`.

---

### FEAT-012: Tooltip shows zero-value series as noise [CLOSED]

**Status:** CLOSED
**Reported by:** Charting Expert
**Resolved:** Tooltip formatter returns `[null, null]` for zero values, filtering them from display.

---

### FEAT-013: Salary sacrifice recommendation ignores actual pension method [CLOSED]

**Status:** CLOSED
**Reported by:** Devil's Advocate
**Resolved:** `analyzeSalaryTaper` checks `pensionContributionMethod` and adapts title/description/plainAction accordingly.

---

### FEAT-014: Conflicting ISA recommendations can exceed ISA allowance [CLOSED]

**Status:** CLOSED
**Reported by:** Devil's Advocate
**Resolved:** ISA top-up recommendation claims remaining allowance first; Bed & ISA only uses what's left (preventing combined recommendations from exceeding £20k).

---
