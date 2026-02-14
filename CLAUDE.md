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

### Guidance for Coding Agents

- Test hypotheses by running code; leverage computational advantages.
- Build minimally; avoid speculative abstractions.
- Execute large mechanical changes confidently when core design improves.
- Treat type system resistance as design signals; avoid casts and reflection.
- Question unclear directions rather than producing extensive wrong approaches.
- Derive from principles rather than pattern-matching on memorized practices.
- Write comprehensive property-based tests before implementation.
