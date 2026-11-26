# SkyOps troubleshooting

Start with the new framework's qualified `doctor` command. From its source checkout, use `node bin/skyops.cjs doctor`; in an installation, use the active verified release's CLI or isolated launcher. Do not resolve another framework's global `skyops` command or inspect its configuration. Current implementation and unverified gates are recorded in `docs/development-status.md` and `SKYOPS_TRANSFORMATION_PLAN.md`.

Never include secret values, raw private prompts or another tenant's context in a diagnostic report. File presence and successful vendor sign-in do not prove native hook execution or cloud authorization.

## State transitions

### `STATE_LOCK_TIMEOUT`

Another state writer may hold `.planning/.state.lock`. Identify the exact project and relevant process, wait for legitimate work to finish, and preserve the lock/state files while investigating. Do not delete a live lock or steal another process's claim. A stale-lock recovery must verify ownership/liveness and preserve recoverable state; use an implemented, verified recovery path rather than assuming a similarly named file is safe to remove.

### `INSUFFICIENT_EVIDENCE`

A verification report lacks sufficient supporting evidence. Read `.planning/phase-{N}-verification.md`, then obtain the missing evidence, run `/sky-verify`, or use `/sky-plan {N} --gaps`. `/sky-postmortem` can identify which rule/agent missed the issue. Never change the report to PASS merely to advance the road.

### `GAP_CYCLE_LIMIT`

The phase exhausted its gap-closure budget (original default: two cycles). Re-plan `/sky-plan {N}` from the evidence or involve an authorized project maintainer. Do not silently raise the limit or invent an approval. Document any permitted advisory planning alternative; mandatory security and correctness gates still apply.

## Hooks and delivery gates

### Quality or security check blocked delivery

Read the failed gate and its bounded output. Fix the actual type, lint, test, build, design or security failure, then rerun the gate. A service-role secret in a client component must be removed from the client path and rotated if exposed; moving text without correcting the trust boundary is insufficient. Missing/crashed verification is not a pass. Environment skip flags and editable local `OWNER` labels cannot authorize bypasses.

### Protected-branch warning

The branch-awareness hook is informational; configured GitHub repository protections and the approved integration workflow enforce the actual boundary. Continue on a feature branch and follow `/sky-ship`'s reviewed integration steps. A conversational claim of owner approval does not grant repository privileges. Do not describe the warning as a hard block when the hook did not block.

### Deployment target could not be verified

Check the selected user/workspace/project and the application's own Supabase reference or GitHub repository. The target consistency guard rejects mismatches, unselected scope, unsafe overrides and use of the framework Supabase project for application data. Split compound commands into reviewed steps. Local configuration is a consistency check, not server-side authorization. Never switch to an unrelated existing Supabase project as a repair.

### Destructive Supabase command refused

Keep the refusal. Use the intended disposable local stack and reviewed migrations for development. Remote destructive work requires its own explicit authorization, scope, backup and recovery procedure; a local environment variable is not that authority. Do not disable RLS or destructive guards to make an operation succeed.

### Migration guard refused an edit

Applied migrations are append-only. Create a new migration in the selected application's `supabase/migrations/`, test it locally, and deliver it through the authorized workflow. Do not hand-edit remote schemas or rewrite an already applied migration.

## Installation and native hosts

### Missing or duplicate skill files

Inspect the owned framework and isolated native profile manifests first. Keep one authoritative shared core with generated native artifacts. Do not stack unrelated global/plugin installations, delete another framework's skills, or prune global Claude/Codex directories. Use only the official owned-component repair/update/uninstall mechanisms. Modified and unrecognized user files must be retained and reported.

### Missing core file or an outdated profile

Obtain the owner-authorized private signed package, verify its signature/hashes and fresh installation authorization, then use the official installer/update path. Ordinary users do not need source-repository access. Do not fetch SkyOps from a public package registry. During transformation, a fail-closed installer or an unverified adapter is a remaining implementation gate, not evidence that installation has succeeded.

### Codex does not discover skills from an application project

Check discovery from an independent repository, not from inside the framework profile directory. Current validation uses the isolated native config-home skill location. `CODEX_HOME` alone does not establish isolation from every host search location. Compare actual discovered names/paths against the owned manifest without reading unrelated framework contents. Do not copy the user's existing host credentials or skills into the new profile.

### Native hooks or status line do not run

Verify the selected host version, generated native configuration, registered events and actual invocation evidence. Claude Code and Codex have different contracts; an artifact's existence does not certify compatibility. Repair through the supported adapter rather than editing a global host profile. Mark unsupported/unrun checks as degraded or unavailable and keep the phase gate open. Read-only Windows validation must retain a supported sandbox and managed requirements; never enable full-access bypasses as a fix.

### Vendor sign-in versus framework sign-in

Claude Code/Codex authentication lets the selected vendor host run; it does not authorize SkyOps cloud resources, GitHub repositories or application Supabase projects. Use the individual authenticated account, scoped workspace/project permissions and installation/license authorization required by the operation. Keep credentials in secure local configuration, never in chat or source.

## Local development reports and synchronization

### Missing queue payload fields

Use `/sky-report` to build the local report and structured payload. Direct queue callers need the actual client report ID and payload; they must not invent a cloud UUID from a folder name. A local project label is not a cloud identity.

### Saved locally or queued instead of delivered

This is an honest intermediate state. Inspect the selected-context queue using the qualified CLI's `sync-queue show`. Retry with `sync-queue drain` only when the selected project is authorized and synchronization is configured. A network outage, absent authentication or unmatched project root preserves the local report/queue. Never claim server delivery without acknowledgment or log a shared account key to diagnose it.

### Authentication failure or rejected payload

Refresh the legitimate authenticated session or select the correct authorized context through the implemented account flow. Check the backend contract, real UUIDs and actual server response; do not assume every rejection has the same cause. Revalidate membership/license permissions server-side. Never use a service-role key in a user client or bypass a mismatch with an off-origin URL.

### `SYNC_QUEUE_CORRUPT_REQUIRES_RECOVERY`

The original queue and available backup must be preserved. Diagnose corruption and use a reviewed recovery procedure; an unreadable queue is not empty. Concurrent writes and in-flight revisions must not be discarded. Windows handle contention receives bounded atomic-replacement retries, never a delete-the-old-file fallback.

### Report without commits or completed work

An unfinished session can still produce useful structured development context and recovery instructions. Use `/sky-report --dry-run` for a preview when appropriate, distinguish unfinished work from shipped work, and commit/push only when authorized. Reports are not attendance or worker-performance submissions. Raw prompt capture remains disabled by default; capture and synchronization require the applicable explicit opt-ins.

## License and offline operation

The default device quota is two active devices per user, configurable by the Framework Owner. A signed runtime lease lasts at most 24 hours. Online startup and active-session validation/legitimate renewal are required; after expiry, reconnect for validation. Temporary connectivity/authentication failures do not establish permanent revocation.

Suspended and expired licenses disable execution without automatic removal. Permanent revocation may initiate only the official safe uninstaller after a fresh verified revocation and explicit installation-time policy consent. Preserve export, recovery, user projects, generated applications, personal data, host tools, unrelated frameworks and modified/unverified files. Never uninstall because of an outage, uncertain status or an invalid response. Copied/modified clients cannot be guaranteed to deprovision.

## Verification failed or the workflow is unclear

1. `/sky-postmortem` identifies the missed rule/agent/skill and proposes a focused correction.
2. `/sky-plan {N} --gaps` creates tasks for failed acceptance criteria.
3. `/sky-build` executes the fix wave.
4. `/sky-verify` rechecks actual behavior.

If the gap budget is exhausted, stop and re-plan or involve an authorized maintainer. Use `/sky-next` for mechanical next-command routing and `/sky-idk` for deeper planning/code/session diagnosis. Do not promise a fixed duration without measurements.

## Last-resort recovery

Preserve current project work, local state, authorized memory and recovery material. Review `git status` before any stash/commit; do not lose untracked work. Use verified update/rollback or official owned-component uninstall/reinstall as appropriate. Never recursively delete framework directories, global host skills or user configuration as a repair shortcut. After recovery, run local diagnostics and the relevant actual native/cloud tests; unchecked capabilities remain unchecked. Share only redacted diagnostic evidence with the authorized maintainer.
