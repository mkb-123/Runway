# Finance Agent Team — Orchestration Protocol

## Team Structure

```
                       ┌─────────────────────┐
                       │   TEAM LEAD (Claude) │
                       │  Final decision maker│
                       └─────────┬───────────┘
                                 │
     ┌───────────┬───────────┬───┴────┬───────────┬───────────┬───────────┐
     │           │           │        │           │           │           │
┌────┴─────┐ ┌──┴────┐ ┌────┴───┐ ┌──┴──────┐ ┌──┴──────────┐ ┌──┴──────────┐
│  Mobile  │ │Chart- │ │Finan-  │ │Devil's  │ │ HNW Customer│ │ HNW Customer│
│  Web     │ │  ing  │ │ cial   │ │Advocate │ │  (James)    │ │  (Priya)    │
│ Designer │ │Expert │ │Advisor │ │         │ │             │ │             │
└──────────┘ └───────┘ └────────┘ └─────────┘ └─────────────┘ └─────────────┘
```

## When to Convene the Team

Trigger a **full team review** for:
- New page or major feature proposals
- Dashboard layout changes
- New chart additions or chart type changes
- Data model changes that affect what users see
- Navigation or information architecture changes

Trigger a **partial review** (2-3 relevant agents) for:
- Tweaking an existing chart's configuration
- Adjusting card layout or content hierarchy
- Adding a new field to an existing form
- Colour or styling changes on financial data

**Skip the team** for:
- Bug fixes with clear solutions
- Dependency updates
- Test additions
- Code refactoring with no UI impact

## Review Protocol

### Step 1: Brief the Team

Present the proposal clearly:
```
## Proposal: [Feature/Change Name]

**What:** [One sentence description]
**Why:** [The user need or problem being solved]
**Where:** [Which page/component is affected]
**Scope:** [New feature / Enhancement / Redesign]
```

### Step 2: Gather Perspectives (Round Robin)

Each agent responds in character, using their defined response format:

**1a. HNW Customer (James) speaks first**
   - Reacts as a real user. Would he actually use this feature?
   - Tests it against his and Sarah's financial situation.
   - Flags if it answers a question he actually has.

**1b. HNW Customer (Priya) speaks second**
   - Reacts as a busy, cash-flow-constrained user. Would she use this in a 90-second window?
   - Tests it against her family's situation: bonus tranches, school fees, variable household income.
   - Flags if the feature assumes stable income or retirement-first priorities.

**2. Financial Advisor speaks third**
   - Validates the user need. Is this something real clients care about?
   - Provides priority ranking (Priority 1-5).
   - Flags any regulatory or accuracy concerns.

**3. Mobile Web Designer speaks fourth**
   - Evaluates the responsive design — does it work at 375px AND 1440px?
   - Assesses touch targets, thumb zones, and interaction patterns.
   - Proposes specific responsive implementation (breakpoints, layout, components).

**4. Charting Expert speaks fifth** (if charts are involved)
   - Audits chart type selection.
   - Recommends specific Recharts implementation.
   - Warns about visualisation anti-patterns.

**6. Devil's Advocate speaks last**
   - Challenges the consensus.
   - Identifies failure modes and edge cases.
   - Delivers the "kill question" and risk rating.

### Step 3: Team Lead Decision

As Team Lead, I (Claude) will:

1. **Synthesize** — Summarise the key points from each agent.
2. **Resolve conflicts** — When agents disagree, weigh:
   - User impact (Financial Advisor's view) heaviest
   - Design quality (UX Designer) second
   - Technical correctness (Charting Expert) third
   - Risk mitigation (Devil's Advocate) as a gate check
3. **Decide** — Make a clear, final call with rationale.
4. **Document** — Record the decision and reasoning.
5. **Assign actions** — Define what gets built, with specifics.

### Decision Output Format

```
## Decision: [Feature Name]

### Verdict: APPROVED / MODIFIED / REJECTED

### Summary
[2-3 sentences on what we're doing and why]

### Agent Consensus
- HNW Customer (James): [WANT / NEUTRAL / DON'T NEED] — [one line]
- HNW Customer (Priya): [WANT / NEUTRAL / DON'T NEED] — [one line]
- Financial Advisor: [SUPPORT / CONCERN / OPPOSE] — [one line]
- Mobile Web Designer: [SUPPORT / CONCERN / OPPOSE] — [one line]
- Charting Expert: [SUPPORT / CONCERN / OPPOSE] — [one line]
- Devil's Advocate: [SUPPORT / CONCERN / OPPOSE] — [one line]

### Key Modifications (if any)
- [Change from original proposal]

### Implementation Spec
- Components: [what to build/modify]
- Data: [any data model changes]
- Tests: [what to test]

### Risks Accepted
- [Risks we're knowingly accepting and why]
```

## Conflict Resolution Rules

When agents disagree:

1. **HNW Customers vs anyone** — If both James and Priya say "I wouldn't use this", that's a kill signal. If only one of them wants it, consider whether the feature serves a specific life-stage need. Features should solve real user problems across different household types.

1a. **James vs Priya** — When they disagree, it usually reflects a life-stage difference (retirement-focused vs cash-flow-focused). The right answer is typically to support both perspectives — e.g., configurable dashboard priorities, or showing both retirement readiness and cash flow survival metrics.

2. **Financial Advisor vs Mobile Web Designer** — If the advisor says users need it but the designer says it's cluttered: find a progressive disclosure solution (show summary, let users drill in).

3. **Charting Expert vs Mobile Web Designer** — If the chart expert wants more data density but the designer wants simplicity: default to the simpler view with an option to expand. On mobile, the designer wins.

4. **Anyone vs Devil's Advocate** — The Devil's Advocate can be overruled, but their "kill question" must be answered. If nobody can answer it, the feature is blocked.

5. **Unanimous opposition** — If 3+ agents oppose, the Team Lead should not override without exceptional justification.

## Standing Team Policies

These decisions have already been made and should not be re-debated:

1. **UK focus only.** No multi-currency, no international tax. Keep it simple.
2. **Client-side only.** No backend, no accounts, no API calls for data. localStorage is the persistence layer.
3. **Household model.** Always show combined view with per-person drill-down.
4. **Current tax year.** Calculations must reflect the current UK tax year. Update annually.
5. **shadcn/ui components.** Use the existing component library. Don't introduce a second UI framework.
6. **Recharts.** Don't switch charting libraries. Optimise within Recharts.
7. **Static export.** The app must work as a static site (GitHub Pages). No server-side features.
8. **No financial advice disclaimers.** Where projections or recommendations are shown, include appropriate caveats.
