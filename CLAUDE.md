# Runway - UK Household Net Worth Tracker

## Project Overview

Runway is a comprehensive UK household net worth tracking and financial planning application. Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, and Recharts. All data is stored client-side in localStorage — no backend.

## Tech Stack

- **Framework:** Next.js 16 (App Router, static export)
- **UI:** shadcn/ui + Radix UI + Tailwind CSS 4
- **Charts:** Recharts 3.7
- **Validation:** Zod 4
- **Testing:** Vitest + Testing Library (124 tests)
- **Export:** SheetJS (xlsx)

## Key Directories

- `src/app/` — Pages: dashboard, accounts, holdings, projections, retirement, income, tax-planning, allocation, iht, export, settings
- `src/components/ui/` — 26 shadcn/ui components
- `src/components/charts/` — 15 financial visualization charts (Recharts)
- `src/components/layout/` — Navigation
- `src/lib/` — Financial calculation engines (tax, CGT, projections, formatting)
- `src/context/` — Global data context (localStorage persistence)
- `src/types/` — TypeScript type definitions
- `data/` — Default JSON data files (household, snapshots, transactions)

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

### Decision Process

See `.claude/agents/team-orchestration.md` for the full multi-agent review workflow.
