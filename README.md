# Runway

UK household net worth tracker and financial planner. Track accounts, holdings, income, tax planning, retirement projections, and more — all client-side with no backend.

**Live app:** [https://mkb-123.github.io/Runway/](https://mkb-123.github.io/Runway/)

## Features

- **Configurable Dashboard** — 3 hero metric slots (net worth, cash position, retirement countdown, savings rate, FIRE progress, and more). Collapsible sections with progressive disclosure. Person toggle to switch between household members.
- **Committed Outgoings** — Track mortgage, school fees, childcare, insurance, and other recurring obligations. Factors into dashboard metrics and projections.
- **Accounts & Holdings** — All accounts grouped by person with provider, type, value, fund holdings, cost basis, and gain/loss.
- **Projections** — Compound growth scenarios at configurable return rates over 30 years.
- **Retirement** — FIRE target tracking, Coast FIRE, pension bridge planning, state pension estimates, and income timeline.
- **Income & Tax** — UK income tax, NI, and student loan calculations with cash flow waterfall charts.
- **Tax Planning** — Bed & ISA planner, pension optimisation, wrapper efficiency, ISA/pension allowance tracking.
- **What-If Scenarios** — Model salary sacrifice, bonus deployment, market crashes, and contribution changes with live impact preview.
- **Allocation** — Distribution by asset class, region, and tax wrapper.
- **IHT** — Inheritance tax estimator with nil-rate band, RNRB, spouse exemption, and 7-year gift taper.
- **Export** — Download as Excel spreadsheets or print a full report.

## Getting Started

1. Visit the [live app](https://mkb-123.github.io/Runway/)
2. Go to **Settings** to enter your financial data
3. All pages compute automatically from the data you provide

All data is stored locally in your browser — nothing is sent to any server.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- [Next.js](https://nextjs.org) 16 with App Router (static export)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com) v4
- [shadcn/ui](https://ui.shadcn.com) + Radix UI
- [Recharts](https://recharts.org) for data visualisation
- [Zod](https://zod.dev) v4 for runtime validation
- [SheetJS](https://sheetjs.com) for Excel export
- localStorage for client-side persistence

## Testing

```bash
npm test
```

143 tests across 6 suites covering tax calculations, projections, CGT, recommendations, formatting, and constants.
