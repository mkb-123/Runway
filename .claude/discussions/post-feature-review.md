# Post-Feature Review — Items for Future Agent Discussion

Date: 2026-02-14
Branch: `claude/add-design-principles-zTnMP`

## Issues to Address

### 1. Settings page is ~1865 lines — RESOLVED
**Severity:** Medium | **Type:** Maintainability

Resolved by agent team discussion. Settings page restructured from 1,979 lines to 253-line
thin orchestrator + 6 extracted tab components. See decision record below.

### 2. `src/lib/data.ts` appears to be dead code — RESOLVED
**Severity:** Low | **Type:** Cleanup

Confirmed zero imports. File deleted. Comment reference in `data-context.tsx` updated.

### 3. Print stylesheet hides all `<button>` elements
**Severity:** Low | **Type:** Design constraint

The `@media print` block in `globals.css` uses `button { display: none !important; }`. This is correct for the current dashboard print report but could surprise future features. Any page that needs a visible button in print output would need a `print:block` override.

**Proposed action:** Document this as a known constraint. Consider scoping the rule to `.print\:hidden button` if it causes issues later.

### 4. Export page "Print from Dashboard" pattern is fragile
**Severity:** Low | **Type:** UX

The export page has a `<Link href="/">` with `onClick={() => setTimeout(() => window.print(), 300)}`. This navigates to the dashboard then fires print after 300ms. The timing is arbitrary and may not work reliably on slow devices.

**Proposed action:** Consider a dedicated `/report` print-only page, or trigger print from the dashboard itself (which already has a Print Report button).

### 5. Missing Collapsible shadcn component
**Severity:** Low | **Type:** Component gap

The Collapsible component from shadcn/ui is not installed. It would be useful for the settings page (collapsible sections) and potentially for the recommendations list on the dashboard.

**Proposed action:** Install with `npx shadcn@latest add collapsible` when needed.

### 6. Transactions tab has duplicated description text — RESOLVED
**Severity:** Low | **Type:** Polish

Fixed during settings page restructuring. The extracted `TransactionsTab` component has a single description line.

## Architecture Observations

- **Scenario system is now integrated across all pages** — 7/11 pages use `useScenarioData()`. The remaining 4 (accounts, holdings, export, settings) intentionally show raw data.
- **Zod validation at localStorage boundary** works well. No runtime errors observed. The `safeParse` approach gracefully falls back to defaults on invalid data.
- **Navigation split (Today/Plan)** provides clear information architecture. Future pages should be categorised into one of these groups.
- **The agent team review process** (Devil's Advocate, Financial Advisor, UX Designer, HNW Customer) produced good outcomes. The Devil's Advocate correctly flagged the wizard as over-engineered — the Quick Setup card was a better solution.

---

## Decision Record: Settings Page Usability Overhaul

**Date:** 2026-02-14
**Trigger:** User reported settings page hard to use
**Review type:** Full team

### Verdict: APPROVED

### Summary

Restructured the settings page from a 1,979-line 7-tab monolith into a person-centric,
component-extracted design with 6 tabs. The key UX change: merged People + Income + Bonus +
Contributions into a single "Household" tab where all per-person data lives together.
Added contextual help text to ambiguous fields. Accounts grouped by person. Scenario rates
given descriptive labels (Pessimistic/Expected/Optimistic). "Goals" tab renamed to "Planning".

### Agent Consensus

- HNW Customer (James): **WANT** — "I'd rather see James's stuff and Sarah's stuff in one place"
- Financial Advisor: **SUPPORT** — "Foundational infrastructure; clients think per-account, not per-data-type"
- Mobile Web Designer: **SUPPORT** — "7-tab bar breaks on mobile; forms waste space on desktop"
- Charting Expert: **NEUTRAL** — No charts involved
- Devil's Advocate: **OVERRULED** — Raised valid scope concerns but user accepted the risk

### What Changed

**Tab structure: 7 tabs → 6 tabs**
- `People` + `Income` + `Goals` → `Household` (per-person cards with details, income, bonus, contributions)
- `Accounts` — now groups accounts by person with section headers
- `Funds` — shows holding reference count per fund
- `Goals` → `Planning` (retirement, growth scenarios, emergency fund, expenses)
- `IHT` — added IHT-specific help text (nil-rate bands, 7-year rule)
- `Transactions` — fixed duplicate description text

**Code structure: 1 file → 8 files**
- `page.tsx` — 253 lines (thin orchestrator)
- `components/household-tab.tsx` — per-person everything
- `components/accounts-tab.tsx` — accounts grouped by person
- `components/funds-tab.tsx` — fund catalogue
- `components/planning-tab.tsx` — retirement & projections
- `components/iht-tab.tsx` — inheritance tax
- `components/transactions-tab.tsx` — transaction log
- `components/field-helpers.tsx` — shared clone/setField/renderField with hint support

**UX improvements:**
- Help text on 20+ fields (pension access age, NI years, salary sacrifice, ISA limits, etc.)
- Account count shown per person in Household tab
- Holding reference count shown per fund in Funds tab
- Scenario rates labelled Pessimistic/Expected/Optimistic instead of Rate 1/2/3
- Growth Scenarios split into its own card for clarity
- Orphaned accounts (no matching person) highlighted with destructive styling
- Quick Setup steps updated to point to new tab names

### Also Resolved
- Deleted dead code file `src/lib/data.ts` (confirmed zero imports)
- Updated stale comment in `data-context.tsx`

### Risks Accepted
- Settings page is the most stateful page; restructuring touches all data models
- No new tests added (existing 143 tests all pass; TypeScript clean; lint clean)
