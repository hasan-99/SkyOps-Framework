---
name: sky-ship
disable-model-invocation: true
description: "Deploy to production — state-guard, full security scan, quality gates, commit, push, deploy, verify. Trigger on 'deploy', 'ship it', 'go live', 'push to prod', 'launch', 'release to production'."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# /sky-ship — Deploy

Full deployment pipeline with quality gates.

## Process

```bash
node ${SKYOPS_HOME}/bin/skyops-ui.js banner ship
```

### 0. State Guard — refuse to ship from an invalid state

`/sky-ship` is a terminal operation — it writes a deployed tag, bumps counters, and produces a verified URL. It must NEVER run on an unpolished, unverified, or malformed project.

```bash
STATE=$(node ${SKYOPS_HOME}/bin/state.js check 2>/dev/null)
if [ -z "$STATE" ]; then
  node ${SKYOPS_HOME}/bin/skyops-ui.js fail "No project loaded. Run /sky-new first or cd to a SkyOps-managed project."
  exit 1
fi

STATUS=$(echo "$STATE" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d.status||'')}catch{}")
VERIFICATION=$(echo "$STATE" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d.verification||'')}catch{}")
NEXT_COMMAND=$(echo "$STATE" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d.next_command||'/sky-next')}catch{process.stdout.write('/sky-next')}")
if [ "${SKYOPS_SHIP_FORCE:-0}" = "1" ]; then
  node ${SKYOPS_HOME}/bin/skyops-ui.js fail "Mandatory verification cannot be bypassed by a local role or environment variable."
  node ${SKYOPS_HOME}/bin/skyops-ui.js info "Run $NEXT_COMMAND."
  exit 1
fi

# Valid ship-from states:
#   polished     — /sky-polish ran cleanly; ready for deploy
#   verified+pass — final phase verified; skipping polish is allowed for hotfixes
# Anything else (setup, planned, built, shipped, handed_off, verified+fail) is refused.
if [ "$STATUS" != "polished" ] && ! { [ "$STATUS" = "verified" ] && [ "$VERIFICATION" = "pass" ]; }; then
  node ${SKYOPS_HOME}/bin/skyops-ui.js fail "Ship refused from state '$STATUS' (verification: ${VERIFICATION:-none})."
  node ${SKYOPS_HOME}/bin/skyops-ui.js info "Run $NEXT_COMMAND."
  exit 1
fi
```

### 1. Quality Gates

Run in sequence. Auto-fix failures (up to 2 attempts).

```bash
npx tsc --noEmit          # TypeScript — must pass
if node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.lint?0:1)"; then npm run lint; fi
if node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.test?0:1)"; then npm test; fi
npm run build             # Build — must succeed
node ${SKYOPS_HOME}/bin/slop-detect.mjs --severity=critical   # Anti-slop — CRITICAL design tells block ship
```

The `pre-deploy-gate.js` hook re-runs mandatory quality and anti-slop checks for supported delivery commands. Local role claims and environment variables cannot bypass them. This step surfaces failures before delivery.

On failure:
1. Summarize what failed in plain language
2. Auto-fix
3. Re-run the gate
4. If still failing after 2 attempts: tell the employee, suggest `/sky-fix`

### 2. Security Check — full depth

Shallow grep on `service_role` alone was missing hardcoded keys, tracked `.env` files, and dangerous DOM injection. Match the CRITICAL checks from `/sky-review` exactly so the two skills agree.

```bash
SEC_FAIL=0

# CRITICAL: service_role in client-facing code
HITS=$(grep -rn "service_role" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" app/ components/ src/ lib/ 2>/dev/null | grep -v node_modules | grep -v "\.server\.\|[\\/]server[\\/]\|[\\/]app[\\/]api[\\/]\|route\.\|middleware\.")
if [ -n "$HITS" ]; then
  node ${SKYOPS_HOME}/bin/skyops-ui.js fail "service_role leaked to client code:"
  echo "$HITS" | head -5
  SEC_FAIL=1
fi

# CRITICAL: hardcoded secrets
HITS=$(grep -rn "sk_live\|sk_test\|SUPABASE_SERVICE_ROLE\|eyJhbGciOi" --include="*.ts" --include="*.tsx" --include="*.js" app/ components/ src/ lib/ 2>/dev/null | grep -v node_modules | grep -v "\.env")
if [ -n "$HITS" ]; then
  node ${SKYOPS_HOME}/bin/skyops-ui.js fail "Hardcoded secret found:"
  echo "$HITS" | head -5
  SEC_FAIL=1
fi

# CRITICAL: dangerouslySetInnerHTML / eval
HITS=$(grep -rn "dangerouslySetInnerHTML\|eval(" --include="*.ts" --include="*.tsx" --include="*.js" app/ components/ src/ 2>/dev/null | grep -v node_modules)
if [ -n "$HITS" ]; then
  node ${SKYOPS_HOME}/bin/skyops-ui.js fail "Dangerous innerHTML/eval pattern:"
  echo "$HITS" | head -5
  SEC_FAIL=1
fi

# CRITICAL: .env files tracked in git
HITS=$(git ls-files | grep -i "\.env" | grep -v "\.example\|\.template\|\.sample")
if [ -n "$HITS" ]; then
  node ${SKYOPS_HOME}/bin/skyops-ui.js fail ".env files tracked in git:"
  echo "$HITS"
  SEC_FAIL=1
fi

if [ $SEC_FAIL -ne 0 ]; then
  node ${SKYOPS_HOME}/bin/skyops-ui.js fail "Security check failed. Fix findings above or run /sky-review for full audit."
  exit 1
fi
```

### 3. Integrate to main (ship IS the merge point)

Ship is the one place feature work lands on `main`, so `main` is always exactly what's in production and no branch lingers. Commit, then fast-forward-integrate into `main` and push. `branch-guard` records the main push (accountability, not a block — see `rules/infrastructure.md`).

```bash
git add {specific changed files}
git commit -m "ship: {project name} production deploy"

BR=$(git branch --show-current)
if [ "$BR" != "main" ] && [ "$BR" != "master" ]; then
  git checkout main
  git pull --ff-only origin main 2>/dev/null || true   # sync with remote first
  if git merge --ff-only "$BR"; then
    : # clean fast-forward
  else
    # main moved since the branch started — rebase the feature, then ff.
    git checkout "$BR" && git rebase main || {
      node ${SKYOPS_HOME}/bin/skyops-ui.js fail "Rebase conflict integrating $BR → main. Resolve, then re-run /sky-ship."
      exit 1
    }
    git checkout main && git merge --ff-only "$BR"
  fi
fi
git push origin HEAD
```

If anything in this block fails (conflict, push rejected), STOP and surface it — do not deploy a half-integrated tree.

### 4. Deploy (from main)

Deploy runs on `main` HEAD — what you just integrated — so the deployed artifact and `main` are byte-identical.

Use the selected application's configured GitHub Actions delivery workflow or its own Supabase Edge Functions where compatible. Check repository/project targeting and authorization before running either. Never deploy generated application code to the internal framework Supabase project.

```text
gh workflow run {configured-workflow} --repo {application-owner/application-repository}
supabase functions deploy {configured-function} --project-ref {application-project-reference}
```

These are alternatives for configured targets, not commands to run together or values to invent. Wait for CI/function completion and obtain real deployment evidence. For static sites, GitHub Pages may be configured with the application's own access policy. Next.js SSR and long-running workers remain supported through local Node/worker execution; they cannot be represented as statically hosted sites or forced into bounded Edge Functions/CI jobs.

If only local execution, build/test and a signed/versioned GitHub release artifact are available, report **deployment prepared, live delivery pending**. Preserve the runnable artifact and recovery instructions, but do not mark the application shipped, close its delivery branch or claim a production URL. Complete live verification only after the application's actual authorized runtime is available. No additional hosting provider is mandatory.

### 4b. Close the branch

On a verified successful deploy, delete the integrated feature branch so nothing lingers (skip if you shipped directly from `main`):

```bash
if [ -n "$BR" ] && [ "$BR" != "main" ] && [ "$BR" != "master" ]; then
  git branch -d "$BR" 2>/dev/null && git push origin --delete "$BR" 2>/dev/null || true
fi
```

### 5. Post-Deploy Verification

Read the deployed URL from `tracking.json.deployed_url` or from an explicit user-provided URL. Do NOT use a `{domain}` placeholder — that expects the LLM to hallucinate the URL, which is exactly the kind of silent fail the state guard above prevents.

```bash
# If the user invoked `/sky-ship --url ...`, set SKYOPS_SHIP_URL to that
# exact value before running this block. Otherwise use tracking.json.
URL="${SKYOPS_SHIP_URL:-$(node -e 'try{const t=JSON.parse(require("fs").readFileSync(".planning/tracking.json","utf8"));process.stdout.write(t.deployed_url||"")}catch{}')}"
if [ -z "$URL" ]; then
  node ${SKYOPS_HOME}/bin/skyops-ui.js warn "No verified deployed_url in tracking.json — read it from the application's completed authorized delivery workflow. An artifact alone is not a live deployment."
  node ${SKYOPS_HOME}/bin/skyops-ui.js info "Re-run with: /sky-ship --url https://your-site.com, then export that value as SKYOPS_SHIP_URL for this check."
  exit 1
fi

# HTTP 200 + latency under 500ms (combined)
RESP=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" --max-time 15 "$URL")
HTTP_CODE=$(echo "$RESP" | awk '{print $1}')
LATENCY=$(echo "$RESP" | awk '{print $2}')

if [ "$HTTP_CODE" != "200" ]; then
  node ${SKYOPS_HOME}/bin/skyops-ui.js fail "Post-deploy check failed: HTTP $HTTP_CODE at $URL"
  exit 1
fi

# Auth endpoint (best-effort — not every project has one)
AUTH_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$URL/api/auth/callback" 2>/dev/null)
```

### 6. Report

```bash
node ${SKYOPS_HOME}/bin/skyops-ui.js divider
node ${SKYOPS_HOME}/bin/skyops-ui.js ok "URL: $URL"
node ${SKYOPS_HOME}/bin/skyops-ui.js ok "Status: HTTP $HTTP_CODE"
node ${SKYOPS_HOME}/bin/skyops-ui.js ok "Latency: ${LATENCY}s"
[ "$AUTH_CODE" = "200" ] || [ "$AUTH_CODE" = "401" ] && node ${SKYOPS_HOME}/bin/skyops-ui.js ok "Auth endpoint responds (HTTP $AUTH_CODE)"
```

```bash
# A5: on the per-increment layout, `release` ships the active increment, runs
# the Definition-of-Done gate, and clears its claim (one committed file → no
# merge conflict). Falls back to the legacy phase-level transition otherwise.
if [ -d .planning/increments ]; then
  node ${SKYOPS_HOME}/bin/state.js release --deployed-url "$URL"
else
  node ${SKYOPS_HOME}/bin/state.js transition --to shipped --deployed-url "$URL"
fi
```
Do NOT manually edit STATE.md or tracking.json — state.js handles both.

```bash
node ${SKYOPS_HOME}/bin/skyops-ui.js end "SHIPPED" "/sky-handoff"
```
