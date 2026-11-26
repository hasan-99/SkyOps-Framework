---
name: sky-doctor
description: "Diagnose installation, native hooks, project state, contracts, memory, design resources, scoped synchronization queues and configured integration health. Suggest safe repairs without exposing secrets."
allowed-tools:
  - Bash
  - Read
  - Grep
---

# /sky-doctor

Diagnose the framework before blaming the project or model. Use deterministic helpers first. A local diagnostic cannot grant privileges, replace license validation or certify full functional parity.

## 1. Installation and native host health

Use qualified paths from the active release, avoiding another framework's global command:

```text
node ${SKYOPS_BIN}/skyops.cjs doctor
node ${SKYOPS_BIN}/skyops.cjs trust
node ${SKYOPS_BIN}/skyops.cjs status --json
```

Read failed checks before proposing repair. Check shared core once and each selected isolated native profile independently. Files being present does not prove that native hooks execute. Missing or unverified adapters remain degraded.

Install, update or roll back only through a verified owner-authorized private release. Follow the signed installation/authorization instructions; never fetch SkyOps from a public package registry. Do not overwrite user modifications, adopt a global Claude/Codex profile or touch another framework. Preserve data export, recovery and official uninstall access.

## 2. Project state and ledger

From the selected project root:

```text
node ${SKYOPS_BIN}/state.js check
```

- NO_PROJECT: recommend /sky-new, or /sky-map for an existing codebase.
- Schema errors: inspect first; recommend state.js fix only for malformed generated state. Preserve valid history.
- Ledger failure: report missing/corrupt evidence and retain files for recovery.
- Exhausted gap cycles: recommend replanning/escalation; never bypass mandatory security/correctness gates.

## 3. Plan contracts

```text
node ${SKYOPS_BIN}/state.js validate-plan --phase {N}
node ${SKYOPS_BIN}/contract-runner.js .planning/phase-{N}-contract.json
```

Run the contract runner only when a current contract exists and its deterministic checks are appropriate for this diagnostic. Missing, invalid or drifted contracts mean degraded trust; missing evidence cannot pass verification.

## 4. Planning folder hygiene

```text
node ${SKYOPS_BIN}/skyops.cjs planning-hygiene scan
node ${SKYOPS_BIN}/skyops.cjs planning-hygiene organize
```

The second command previews moves. Add --write only after the user approves those moves. Preserve phase-critical root files. Use the existing organizer for reports, assets, design and loose-file archives rather than deleting or moving files manually.

## 5. Memory, design and developer experience

```text
node ${SKYOPS_BIN}/knowledge.js
node ${SKYOPS_BIN}/knowledge.js list
```

Inspect only the current user's authorized local scope. Start with clean personal memory. Never import original user/client logs to make a check pass. Missing personal index.md, agents.md or daily-log/ requires initialization guidance, not copying private history. Curated knowledge may be absent before initialization. Cloud memory/restoration requires authenticated resource authorization; local diagnostics do not prove synchronization or isolation.

Keep checks for every active skill entry point, guide/help, design laws, rubric, brand/product/reference/frontend/graphics resources, visual evaluator and deterministic slop scanner. Report missing and unverified components separately.

## 6. Scoped synchronization

```text
node ${SKYOPS_BIN}/skyops.cjs sync-queue show
```

Show only the selected context. Queued reports remain local until the authorized backend acknowledges them. When synchronization is configured and retry is requested:

```text
node ${SKYOPS_BIN}/skyops.cjs sync-queue drain
```

Never claim delivery from enqueue success. Authentication failures require secure authenticated-session recovery when available, never a shared business-server key. Context mismatch requires selecting the correct workspace/project. Queue corruption requires recovery while preserving originals/backups. Connectivity/authentication errors and uncertain license status never authorize deletion or deprovisioning.

## 7. Project environment and configured integrations

Read .planning/env.required.json, falling back to env.required.json. Missing contract means N/A with /sky-new setup guidance. Check each required variable for a nonempty process environment or project .env.local value, without printing values. Entries marked optional are N/A unless their provider is enabled/required by the selected project; optional voice/API accounts never block unrelated installation or development. Parse variable names as data; never interpolate them into shell commands or regular expressions.

Print PASS {NAME} or FAIL {NAME} with its howToObtain guidance. For ownerIssued: true, the authorized project/account owner must provide secure configuration; do not assume a person, accept relayed approval or request a secret in conversation.

Check GitHub authentication only for configured repository operations. Check Supabase CLI authentication only when needed by the selected project; do not enumerate or mutate unrelated projects. Optional integrations are checked only when configured and required. No removed hosting provider is mandatory. Recommend official CLI installation guidance when needed; do not install software during diagnosis.

## Output

```text
Harness health: PASS | DEGRADED | FAIL
Trust score: {N}/100 (local diagnostic, not authorization)
Install / native host: ...
State / ledger: ...
Contracts: ...
Planning hygiene: ...
Memory: ...
Design / UI: ...
Developer experience: ...
Environment: PASS | DEGRADED | BLOCKED (authorized owner configuration needed) | N/A
Configured CLI / integration authentication: ...
Synchronization: ...
Unchecked capabilities: ...
Next: ...
```

Read before repair. Never expose secrets or alter user projects, other installations or cloud resources during a health check. Distinguish absent, failed, degraded and unverified checks.
