# Runway Improvement Roadmap

Evolved from 4 rounds of deep-dive UX interviews with James (52, pre-retirement) and Priya (35, school-fee years). UX principles are the organising priority — features are ordered by how directly they solve real usage-journey failures, not by technical complexity.

## Design North Stars

These principles emerged from watching both customers describe their actual usage. Every feature must satisfy at least one:

1. **2-second glance** — The most important number is visible without scrolling on a 375px phone screen
2. **90-second task completion** — Any primary task (check position, review recommendation, run scenario) completes in under 90 seconds on mobile
3. **Honesty over flattery** — Net worth without committed outgoings is a lie. The app must show the real picture.
4. **Decision support, not data display** — "Where should this £22k go?" is more valuable than "Your ISA balance is £65k"
5. **Direct manipulation** — Sliders on the page, not in a separate panel. See the impact as you drag.
6. **Household-native** — Every view supports James | Sarah | Household (or Priya | Tom | Household). Couples are the unit of planning.

---

## P0 — UX Foundation (do first, everything else depends on this)

These are not features — they are the minimum bar for the app to be usable for its two primary personas. Nothing in P1+ should be started until P0 is shipped.

### 0a. Configurable Hero Dashboard

**Problem:** Dashboard requires 8-9 scrolls on mobile. James's #1 metric (retirement countdown) is on a separate page. Priya's #1 metric (cash position) is the 4th card in a stacked column.

**Solution:** Three customisable hero metric slots at the top of the dashboard, zero scrolling required.

**UX spec:**
- 3 metric slots in a tight horizontal row (mobile: stack to 1 column with very compact height)
- Metric options (preset list, user picks 3): Total Net Worth, Cash Position, Retirement Countdown, Period Change (MoM), Year-on-Year Change, Savings Rate, FIRE Progress %, Next Committed Outgoing
- Each metric: large bold number + small label + optional trend indicator (up/down arrow or sparkline)
- Default for new users: Total Net Worth, Period Change, Retirement Countdown
- Configuration: Settings page, drag to reorder, tap to swap — or long-press on a metric card to change it in-place
- Priya's ask: Cash Position hero metric includes a tiny 3-month cash trajectory sparkline; if trending toward buffer danger zone, sparkline turns amber

**James says:** *"If I can see 'Retirement: 4y 7m' the instant I open the app, I'll check every morning."*
**Priya says:** *"Cash position with a sparkline showing I'm safe until March — that's a 2-second check."*

### 0b. Committed Outgoings Model

**Problem:** Net worth of £720k sounds healthy until you subtract £54k school fees + £55k mortgage + childcare. The app is actively misleading without committed outgoings. Retirement projections are dishonest without them.

**Solution:** A committed outgoings data model, entered once in Settings, visible everywhere.

**UX spec:**
- New "Commitments" section in Settings (or a dedicated tab): recurring outgoings with amount, frequency, start date, end date (optional)
- Types: School fees, Mortgage, Rent, Childcare, Insurance, Other
- Per-child education entries (child name, school, annual fee, expected end year)
- Dashboard secondary metric: "Net worth after annual commitments: £XXX"
- Projections and retirement pages factor committed outgoings into calculations
- Committed outgoings appear as red baseline in any cash flow or projection chart

**Priya says:** *"This is the difference between the app lying to me and telling the truth."*
**James says:** *"My retirement projections are optimistic without this. Our annual spend is higher than the app thinks."*

### 0c. Progressive Disclosure Redesign

**Problem:** Dashboard shows 6 full sections (summary cards, recommendations, wrapper breakdown, trajectory chart, history chart, person chart) all expanded. Mobile users scroll past content they didn't ask for.

**Solution:** Summary-first, expand-on-demand pattern for all dashboard sections below the hero.

**UX spec:**
- Hero metrics (0a) always visible, never collapsible
- Top recommendation: show ONE card — the highest-priority action with specific amounts. "Show more" expands to full list
- Remaining sections: collapsed by default on mobile (<640px), showing only section title + one-line summary (e.g., "Wrapper split: 55% pension, 25% ISA, 12% GIA, 8% cash"). Tap to expand.
- Desktop (>1024px): can show 2-3 sections expanded by default
- Sections remember their open/closed state in localStorage
- Total mobile scroll depth target: 2 scrolls max to see all summaries, not 8-9

**James says:** *"Summary first, tap for details. Don't show me everything at once."*
**Priya says:** *"If I can see all the headlines in 2 scrolls and tap into the one I care about, that's 30-second glanceability."*

### 0d. Person Segmented Control

**Problem:** James and Sarah have different financial positions but the app primarily shows combined views. Priya sometimes hands her phone to Tom, who sees her personalised view. No quick way to switch perspectives.

**Solution:** A segmented control [Person 1] [Person 2] [Household] at the top of every page.

**UX spec:**
- Segmented control (pill-style toggle) appears below the page title on every page
- Segments use person names from settings (e.g., [James] [Sarah] [Household])
- Selection persists across page navigations within a session (but defaults to Household on fresh load)
- Dashboard: hero metrics, recommendations, and charts filter to selected person
- Accounts, Holdings, Allocation: filter to show only selected person's data
- Retirement: show selected person's retirement countdown, pension pot, bridge analysis
- Income: show selected person's tax position, NI, effective rate
- Household view: combined data (current behaviour)
- On mobile: segmented control is compact (abbreviated names if needed: "J | S | All")

**James says:** *"When Sarah and I sit down quarterly, I want to flip between her view and mine, then look at the combined picture. Three taps."*
**Priya says:** *"When Tom picks up my phone, he should be able to tap his name and see his situation."*

---

## P1 — Core Workflows (the features that make the app a planning tool, not just a dashboard)

### 1a. Cash Flow Forecast

**Problem:** Priya needs to know whether she can survive the next 6 months. "Will cash dip below my £80k buffer before the next bonus?" The app shows snapshots, not forecasts.

**Solution:** Month-by-month cash flow forecast page, 6-12 months forward.

**UX spec:**
- New page or dashboard section: "Cash Flow Forecast"
- Waterfall chart: green bars for income events (salary, bonus vesting dates), red bars for outgoings (committed outgoings from 0b, plus estimated spending)
- Running balance line overlaid on the waterfall
- Horizontal band showing cash buffer danger zone (configurable threshold, Priya's is £80k)
- If balance dips into danger zone, the bar and balance line turn amber/red
- Income events include: regular salary, bonus vesting dates (from settings), expected investment income
- Outgoings include: committed outgoings (0b), estimated discretionary spending (configurable)
- Bonus vesting dates marked with a distinct icon/label
- Mobile: horizontally scrollable if >6 months shown; default view is 6 months

**Dependency:** Requires 0b (committed outgoings model).

**Priya says:** *"This is THE feature. Green bars up, red bars down, danger line at £80k. Five seconds to see if I'm safe."*
**James says:** *"I'd use this to plan larger purchases — 'can we afford the car in July without touching investments?'"*

### 1b. Bonus / Income Deployment Wizard

**Problem:** Priya's highest-value moment is when a bonus vests (3x/year). She has 30 minutes to decide where £22k goes. The app offers a scenario playground, not decision support.

**Solution:** A guided "Deploy Income" flow triggered by income events.

**UX spec:**
- Trigger: manual ("Deploy bonus" button on cash flow page or dashboard) or prompted when a new income event date passes
- Guided wizard (3-5 screens, linear flow):
  1. **Cash buffer check:** "Your target buffer is £80k. Current cash: £72k after upcoming fees. Recommended: keep £8k in cash." [Adjust] [Accept]
  2. **ISA allowance:** "You've used £12k of £20k this year. Recommended: £8k to ISA." Person selector if household. [Adjust] [Accept]
  3. **Pension check:** "Your adjusted income is £160k. Additional pension sacrifice of £X would save £Y in tax." Or: "Pension annual allowance already maximised. Skip." [Adjust] [Accept] [Skip]
  4. **Remaining:** "£6k remaining. Options: Tom's ISA (£20k unused), GIA, mortgage overpayment, keep in cash." [Choose]
  5. **Summary:** "Here's your deployment plan. Save this as a note or apply as scenario."
- Each step shows specific amounts calculated from actual data (allowance usage, tax position, cash buffer)
- The wizard produces a concrete plan, not a vague recommendation

**Priya says:** *"This turns a 30-minute research session into a 5-minute guided decision."*
**James says:** *"I'd use this quarterly when we review contributions. 'Where should the next £5k go?'"*

### 1c. Per-Person Retirement Ages + Interactive Slider

**Problem:** James wants to retire at 57, Sarah at 55. The retirement page uses `currentAge + 10` for everyone. The income timeline chart can't model the gap where one partner is retired and the other isn't.

**Solution:** Per-person retirement ages in settings, plus a direct-manipulation slider on the retirement page.

**UX spec:**
- Settings: each person has a "Target retirement age" field (already partially exists as pension access age, but this is different — it's when they plan to stop working)
- Retirement page: slider per person, range 50-75, step 1
- As the slider drags, the retirement income timeline chart updates in real time
- The chart clearly shows the gap period (e.g., James retires at 57, Sarah keeps working until 55 — 2 years where only Sarah's income flows, then both draw pensions)
- Pension bridge analysis calculates per-person, showing each person's accessible-wealth bridge

**James says:** *"Drag the slider, see the chart move. That's the single most satisfying interaction you could build."*
**Priya says:** *"Retirement is distant for me, but I want to see what happens if I work to 55 vs 60. The difference in quality of life is massive."*

### 1d. In-Context Scenario Controls

**Problem:** The global scenario panel is hard to discover (small header button) and disconnects the question from the answer. Users ask "what if?" while looking at a specific page, not while looking at a global control panel.

**Solution:** Each page gets its own relevant "What if?" controls, embedded in the page content.

**UX spec:**
- Retirement page: retirement age slider (1c), growth rate toggle (pessimistic/expected/optimistic), "What if market drops 30%?" quick button
- Income page: salary adjustment slider, "What if I salary sacrifice £X more?" input
- Projections page: contribution rate slider, growth rate toggle
- Dashboard: scenario presets as quick-action buttons (Market Crash, Increase Contributions, etc.)
- These in-context controls activate the existing scenario system under the hood
- The global scenario panel remains for power users who want full control
- In-context controls are simpler: fewer options, pre-labelled, one-tap activation

**James says:** *"I don't want to leave the retirement page to ask a retirement question."*
**Priya says:** *"'What if Tom has a bad year?' should be a button on the income page, not a hunt through a side panel."*

### 1e. Contextual, Time-Aware Recommendations

**Problem:** Current recommendations are generic ("You have remaining ISA allowance") and ignore timing, recent events, and household context. Priya needs "put this bonus here NOW", not "consider using your ISA."

**Solution:** Upgraded recommendation engine that considers timing, allowance usage to date, recent income events, and tax year position.

**UX spec:**
- Dashboard shows ONE top recommendation prominently (not 5-10 cards). "Show more" for the rest.
- Recommendations include specific amounts: "Salary sacrifice £2,400 more this month to save £960 in tax" not "Consider salary sacrifice"
- Time-aware: "Tax year ends in 23 days. You have £8k ISA allowance remaining." urgency framing
- Event-aware: "Your March bonus vested. See deployment plan." linking to 1b wizard
- Per-person: recommendations tagged with the person they apply to, filtered by person toggle (0d)
- Priority: one clear #1 recommendation per person, ranked by £ impact
- Plain-English mode (existing toggle) with Tom-friendly language

**James says:** *"'You could save £960 by salary sacrificing £2,400 before April 5th' — that's actionable. That's specific. That's worth opening the app for."*
**Priya says:** *"If the app notices my bonus just landed and tells me what to do with it, I'll trust it."*

---

## P2 — Horizon Planning (medium-term features that deepen the planning experience)

### 2a. Education Cost Horizon Planner

**Problem:** Priya has 3 children in private school. Total remaining cost: ~£756k at current rates, ~£890k with fee inflation. She can't see the timeline, the per-child costs, or the inflection points when fees drop.

**UX spec:**
- Gantt-style horizontal bar chart: one bar per child, spanning school start to school end year
- Below each bar: cumulative cost for that child (including fee inflation option)
- Total remaining cost prominently displayed
- Inflection points marked: "When Arjun finishes (2036): outgoings drop £18k/year. Savings rate increases from X% to Y%."
- Net worth trajectory overlay showing the step-changes at each inflection point
- Option to include university costs (additional years per child, different fee rate)

**Priya says:** *"This chart is the emotional centrepiece. Seeing the inflection points turns drowning into 'I can see the shore.'"*

### 2b. Variable Income Projections

**Problem:** Tom's consulting income ranges from £45k-£80k/year. Priya's bonus tranches are lumpy. Current projections assume stable monthly income — they're fiction for this household.

**UX spec:**
- Income entry supports a range: base case, pessimistic case, optimistic case per person
- Projections show a band (fan chart) rather than a single line for households with variable income
- "Bad year" scenario: what if Tom earns only £30k? What if Priya's bonus is deferred?
- Cash flow forecast (1a) shows the range as a shaded band around the running balance

**Priya says:** *"Let me enter Tom's income as £45k-£80k. Show me the band. That's honest."*

### 2c. Multi-Year GIA Drawdown Planner

**Problem:** James has £180k in a GIA with significant gains. Selling all at once wastes CGT allowances. He needs to plan disposals across tax years using both his and Sarah's £3k annual exemptions.

**UX spec:**
- GIA drawdown modelling page: target amount to raise, over how many tax years
- Uses both partners' CGT exemptions (£3k each = £6k combined per year)
- Shows year-by-year disposal plan with estimated CGT per year
- Models interspousal transfers (bed & ISA via spouse) where beneficial
- Comparison: "Sell all now (CGT: £X) vs. staged over N years (CGT: £Y). Saving: £Z"

**James says:** *"This is the most tax-efficient thing I'll do in the next 5 years. The maths is clear but I want the app to do it."*

### 2d. Scenario System v2 (All Pages)

**Problem:** Scenarios currently work on 2 of 9 content pages (Dashboard and Retirement). The amber banner shows on all pages, implying scenario data is active everywhere — but it isn't. Users lose trust.

**UX spec:**
- All 9 content pages use `useScenarioData()` instead of `useData()` for household data
- Pages that don't have meaningful scenario differences show a note: "This page is not affected by the current scenario"
- Or remove the scenario banner from pages where it doesn't apply

### 2e. Settings Onboarding Wizard

**Problem:** Initial setup takes 60-90 minutes. Sarah and Tom won't do it. The wall of fields is intimidating.

**UX spec:**
- 5-step guided wizard for first-time users:
  1. "Tell us about your household" — names, dates of birth, relationships
  2. "Add your accounts" — account type picker, provider, approximate balance
  3. "Enter your income" — salary, bonus structure, employment type
  4. "Set your goals" — retirement age, target income (with sensible defaults)
  5. "Review and go" — summary of everything entered, edit any field
- Progressive: each step is one screen, one task, clear "Next" button
- Can be skipped and returned to later
- Existing Settings page remains for detailed editing after initial setup
- Target: 15-minute initial setup, down from 60-90 minutes

---

## P3 — Polish & Depth

| # | Feature | Rationale | Primary User |
|---|---------|-----------|-------------|
| 3a | **IHT gifting scenario modeller** | Model gifts, 7-year rule, taper relief impact on estate | James (quarterly) |
| 3b | **Mortgage tracking** | Outstanding balance, overpayment modelling, rate change impact | Priya (second-largest outgoing) |
| 3c | **Household tax position summary** | Combined view across PAYE, self-employment, bonus tranches | Both (Priya more urgently) |
| 3d | **Dark mode colour hierarchy** | Fix grey-on-grey, add contrast hierarchy, semantic colour | Both (aesthetic) |
| 3e | **Brand accent colour** | Add a single accent colour to break monochrome UI | Both (aesthetic) |

---

## Visual / UX Debt (fix alongside features)

| Issue | Detail | Fix With |
|-------|--------|----------|
| Dashboard scroll depth (8-9 scrolls) | Key info not above fold on mobile | P0c (progressive disclosure) |
| No semantic colour for health indicators | Good/bad states shown in same neutral grey | P0a (hero metrics with trend colour) |
| Settings tab layout | 6 tabs spanning 2 rows looks janky on mobile | P2e (onboarding wizard) + immediate CSS fix |
| Scenario banner on non-scenario pages | Amber banner shows on 9 pages but data only changes on 2 | P2d (scenario system v2) |
| Dark mode too flat | Grey-on-grey, no contrast hierarchy | P3d |
| Retirement hardcoded age | `currentAge + 10` instead of user-set retirement age | P1c |
| Recommendations coverage gaps | ISA 50-99% gets no recommendation; Bed & ISA misses high gains | P1e |

---

## Mobile-First Design Principles

These principles govern all feature design. Violation of any principle is a bug.

1. **2-second glance** — Hero metrics visible without scrolling on 375px
2. **90-second task completion** — Any primary task completes in 90 seconds on mobile
3. **Touch targets >= 44px** — All interactive elements thumb-friendly
4. **Bottom sheets over side panels** — Modals slide up from bottom (thumb zone)
5. **Single column first** — Design for 375px, enhance for wider
6. **Progressive disclosure** — Summary first, tap for details. Never wall-of-content.
7. **No hover dependencies** — Everything accessible via tap
8. **Direct manipulation** — Sliders and controls on the page, not in separate panels
9. **Household-native** — Person toggle on every page
10. **Decision support over data display** — Guided flows over raw data tables

---

## Customer Quotes (Reference)

### James
> "If I can see 'Retirement: 4y 7m' the instant I open the app, I'll check every morning."

> "Drag the slider, see the chart move. That's the single most satisfying interaction you could build."

> "The app feels like a spreadsheet with better formatting, not a planning tool."

> "Sarah won't use the app until setup is less painful."

### Priya
> "Net worth is a vanity metric for me — my house is worth £1.15M but I can't pay school fees with it."

> "My single most important daily number requires 4 scrolls. That's a failed UX."

> "I need decision support, not a scenario playground."

> "Seeing the inflection points turns drowning into 'I can see the shore.'"

> "If the app notices my bonus just landed and tells me what to do with it, I'll trust it."
