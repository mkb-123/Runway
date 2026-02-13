# Open Issues — Agent Team Review

> This file is maintained by the agent team. Review it at the start of every session.
> Mark issues as `[CLOSED]` when resolved. Do not delete — keep for audit trail.

---

## Bugs

### BUG-001: Scenario banner shows on all pages but only 2 pages use scenario data [HIGH]

**Status:** OPEN
**Reported by:** UX Designer, Devil's Advocate
**Files:** `src/components/scenario-panel.tsx:149`, all page files

The What-If scenario banner appears on all 11 pages (rendered in root Navigation), but only Dashboard (`/`) and Retirement (`/retirement`) use `useScenarioData()`. The other 9 pages use raw `useData()` and display unmodified values. A user in "Market Crash (-30%)" mode who navigates to `/projections` sees original un-crashed values despite the banner.

**Fix:** Update all remaining pages to use `useScenarioData()`:
- `src/app/accounts/page.tsx`
- `src/app/holdings/page.tsx`
- `src/app/projections/page.tsx`
- `src/app/income/page.tsx`
- `src/app/tax-planning/page.tsx`
- `src/app/allocation/page.tsx`
- `src/app/iht/page.tsx`

---

### BUG-002: Retirement page NaN% and Infinity when income or withdrawal rate is zero [HIGH]

**Status:** OPEN
**Reported by:** Devil's Advocate
**Files:** `src/app/retirement/page.tsx:78`, `src/app/retirement/page.tsx:48-55`

- `savingsRate = totalAnnualContributions / totalGrossIncome * 100` — produces `NaN` when income is 0
- `requiredPot = targetAnnualIncome / withdrawalRate` — produces `Infinity` when withdrawal rate is 0, cascading through the entire page

**Fix:** Guard both: `totalGrossIncome > 0 ? ... : 0` and `withdrawalRate > 0 ? ... : 0`.

---

### BUG-003: Income timeline grows pots before drawdown, overstating retirement income [HIGH]

**Status:** OPEN
**Reported by:** Charting Expert, Financial Advisor
**Files:** `src/components/charts/retirement-income-timeline.tsx:88-94`, `:108-113`

Growth is applied to pension pots and accessible wealth BEFORE withdrawals each year. Standard convention is draw-first-then-grow. This systematically overstates income and makes pots last years longer than realistic.

Also: double-compounding at the pension access age transition (pot grown in pre-access else branch at age N-1, then again in the if branch at age N).

**Fix:** Draw first, then grow: `const draw = Math.min(need, pot); pot -= draw; pot *= (1 + rate);`

---

### BUG-004: State pension capped to remainingNeed hides real entitlement [HIGH]

**Status:** OPEN
**Reported by:** Charting Expert
**Files:** `src/components/charts/retirement-income-timeline.tsx:75-78`

`Math.min(p.statePensionAnnual, remainingNeed)` caps state pension to what's needed. If person 1's state pension covers the target, person 2's shows as £0. In reality both receive their full entitlement. The chart should allow total income to exceed the target line (showing surplus).

**Fix:** Remove the `Math.min` cap. Let total income exceed target. Shortfall only when total < target.

---

### BUG-005: First-person priority bias in drawdown ordering [MEDIUM]

**Status:** OPEN
**Reported by:** Charting Expert, Devil's Advocate
**Files:** `src/components/charts/retirement-income-timeline.tsx:70-120`

The shared `remainingNeed` pool means person 1's pension is always fully depleted before person 2's is touched. This is suboptimal for tax planning and longevity.

**Fix:** Draw proportionally from each person's pot based on pot size ratio, or split need equally.

---

### BUG-006: Scenario panel Sheet width overflows on 375px mobile screens [HIGH]

**Status:** OPEN
**Reported by:** UX Designer
**Files:** `src/components/scenario-panel.tsx:199`

`w-96` (384px) overflows a 375px viewport by 9px. Inputs and close button may be unreachable.

**Fix:** Replace `w-96` with `w-full sm:w-96` or remove it entirely to use Sheet's default responsive width.

---

### BUG-007: No htmlFor/id linkage on scenario panel form inputs [HIGH]

**Status:** OPEN
**Reported by:** UX Designer
**Files:** `src/components/scenario-panel.tsx` (all Label/Input pairs, ~12 instances)

Every `<Label>` and `<Input>` pair lacks `htmlFor`/`id` association. Screen readers announce inputs as "edit text" with no label. WCAG 2.1 Level A failure (SC 1.3.1, 4.1.2).

**Fix:** Add unique `id` props to inputs and matching `htmlFor` to labels.

---

### BUG-008: ISA recommendation has coverage gap (50%-99% remaining) [HIGH]

**Status:** OPEN
**Reported by:** Devil's Advocate, Financial Advisor
**Files:** `src/lib/recommendations.ts:116-138`

The first branch triggers when ISA remaining is <= 50% of allowance. The second triggers when ISA remaining is exactly 100%. Anyone with 50%-99% remaining gets NO recommendation.

**Fix:** Change condition to `isaRemaining > 0` (any unused allowance generates a recommendation).

---

### BUG-009: Bed & ISA only recommended when gains < £3,000 CGT exempt amount [HIGH]

**Status:** OPEN
**Reported by:** Financial Advisor
**Files:** `src/lib/recommendations.ts:179`

The recommendation only fires when `totalGain <= cgt.annualExemptAmount`. Gains above £3k — which is where most real value lies — generate no recommendation. The most valuable Bed & ISA cases are missed.

**Fix:** Add a second branch for gains > exempt amount that shows CGT cost vs long-term ISA benefit analysis.

---

### BUG-010: Emergency fund check excludes Cash ISA and Premium Bonds [MEDIUM]

**Status:** OPEN
**Reported by:** Devil's Advocate, Financial Advisor
**Files:** `src/lib/recommendations.ts:235-236`

Filter only counts `cash_savings` accounts. Cash ISAs and Premium Bonds are both instant-access liquid assets commonly treated as emergency fund components. Users get false "emergency fund low" warnings.

**Fix:** Include `cash_isa` and `premium_bonds` in the filter.

---

### BUG-011: Drawdown chart uses requiredPot not currentPot as starting value [HIGH]

**Status:** OPEN
**Reported by:** Financial Advisor
**Files:** `src/app/retirement/page.tsx:402`

The drawdown chart starts from `requiredPot` (the target based on SWR), not from `currentPot` (actual net worth). If the household is only 60% to target, the chart shows a more optimistic scenario than reality.

**Fix:** Use `currentPot` or the projected pot at retirement age.

---

### BUG-012: Drawdown chart uses full state pension ignoring NI qualifying years [MEDIUM]

**Status:** OPEN
**Reported by:** Financial Advisor
**Files:** `src/app/retirement/page.tsx:407`

The drawdown chart passes `UK_TAX_CONSTANTS.statePension.fullNewStatePensionAnnual` regardless of qualifying years, while the income timeline chart correctly pro-rates. Two charts on the same page show different state pension figures.

**Fix:** Calculate pro-rated state pension and pass to drawdown chart.

---

### BUG-013: Scenario panel prevents modelling zero income (redundancy) [MEDIUM]

**Status:** OPEN
**Reported by:** Devil's Advocate
**Files:** `src/components/scenario-panel.tsx:79`

The filter `([, val]) => val > 0` excludes income overrides of 0. Users cannot model a redundancy scenario.

**Fix:** Change to `val >= 0` or `val !== undefined`.

---

### BUG-014: Recommendation badge row overflows on mobile (no flex-wrap) [MEDIUM]

**Status:** OPEN
**Reported by:** UX Designer
**Files:** `src/app/page.tsx:414`

`flex items-center gap-2` without `flex-wrap` causes badges to overflow horizontally on 375px screens with long recommendation titles.

**Fix:** Add `flex-wrap` class.

---

### BUG-015: Retirement income timeline chart has no accessible text alternative [HIGH]

**Status:** OPEN
**Reported by:** UX Designer
**Files:** `src/components/charts/retirement-income-timeline.tsx:188`

The chart renders only SVG. No `aria-label`, summary table, or screen-reader-accessible representation. WCAG 2.1 Level A failure (SC 1.1.1).

**Fix:** Add `aria-label` to container div and consider a "View as table" toggle.

---

### BUG-016: Monotone interpolation creates misleading smooth curves for annual data [MEDIUM]

**Status:** OPEN
**Reported by:** Charting Expert
**Files:** `src/components/charts/retirement-income-timeline.tsx:232`

`type="monotone"` creates smooth splines between integer age data points. State pension kicks in fully at one age, not gradually. Smoothing implies gradual transitions that don't exist.

**Fix:** Use `type="stepAfter"` for accurate discrete annual representation.

---

### BUG-017: Shortfall stacked with income visually reaches the target line — misleading [MEDIUM]

**Status:** OPEN
**Reported by:** Charting Expert, Devil's Advocate
**Files:** `src/components/charts/retirement-income-timeline.tsx:123`, `:229-237`

Shortfall is in the same `stackId="income"`. The total stack (income + shortfall) always reaches the target line. Users may misread this as "on track" when the red area IS the shortfall.

**Fix:** Remove shortfall from the income stack. Show as a separate annotation or hatched overlay.

---

---

## Feature Requests

### FEAT-001: Missing pension tapered annual allowance [CRITICAL]

**Status:** OPEN
**Reported by:** Financial Advisor
**Files:** `src/lib/recommendations.ts:144-145`, `src/lib/tax-constants.ts`

The pension annual allowance is used as a flat £60k for everyone. For individuals with adjusted income exceeding £260k, the allowance tapers to a minimum of £10k. A client earning £300k who follows the recommendation to contribute up to £60k would face an annual allowance tax charge. This is a material regulatory error.

**Required constants:** threshold income (£200k), adjusted income (£260k), taper rate (1:2), minimum tapered allowance (£10k).

---

### FEAT-002: Add pension carry-forward rules [MEDIUM]

**Status:** OPEN
**Reported by:** Financial Advisor
**Files:** `src/lib/recommendations.ts`, `src/lib/tax-constants.ts`

Unused pension annual allowance from previous 3 tax years can be carried forward. The engine only checks current year's £60k. Clients with low prior contributions could have up to £180k additional headroom.

---

### FEAT-003: Retirement age slider on income timeline [HIGH]

**Status:** OPEN
**Reported by:** HNW Customer (James), Devil's Advocate
**Files:** `src/app/retirement/page.tsx:140`

`earlyRetirementAge = currentAge + 10` is hardcoded. Users cannot adjust retirement age. A 55-year-old sees age 65 regardless of plans. Add a slider or dropdown to set retirement age, updating the chart in real-time.

---

### FEAT-004: Growth rate toggle on income timeline [MEDIUM]

**Status:** OPEN
**Reported by:** HNW Customer (James)
**Files:** `src/app/retirement/page.tsx:347`

Currently uses middle scenario rate only. Allow toggling between all configured scenario rates (5%, 7%, 9%) to see how shortfall age changes.

---

### FEAT-005: Recommendations link to relevant pages [MEDIUM]

**Status:** OPEN
**Reported by:** HNW Customer (Sarah)
**Files:** `src/app/page.tsx:400-445`, `src/lib/recommendations.ts`

Recommendations should include a link to the relevant page (e.g., salary sacrifice recommendation links to Tax Planning pension optimisation section). Add a `link` field to the `Recommendation` type.

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

### FEAT-008: Vertical reference lines for pension access and state pension ages [LOW]

**Status:** OPEN
**Reported by:** Charting Expert
**Files:** `src/components/charts/retirement-income-timeline.tsx`

Add vertical reference lines at each person's pension access age and state pension age. These are the critical inflection points and should be visually marked.

---

### FEAT-009: Colourblind-safe chart palette with pattern fills [MEDIUM]

**Status:** OPEN
**Reported by:** UX Designer, Charting Expert
**Files:** `src/components/charts/retirement-income-timeline.tsx:131-139`

Green/teal pair (HSL 142 vs 160) and amber/orange pair (HSL 38 vs 25) are indistinguishable for colour-blind users. Add pattern fills (hatching, dots) and increase hue separation. Also handle 3+ person households where the 7-colour palette wraps.

---

### FEAT-010: Missing disclaimers on retirement projections [HIGH]

**Status:** OPEN
**Reported by:** Financial Advisor
**Files:** `src/app/retirement/page.tsx:332-388`, `:290-330`, `:412-483`

Several sections lack "Capital at risk — projections are illustrative" warnings:
- Combined Retirement Income Timeline chart
- Retirement Countdown section
- FIRE Metrics section (especially "Coast FIRE: Achieved")
- All nominal projections should note no inflation adjustment

FCA compliance risk (COBS 4.6).

---

### FEAT-011: Y-axis label missing on income timeline chart [LOW]

**Status:** OPEN
**Reported by:** Charting Expert
**Files:** `src/components/charts/retirement-income-timeline.tsx:199-203`

Y-axis has no label. Add `label={{ value: "Annual Income (£)", angle: -90, position: "insideLeft" }}`.

---

### FEAT-012: Tooltip shows zero-value series as noise [LOW]

**Status:** OPEN
**Reported by:** Charting Expert
**Files:** `src/components/charts/retirement-income-timeline.tsx:204-216`

Tooltip displays all series even when value is £0 at that age (e.g., "James State Pension: £0" at age 55). Filter out zero values in the tooltip formatter.

---

### FEAT-013: Salary sacrifice recommendation ignores actual pension method [MEDIUM]

**Status:** OPEN
**Reported by:** Devil's Advocate
**Files:** `src/lib/recommendations.ts:49-107`

The recommendation always says "salary sacrifice" but does not check whether the person's `pensionContributionMethod` is actually `salary_sacrifice`. If using `relief_at_source`, the advice is inapplicable.

**Fix:** Check method before recommending, and adjust title/description accordingly.

---

### FEAT-014: Conflicting ISA recommendations can exceed ISA allowance [MEDIUM]

**Status:** OPEN
**Reported by:** Devil's Advocate
**Files:** `src/lib/recommendations.ts:116-127`, `:169-191`

A person can receive both "top up ISA" and "Bed & ISA transfer" recommendations, both consuming the same ISA allowance. The combined advice could lead a user to exceed the £20k limit.

**Fix:** Coordinate ISA-consuming recommendations so total does not exceed remaining allowance.

---
