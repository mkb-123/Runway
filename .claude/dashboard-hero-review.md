# Dashboard Hero Page — Deep Dive Review

> Agent team review: 5 agents consulted (James, Priya, UX Designer, Devil's Advocate, QA Engineer).
> Date: 2026-02-22. **For review only — no implementation yet.**

---

## Summary: Top Recommendations (Consolidated)

The team surfaced **32 individual findings** across 5 agents. After de-duplication and synthesis, here are the **top recommendations** grouped by theme:

---

## REC-A: Replace Net Worth as Default Primary Metric — Show "Am I On Track?" Instead

**Raised by:** James, Priya, UX Designer
**Priority:** HIGH

**Problem:** The hero shows Net Worth as the primary metric. Both users say this is a vanity metric that answers no question.
- James (52): "Net worth of £1.8M means nothing without context. I want to know: will I have enough income in retirement — yes or no?"
- Priya (35): "Half my net worth is locked in pensions I can't touch for 22 years. My actual question is: am I going to run out of cash before the March tranche vests?"

**Recommendation:** The primary hero should show a **contextual status sentence** — not just a number, but a verdict:
- James: "Projected retirement income: £62k/yr vs £60k target — on track" (green)
- Priya: "Cash covers 11.2 months of committed outgoings" (with colour indicator)

The UX Designer suggests adding a single plain-English sentence below the primary metric: max 80 characters, semantic colour (green/amber/red). Converts the 3-second glance from "I see a number" to "I see a verdict."

**Also consider:** Default hero metric should be life-stage appropriate. Net Worth for accumulators, Projected Retirement Income for pre-retirees, Cash Runway for high-commitment households.

---

## REC-B: Remove Hardcoded FIRE Progress Bar — Make It Conditional / Life-Stage Aware

**Raised by:** Priya, Devil's Advocate, QA Engineer
**Priority:** HIGH

**Problem:** The FIRE progress bar is permanently embedded in the hero card regardless of user configuration. Three issues:
1. **Priya**: "Showing 18% FIRE progress permanently is depressing and irrelevant. My planning horizon is school fees for 14 more years, not early retirement."
2. **Devil's Advocate**: "If the user can configure 3 hero metrics, why is a 4th metric hardcoded? Who decided FIRE deserves permanent, unchallengeable real estate?"
3. **QA (Sam)**: "FIRE Progress is both hardcoded AND available as a configurable metric. If selected as secondary, it shows twice."

**Recommendation:** Make the sub-hero strip context-sensitive:
- Households with active school fees + constrained cash → "School Fee Funding Status" strip
- Pre-retirement users (within 10yr) → FIRE progress bar
- Or: let the user choose via dashboard config
- At minimum: suppress the hardcoded bar when `fire_progress` is already selected as a configurable metric.

---

## REC-C: Person Toggle Doesn't Work for Most Metrics — Fix or Remove

**Raised by:** QA Engineer (Sam), Devil's Advocate
**Priority:** HIGH (P1 data integrity)

**Problem:** The Person Toggle is prominently displayed in the header, but **10 of 14 hero metrics ignore it entirely**:

| Metric | Person-filtered? |
|--------|-----------------|
| Net Worth | YES |
| Cash Position | YES |
| FIRE Progress | YES |
| Cash Runway | YES |
| Retirement Countdown | **NO** |
| Savings Rate | **NO** |
| Period Change / YoY | **NO** |
| Projected Retirement Income | **NO** |
| Net Worth After Commitments | **NO** |
| School Fee Countdown | **NO** |
| Pension Bridge | **NO** |
| Per-Person Retirement | **NO** |

A user viewing "Sarah's" dashboard sees Sarah's net worth but the *household's* savings rate, retirement countdown, and projected retirement income. This is confusing and arguably a data integrity issue.

**Recommendation:** Either (a) make all metrics person-aware, or (b) clearly label metrics as "household" when person view is active, or (c) only show person-filterable metrics in person view mode.

---

## REC-D: Reclaim Above-the-Fold Space — Reduce Permanent Chrome

**Raised by:** James, UX Designer, Devil's Advocate
**Priority:** MEDIUM

**Problem:** On a 375px mobile screen, the user must scroll past ~690px of content before seeing any chart:
1. Getting Started banner (~120px, if not dismissed)
2. Page header + person toggle + print button (~60px)
3. Hero card + FIRE bar (~200px)
4. Secondary metric cards (~100px)
5. What-If CTA banner (~64px)
6. Recommendations header + first card (~150px)

James: "The What-If CTA is visual noise by day 30. I know the scenario panel exists."
UX Designer: "The word 'Dashboard' is redundant — the nav already tells them where they are."

**Recommendation:**
- Remove "Dashboard" title from the header (redundant with nav)
- Embed PersonToggle inside the hero card (top-right), not a separate row
- Move Print button to overflow/kebab menu
- Collapse What-If CTA to a small inline button after first use (detect via `savedScenarios.length > 0`)
- Cap mobile recommendations to 2 visible (with "Show N more" expand)

Estimated viewport savings: 120-180px on mobile.

---

## REC-E: Add "Next Cash Events" — Upcoming Inflows and Outflows

**Raised by:** Priya
**Priority:** MEDIUM

**Problem:** There is no visibility of *when money arrives*. Priya's entire financial life revolves around bonus tranche vesting dates, school fee due dates, and Tom's invoice payments. The dashboard has no calendar awareness.

**Recommendation:** Add a "Next Cash Events" compact strip showing the next 2-3 inflows and outflows with dates:
- **5 Mar** — Deferred tranche vests: ~£38k gross
- **1 Apr** — School fees due: -£13,500
- **15 Apr** — Tom invoice (est): +£8,400

On mobile: 2-3 lines of text with dates and amounts. On desktop: mini-timeline.

The data exists in the model — `BonusStructure.bonusPaymentMonth`, `generateDeferredTranches()`, school fee term dates, committed outgoings with dates.

---

## REC-F: Time-Sensitive Recommendations Should Be Separate From Standing Advice

**Raised by:** James, Priya
**Priority:** MEDIUM

**Problem:** Recommendations are sorted by category, not urgency. Both users want time-sensitive actions surfaced prominently:
- James: "ISA allowance deadline is 42 days away and I haven't maxed it. That should be screaming at me."
- Priya: "When the March bonus lands, I need to see 'You have £18k ISA allowance remaining and 22 days until 5 April' — not a generic pension taper suggestion."

**Recommendation:** Add a time-based urgency tier:
- **Act now** (countdown: ISA deadline, tax year end, bonus month approaching, CGT allowance reset)
- **Act this month** (bonus deployment, rebalancing)
- **Standing advice** (pension optimisation, IHT, emergency fund)

On mobile, show only the top urgency tier by default.

---

## REC-G: Couples View — Show Both Partners Side-by-Side

**Raised by:** James
**Priority:** MEDIUM

**Problem:** James: "Sarah's pension is £320k — less than half mine. The Person Toggle lets me switch views but then I lose the household context. There is no side-by-side." The per-person retirement metric shows "James: 6y 2m · Sarah: 11y 4m" in tiny subtext, but not the pot figures or projected income.

**Recommendation:** Add a "Couple's Snapshot" row below the FIRE bar — two columns showing for each person: name, current pot, projected pot at retirement, years to retirement. On mobile, collapse to: "James: on track / Sarah: 4yr behind."

---

## REC-H: Period Change Needs Attribution — Contributions vs Market

**Raised by:** James, Priya, Devil's Advocate
**Priority:** MEDIUM

**Problem:** MoM change of "+£12.4k" is a mix of contributions and market movement. James: "Was the market up? Did I make my ISA top-up? I have no idea." Priya: "+£28k in March when the tranche hits should not make me feel rich — most of that is already committed."

Additional issues flagged by Devil's Advocate and QA:
- With < 2 snapshots, shows "+0.0" with no indication data is missing
- YoY uses nearest-date matching — may compare 8-month periods
- Ignores person toggle (always household data)

**Recommendation:** Show attribution: "+12.4k (incl. £6.5k contributions)" or at minimum the monthly contribution run-rate alongside the change. Handle insufficient data gracefully ("Needs 2+ months of history").

---

## REC-I: Hero Metrics Are "Configurable" But No Settings UI Exists

**Raised by:** Devil's Advocate
**Priority:** HIGH (architectural)

**Problem:** The dashboard has 14 configurable hero metrics. The user "picks 3 in settings." But there is **zero settings UI** for changing hero metrics — no reference to `heroMetrics`, `HERO_METRIC_LABELS`, or `dashboardConfig` in any settings component. The only way to change metrics is editing localStorage manually.

Additionally, default values are inconsistent:
- `data-context.tsx` defaults: `["net_worth", "cash_position", "retirement_countdown"]`
- `schemas.ts` / `migration.ts` defaults: `["net_worth", "fire_progress", "retirement_countdown"]`

**Recommendation:** Either (a) build the settings UI for hero metric configuration, or (b) remove the abstraction and hardcode the best defaults. The current state is a configurable system nobody can configure.

---

## REC-J: Variable Income Households Need Conservative vs Optimistic Views

**Raised by:** Priya
**Priority:** LOW

**Problem:** Priya budgets defensively — she assumes Tom earns nothing and treats his income as upside. But the dashboard blends both incomes into a single savings rate and cash runway. "If Tom has a quiet quarter and I don't notice because the dashboard is showing combined numbers, I might miss that our buffer is eroding."

**Recommendation:** Cash runway metric should show two variants: "Assuming Tom's income: 11.2 months" and "On your salary alone: 7.8 months." More broadly: distinguish contracted/predictable income from variable/estimated income.

---

## REC-K: "Net Worth After Commitments" Is Conceptually Suspect

**Raised by:** Devil's Advocate, QA Engineer
**Priority:** LOW

**Problem:** The metric subtracts an annual *flow* (commitments) from a *stock* (net worth). A household with £700k and £50k/yr commitments shows "£650k after commitments" — but those commitments recur. After 10 years it's actually £200k. The metric implies a one-time deduction from a perpetual obligation. Also mixes discretionary lifestyle spending into "committed" outgoings.

**Recommendation:** Either reframe as "years of commitment coverage" (stock / flow = time), clearly label as "After 1yr Commitments", or remove entirely.

---

## REC-L: Extract Dashboard Computation to a Testable Function

**Raised by:** Devil's Advocate
**Priority:** LOW (architectural)

**Problem:** The 1,248-line page.tsx contains 30+ useMemo blocks, inline computation (violating CLAUDE.md's "No Inline Financial Computation" rule), and duplicated base/scenario logic. All 14 metrics are computed on every render regardless of which 3 are selected.

**Recommendation:** Extract a `computeHeroData(household, snapshots, selectedView)` function to `src/lib/`. Call it twice — once for scenario, once for base. This halves the useMemo count, eliminates duplication, and makes the computation testable.

---

## Bug Findings (QA Engineer)

| # | Issue | Severity |
|---|-------|----------|
| QA-1 | Person toggle ignored by 10/14 metrics | P1 |
| QA-2 | FIRE progress renders twice when selected as metric | P2 |
| QA-3 | Period Change/YoY shows "+0.0" with no snapshots (not "N/A") | P1 |
| QA-4 | Cash Runway shows green "∞" when no outgoings configured | P1 |
| QA-5 | Net Worth After Commitments ignores person view | P1 |
| QA-6 | Projected Retirement Income hides growth rate assumption | P2 |
| QA-7 | Per-Person Retirement subtext overflows on 3+ persons | P3 |

---

## What's NOT Changing (Standing Decisions)

Per team-orchestration.md, these are settled:
- UK focus only
- Client-side only (localStorage)
- Household model with per-person drill-down
- shadcn/ui + Recharts
- Static export
