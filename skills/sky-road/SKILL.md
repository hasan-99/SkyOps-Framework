---
name: sky-road
description: "Terminal workflow map — Project → Journey → Milestones → Phases → Tasks. For headless/SSH/no-browser sessions. Triggers: 'show me the road', 'what's the workflow', 'how does SkyOps work', SSH context."
disable-model-invocation: true
allowed-tools:
  - Read
---

# The SkyOps Road — Project Workflow Map

**Hierarchy:** Project → Journey → Milestones (2–5, Handoff always last) → Phases (2–5 tasks each) → Tasks (one commit, one verification contract).

```
/sky-new        → kickoff + parallel research + JOURNEY.md (all milestones upfront)
                     add --auto to chain the whole road end-to-end
     ↓
For each milestone, for each phase:
  /sky-plan     → plan the phase (planner + plan-checker revision loop, fresh context)
  /sky-build    → build it (builder subagents per task, wave-based parallel)
  /sky-verify   → goal-backward check (verifier agent, fresh context)
     ↓
/sky-milestone  → close milestone, archive artifacts, prep next (human gate)
     ↓ (repeat for each milestone until Handoff)

Final milestone = Handoff:
  /sky-polish   → final design pass (whole app)
  (content + SEO)  → Phase 2
  (final QA)       → Phase 3
  /sky-ship     → deploy to production (quality gates → deploy → verify)
  /sky-handoff  → 4 deliverables: credentials, doc, final update, report
     ↓
Done.
```

## Design as a thread
Every road agent loads `PRODUCT.md + DESIGN.md + design-laws.md` substrate. Builders run `slop-detect` on every frontend commit. Verifiers score 9 design dimensions per phase, including visual system and graphics.

## /sky-polish is scope-adaptive
```
/sky-polish src/components/Button.tsx     ~30s component touch-up
/sky-polish app/dashboard                 ~3m  section pass
/sky-polish                               ~12m whole app, fan-out
/sky-polish --redesign                    ~30m ground-up redesign + complex visual concept
/sky-polish --critique                    read-only scored audit
/sky-polish --quick                       ~1m  gates only
```

## Design pivots — /sky-polish --vibe
```
/sky-polish --vibe                              fast aesthetic pivot: ONE proposed direction, swap tokens, keep layout (~3 min)
/sky-polish --vibe brutalist                    explicit pivot to named direction
/sky-polish --vibe --variants 3                 opt-in menu (rare; default flow is one-opinion)
/sky-polish --vibe --extract https://stripe.com reverse-engineer DESIGN.md from a reference URL
/sky-polish --vibe --extract ./inspo.png        same, from a local screenshot
/sky-polish --vibe --sync                       show drift between code (CSS vars, Tailwind config) and DESIGN.md
/sky-polish --vibe --sync --write               patch DESIGN.md to match code, commit
```
`/sky-polish --vibe` is for the WHOLE-SITE aesthetic. For surgical component-level fixes use `/sky-polish` (component or section scope). For ground-up structural redesign use `/sky-polish --redesign`.

## /sky-polish --loop — autonomous visual QA
```
/sky-polish --loop http://localhost:3000               screenshot + eval + fix loop
/sky-polish --loop {url} --max 4                       cap iterations
/sky-polish --loop {url} --ref design.png              anchor to reference image
/sky-polish --loop {url} --reduced-motion              force prefers-reduced-motion
/sky-polish --loop --routes /a,/b,/c                   multi-route sweep
```
Screenshots at 3 viewports (375/768/1440), scores 9 design dimensions using vision, fixes issues, re-screenshots, loops until all dims >= 3 or kill-switch triggers. Per-iteration git commits for clean revert.

## Deterministic-enforcement skills
```
/sky-optimize --deepen   spawns 3 parallel interface-design variants per candidate (Step 5b)
```
`/sky-optimize --deepen` preserves the three distinct interface proposals so the authorized user can compare or combine them; quality/performance claims require actual evaluation.

## Alignment substrate
Before high-stakes phases, run alignment skills against `.planning/CONTEXT.md` (domain glossary) and `.planning/decisions/` (ADRs):

```
/sky-scope            → relentless one-question interview, updates CONTEXT.md inline
/sky-optimize --deepen  → find shallow modules, propose Ousterhout-style refactors
/sky-test --tdd         → vertical-slice red→green→refactor for one feature
/sky-map                → adapt SkyOps to an existing brownfield repo's conventions (5th onboarding agent)
```

## Auxiliary commands
```
Lost?        → /sky-next        (state router — tells you the next command)
Don't-know?  → /sky-idk    (deep diagnostic — three isolated scans + paste-ready command sequence)
Health?      → /sky-doctor (install, state, contracts, memory, scoped synchronization queue)
Stuck/weird? → /sky-next        (diagnostic branch — scans planning + code when state alone is insufficient)
Broken thing? → /sky-fix     (root cause, minimal patch, verify, report)
Single feature? → /sky-feature (new capability: inline for trivia, fresh spawn for 1-5 files)
Research it? → /sky-research (per-phase deep research before planning; writes phase-{N}-research.md)
Save a lesson? → /sky-learn (persist a pattern/fix/client preference across sessions + projects)
Secure config? → /sky-secure (audit CLAUDE.md / settings.json / hooks / MCP for injection + leaks)
Verify FAILed? → /sky-postmortem (self-heal — find which rule/agent should have caught it)
Paused?      → /sky-next        (restore from .continue-here.md or STATE.md)
Session ending? → /sky-report (honest development context, local save and optional authorized synchronization)
Unsure plan? → /sky-scope (capture decisions before planning)
Invoice/email? → /sky-zoho-workflow (Zoho Invoice + Mail ops — invoices, cover emails, contacts, inbox)
```

## Outside-road command boundaries
```
Need a repair?       → /sky-fix       (mutates code, proves fix)
Need an investigation? → /sky-review  (read-only audit) or /sky-fix (known broken behavior)
Need an audit?       → /sky-review    (detect-only, scored findings)
Need improvement map? → /sky-optimize (report/RFC, broad opportunities)
Need visual quality? → /sky-polish    (style/layout/accessibility)
Need new aesthetic?  → /sky-polish --vibe (tokens only, layout preserved)
Need new capability? → /sky-feature   (small net-new work)
```

## Human gates
Journey approval after `/sky-new`, then a decision at each milestone boundary via `/sky-milestone`. `--auto` chains the intervening work within the approved scope. Mandatory authorization/security/correctness checks and real external-action approvals still apply.

## Context isolation
Every task runs in a fresh subagent context. Fresh context limits accumulated noise; measure actual quality and usage rather than assuming equal outcomes.
- Planner gets: PROJECT.md + CONTEXT.md + phase requirements
- Builder gets: single task from plan + PROJECT.md + CONTEXT.md
- Verifier gets: success criteria + codebase access

No accumulated garbage. No context rot.

## Quality gates (required; actual native enforcement must be verified)
- **Frontend guard** — Read `.planning/DESIGN.md` before any frontend changes
- **Deploy guard** — tsc + lint + build + tests must pass before deploy
- **Migration guard** — Catches dangerous SQL (DROP without IF EXISTS, DELETE without WHERE, CREATE TABLE without RLS)
- **Slop-detect** — Em-dash and AI-tells check on every UI commit
- **Intent verification** — Respect the user-approved scope; ask only for a genuine missing decision/authorization. File counts and editable OWNER labels do not confer privileges or waive mandatory gates

## Tracking
`.planning/tracking.json` is updated locally on every push. It feeds statusline, stop-session-log, and `/sky-report`; authorized project synchronization uses explicit scoped payloads and server acknowledgment; no business server passively reads private Git state.
Never edit tracking.json manually — hooks update it from STATE.md.

## Compaction — ALWAYS preserve
Project path/name, branch, current phase, modified files, decisions, test results, in-progress work, errors, tracking.json state.
