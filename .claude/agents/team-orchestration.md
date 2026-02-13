# Finance Agent Team — Orchestration Protocol

## Team Structure

```
                    ┌─────────────────────┐
                    │   TEAM LEAD (Claude) │
                    │  Final decision maker│
                    └─────────┬───────────┘
                              │
          ┌───────────┬───────┴───────┬───────────┐
          │           │               │           │
    ┌─────┴─────┐ ┌───┴────┐ ┌───────┴──┐ ┌──────┴──────┐
    │ UX Design │ │Charting│ │Financial │ │   Devil's   │
    │  (Apple)  │ │ Expert │ │ Advisor  │ │  Advocate   │
    └───────────┘ └────────┘ └──────────┘ └─────────────┘
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

**1. Financial Advisor speaks first**
   - Validates the user need. Is this something real clients care about?
   - Provides priority ranking (Priority 1-5).
   - Flags any regulatory or accuracy concerns.

**2. UX Designer speaks second**
   - Evaluates the proposed interaction and layout.
   - Assesses information hierarchy and cognitive load.
   - Proposes specific design approach (components, layout, states).

**3. Charting Expert speaks third** (if charts are involved)
   - Audits chart type selection.
   - Recommends specific Recharts implementation.
   - Warns about visualisation anti-patterns.

**4. Devil's Advocate speaks last**
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
- Financial Advisor: [SUPPORT / CONCERN / OPPOSE] — [one line]
- UX Designer: [SUPPORT / CONCERN / OPPOSE] — [one line]
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

1. **Financial Advisor vs UX Designer** — If the advisor says users need it but the designer says it's cluttered: find a progressive disclosure solution (show summary, let users drill in).

2. **Charting Expert vs UX Designer** — If the chart expert wants more data density but the designer wants simplicity: default to the simpler view with an option to expand.

3. **Anyone vs Devil's Advocate** — The Devil's Advocate can be overruled, but their "kill question" must be answered. If nobody can answer it, the feature is blocked.

4. **Unanimous opposition** — If 3+ agents oppose, the Team Lead should not override without exceptional justification.

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
