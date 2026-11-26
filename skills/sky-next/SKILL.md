---
name: sky-next
description: "Mechanical state-driven router — reads state.js, returns the exact next command. Cheap and instant. Triggers: '/sky-next', 'what next', 'what now'. For deeper situational confusion use /sky-idk."
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# /sky-next — What's Next?

Read project state. Classify your situation. Tell you the exact next command.

## Process

### 1. Get State

```bash
node ${SKYOPS_HOME}/bin/state.js check 2>/dev/null
```

The JSON carries a `profile` field (`strict` or `standard`; env `$SKYOPS_PROFILE` wins). Strict mode requires its planning gates. Standard mode may allow documented alternatives for advisory planning checks only. Mandatory security, authorization and correctness gates always apply and cannot be waived by a local role or environment variable. Surface the profile when a gate is involved.

**A5 — multi-person layout.** If the JSON has `"layout": "increments"`, this project is concurrency-aware: route by the increment fields, not the single phase cursor. Continue your own claim first (`my_claim`), else start `next_increment` (the first unclaimed, not-done increment). **Never** route the operator to anything in `claimed_increments[]` — those are held by another person on another branch. The status→command mapping in the table below still applies (it's computed into `next_command`); the increment fields just tell you *which* unit is yours. Legacy projects (no `layout` field) route exactly as before.

Also gather context:
```bash
test -f .continue-here.md && echo "HANDOFF_EXISTS" && head -20 .continue-here.md || echo "NO_HANDOFF"
git status --short 2>/dev/null | head -10
git log --oneline -3 2>/dev/null
ls .planning/phase-*-plan.md 2>/dev/null || echo "NO_PLANS"
ls .planning/phase-*-verification.md 2>/dev/null || echo "NO_VERIFICATIONS"
```

And surface where work was left off last time — the richest "where we left off" signal lives in `.planning/reports/`:
```bash
node ${SKYOPS_HOME}/bin/last-report.js 2>/dev/null
```
Exit 0 → it prints a one-line digest of the newest session report (`Last session ({date}, {age}d ago): {summary} → next: {next}`). Exit 1 → no reports yet (nothing to surface). When a project is loaded and a digest exists, print that line **at the very TOP of your output**, before the banner — so the first thing the operator (or a teammate picking the project up) sees is exactly where the last session ended.

Read conversation context — what has the user been doing, what errors occurred.

### 2. Classify and Route

Use the state.js JSON output plus gathered context:

| Situation | Detection | Route |
|-----------|-----------|-------|
| `no-project` | state.js returns NO_PROJECT | → `/sky-new` |
| `handoff` | `.continue-here.md` exists | → Read it, summarize, route to next step |
| `mid-work` | Uncommitted changes + phase in progress | → Continue, or write `.continue-here.md` if the user wants to pause |
| `ready-to-plan` | status == "setup" | → `/sky-plan {N}` |
| `ready-to-build` | status == "planned" | → `/sky-build {N}` |
| `ready-to-verify` | status == "built" | → `/sky-verify {N}` |
| `gaps-found` | status == "verified", verification == "fail", gap_cycles < 2 | → `/sky-plan {N} --gaps` |
| `gap-limit` | status == "verified", verification == "fail", gap_cycles >= 2 | → Escalate to the authorized project maintainer or re-plan from scratch |
| `phase-complete` | state.js auto-advanced (status == "setup", phase > 1) | → `/sky-plan {N}` |
| `all-verified` | last phase verified pass, status == "verified" | → `/sky-polish` |
| `polished` | status == "polished" | → `/sky-ship` |
| `shipped` | status == "shipped" | → `/sky-handoff` |
| `handed-off` | status == "handed_off" | → `/sky-report` then done |
| `blocked` | STATE.md lists blockers or same error 3+ times | → Diagnose the evidence; `/sky-fix` if expected behavior is known, `/sky-review` if broader audit is needed |
| `bug-loop` | Same files edited 3+ times, user frustrated | → Stop patching; summarize root cause evidence and route to `/sky-fix` or `/sky-review` |
| `need-tests` | User mentions "tests", "coverage", "test this" | → `/sky-test` |

**Project escalation:** For `gap-limit` or `bug-loop`, identify the blocked development task and suggest involving an authorized project maintainer. Do not record worker-performance tallies or assume administrative access from local role metadata.

### 3. Display

**Clear next step** (use the UI helper — it reads state.js itself):
```bash
node ${SKYOPS_HOME}/bin/skyops-ui.js banner router
# If a project is loaded, show the journey position first (one-glance orientation)
test -f .planning/JOURNEY.md && node ${SKYOPS_HOME}/bin/skyops-ui.js journey-tree .planning/JOURNEY.md
node ${SKYOPS_HOME}/bin/skyops-ui.js next "{next_command from state.js}"
```

**Ambiguous situation (multiple options):**
Print the banner first, then use plain markdown for the options:
```bash
node ${SKYOPS_HOME}/bin/skyops-ui.js banner router
```
```
## Where You Are
{1-2 sentences}

## I Recommend
**{action}** — {why}
{command}

## Other Options
1. **{option}** — {what}
2. **{option}** — {what}
3. **{option}** — {what}
```

**Blocker detected** (gap-limit, bug-loop, project escalation):
```bash
node ${SKYOPS_HOME}/bin/skyops-ui.js banner router
node ${SKYOPS_HOME}/bin/skyops-ui.js fail "{blocker description}"
node ${SKYOPS_HOME}/bin/skyops-ui.js warn "Escalate to an authorized project maintainer or re-plan from scratch"
```

User can respond with a number, "just do it", or natural language.
