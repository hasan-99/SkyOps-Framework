---
name: sky-handoff
disable-model-invocation: true
description: "Client delivery — verifies production access, documentation, client assets archive and the final development report. Triggered at the end of the Handoff milestone."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# /sky-handoff — Client Delivery

Finishes a project by producing the 4 mandatory Handoff deliverables defined in `JOURNEY.md`'s Handoff milestone. Every SkyOps client project ends with this skill.

## When to Use

- After `/sky-ship` on the final phase of the Handoff milestone
- Invoked automatically at the end of `/sky-new --auto` chain
- Can also be run manually if the project deviated from auto mode

## The 4 Deliverables

Every Handoff milestone must produce these. They are checked against in `REQUIREMENTS.md` as `HAND-10..HAND-15`.

1. **Production URL verified** — HTTP 200, auth flow, latency under 500ms
2. **Documentation** — README with architecture, setup, API docs
3. **Client Assets** — `.planning/archive/` contains every milestone's verification reports + credentials doc + recorded walkthrough
4. **Development finalization** — final `/sky-report` with `lifetime.milestones_completed` incremented

## Process

```bash
node ${SKYOPS_HOME}/bin/skyops-ui.js banner handoff
```

### 1. Verify Production URL (Deliverable 1)

```bash
URL=$(node -e "const t=JSON.parse(require('fs').readFileSync('.planning/tracking.json','utf8'));console.log(t.deployed_url||'')")
if [ -z "$URL" ]; then
  node ${SKYOPS_HOME}/bin/skyops-ui.js fail "No deployed_url — run /sky-ship first"
  exit 1
fi
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
LATENCY=$(curl -s -o /dev/null -w "%{time_total}" "$URL")
AUTH=$(curl -s -o /dev/null -w "%{http_code}" "$URL/api/auth/callback" 2>/dev/null || echo "N/A")
node ${SKYOPS_HOME}/bin/skyops-ui.js ok "URL: $URL (HTTP $HTTP, ${LATENCY}s, auth:$AUTH)"
```

If HTTP is not 2xx or latency > 1.0s → halt; deliverable fails.

### 2. Update Documentation (Deliverable 2)

Ensure the repo's `README.md` has:
- **Overview** — what the project does
- **Architecture** — stack summary, separate application Supabase project, local runtime and optional integrations
- **Setup** — how to run locally (clone, env, `npm install`, `npm run dev`)
- **Env vars** — list from `.env.local.example` (mask values)
- **Deploy** — actual local/GitHub/Supabase delivery procedure, approval/CI gates, runnable artifacts and any live-deployment limitations
- **Support** — the application's own configured support contact; never inherit another organization's personal contact

If README is stale or missing sections, update it and commit.

### 3. Generate Handover Doc + Archive (Deliverable 3)

Create `.planning/HANDOFF.md`:

```markdown
# {Project Name} — Handover

## What Was Built
{3-5 bullet summary of delivered features, pulled from JOURNEY.md milestone exit criteria}

## Access
- **URL:** {production URL}
- **Admin login:** {credentials doc location — typically `.planning/credentials.md` (git-ignored)}
- **Supabase:** {project ref}
- **GitHub:** {repo URL}
- **Delivery workflow / release:** {actual application GitHub workflow and release links}
- **Walkthrough:** {Loom or video link — recorded demo of primary flows}

## How to Use
{Brief walkthrough of the main user flows}

## Known Limitations
{Anything not in scope or deferred, copied from REQUIREMENTS.md Out of Scope + Post-Handoff v2}

## Maintenance
- Runtime / delivery: {actual application runtime and authorized GitHub/Supabase delivery procedure; distinguish a runnable artifact from a live production service}
- Database: Supabase ({region})
- Domain: {domain provider if applicable}
- Monitoring: {application-specific configured monitoring/status page, if enabled}

## Milestones Shipped
{Summary pulled from tracking.json milestones[] — one line per closed milestone with date and phase count}

## Support
Contact: the application's authorized support identity from project configuration
Standard support window: 30 days post-handoff.
```

Also ensure `.planning/archive/` contains every milestone's phase verification reports (sky-milestone moves them there on close — verify they're present).

```bash
ls -la .planning/archive/ 2>/dev/null
```

If `.planning/archive/` is empty, something went wrong — milestones should have been archived on close. Investigate and recover from git history if needed.

### 4. Commit + Push

```bash
git add .planning/HANDOFF.md README.md
git commit -m "docs: client handoff — {project name}"
git push
```

### 5. Update State

```bash
node ${SKYOPS_HOME}/bin/state.js transition --to handed_off
```

Do NOT manually edit STATE.md or tracking.json — state.js handles both.

### 6. Development Finalization (Deliverable 4)

Trigger the final `/sky-report`. Preserve the local closing report with `lifetime.milestones_completed` incremented by the completed Handoff close. Synchronize only to the current authorized project when enabled; distinguish local save, queued synchronization and confirmed server acknowledgment. No business server or shared key is required.

In `--auto` mode, inline-invoke `/sky-report` now. In guided mode, show the next step:

```bash
node ${SKYOPS_HOME}/bin/skyops-ui.js ok "Production URL verified"
node ${SKYOPS_HOME}/bin/skyops-ui.js ok "Documentation updated"
node ${SKYOPS_HOME}/bin/skyops-ui.js ok "Client assets archived + handoff doc written"
node ${SKYOPS_HOME}/bin/skyops-ui.js ok "Ready for final development report"
node ${SKYOPS_HOME}/bin/skyops-ui.js end "DELIVERED" "/sky-report"
```

## Rules

1. **No handoff without verified production URL.** Step 1 halts if URL is down or latency > 1s.
2. **Archive is mandatory.** `.planning/archive/` must contain every closed milestone's phase artifacts. If empty, the project was handled outside the framework — recover from git history.
3. **README is the public face.** If it's stale, fix it before handoff. Client reads it first.
4. **Credentials never in the repo.** `.planning/credentials.md` is git-ignored. Deliver credentials via secure channel (1Password shared vault, encrypted email).
5. **Support clause is 30 days by default.** If the client contract says otherwise, override it in HANDOFF.md.
