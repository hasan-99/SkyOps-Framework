# SkyOps Developer Guide

> Follow the road. Type the commands. The framework handles the rest.
> `--auto` chains the road with journey approval and milestone-boundary decisions; required security, authorization and correctness gates still apply.

Preservation inventory: **29 active skill entry points and 9 specialist agents**. Native execution and complete workflow parity are tracked separately in the authoritative plan. Use `/sky-fix` for broken behavior, `/sky-feature` for new single-feature work, `/sky-scope` in PROJECT MODE for kickoff capture, `/sky-polish --loop` for the autonomous visual loop, and `/sky-polish --vibe` for fast layout-preserving aesthetic pivots.

For the identity statement see [`SOUL.md`](./SOUL.md). For every skill flag see [`FLAGS.md`](./FLAGS.md). When something breaks see [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md). For release history see [`CHANGELOG.md`](./CHANGELOG.md).

## The Road

```
/sky-new                ← Set up project (once). Produces JOURNEY.md — all milestones to handoff.
     ↓
For each phase of the current milestone:
  /sky-plan             ← Plan it (planner + plan-checker, story-file format)
  /sky-build            ← Build it (builder subagents with pre-inlined context)
  /sky-verify           ← Check it actually works (goal-backward + per-task AC)
     ↓
/sky-milestone          ← Close milestone, open next from JOURNEY.md
     ↓
...repeat per milestone until the Handoff milestone...
     ↓
/sky-polish             ← Design pass (part of Handoff milestone)
/sky-ship               ← Deploy to production
/sky-handoff            ← Enforce the 4 handoff deliverables
     ↓
Done.
```

## Auto Mode

Append `--auto` to `/sky-new` and the framework chains every step:

```
/sky-new --auto
  → research runs → JOURNEY.md written → approve the whole journey ONCE
  → auto: plan 1 → build 1 → verify 1 → plan 2 → build 2 → verify 2 → ...
  → pause at each milestone boundary: "Continue to M{N+1}?"
  → resume: plan 1 → build 1 → ... of new milestone
  → eventually reaches Handoff milestone's last phase → ship → handoff → report → done
```

**Human checkpoint categories in auto mode:**
1. Journey approval after `/sky-new` research
2. Each milestone boundary

These are checkpoint categories, not a fixed count of prompts or permission waivers. Required approvals for external actions and scoped privileges remain in force. **Additional halt case:** if a phase fails verification beyond the gap-cycle limit (default 2), the chain stops and asks for human intervention.

## The Road Commands

| When | Command | What it does |
|------|---------|-------------|
| Starting | `/sky-new` | Set up project with full journey (all milestones → Handoff) |
| Starting (auto) | `/sky-new --auto` | Same + chain through building automatically |
| Brownfield | `/sky-map` | Map an existing codebase BEFORE `/sky-new` |
| Building | `/sky-plan` | Plan the current phase |
| | `/sky-build` | Build it (parallel tasks) |
| | `/sky-verify` | Check it actually works |
| Milestone | `/sky-milestone` | Close current, open next from JOURNEY.md |
| Single feature | `/sky-feature` | Auto-scoped: inline for trivia, fresh spawn for 1-5 files |
| Finishing | `/sky-polish` | Design and UX pass (scope-adaptive: component / route / app / redesign / critique / quick / loop) |
| | `/sky-polish --loop` | Autonomous visual-polish loop: screenshot, vision-eval, fix, repeat |
| Pivot the vibe | `/sky-polish --vibe` | Fast aesthetic pivot (~3 min): swap tokens, keep layout. Propose ONE direction. |
| | `/sky-polish --vibe --extract <URL>` | Reverse-engineer DESIGN.md from a reference site |
| | `/sky-polish --vibe --sync` | Show / patch drift between code (CSS vars + Tailwind) and DESIGN.md |
| | `/sky-ship` | Deploy to production |
| | `/sky-handoff` | Deliver to client (4 mandatory deliverables) |
| Reporting | `/sky-report` | Preserve an honest development-session report and recovery context; commit/push and synchronization stay authorized |
| Optimize | `/sky-optimize --deepen` | Find shallow modules; v5.3+ spawns 3 parallel interface-design variants per candidate |
| Harness eval | `skyops eval --run --write` | Run machine contract checks and write scored local verification artifacts for development reporting |
| Planning hygiene | `skyops planning-hygiene scan` | Detect loose `.planning/` reports/assets before they turn into folder bloat |
| Road view | `/sky-road` | View and navigate journey/milestone/phase status |
| Lost — need next command | `/sky-next` | Mechanical state-driven router |
| Confused — need to understand the situation | `/sky-idk` | Three-scan diagnostic + paste-ready command sequence |

## Full Journey Hierarchy

```
Project
└─ Journey           (the whole arc — mapped upfront by /sky-new, lives in .planning/JOURNEY.md)
   └─ Milestone      (a release — 2-5 total, Handoff is always last)
      └─ Phase       (a feature-sized deliverable, 2-5 tasks)
         └─ Task     (atomic unit, one commit, one verification contract)
```

Hard rules (enforced by `state.js` and the roadmapper):
- **Milestone count: 2 to 5.** Final milestone is always literally named "Handoff".
- **≥ 2 phases per non-Handoff milestone** (single-phase "milestones" are phases, not milestones).
- **Milestone numbering is contiguous** — no skipped numbers.
- **Handoff milestone has fixed 4 phases:** Polish, Content + SEO, Final QA, Handoff (credentials + walkthrough + archive + final development report).

## Rules

1. **Feature branches only** — never push to main
2. **Read before write** — don't edit files you haven't read
3. **MVP first** — build what's asked, nothing extra
4. **Every task has a `Why`** (story-file format) — if you can't explain why a task matters in one sentence, it probably shouldn't exist
5. **`/sky-next` is your friend** — lost on "what's my next command?" The router reads state and returns the next move.
6. **`/sky-idk` is your deeper friend** — confused about *the situation itself*. Reads conversation + planning + code, then returns guidance plus a paste-ready SkyOps command sequence.

## Profiles

A project runs under one profile, set via `$SKYOPS_PROFILE` (defaults to `strict`). `state.js check` surfaces the active profile in its output.

- **`strict`** (default for the team) — hard gates, no waivers. Every gate must pass before the road advances.
- **`standard`** — advisory planning alternatives may be documented in `.planning/decisions/`. Mandatory security, authorization and correctness gates cannot be waived by a role claim or environment variable.

## When You're Stuck

```
/sky-next       ← "what's my next command?" (state-driven, instant)
/sky-idk   ← "what is actually going on here?" (three-scan diagnostic, ~30-45s)
```

If neither helps, give the selected Claude Code or Codex host the redacted error and relevant evidence. Involve an authorized project maintainer when a real decision or blocker needs their input.

## Session Start / End

**Start:** The selected isolated Claude Code or Codex profile loads relevant authorized project context. The router banner shows your journey position ("M2 of 4 · P2 of 3").
**End:** Run `/sky-report` for an honest development-session report, even when work is unfinished. It preserves local evidence, authorized commit/push and optional context-scoped synchronization. Queueing is not proof of cloud delivery. There is no attendance or employee-performance system.

## How It Works (you don't need to know this, but if curious)

- **Journey-first planning:** `/sky-new` produces JOURNEY.md listing every milestone from kickoff to Handoff with exit criteria and phase sketches. The whole team sees the path on day 1.
- **Context isolation:** Each specialist task gets bounded relevant context rather than an ever-growing session history. Measure quality and usage; fresh context alone is not a guarantee of equal task quality.
- **Pre-inlined context at dispatch:** The builder starts with PROJECT.md, DESIGN.md, and all Context @files already loaded — no wasted orientation reads.
- **Goal-backward verification:** The verifier doesn't trust "I built it." It greps the code to check if things actually work AND walks every task's Acceptance Criteria.
- **Story-file plans:** Every task has Why / Acceptance Criteria / Depends on / Validation inline — the plan IS the brief.
- **Wave execution:** Independent tasks run in parallel. Dependent tasks wait.
- **Milestone-boundary pauses:** In `--auto` mode, the framework pauses only at real decision points. Everything else runs on rails.
- **tracking.json:** Updated locally on push. It feeds local statusline, stop-session-log, and `/sky-report`; authorized synchronization uses explicit scoped payloads and acknowledgments rather than passively scraping private project state from Git.

## Quick Reference

| Situation | Run |
|---|---|
| Starting a new client project | `/sky-new` (or `/sky-new --auto` to roll end-to-end) |
| Starting a quick throwaway | `/sky-new --quick` |
| Brownfield project | `/sky-map` first, then `/sky-new` |
| Stuck — "what command should I run?" | `/sky-next` |
| Confused — "what's actually going on?" | `/sky-idk` |
| Finished the last phase of a milestone | `/sky-milestone` |
| About to ship | `/sky-ship` |
| Client is ready to take over | `/sky-handoff` |
| Session continuation or completion | `/sky-report` for honest development context, including unfinished work |

## Infrastructure, installation and verification boundaries

SkyOps uses local execution, GitHub and one dedicated internal Supabase project. Every generated application has its own independent Supabase, credentials and visual identity. Other approved integrations are optional and activated only when the selected project requires them. Obtain private signed packages through the owner-authorized distribution flow; ordinary users do not need source-repository access. Do not install a public package with a similar name or reuse another SkyOps installation.

Local execution retains full-stack SSR/API and persistent worker capabilities. GitHub Actions/Release artifacts are not live deployments. GitHub Pages supports compatible static exports; application Supabase supports its own migrations/storage and bounded Edge Functions. Report an artifact as deployment prepared while its actual live runtime remains unverified. `/sky-ship` and `/sky-handoff` retain their mandatory live-delivery evidence gates; no arbitrary new hosting provider is required.

The current source is undergoing transformation. Compiled artifacts, sign-in and local component tests are distinct from native skill/agent/hook acceptance, tenant isolation and full end-to-end readiness. Use the current authoritative plan and receipts; do not treat this guide as a completion claim.
