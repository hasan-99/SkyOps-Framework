---
name: sky-update
description: "Ship one update to a LAUNCHED project (operate lifecycle). The post-launch counterpart to /sky-milestone — a lean plan → build → verify → ship loop with no milestone-journey or forced-handoff machinery. Triggers: 'ship an update', 'make a change to the live site', 'the project is live, I need to add X', 'operate mode', 'post-launch change', 'patch the launched product'."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
---

# /sky-update — ship one update to a launched project

The operate-lifecycle counterpart to `/sky-milestone`. Once a project has
**launched** (`state.js launch` flips `lifecycle` from `build` to `operate`), it
is an **update stream**, not a milestone journey: there is no forced
polish → ship → **handoff** terminal. `/sky-update` runs one lean change
cycle and loops. Each completed update bumps `lifetime.updates_completed`.

## Output contract

```
Command: /sky-update {change}
Scope: {files/routes touched}
Intent: build
Mutation: planned → active
Evidence: state.js check, contract-runner output
Output: shipped update + deployed URL
Next: /sky-update (next change) or done
```

## Process

### 1. Confirm the project is launched

```bash
node ${SKYOPS_HOME}/bin/state.js check
```

- `lifecycle: "operate"` → proceed.
- `lifecycle: "build"` and the product is actually live → launch it first:
  ```bash
  node ${SKYOPS_HOME}/bin/state.js launch --deployed-url {url} --source manual
  ```
  (Authorized project automation may record launch only from actual live-delivery evidence. A chat claim or release artifact alone cannot establish that the product is live.)
- Still mid-build (never launched, not live) → this is `/sky-feature` or a
  normal phase, not an update. Route there instead.

### 2. Scope the change (one update = one coherent change)

Keep it small and shippable. A bug fix, a copy change, a new section, a single
feature. If it's larger than ~5 files or needs its own milestone arc, it's a new
`build`-mode milestone — use `/sky-milestone`, not an update.

### 2b. Set the work-unit goal

Per `rules/codex-goal.md` — set the work-unit goal with scope `feature` (Codex `/goal`; on Claude Code, a tracked task + budget). An update runs its own lean loop without `/sky-plan`, so set the objective + budget here so the change stays one coherent, bounded unit.

### 3. Run the lean loop

Reuse the real lifecycle skills, scoped to this one change:

```
/sky-plan {N}     # compile the change into a phase + machine contract
/sky-build {N}    # builders execute, atomic commits
/sky-verify {N}   # contract-runner evidence + goal-backward check (must PASS)
```

Verification evidence is mandatory exactly as in build mode — a contract runs and
its evidence must be clean before PASS. On the final phase, a `verified(pass)`
in operate routes here again (`next_command: /sky-update`) and increments
`lifetime.updates_completed`.

### 4. Ship

```bash
/sky-ship        # quality gates → commit → deploy → verify live
```

No handoff. No "final milestone." The deploy is just this update going live. Then
`/sky-report` as usual — the report carries `lifecycle: operate` and the
updated `updates_completed` so local/authorized synchronized project history distinguishes updates from milestones. Preserve the report locally if synchronization is unavailable; do not claim delivery from queueing.

### 5. Loop or stop

```bash
node ${SKYOPS_HOME}/bin/skyops-ui.js end "UPDATE SHIPPED" "/sky-update"
```

Run `/sky-update` again for the next change, or stop — an operate project has
no terminal state to reach.

## Why this exists

Hard-coding "every project ends in Handoff" forced launched products and
retainers into a state machine that fought them. `/sky-update` + the `operate`
lifecycle make "this project is live and keeps shipping" explicit state instead
of a milestone the team is forced to mislabel. See `${SKYOPS_HOME}/skyops-templates/journey.md` rule 3.
