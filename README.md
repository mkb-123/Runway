# Net Worth Tracker

A comprehensive UK household net worth tracker built with Next.js. Track accounts, holdings, income, tax planning, retirement projections, and more — all from your browser with no backend required.

**Live app:** Available via GitHub Pages once deployed

## Features

- **Dashboard** — Total net worth summary with period-over-period changes, projections, and breakdowns by person and tax wrapper
- **Settings** — Full data entry forms for people, accounts, holdings, income, contributions, funds, IHT, and transactions. All data is saved to your browser's localStorage
- **Accounts** — View all accounts grouped by person with provider, type, and current value
- **Holdings** — Detailed fund holdings with units, cost basis, current value, gain/loss, and gain percentage
- **Projections** — Compound growth scenarios at configurable return rates over 30 years
- **Retirement** — FIRE target tracking, Coast FIRE analysis, pension bridge planning, and state pension estimates
- **Income** — UK income tax, National Insurance, and student loan calculations with cash flow waterfall charts
- **Tax Planning** — Bed & ISA planner, pension optimisation modelling, wrapper efficiency analysis, and ISA/pension allowance tracking
- **Allocation** — Investment distribution by asset class, region, and tax wrapper with pie and bar charts
- **IHT** — Inheritance tax estimator with nil-rate band, residence nil-rate band, spouse exemption, and 7-year gift taper
- **Export** — Download data as Excel spreadsheets (individual sheets or full workbook)

## Getting Started

1. Deploy the app or run it locally (see below)
2. Go to **Settings** (second link in the navigation) to enter your financial data
3. All other pages automatically compute from the data you provide in Settings

All data is stored locally in your browser — nothing is sent to any server. The included JSON files in `data/` contain fictional sample data for demonstration purposes only.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- [Next.js](https://nextjs.org) with App Router (static export for GitHub Pages)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com) v4
- [shadcn/ui](https://ui.shadcn.com) component library
- [Recharts](https://recharts.org) for data visualisation
- [SheetJS](https://sheetjs.com) for Excel export
- localStorage for client-side data persistence

## Testing

```bash
npm test
```

Runs 124 tests across 5 suites covering tax calculations, projections, CGT rules, formatting, and tax constants.
