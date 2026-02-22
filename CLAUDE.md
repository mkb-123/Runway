# Runway - UK Household Net Worth Tracker

## Quick Start for Agents

**Read this file first — it is the complete index.** You should NOT need to read most source files before making changes; use this index to locate the right file and function, then read only what you need.

### Most-changed files (highest churn — read before editing)
- `src/app/page.tsx` — Dashboard: hero, metrics, collapsible sections, charts
- `src/lib/dashboard.ts` — computeHeroData, getStatusSentence, getNextCashEvents
- `src/lib/migration.ts` — 10 migrations, add new migration at bottom + call in main fn
- `src/lib/schemas.ts` — Zod validation, DashboardConfigSchema, defaults
- `src/types/index.ts` — All domain types; DashboardConfig.heroMetrics: HeroMetricType[]

### Key invariants (do not break)
- All financial math lives in `src/lib/` — never inline in components or useMemo
- Every financial calculation has a test in `src/lib/__tests__/`
- Tax constants are single-source in `src/lib/tax-constants.ts` — never hardcode rates
- All pages use `CollapsibleSection` for content sections (not plain `Card`) — consistent UI
- `heroMetrics[0]` = primary metric, `heroMetrics[1..4]` = secondary (max 5 total)
- IHT 7-year gift filter uses `< 7` (not `<= 7`) — gifts at exactly 7 years are outside estate

### Common tasks → file locations
| Task | Files to read |
|------|---------------|
| Add a hero metric type | `src/types/index.ts` (HeroMetricType union + HERO_METRIC_LABELS), `src/app/page.tsx` (resolveMetric switch), `src/lib/dashboard.ts` (computeHeroData return value + HeroMetricData interface) |
| Add a recommendation analyzer | `src/lib/recommendations.ts` (add analyzer fn + call in generateRecommendations), `src/lib/__tests__/recommendations.test.ts` |
| Change a tax rate or threshold | `src/lib/tax-constants.ts` only, then update `src/lib/__tests__/tax-constants.test.ts` |
| Add a new page | `src/app/<route>/page.tsx`, update navigation in `src/components/layout/navigation.tsx`, update CLAUDE.md page table |
| Change localStorage schema | `src/lib/schemas.ts` (add Zod field + default), `src/lib/migration.ts` (add migration N+1), `src/types/index.ts` (type), `src/lib/__tests__/migration.test.ts` (test) |
| Change dashboard section order | `src/app/page.tsx` — CollapsibleSection blocks near line 989–1160 |
| Change collapsible open/closed default | `defaultOpen` prop on `CollapsibleSection` in relevant page file |

## Project Overview

Runway is a comprehensive UK household net worth tracking and financial planning application. Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, and Recharts. All data is stored client-side in localStorage — no backend.

## Maintenance Rule

**Always keep this index updated when things change.** When adding, renaming, or removing files, functions, types, or data flows — update the relevant section of this index in the same commit.

## Tech Stack

- **Framework:** Next.js 16 (App Router, static export)
- **UI:** shadcn/ui + Radix UI + Tailwind CSS 4
- **Charts:** Recharts 3.7
- **Validation:** Zod 4
- **Testing:** Vitest + Testing Library (568 tests)
- **Export:** SheetJS (xlsx)

## Key Directories

- `src/app/` — Pages: dashboard, accounts, projections, retirement, income, tax-planning, iht, cashflow, export, settings
- `src/components/ui/` — 17 shadcn/ui components
- `src/components/charts/` — 15 financial visualization charts (Recharts)
- `src/components/layout/` — Navigation
- `src/components/retirement/` — Retirement sub-components (hero, countdown grid, pension bridge, FIRE metrics, scenario controls)
- `src/lib/` — Financial calculation engines (tax, CGT, projections, formatting, recommendations, school fees, deferred bonus)
- `src/context/` — Global state (data, scenario, person view, privacy)
- `src/types/` — TypeScript type definitions
- `data/` — Default JSON data files (household, snapshots)

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build (static export)
- `npm run test` — Run Vitest test suite
- `npm run lint` — Run ESLint

## Agent Team

This project uses a **Finance Agent Team** for design and architecture decisions. Before making significant UI, charting, or feature decisions, consult the agent team defined in `.claude/agents/`.

### Team Members

| Role | File | Expertise |
|------|------|-----------|
| Mobile Web Designer | `.claude/agents/ux-designer.md` | Responsive design, mobile-first layouts, touch interactions, performance |
| Charting Expert | `.claude/agents/charting-expert.md` | Financial data visualisation, chart type selection, Recharts |
| Financial Advisor | `.claude/agents/financial-advisor.md` | Client needs, regulatory context, what matters to real users |
| Devil's Advocate | `.claude/agents/devils-advocate.md` | Challenges assumptions, identifies risks, stress-tests ideas |
| HNW Customer (James) | `.claude/agents/hnw-customer.md` | Real user perspective, retirement planning, tax optimisation, couple's finances |
| HNW Customer (Priya) | `.claude/agents/hnw-customer-priya.md` | Busy family perspective, cash flow under school fees, bonus tranches, variable household income |
| HNW Customer (Marcus) | `.claude/agents/hnw-customer-marcus.md` | Entrepreneur/founder, illiquid equity, pension catch-up, tapered allowance, exit planning |
| HNW Customer (Eleanor) | `.claude/agents/hnw-customer-eleanor.md` | Divorced, no children, near-retirement, SIPP drawdown, severe IHT exposure (one NRB, no RNRB), estate planning |
| Senior Web Architect | `.claude/agents/web-architect.md` | 30 years building web apps, separation of concerns, testability, no inline computation, anti-duplication |
| QA Engineer (Sam) | `.claude/agents/qa-engineer.md` | Pedantic tester, cross-page consistency, edge cases, data model contradictions, confusion risks |

### Decision Process

See `.claude/agents/team-orchestration.md` for the full multi-agent review workflow.

## Design Principles

Source: [Smaug123/gospel](https://github.com/Smaug123/gospel/blob/main/gospel.md)

### 1. Local Reasoning

You should be able to understand what code does by looking at it, without tracing through indirection, global state, or runtime dispatch.

- Dependency rejection over dependency injection. Pass values in, get values out. The shell decides where values come from; the core doesn't know or care.
- Functional core, imperative shell. Effects (IO, mutation, exceptions) break local reasoning because their consequences are elsewhere. Quarantine them at the edges.
- No "interface for one implementation." Compute a description of what to do, then do it—don't call out to a pluggable dependency.
- No framework brain. Frameworks invert control: you write hooks, the framework calls them. Most code is not a framework and shouldn't be structured like one.
- No magic. Reflection, implicit conversions, runtime code generation—these make behaviour invisible at the point of use.
- Explicit over implicit, always.
- Error results over exceptions unless necessary.
- Immutable over mutable, except perhaps in tightly-constrained temporary local scopes.

### 2. Have the Machine Enforce Invariants

Don't rely on discipline or documentation. Make the machine verify properties—at compile time where possible, at runtime where necessary.

- Make illegal states unrepresentable. If two fields can't both be Some, use a discriminated union, not two options.
- Parse, don't validate. At the boundary, transform unstructured input into types that are correct by construction. Interior code receives proof, not promises.
- No stringly typing. Structured values get structured types.
- No primitive obsession. An email address is not a string. A user ID is not an int. Wrap them.
- Assert pre/postconditions. When types can't express an invariant, assert it. Fail fast, fail loud.
- "Hard to misuse" is much more important than "easy to use."

### 3. Small Orthogonal Core

A good system has a small set of primitives whose interactions are fully specifiable. Everything else is sugar that desugars to the core.

- No speculative generality. Abstractions must earn their place by simplifying the composition story.
- Composition over inheritance. Functions and data compose simply.
- Be suspicious of any design where you can't enumerate the primitive operations and their laws.

### 4. Leverage Compute

You can run code. Use the machine to search and verify rather than relying on complex human reasoning.

- Property-based testing over example-based. Find the invariant: "for all valid inputs, P holds."
- Reference implementations. For complex algorithms, write a naive correct version. Property: fast implementation ≡ slow implementation.
- Search for edge cases. Write a predicate, generate until you find matches. You have compute.
- Use tracing liberally. Knowing for certain what the program did is better than guessing.
- When fixing a bug, always write the failing test, observe it fail, then fix the bug.

### 5. Correctness Over Availability

Producing wrong results is worse than going down. When you can't guarantee correctness, stop.

- State the guarantees. For each component, document what it promises under normal operation and under each failure mode.
- Design for resurrection, not immortality. Make death cheap: externalize state, make operations idempotent.
- Fail fast, fail visibly. When invariants are violated beyond recovery, crash immediately.
- Bound uncertainty. If you serve stale data, bound how stale. If you retry, bound how many times. If you queue, bound how deep.

### 6. No Inline Financial Computation

Financial calculations must never live inside React components. Inline computation in `useMemo` or render logic is a code smell — it's untestable, unreviewable, and impossible to verify against HMRC rules.

- **Extract all financial math to `src/lib/`**. Components call pure functions and render results. No arithmetic in JSX or `useMemo` beyond trivial aggregation (e.g. `array.reduce` for totals).
- **Every financial calculation must have a test**. If you add a formula, add a test. If you change a rate, update the test. No exceptions.
- **Name the formula**. Don't write `Math.max(0, Math.floor((x - threshold) / 2))` inline — extract it as `calculateRnrbTaperReduction(estateValue)` with a docstring citing the HMRC rule.

### 7. No Duplication

Every piece of knowledge should have a single, authoritative source in the codebase.

- **Constants live in `tax-constants.ts`**. Never hardcode a tax rate, threshold, or allowance in a component.
- **Shared calculations live in `src/lib/`**. If two pages compute the same thing, extract it.
- **Shared UI patterns live in `src/components/`**. If two pages render the same structure, extract it.
- Before writing new code, search for existing implementations. Prefer reuse over reinvention.

### Guidance for Coding Agents

- Test hypotheses by running code; leverage computational advantages.
- Build minimally; avoid speculative abstractions.
- Execute large mechanical changes confidently when core design improves.
- Treat type system resistance as design signals; avoid casts and reflection.
- Question unclear directions rather than producing extensive wrong approaches.
- Derive from principles rather than pattern-matching on memorized practices.
- Write comprehensive property-based tests before implementation.

### Testing Rules

- **Bug fix testing.** Anytime you find a bug, write a test after fixing the bug. The test must reproduce the original failure and verify the fix.
- **New code testing.** Any time you add new code, add a test. No new logic lands without corresponding test coverage.
- **Integration testing.** Write integration tests to test common workflows that span multiple pages — e.g., "change pension contribution and ensure it is reflected on all the pages." These tests verify that data flows correctly through the context and appears consistently across the application.

## Test Coverage Gaps

Most calculations are now extracted to `src/lib/` with tests. The following remain as **inline page calculations** (low risk, aggregation-only):

### Remaining (Medium Priority — Accuracy)

| Page | Inline Calculation | Risk |
|------|--------------------|------|
| `retirement/page.tsx` | Mid-scenario rate selection | Array index assumption |
| `retirement/page.tsx` | Savings rate: `contributions / grossIncome * 100` | Division by zero if no income |

### Resolved (now extracted and tested)

- IHT: RNRB taper, gift NRB reduction, liability calculation -> `src/lib/iht.ts` (35 tests)
- CGT rate determination (with pension method awareness) -> `src/lib/cgt.ts:determineCgtRate`
- Bed & ISA break-even -> `src/lib/cgt.ts:calculateBedAndISABreakEven`
- State pension pro-rata -> `src/lib/projections.ts:calculateProRataStatePension`
- Age calculation (calendar-based, leap year safe) -> `src/lib/projections.ts:calculateAge`
- Tax efficiency score -> `src/lib/projections.ts:calculateTaxEfficiencyScore`
- Deferred bonus projection -> `src/lib/projections.ts:projectDeferredBonusValue`
- All 10 recommendation analyzers now have test coverage

---

## Code Index

### src/lib/ — Financial Calculation Engines

#### `tax-constants.ts` — UK Tax Rates & Thresholds (2024/25)
Single source of truth. Never hardcode rates elsewhere.
- `UK_TAX_CONSTANTS` — nested object: `personalAllowance`, `incomeTax` (basic/higher/additional rates & limits), `nationalInsurance` (thresholds, employee rates), `studentLoan` (plan1-5 + postgrad thresholds & rates), `cgt` (exemption, rates), `isaAnnualAllowance`, `pensionAnnualAllowance`, pension taper thresholds, `dividendAllowance` + rates, `iht` (NRB, RNRB, taper threshold, rate), `marriageAllowance`, `statePension` (weekly/annual amounts, qualifying years)

#### `tax.ts` — Income Tax, NI, Take-Home Pay
- `calculateIncomeTax(grossSalary, pensionContribution?, pensionMethod?) → IncomeTaxResult` — band breakdown + effective rate
- `calculateNI(grossSalary, pensionContribution?, pensionMethod?) → NIResult` — NI bands
- `calculateStudentLoan(grossSalary, plan) → number`
- `calculateTakeHomePay(income: PersonIncome) → TakeHomeResult` — full net pay (gross, tax, NI, pension, monthly)
- `calculateTakeHomePayWithStudentLoan(income, plan) → TakeHomeResult`
- Types: `TaxBandBreakdown`, `IncomeTaxResult`, `NIResult`, `TakeHomeResult`

#### `cgt.ts` — Capital Gains Tax & Bed-and-ISA
- `getTaxYear(dateStr) → string` — e.g. "2024/25"
- `parseTaxYearDates(taxYear) → {start, end}`
- `getUnrealisedGains(accounts[]) → UnrealisedGain[]`
- `determineCgtRate(grossIncome, pensionContribution?, pensionMethod?) → number`
- `calculateBedAndISA(unrealisedGain, cgtAllowanceRemaining, cgtRate) → BedAndISAResult`
- `calculateBedAndISABreakEven(cgtCost, giaValue, cgtRate, assumedReturn?) → number`

#### `iht.ts` — Inheritance Tax
- `calculateEffectiveNRB(nrbPerPerson, numberOfPersons, giftsWithin7Years) → number`
- `calculateRnrbTaperReduction(estateValue, taperThreshold?) → number`
- `calculateEffectiveRNRB(rnrbPerPerson, numberOfPersons, estateValue) → number`
- `calculateIHT(estateValue, numberOfPersons, giftsWithin7Years, passingToDirectDescendants) → IHTResult`
- `calculateYearsUntilIHTExceeded(currentEstateValue, combinedThreshold, annualSavingsInEstate, growthRate?) → number | null`
- `yearsSince(dateStr, now?) → number`

#### `projections.ts` — Growth Projections, Retirement, State Pension
- **Compound growth:** `projectCompoundGrowth()`, `projectScenarios()`, `projectCompoundGrowthWithGrowingContributions()`, `projectScenariosWithGrowth()`, `projectFinalValue()`, `projectSalaryTrajectory()`
- **Retirement:** `calculateRetirementCountdown()`, `calculateCoastFIRE()`, `calculateRequiredSavings()`, `calculatePensionBridge()`, `calculateSWR()`, `calculateRequiredPot()`, `calculateAdjustedRequiredPot()`
- **Pension allowance:** `calculateTaperedAnnualAllowance(thresholdIncome, adjustedIncome) → number`
- **State pension:** `calculateProRataStatePension(qualifyingYears) → number`
- **Age:** `calculateAge(dateOfBirth, now?) → number`
- **Efficiency:** `calculateTaxEfficiencyScore()`, `projectDeferredBonusValue()`, `getMidScenarioRate()`

#### `cash-flow.ts` — 24-Month Forward Cash Flow
- `generateCashFlowTimeline(household) → CashFlowMonth[]` — salary, bonus, deferred vesting, outgoings by month

#### `lifetime-cashflow.ts` — Lifetime Year-by-Year Projection
- `generateLifetimeCashFlow(household, growthRate, endAge?) → LifetimeCashFlowResult` — tracks employment income, pension drawdown, state pension, investment drawdown, expenditure to age 95
- Types: `LifetimeCashFlowYear`, `LifetimeCashFlowResult`, `LifetimeCashFlowEvent`

#### `dashboard.ts` — Dashboard Hero Metrics (Extracted)
- `computeHeroData(household, snapshots, selectedView) → HeroMetricData` — all 14 hero metrics, person-view aware
- `getNextCashEvents(household, maxEvents?) → CashEvent[]` — upcoming inflows/outflows (bonus, vesting, fees)
- `getStatusSentence(heroData, household) → StatusSentence` — life-stage aware contextual status
- `detectLifeStage(household) → LifeStage` — accumulator / school_fees / pre_retirement
- `getRecommendationUrgency(recId) → RecommendationUrgency` — act_now / act_this_month / standing
- Types: `HeroMetricData`, `CashEvent`, `StatusSentence`, `LifeStage`, `RecommendationUrgency`

#### `school-fees.ts` — School Fee Projections
- `calculateSchoolStartDate(child)`, `calculateSchoolEndDate(child)`, `calculateSchoolYearsRemaining(child)`, `calculateTotalSchoolFeeCost(child)`, `generateSchoolFeeOutgoing(child) → CommittedOutgoing`, `generateSchoolFeeTimeline(children[]) → SchoolFeeTimelineYear[]`, `findLastSchoolFeeYear(children[])`

#### `deferred-bonus.ts` — Deferred Bonus Tranches
- `generateDeferredTranches(bonus, referenceDate?) → DeferredBonusTranche[]` — respects `vestingGapYears`
- `totalProjectedDeferredValue(bonus, referenceDate?) → number`

#### `emma-import.ts` — Emma App CSV Import
- `parseEmmaCSV(csvText) → EmmaParseResult` — parse Emma CSV export into structured transactions
- `analyzeEmmaSpending(transactions) → EmmaSpendingSummary` — derive monthly spending, category breakdown, recurring payments
- `toCommittedOutgoings(suggestions) → CommittedOutgoing[]` — convert detected payments to Runway outgoings
- Helpers: `parseCSVRow()`, `parseDate()`, `parseAmount()`
- Types: `EmmaTransaction`, `EmmaParseResult`, `EmmaSpendingSummary`

#### `recommendations.ts` — Actionable Financial Recommendations
- `generateRecommendations(household) → Recommendation[]` — master function calling 10+ analyzers
- Individual analyzers: `analyzeSalaryTaper`, `analyzePensionAllowance` (taper), `analyzeSalaryContribution`, `analyzePensionDeficit`, `analyzeISA`, `analyzeGIA`, `analyzeBedAndISA`, `analyzeCGTAllowance`, `analyzeStudentLoan`, `analyzeEmergencyFund`
- Types: `Recommendation`, `RecommendationPriority`, `RecommendationCategory`

#### `scenario.ts` — What-If Scenario Overrides
- `applyScenarioOverrides(household, overrides) → HouseholdData`
- `scaleSavingsRateContributions(persons, income, bonusStructures, contributions, targetRate) → ContributionOverride[]` — income-proportional scaling with existing ISA/pension/GIA ratio preserved
- `calculateScenarioImpact(persons, income, pensionOverrides) → Map<string, ImpactPreview>` — tax/NI impact of pension sacrifice changes
- `buildAvoidTaperPreset(persons, income, contributions) → ScenarioOverrides` — salary sacrifice to avoid £100k PA taper
- Types: `ScenarioOverrides`, `ContributionOverride`, `PersonOverride`, `ImpactPreview`

#### `format.ts` — Display Formatting
- `formatCurrency(amount)` → "£1,234.56"
- `formatCurrencyCompact(amount)` → "£1.2k"
- `formatPercent(decimal)` → "7.00%"
- `formatDate(dateStr)` → "15 Jun 2024"
- `formatNumber(n)` → "1,234"
- `formatCurrencyAxis(value)` — chart axis labels
- `formatCurrencyTooltip(value)` — chart tooltip labels
- `roundPence(amount)`

#### `schemas.ts` — Zod Runtime Validation
- `HouseholdDataSchema`, `SnapshotsDataSchema` — top-level
- Per-entity: `PersonSchema`, `AccountSchema`, `PersonIncomeSchema`, `BonusStructureSchema`, `ContributionSchema`, `RetirementConfigSchema`, `EmergencyFundConfigSchema`, `CommittedOutgoingSchema`, `ChildSchema`, `GiftSchema`, `IHTConfigSchema`, `DashboardConfigSchema`

#### `migration.ts` — localStorage Schema Migrations
- `migrateHouseholdData(raw) → record` — 10 idempotent migrations:
  1. `annualContributions → contributions`
  2. `estimatedAnnualExpenses → monthlyLifestyleSpending`
  3. Ensure `monthlyLifestyleSpending` in emergencyFund
  4. Default `committedOutgoings[]`
  5. Default `dashboardConfig` (5-slot heroMetrics default)
  6. Default `plannedRetirementAge`, `niQualifyingYears`, `studentLoanPlan`, `pensionAccessAge`, `stateRetirementAge` on persons
  7. `deferredTranches[] → deferredBonusAnnual` (simplified)
  8. Default `children[]`
  9. `deferredBonusAnnual → totalBonusAnnual` (total model)
  10. Expand `heroMetrics` from old 3-slot tuple to 5-slot array (adds `period_change`, `projected_retirement_income`)

#### `utils.ts` — Tailwind Utilities
- `cn(...inputs)` — clsx + twMerge

### src/types/index.ts — Domain Type Definitions

**Enums:** `AccountType`, `TaxWrapper`, `StudentLoanPlan`, `PensionContributionMethod`, `OutgoingFrequency`, `CommittedOutgoingCategory`, `ContributionTarget`, `HeroMetricType` (includes `projected_retirement_income`)

**Core types:**
- `Person` — id, name, relationship, dateOfBirth, plannedRetirementAge, pensionAccessAge, stateRetirementAge, niQualifyingYears, studentLoanPlan
- `Account` — id, personId, type (AccountType), provider, name, currentValue, costBasis?
- `PersonIncome` — personId, grossSalary, employer/employeePensionContribution, pensionMethod, salaryGrowthRate, bonusGrowthRate, priorYearPensionContributions?
- `BonusStructure` — personId, totalBonusAnnual, cashBonusAnnual, vestingYears, vestingGapYears, estimatedAnnualReturn
- `DeferredBonusTranche` — grantDate, vestingDate, amount, estimatedAnnualReturn
- `Contribution` — id, personId, label, target (isa|pension|gia), amount, frequency
- `RetirementConfig` — targetAnnualIncome, withdrawalRate, includeStatePension, scenarioRates
- `EmergencyFundConfig` — monthlyEssentialExpenses, targetMonths, monthlyLifestyleSpending
- `Child` — id, name, dateOfBirth, schoolFeeAnnual, feeInflationRate, schoolStartAge, schoolEndAge
- `CommittedOutgoing` — id, category, label, amount, frequency, startDate?, endDate?, inflationRate?, linkedChildId?
- `Gift`, `IHTConfig`, `DashboardConfig` (`heroMetrics: HeroMetricType[]` — index 0 primary, max 5), `NetWorthSnapshot`, `HouseholdData`, `SnapshotsData`

**Helper functions:**
- `getAccountTaxWrapper(type) → TaxWrapper`
- `isAccountAccessible(type) → boolean` — pension = inaccessible
- `getDeferredBonus(bonus) → number` — `max(0, totalBonusAnnual - cashBonusAnnual)`
- `annualiseContribution(amount, frequency)`, `annualiseOutgoing(amount, frequency)`
- `getPersonContributionTotals(contributions, personId) → {isa, pension, gia}`

**Label maps:** `ACCOUNT_TYPE_LABELS`, `TAX_WRAPPER_LABELS`, `CONTRIBUTION_TARGET_LABELS`, `CONTRIBUTION_FREQUENCY_LABELS`, `OUTGOING_CATEGORY_LABELS`, `OUTGOING_FREQUENCY_LABELS`, `HERO_METRIC_LABELS`

### src/context/ — Global State

| File | Hook | State | Persistence |
|------|------|-------|-------------|
| `data-context.tsx` | `useData()` | `household`, `snapshots`, `isHydrated` + mutations (`updateHousehold`, `resetToDefaults`, etc.) + computed helpers (`getTotalNetWorth`, `getNetWorthByPerson`, etc.) | localStorage: `nw-household`, `nw-snapshots` |
| `scenario-context.tsx` | `useScenario()` | `isScenarioMode`, `overrides`, `savedScenarios[]` + `enableScenario()`, `applyOverrides()` | localStorage: `nw-saved-scenarios` |
| `person-view-context.tsx` | `usePersonView()` | `selectedView` (household or personId), `isHouseholdView` | Session only |
| `privacy-context.tsx` | `usePrivacy()` | `blurred`, `toggle()` — auto-blur after 5min, default blur if >24h stale, Ctrl+Shift+B | localStorage: `nw-privacy-blurred`, `nw-last-visit` |
| `use-scenario-data.ts` | `useScenarioData()` | Composes data + scenario contexts — returns scenario-aware `household` + `baseHousehold` | — |

### src/app/ — Page Routes

| Route | File | Purpose | Key lib dependencies |
|-------|------|---------|---------------------|
| `/` (Dashboard) | `page.tsx` | Hero metrics, recommendations, net worth breakdown, school fee timeline, retirement countdown, committed outgoings list | `recommendations.ts`, `projections.ts`, `school-fees.ts`, `format.ts` |
| `/accounts` | `accounts/page.tsx` | Account register by person & type, add/edit/delete, cost basis | `format.ts` |
| `/income` | `income/page.tsx` | Salary, tax, NI, student loan, deferred bonus, 24-month cash flow, school fees, income trajectory | `tax.ts`, `cash-flow.ts`, `deferred-bonus.ts`, `school-fees.ts`, `format.ts` |
| `/retirement` | `retirement/page.tsx` | Retirement countdown, pension bridge, FIRE metrics, income timeline, scenario controls | `projections.ts`, `format.ts` |
| `/projections` | `projections/page.tsx` | Multi-scenario net worth growth trajectories | `projections.ts` |
| `/tax-planning` | `tax-planning/page.tsx` | CGT (Bed & ISA), pension taper, ISA/pension allowance usage, marriage allowance | `tax.ts`, `cgt.ts`, `projections.ts`, `format.ts` |
| `/iht` | `iht/page.tsx` | Estate value, gifts within 7 years, RNRB taper, years to threshold | `iht.ts`, `format.ts` |
| `/cashflow` | `cashflow/page.tsx` | Lifetime cash flow projection (income sources, spending, surplus/deficit), life events timeline | `lifetime-cashflow.ts`, `school-fees.ts`, `format.ts` |
| `/export` | `export/page.tsx` | Export household data as .xlsx (multiple sheets) | `deferred-bonus.ts`, `format.ts` |
| `/settings` | `settings/page.tsx` | Tabbed settings: Household, Planning, Children, Commitments, IHT + data reset/import | `schemas.ts`, `format.ts` |

### Settings Sub-Components (`src/app/settings/components/`)

| File | Tab | Edits |
|------|-----|-------|
| `household-tab.tsx` | Household | Persons (name, DOB, retirement age, NI years, student loan), income (salary, pension, growth rates), bonus structures (total, cash, vesting), dashboard hero metrics |
| `planning-tab.tsx` | Planning | Target annual income (input + slider), withdrawal rate, state pension toggle, scenario growth rates |
| `children-tab.tsx` | Children | Child name, DOB, school fee, inflation rate, start/end ages |
| `commitments-tab.tsx` | Commitments | Committed outgoings (category, label, amount, frequency, dates), auto-synced school fees |
| `iht-tab.tsx` | IHT | Property value, direct descendants toggle, gifts register |
| `accounts-tab.tsx` | (inline) | Account type, provider, name, balance, cost basis |
| `emma-import-dialog.tsx` | — | Emma CSV import dialog: upload, review spending analysis, apply outgoings |
| `field-helpers.tsx` | — | Shared form input components (currency, date, percentage fields) |
| `field-warning.tsx` | — | Validation warning component |

### src/components/ — Feature Components

| File | Purpose |
|------|---------|
| `settings-bar.tsx` | Reusable bar surfacing settings on consuming pages (cog icon, primary-tinted bg, edit link) |
| `privacy-toggle.tsx` | Eye/EyeOff button for blur mode |
| `theme-toggle.tsx` | Light/dark mode toggle |
| `person-toggle.tsx` | Dropdown: household vs per-person view |
| `scenario-banner.tsx` | "In scenario mode" banner |
| `scenario-panel.tsx` | Scenario control panel (enable/save/load/delete, target retirement income slider) |
| `scenario-delta.tsx` | Before/after metric comparison |
| `empty-state.tsx` | No-data fallback message |
| `page-header.tsx` | Page title + subtitle |
| `collapsible-section.tsx` | Accordion wrapper for content groups |
| `error-boundary.tsx` | React error boundary |
| `school-fee-summary.tsx` | School fee summary card |
| `layout/navigation.tsx` | Sidebar + mobile nav (includes PrivacyToggle, ThemeToggle) |

### src/components/charts/ — Recharts Visualizations

| File | Chart Type | Used On |
|------|-----------|---------|
| `net-worth-trajectory.tsx` | Multi-year projection with scenario bands | Dashboard |
| `net-worth-history.tsx` | Monthly snapshots from past data | Dashboard |
| `allocation-pie.tsx` | Assets by wrapper (pie) | Dashboard |
| `by-person-chart.tsx` | Net worth per person (bar) | Dashboard |
| `wrapper-split-chart.tsx` | Wrapper breakdown over time (stacked bar) | Dashboard |
| `liquidity-split-chart.tsx` | Accessible vs locked-in (bar) | Dashboard |
| `projection-chart.tsx` | Growth projection (line) | Projections |
| `retirement-progress.tsx` | FIRE progress (bar) | Retirement |
| `retirement-drawdown-chart.tsx` | Pot depletion over years (area) | Retirement |
| `retirement-income-timeline.tsx` | Salary → pension → state pension (stacked area) | Retirement |
| `lifetime-cashflow-chart.tsx` | Year-by-year surplus/deficit (bar + line) | Cashflow |
| `cash-flow-timeline.tsx` | 24-month forward (grouped bar) | Income |
| `school-fee-timeline-chart.tsx` | School fees with inflation (bar) | Income, Dashboard |
| `effective-tax-rate-chart.tsx` | Tax rate over income ranges (line) | Tax Planning |
| `tax-band-chart.tsx` | Income by tax band (stacked bar) | Tax Planning |

### src/components/retirement/ — Retirement Sub-Components

| File | Purpose |
|------|---------|
| `retirement-hero.tsx` | Large headline card (countdown, target pot, projected pot at retirement, sustainable income) |
| `retirement-countdown-grid.tsx` | 3-column grid: retirement, pension access, state pension ages |
| `pension-bridge-card.tsx` | Early retirement bridge gap analysis |
| `fire-metrics-card.tsx` | Coast FIRE, required savings, SWR metrics |
| `scenario-controls.tsx` | Retirement page scenario input controls |

### src/components/ui/ — shadcn/ui Library

`alert`, `badge`, `button`, `card`, `collapsible`, `dialog`, `dropdown-menu`, `input`, `label`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `table`, `tabs`, `tooltip`

### data/ — Default JSON Data

| File | Purpose |
|------|---------|
| `household.json` | Default example data (2 persons, 10+ accounts, income, bonuses, contributions, retirement config, outgoings) |
| `snapshots.json` | Historical net worth snapshots (monthly, per-person, per-wrapper breakdowns) |

### Test Files (`src/lib/__tests__/`)

| File | Tests | Coverage |
|------|-------|----------|
| `tax.test.ts` | Income tax bands, NI, take-home pay, pension methods, student loan |
| `projections.test.ts` | Compound growth, salary trajectory, retirement countdown, pension taper, state pension, age, FIRE |
| `recommendations.test.ts` | All 10+ recommendation analyzers with scenario variations |
| `lifetime-cashflow.test.ts` | Year-by-year cash flow, employment→pension→state pension transitions |
| `iht.test.ts` | NRB reduction, RNRB taper, combined threshold, liability, years to IHT |
| `cgt.test.ts` | Tax year parsing, CGT rate determination, Bed & ISA break-even |
| `pension-flow.test.ts` | Pension contributions, employer match, lump sum, drawdown, bridge |
| `projection-consistency.test.ts` | Cross-function consistency checks |
| `school-fees.test.ts` | Start/end dates, years remaining, total cost, timeline generation |
| `dashboard.test.ts` | Hero metric computation (person-filtered, snapshot changes, QA edge cases), next cash events, status sentence, life-stage detection, recommendation urgency |
| `deferred-bonus.test.ts` | Tranche generation, vesting schedule (including vestingGapYears), projected value |
| `scenario.test.ts` | Scenario override merging (income, contributions, retirement, accounts, market shock), savings rate scaling, impact calculation, avoid-taper preset, target income override integration, combined integration |
| `format.test.ts` | Currency, percentage, date, number formatting |
| `cash-flow.test.ts` | 24-month timeline: salary growth, bonus months, deferred vesting, term fees |
| `migration.test.ts` | All 9 data migrations: old formats → current schema |
| `tax-constants.test.ts` | Constants structure validation |
| `emma-import.test.ts` | CSV parsing, date/amount parsing, spending analysis, recurring payment detection, category classification |

### Key Data Flows

**Settings → Consuming Pages:**
- Retirement config (target income, withdrawal rate, scenario rates) → Retirement page SettingsBar
- ISA/pension allowance usage → Tax Planning page SettingsBar (progress bars)
- Persons, income, bonuses → Income page (trajectory, take-home)
- Children → auto-generates `CommittedOutgoing` school fees → Dashboard, Income, Cashflow
- Committed outgoings → Dashboard (compact list), Cashflow (lifetime)

**Bidirectional navigation:**
- Pages show `SettingsBar` linking to `/settings?tab=<tab>`
- Settings tabs show "Shown on:" links back to consuming pages

**Scenario mode:**
- Pages use `useScenarioData()` → applies `applyScenarioOverrides()` in-memory
- `ScenarioDelta` shows before/after comparison
- Saved scenarios persisted to `nw-saved-scenarios` in localStorage

**Recommendation engine:**
- `generateRecommendations(household)` on Dashboard calls all analyzers
- Each analyzer returns `Recommendation[]` with `actionUrl` linking to relevant pages

**Bonus model:**
- `totalBonusAnnual` grows at `bonusGrowthRate` per year
- `cashBonusAnnual` stays fixed
- Deferred = `getDeferredBonus(bonus)` = `max(0, total - cash)`
- Tranches generated via `generateDeferredTranches()` respecting `vestingGapYears`
- Vests in equal annual tranches: year = grantYear + gap + i

**Privacy blur:**
- `PrivacyProvider` sets `data-blurred="true"` on `<html>`
- CSS blurs `.tabular-nums` and `[class*="recharts"]` elements
- Auto-blur after 5min inactivity, default blur if >24h since last visit
