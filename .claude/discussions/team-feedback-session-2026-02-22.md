# Team Feedback Session — Deep Dive Review

**Date:** 2026-02-22
**Branch:** `claude/team-feedback-session-D3CA6`
**Participants:** James (HNW Customer), Priya (HNW Customer), Marcus (HNW Customer), Eleanor (HNW Customer), Financial Advisor, Mobile Web Designer, Charting Expert, Web Architect, QA Engineer (Sam), Devil's Advocate

---

## Executive Summary

The team conducted a full-depth review of the Runway application across all disciplines. The codebase is fundamentally well-architected — 568 passing tests, pure function calculation layer, clean separation of concerns. However, the review surfaced **3 P0 issues** (data integrity / safety), **8 P1 issues** (user confusion / missing functionality), and **numerous P2/P3 improvements**.

The single most urgent finding is that **tax constants are 11 months stale** (2024/25, and it is February 2026) while the recommendation engine continues to generate specific financial guidance based on those constants. The second most urgent is a **confirmed bug** in the export page where `calculateRequiredSavings` arguments are swapped.

---

## P0 — Data Integrity / Safety (Fix Immediately)

### P0-1: Tax constants are 11 months stale
**Raised by:** Devil's Advocate, Financial Advisor
**Severity:** Critical

Tax constants in `src/lib/tax-constants.ts` are frozen at 2024/25. The `TaxYearBanner` exists and fires, but is dismissable. Meanwhile, the recommendation engine continues to generate specific pension sacrifice, ISA, and CGT guidance based on stale thresholds. A user who follows "sacrifice X into your pension to avoid the taper" when the taper threshold has changed could make a costly mistake.

**Action required:**
- Update constants to 2025/26, OR
- Disable the recommendation engine when constants are stale, OR
- Add per-recommendation warnings when operating on stale data

### P0-2: Export page has swapped arguments in calculateRequiredSavings
**Raised by:** QA Engineer (Sam)
**Severity:** Bug — wrong number displayed

In the export page, `calculateRequiredSavings(grandTotal, requiredPot, retAge - currentAge, midRate)` passes arguments in the wrong order. The function signature is `(targetPot, currentPot, years, returnRate)` but the export passes `grandTotal` (current net worth) as `targetPot` and `requiredPot` as `currentPot`. The retirement page calls it correctly.

**Fix:** Swap the first two arguments in the export page call.

### P0-3: Drawdown convention inconsistency between charts on the same page
**Raised by:** Charting Expert
**Severity:** Two charts on the retirement page compute retirement sustainability differently

`retirement-drawdown-chart.tsx` uses **grow-first-then-draw**: `pot * (1 + rate) - withdrawal`. `retirement-income-timeline.tsx` uses **draw-first-then-grow**: `(pot - withdrawal) * (1 + rate)`. These charts appear on the same retirement page and produce contradictory projections. The difference is `withdrawal * growthRate` per year, compounding.

**Fix:** Standardise on draw-first-then-grow (more conservative, matches the stated convention in comments).

---

## P1 — User Confusion / Missing Functionality

### P1-1: Recommendations lack FCA-style disclaimer on dashboard
**Raised by:** Devil's Advocate, Financial Advisor
**Severity:** Liability risk

The recommendation engine generates specific, personalised, actionable guidance ("increase pension contributions", "Bed & ISA to shelter gains"). The retirement page carries a disclaimer. The dashboard — where recommendations are displayed — does not. Every recommendation card should include "Speak to a qualified financial advisor before acting."

### P1-2: Retirement drawdown chart ignores tax on pension withdrawals
**Raised by:** Eleanor, Financial Advisor
**Severity:** Numbers are dangerously optimistic

The drawdown chart in `retirement-drawdown-chart.tsx` simply withdraws `annualSpend - statePension` from the pot without accounting for income tax on the taxable 75%. The lifetime cashflow module correctly models 25% PCLS tax-free with marginal tax on the remainder. This means the retirement page shows the SIPP lasting significantly longer than it actually would. BUG-026 in issues.md documents this.

Eleanor: *"For me with a £75k target, the required gross drawdown is more like £90k+. The retirement page's required pot figure is therefore too optimistic."*

### P1-3: "Net Worth" excludes property — misleading headline
**Raised by:** Devil's Advocate, James
**Severity:** The biggest number on the dashboard is incomplete

Property exists as `estimatedPropertyValue` in IHT config but is excluded from the net worth headline. For most UK households with £1M+, property is 40-60% of wealth. The same asset appears in IHT calculations but vanishes from the dashboard.

**Options:** (a) Include property and mortgage as first-class asset/liability, or (b) rename to "Investable Assets" everywhere.

### P1-4: Four built chart components are never rendered
**Raised by:** Charting Expert
**Severity:** Missing features that already exist

Four fully-built charts are defined but not imported by any page:
1. `net-worth-history.tsx` — historical net worth (arguably the most important chart in a net worth tracker)
2. `effective-tax-rate-chart.tsx` — marginal + effective rate curves
3. `tax-band-chart.tsx` — income by tax band
4. `retirement-progress.tsx` — FIRE progress bar

These should be wired into their respective pages or deleted.

### P1-5: IHT page shows "Combined Couple Allowance" for single-person households
**Raised by:** Eleanor
**Severity:** Factually wrong label for Eleanor's situation

When `numberOfPersons` is 1, the IHT page still labels the threshold as "Combined Couple Allowance". This is wrong for single, divorced, or widowed users.

### P1-6: No pension carry-forward collection in UI
**Raised by:** Marcus, Financial Advisor
**Severity:** Feature gap — logic exists but data is not collected

`calculatePensionCarryForward()` is implemented and the `priorYearPensionContributions` field is defined in the type, but the settings form does not collect this data. For Marcus (high earner, underfunded pension), this is essential — he could potentially contribute £80-100k using carry-forward.

### P1-7: NI calculated as Class 1 (employee) for self-employed users
**Raised by:** Eleanor, Web Architect
**Severity:** Wrong numbers for self-employed users

Self-employed Class 4 NI is 6% between thresholds (not 8%). The app overstates NI by ~£753/year for self-employed users like Eleanor. There is no income type flag to distinguish PAYE from self-employment.

### P1-8: No illiquid equity account type
**Raised by:** Marcus
**Severity:** 34% of Marcus's net worth cannot be entered

Company equity (£715k) cannot be tracked. There is no "illiquid" or "company equity" account type. The net worth figure is "fiction" for founder/entrepreneur users.

---

## Customer Persona Summaries

### James (52, pre-retirement, £1.8M NW)

**Loves:** Retirement countdown, pension bridge analysis, scenario mode, income timeline chart, Bed & ISA planner, effective tax rate visualisation.

**Frustrates:** No fund-level OCF tracking, no asset class breakdown beyond tax wrapper, no historical net worth chart (exists but not rendered), can't model gradual GIA-to-ISA transfer strategy across multiple tax years.

**Top request:** "Show me the optimal salary sacrifice amount to stay below £100k adjusted net income" — the avoid-taper preset exists but needs more visibility.

**Sarah test:** Partially passes. Second person with independent tax/NI works. But NHS pension (defined benefit) cannot be modelled — it accrues at 1/54th per year, not as a DC pot.

### Priya (35, school fees + bonuses, £720k NW)

**Loves:** Cash flow timeline (24-month), school fee tracking per child, deferred bonus tranches with vesting dates, next cash events banner, committed outgoings with category breakdown.

**Frustrates:** No mortgage as asset/liability (just a committed outgoing), Tom's variable freelance income is a single number (no year-by-year variability), no "bonus deployment advisor" when a tranche lands, cash flow is 24-month not focused 6-month view, no university fee modelling, no child benefit clawback.

**Top request:** "When my March bonus hits, show me the optimal split between pension, ISA, and mortgage overpayment given my tax position."

**Tom test:** Partially passes. Variable income can be entered as gross salary but can't model "Tom has a bad year" without manual scenario override. No self-employment flag.

### Marcus (45, entrepreneur, £2.1M NW)

**Loves:** Scenario mode for Sunday planning, pension taper calculation, tax band modelling, FIRE metrics.

**Missing fundamentally:** Illiquid equity tracking, exit event modelling (BADR), pension carry-forward UI, conditional retirement branching (exit vs no-exit), dividend income modelling.

**Pension catch-up verdict:** "The app tells me I'm behind. It doesn't help me build the catch-up plan." Carry-forward logic exists but UI doesn't collect the data.

**Rating:** "7/10 for a salaried household, 5/10 for a founder household."

### Eleanor (59, single, £3.1M NW, £1.07M IHT)

**Loves:** Estate composition breakdown (pensions excluded correctly), income timeline showing gap between retirement and state pension, Bed & ISA analysis for current-year CGT planning, wrapper breakdown.

**Missing critically:** Sustained gifting projection with taper relief, tax-aware drawdown modelling, CGT timing analysis (realise now at higher rate vs retirement at basic rate), self-employment NI (Class 4), PCLS strategy modelling (lump sum vs per-withdrawal).

**Single-person verdict:** "The app works for a single person, but the UI labels and mental model are clearly designed for couples. I feel like an afterthought."

**Trust check:** "I would enter my data here and bring the charts to my planner with a list of caveats. But I would not rely on it as my authoritative source."

---

## Architecture Assessment (Web Architect)

**Overall grade: B+**

**Strengths:**
- Pure function calculation layer is excellent
- 568 tests all pass, edge cases well-covered
- Zod + migration pattern is robust
- CLAUDE.md index is thorough and accurate

**Top findings:**

1. **Person-view filtering duplicated 28 times across 8 pages.** Each page re-implements `household.accounts.filter(a => a.personId === selectedView)` independently. Some forget to filter `bonusStructures`. Extract to `filterHouseholdByView()` in `aggregations.ts`.

2. **`resolveMetric()` is 260 lines of untested display logic** in `page.tsx`. It maps metric types to display properties (format, color, icon, threshold). Any formatting error is invisible to the test suite. Extract to `src/lib/dashboard.ts`.

3. **`retirement/page.tsx` has 43 useMemo blocks** due to base/scenario duplication. Create `computeRetirementPageData(household, selectedView, growthRate)` that returns all derived values.

4. **`SnapshotByPerson` type/schema mismatch** — `createAutoSnapshot` generates a `name` field that exists in neither the TypeScript type nor the Zod schema. Zod strips it on parse.

5. **Saved scenarios not Zod-validated on load** — `JSON.parse` without schema validation; corrupt scenario crashes the app.

6. **Lifestyle inflation (2%) hardcoded** in `lifetime-cashflow.ts` instead of `tax-constants.ts` or a user-configurable setting.

---

## Mobile UX Assessment (Mobile Web Designer)

**Key issues:**

1. **Pie chart labels overflow at 375px.** `WrapperSplitChart` (outerRadius 110) and `ByPersonChart` (outerRadius 140) have external labels that clip. At 320px content width, labels like "Premium Bonds 12.50%" extend beyond container bounds.

2. **Touch targets below 44px minimum.** ThemeToggle (32px), PrivacyToggle (36px), hamburger (36px), scenario trigger (32px) all fail WCAG minimum.

3. **Three charts have fixed heights that dominate mobile viewport.** Lifetime cashflow (500px), retirement income timeline (450px), school fee timeline (350px) don't use the responsive `h-[300px] sm:h-[400px]` pattern.

4. **No bottom navigation bar.** All navigation requires 2 taps (hamburger + destination). Primary actions are in the top 64px (hardest thumb zone). A persistent bottom tab bar for 4-5 key destinations would reduce friction.

5. **Settings tabs have no scroll indicator.** 6 tabs with `overflow-x-auto` and hidden scrollbar. On 375px, only ~4 tabs visible. Users may never discover the IHT tab.

6. **Dashboard page is 1168 lines** with 5 chart components statically imported. All render on mount even when collapsed. Lazy-load behind `CollapsibleSection` boundaries.

---

## Chart Assessment (Charting Expert)

**Overall grade: C+**

**Critical findings:**

1. **Four colour systems across 15 charts.** CSS variables, hardcoded HSL, hardcoded hex, semantic constants. The same wrapper type (ISA) is three different colours across three charts. Define a single `SEMANTIC_COLORS` map.

2. **Three pie charts on one dashboard is excessive.** Pie charts are the weakest geometry for comparing magnitudes. Replace with a single grouped horizontal stacked bar showing by-person, by-wrapper, and by-liquidity in one-third the space.

3. **Financial computation embedded in 4 chart components.** `buildDrawdownData`, `buildTaxCurveData`, `classifyLiquidity`, `buildIncomeTimeline` — substantial untested financial logic in rendering components. `buildIncomeTimeline` is 100+ lines of drawdown simulation.

4. **`effective-tax-rate-chart.tsx` hardcodes tax thresholds** (£12,570, £50,270, £100,000, £125,140) instead of importing from `tax-constants.ts`. Violates single-source-of-truth rule.

5. **`projection-chart.tsx` and `net-worth-trajectory.tsx` are 80% duplicate.** Merge into one component with optional props.

**Best chart:** `lifetime-cashflow-chart.tsx` — correct geometry, semantic colours, dynamic accessible summaries, zero embedded computation. Should be the template for all others.

**Worst charts:** The three dashboard pie charts and the liquidity-split hybrid (triple-encodes the same data as cards + bar + CSS bar).

---

## Devil's Advocate Assessment

**Overall risk rating: MEDIUM-HIGH**

The risk is not in code quality (which is strong). The risk is in what the code *does*:

1. **Generates specific financial recommendations based on stale tax data**
2. **Presents deterministic projections as the probable future** (no Monte Carlo, no probability bands)
3. **Excludes the largest asset most households own** from the headline number
4. **Carries inconsistent disclaimers** — present on some pages, absent from dashboard recommendations

**Kill questions that must be answered:**
- *Projections:* "What is the margin of error on a 30-year projection?" — Currently unknown. No confidence intervals.
- *Recommendations:* "Has a qualified financial advisor validated these recommendations?" — No evidence of professional review.
- *IHT:* "Is this tool suitable for estate planning decisions?" — No trust, life insurance, PET taper, or deed of variation modelling.
- *Tax:* "What happens when a user makes a financial decision based on stale tax rates?" — Banner exists but is dismissable; recommendations keep running.

**Conspicuously missing for credibility:**
1. Monte Carlo / probability bands on projections
2. Property and mortgage as first-class entities
3. Inflation as a user-configurable assumption
4. Dividend income and allowance
5. DB pension modelling
6. Professional review of recommendation logic

---

## Consolidated Improvement Backlog

### Tier 1 — Fix Now (correctness/safety)

| # | Item | Effort | Raised By |
|---|------|--------|-----------|
| 1 | Update tax constants to 2025/26 or disable recs when stale | M | Devil's Advocate |
| 2 | Fix export page swapped `calculateRequiredSavings` args | XS | QA Engineer |
| 3 | Fix drawdown chart grow/draw convention inconsistency | S | Charting Expert |
| 4 | Add FCA disclaimer to dashboard recommendations | S | Devil's Advocate |
| 5 | Fix retirement drawdown to include tax on pension withdrawals | M | Eleanor, Financial Advisor |
| 6 | Extract `buildIncomeTimeline` from chart to `src/lib/` + test | M | Charting Expert, Web Architect |

### Tier 2 — High Impact Features

| # | Item | Effort | Raised By |
|---|------|--------|-----------|
| 7 | Wire up 4 dead chart components to their pages | S | Charting Expert |
| 8 | Add pension carry-forward UI (3 year inputs in settings) | S | Marcus, Financial Advisor |
| 9 | Unify chart colour system (single semantic colour map) | M | Charting Expert |
| 10 | Extract person-view filtering to shared utility | S | Web Architect |
| 11 | Extract `resolveMetric` to `src/lib/dashboard.ts` + test | M | Web Architect |
| 12 | Add self-employment income type with Class 4 NI | M | Eleanor |
| 13 | Fix IHT label for single-person households | XS | Eleanor |
| 14 | Add illiquid equity account type | S | Marcus |

### Tier 3 — UX Improvements

| # | Item | Effort | Raised By |
|---|------|--------|-----------|
| 15 | Fix pie chart label overflow at narrow widths | S | Mobile Designer |
| 16 | Enlarge touch targets to 44px minimum | S | Mobile Designer |
| 17 | Make all chart heights responsive | S | Mobile Designer |
| 18 | Add bottom navigation bar for mobile | M | Mobile Designer |
| 19 | Replace 3 dashboard pies with horizontal stacked bar | M | Charting Expert |
| 20 | Lazy-load chart components behind CollapsibleSections | M | Mobile Designer |
| 21 | Add settings tab scroll indicator | XS | Mobile Designer |
| 22 | Merge `projection-chart` and `net-worth-trajectory` | S | Charting Expert |

### Tier 4 — Strategic (Future Sprints)

| # | Item | Effort | Raised By |
|---|------|--------|-----------|
| 23 | Property + mortgage as first-class asset/liability | L | Devil's Advocate, James |
| 24 | Sustained gifting projection with taper relief for IHT | L | Eleanor |
| 25 | CGT timing analysis (realise now vs. at retirement) | M | Eleanor |
| 26 | Monte Carlo / probability bands on projections | L | Devil's Advocate |
| 27 | DB pension modelling | M | James (Sarah's NHS pension) |
| 28 | Bonus deployment advisor (where to put money when tranche lands) | L | Priya |
| 29 | Company exit scenario modelling (BADR) | L | Marcus |
| 30 | Dividend income + allowance modelling | M | Marcus |
| 31 | Child benefit high-income charge | S | Priya |
| 32 | University fee modelling | M | Priya |

---

## Cross-Team Agreement

**All agents agreed on:**
- The pure function architecture is sound and should be maintained
- Tax constants must be updated or recommendations disabled
- The retirement drawdown needs tax-aware modelling
- Chart colour consistency is poor and needs a unified system
- The app handles couples well but single-person households feel like an afterthought
- Carry-forward pension allowance is the highest-value missing feature for HNW users

**Contested points:**
- *Charting Expert* wants to replace all pie charts; *James* finds the allocation donut useful for quick glances
- *Devil's Advocate* questions whether the app should generate recommendations at all without professional review; others see recommendations as the app's core value
- *Mobile Designer* wants a bottom navigation bar; this is a significant UI change that should be prototyped first

---

## Next Steps

1. **Immediate (this sprint):** Items 1-6 from Tier 1
2. **Next sprint:** Items 7-14 from Tier 2
3. **Backlog grooming:** Prioritise Tier 3 and 4 based on user persona coverage
4. **Process:** Get professional IFA review of recommendation logic before next major release
