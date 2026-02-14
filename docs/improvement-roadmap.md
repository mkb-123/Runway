# Runway Improvement Roadmap

User feedback from James (52, pre-retirement) and Priya (35, school-fee years) after 3 months of use.

## Tier 1 — High Impact, Both Users Want

| # | Improvement | James | Priya | Status |
|---|------------|-------|-------|--------|
| 1 | **Cash flow forecasting** — Forward-looking month-by-month view showing income (including bonus vesting dates), committed outgoings, and projected cash buffer | Sharpens spending projections | Single most important missing feature | Planned |
| 2 | **Committed outgoings model** — Track recurring obligations (school fees, mortgage, childcare) and show net worth after commitments | Makes retirement projections honest | Transforms dashboard from misleading to useful | Planned |
| 3 | **Interactive scenario modelling** — Range sliders on tax, pension, and contribution decisions with live-updating impact preview | Wants to model salary sacrifice amounts | Needs to model bonus deployment decisions | **Implementing** |
| 4 | **Configurable dashboard** — Let users choose which 3-4 cards appear at the top of the dashboard | Wants retirement countdown front and centre | Wants cash position and cash flow front and centre | Planned |
| 5 | **Smarter, personalised recommendations** — Use actual data to generate specific, actionable advice with numbers and links to relevant pages | Wants precise ISA/pension allowance guidance | Wants Tom-friendly plain-English actions | **Implementing** |

## Tier 2 — High Impact, One User Drives It

| # | Improvement | Primary Driver | Secondary Benefit |
|---|------------|---------------|-------------------|
| 6 | **Per-person retirement ages** — Support different target ages, model the gap where one person is retired and the other isn't | James (critical) | Priya (eventually) |
| 7 | **Education cost planner** — Total school + university cost horizon, per-child timeline, fee inflation, freed-up cash inflection points | Priya (critical) | James (uni cost tail) |
| 8 | **Multi-year GIA drawdown planner** — Model selling GIA holdings across tax years using both partners' CGT allowances | James (critical) | Priya (when GIA grows) |
| 9 | **Variable income projections** — Support non-uniform contributions (good years vs bad years, bonus schedules) | Priya (critical) | James (semi-retirement modelling) |

## Tier 3 — Valuable Enhancements

| # | Improvement | Rationale |
|---|------------|-----------|
| 10 | **IHT gifting scenario modeller** — Model prospective gifts and their impact on estate value over time | James's quarterly planning need |
| 11 | **Mortgage tracking** — Outstanding balance, overpayment modelling, rate change impact | Priya's second-largest outgoing, currently invisible |
| 12 | **Household tax position summary** — Combined view of both partners' tax across PAYE, self-employment, bonus tranches | Both want this, Priya more urgently |
| 13 | **Mobile-first dashboard redesign** — Reduce scroll depth, key numbers above the fold, glanceable 30-second check-ins | Priya's 90-second constraint; James's commute check |

## Visual / UX Issues

| Issue | Detail |
|-------|--------|
| **Dark mode too flat** | Background (#1F1F1F), cards (#353535), and borders (10% white) lack contrast hierarchy. Everything is grey-on-grey. |
| **No brand accent colour** | Entire UI is monochrome grey. Charts have colour but surrounding UI has none. |
| **No semantic colour** | Good/bad financial states shown in same neutral grey. Need green/amber/red for health indicators. |
| **Dashboard scroll depth** | 6 sections requiring 5+ scrolls. Key info not above the fold on mobile. |
| **Settings data entry** | 15-20 fields per person, nested editing, ~60-90 min initial setup. |

## Mobile-First Design Principles

For this app, mobile-first means:

1. **30-second glanceability** — Key numbers visible without scrolling on 375px screens
2. **Touch targets >= 44px** — All interactive elements thumb-friendly
3. **Bottom sheets over side panels** — Modals slide up from bottom (thumb zone) not from right
4. **Single column first** — Design for 375px, then enhance for wider screens
5. **Progressive disclosure** — Summary first, tap for details. Don't show everything at once.
6. **90-second task completion** — Any common task (check cash, review recommendation, run scenario) completable in under 90 seconds
7. **No hover dependencies** — Everything accessible via tap
