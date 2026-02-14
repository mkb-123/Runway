# Post-Feature Review — Items for Future Agent Discussion

Date: 2026-02-14
Branch: `claude/add-design-principles-zTnMP`

## Issues to Address

### 1. Settings page is ~1865 lines
**Severity:** Medium | **Type:** Maintainability

`src/app/settings/page.tsx` is the largest file in the codebase. Each tab (People, Accounts, Income, etc.) could be extracted into its own component. This would improve local reasoning (design principle #1) — currently you need to scroll through 1800+ lines to understand any single tab.

**Proposed action:** Extract each `<TabsContent>` into a dedicated component (e.g. `PeopleTab`, `AccountsTab`). Pass `household`, `updateHousehold`, and relevant helpers as props.

### 2. `src/lib/data.ts` appears to be dead code
**Severity:** Low | **Type:** Cleanup

`data.ts` contains aggregation functions (`getTotalNetWorth`, `getNetWorthByPerson`, etc.) that duplicate what `data-context.tsx` provides. It's only referenced in a comment. The context is the actual source of truth used by all pages.

**Proposed action:** Verify no imports exist, then delete the file.

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

### 6. Transactions tab has duplicated description text
**Severity:** Low | **Type:** Polish

The transactions tab now has both a tab-level description paragraph and an existing section header with its own description. The text is nearly identical.

**Proposed action:** Remove one of the two descriptions to avoid redundancy.

## Architecture Observations

- **Scenario system is now integrated across all pages** — 7/11 pages use `useScenarioData()`. The remaining 4 (accounts, holdings, export, settings) intentionally show raw data.
- **Zod validation at localStorage boundary** works well. No runtime errors observed. The `safeParse` approach gracefully falls back to defaults on invalid data.
- **Navigation split (Today/Plan)** provides clear information architecture. Future pages should be categorised into one of these groups.
- **The agent team review process** (Devil's Advocate, Financial Advisor, UX Designer, HNW Customer) produced good outcomes. The Devil's Advocate correctly flagged the wizard as over-engineered — the Quick Setup card was a better solution.
