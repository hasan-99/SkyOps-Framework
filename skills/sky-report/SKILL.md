---
name: sky-report
description: "Create an honest development-session report with commits, progress, blockers and next steps; preserve optional commit/push, branch hygiene and authorized offline synchronization. Use for session reports or end-of-work handoffs."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# Session report

Preserve work continuity without a business server, attendance process or employee-performance assessment. Report unfinished, blocked, investigative, no-code and empty sessions honestly. A report is evidence of work/context, never proof that a task or verification passed.

## Flags

- `/sky-report`: gather, synthesize, save locally, perform the authorized commit/push flow, surface branch hygiene, and queue synchronization only when enabled for the selected context.
- `/sky-report --dry-run`: preview the report/payload; do not commit, push, queue or upload. Use the report ID allocator's `--peek` option.

## 1. Preflight and gather

Run the report banner through `${SKYOPS_HOME}/bin/skyops-ui.js`. Check whether this is a Git repository and a tracked framework project. Missing Git, remote, tracking or cloud configuration must not prevent a truthful local report. Read actual working-tree status, relevant commit history/diffs, project state, latest verification/evidence and previous report/continuation context. Do not inspect unrelated projects or load the entire knowledge store.

## 2. Synthesize

Describe what was done, actual delivered/verified results, remaining work, blockers and the next concrete step. Include the relevant commit hashes and phase/milestone/project context. When no commits exist, use available evidence of investigation/design/testing/partial work. Ask a focused question only when the real outcome cannot be established. Never fabricate completed tasks, attendance, hours, meetings, tests, deployment URLs or uploads.

## 3. Save report and allocate identity

Use the native Write/Edit tool to save a project-local Markdown report under `.planning/reports/`, using the actual date and a noncolliding filename. Keep user-facing language according to the user's preference; technical instructions remain shared English.

Allocate the report ID with `node "${SKYOPS_HOME}/bin/state.js" next-report-id`; append `--peek` for dry-run. IDs use `SKYOPS-REPORT-NN`. If no project state exists, retain the local report and explain that a tracked identity/cloud queue is unavailable; do not fabricate a cloud/project identifier.

Build the structured payload without shell-specific environment assignment or redirection:

```text
node "${SKYOPS_HOME}/bin/report-payload.js" --report-file <local-markdown-file> --report-id <allocated-id> --output <local-report-json-file>
```

Add `--dry-run` for previews. Keep the JSON output under `.planning/reports/`. Raw prompt samples remain excluded unless both local capture and synchronization consent are explicitly enabled in the current user's privacy settings. Never include credentials; current project notes/history must not be promoted into shared framework knowledge automatically.

## 4. Commit and push

In normal mode preserve the original report commit/push capability when authorized by the user's request and repository policy. Stage the report/evidence files explicitly; never sweep unrelated changes into a commit. Use a descriptive report commit and the current authorized branch/remote. Do not bypass protected branches, security gates, provider permissions or a user instruction prohibiting commits/pushes. A push failure leaves the report committed locally and is reported accurately; it does not destroy the local report or block recovery.

## 5. Branch hygiene

Run `${SKYOPS_HOME}/bin/branch-hygiene.js` to surface stranded work and stale review branches/PRs; pass `--offline` when working offline or when the user requested no external calls. Preserve actual findings and unavailable PR status; an unchecked remote is not clean evidence. This is an informational continuity step, not employee monitoring or permission to delete/merge unrelated branches.

## 6. Local queue and optional synchronization

If cloud synchronization is enabled and the selected user/workspace/project matches the report, enqueue the structured JSON through the existing queue helper:

```text
node "${SKYOPS_HOME}/bin/sync-queue.js" enqueue --payload-file <local-report-json-file>
```

Run the configured licensed/authenticated synchronization flow when available. It must use the dedicated internal Supabase endpoint, current user authorization, context checks and idempotency. No old portal/account/key is used. Queueing is **not** delivery. Missing authentication, unavailable backend, non-2xx results, expired licenses or context conflicts preserve the local report and queue for authorized recovery; never claim successful upload without server acknowledgment.

Do not enqueue dry-run reports. Retry only within configured budgets, retain permanent failures for review, and preserve unrelated queue contexts. `show`, `clear`, `--quiet`, `--max` and `--timeout` remain available for the selected context; destructive queue clearing retains a recovery backup.

## 7. State and close

Record report activity through the state helper when project state is available, without turning incomplete/failed work into verified/shipped state. Clear only this session's usage capture after its report has been safely retained; do not clear other project/user context. Conclude with the local report path/ID, commit/push result, actual sync status and next step. Keep export/recovery available even if cloud or license services are unavailable.
