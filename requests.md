# Feature Requests

Large feature requests identified by the agent team during QA sweeps. These require significant design/implementation work and are not suitable for quick fixes.

---

## Round 1: UX + Customer (James)

### REQ-001: Monthly Surplus / Cash Flow Capacity Card
**Source:** Mobile Web Designer + James (HNW Customer)
**Page:** Retirement
**Description:** After all deductions and committed spending, show how much monthly cash is actually available to save. Bridges the gap between Income and Retirement pages. Requires pulling in expenditure data.

### REQ-002: Household Total Tax Summary Card
**Source:** James (HNW Customer)
**Page:** Income
**Description:** Aggregate per-person tax/NI into a single "Household total deductions" card. The first number a financial advisor asks for. Partial data exists in waterfall chart but isn't surfaced as a readable summary.

---

## Round 2: Charts + Financial Advisor

### REQ-003: IHT Gift Taper Relief Rates
**Source:** Financial Advisor
**Page:** IHT
**Description:** The gift tracker shows binary in/out of NRB but omits HMRC taper relief rates (8%-40% sliding scale for gifts 3-7 years before death). Requires a new library function with tests and a visual timeline.

### REQ-004: Chart Accessibility (ARIA)
**Source:** Charting Expert
**Page:** All chart components
**Description:** Only 1 of 14 chart components has ARIA attributes. All chart wrapper divs need `aria-label`, `role="img"`, and summary text for screen readers. Could be a systematic sweep.

### REQ-005: Projections Regulatory Disclaimer
**Source:** Financial Advisor
**Page:** Projections
**Description:** Forward-looking return scenarios should include a standard UK regulatory disclaimer ("Capital at risk", "Past performance is not a guide to future performance"). Required for any UK financial tool showing projections.

---

## Round 3: Devil's Advocate + Architect

### REQ-006: Silent localStorage Failure Warning
**Source:** Devil's Advocate
**Page:** Global
**Description:** If localStorage write fails (quota exceeded, private browsing), users lose data without warning. Need a toast/banner when save fails, plus periodic integrity checks.

### REQ-007: Tax Year Staleness Warning
**Source:** Devil's Advocate
**Page:** Global
**Description:** Tax constants are frozen at 2024/25. After April 2025, users may make pension or contribution decisions based on outdated HMRC thresholds. Need a banner or settings note indicating the tax year the constants apply to.

### REQ-008: Extract Duplicated Aggregation Functions
**Source:** Senior Web Architect
**Page:** data-context.tsx / use-scenario-data.ts
**Description:** Four aggregation functions are duplicated between `data-context.tsx` and `use-scenario-data.ts`. Extract to shared utility module for testability and DRY.

---

## Round 4: QA + Customer (Priya)

### REQ-009: Monthly Waterfall View for Cash Flow
**Source:** Priya (HNW Customer)
**Page:** Income
**Description:** The waterfall chart shows only annual totals. Priya needs to see monthly cash flow to spot dangerous gaps between bonus vesting months and school fee payment months (September, January, April).

### REQ-010: Committed Outgoings End Dates
**Source:** QA Engineer (Sam)
**Page:** Cash flow timeline / Settings
**Description:** The cash flow timeline ignores end dates on committed outgoings, projecting time-limited costs (school fees, car finance) indefinitely. Need an optional end date field in settings and filtering logic in `cash-flow.ts`.

### REQ-011: NI Qualifying Years Editor
**Source:** Priya (HNW Customer)
**Page:** Settings
**Description:** NI qualifying years silently defaults to full entitlement with no way to edit it per person, inflating state pension estimates. Need a per-person field in household settings.

---

## Round 5: Full Team Final Sweep

### REQ-012: Recommendation Deep Links to Settings Tabs
**Source:** Full team
**Page:** Dashboard / Settings
**Description:** "Take action" on recommendations sends users to `/settings` without specifying which of the 5 tabs contains the relevant fields. Need tab-aware deep linking (e.g., `/settings?tab=household`).

### REQ-013: PWA Raster Icons
**Source:** Mobile Web Designer
**Page:** manifest.webmanifest
**Description:** Only an SVG icon is declared. The app cannot be installed to home screen on most mobile devices. Need 192x192 and 512x512 PNG icons.

### REQ-014: Dark Mode Flash Prevention
**Source:** Mobile Web Designer
**Page:** Layout
**Description:** Theme is applied after React hydration, causing a white flash for dark-mode users. Needs a blocking inline `<script>` before first paint to read the theme from localStorage.

### REQ-015: Recommendation `plainAction` Display
**Source:** Full team
**Page:** Dashboard
**Description:** Recommendations compute a `plainAction` text field but the dashboard card component discards it. One line change to surface it, but needs design consideration for card layout.

---

## Priority Matrix

| Priority | Request | Effort | Impact |
|----------|---------|--------|--------|
| High | REQ-006 localStorage warning | Small | Data loss prevention |
| High | REQ-007 Tax year staleness | Small | Financial accuracy |
| High | REQ-010 Outgoing end dates | Medium | Cash flow accuracy |
| Medium | REQ-001 Monthly surplus card | Medium | User insight |
| Medium | REQ-002 Household tax summary | Small | User insight |
| Medium | REQ-009 Monthly waterfall | Medium | Cash flow visibility |
| Medium | REQ-011 NI qualifying years | Small | Pension accuracy |
| Medium | REQ-012 Settings deep links | Small | UX polish |
| Medium | REQ-015 plainAction display | Small | UX polish |
| Low | REQ-003 Gift taper relief | Large | IHT accuracy |
| Low | REQ-004 Chart accessibility | Medium | Accessibility |
| Low | REQ-005 Regulatory disclaimer | Small | Compliance |
| Low | REQ-008 Extract aggregations | Medium | Code quality |
| Low | REQ-013 PWA icons | Small | Mobile install |
| Low | REQ-014 Dark mode flash | Small | Visual polish |
