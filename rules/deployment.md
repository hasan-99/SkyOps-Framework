---
globs: ["next.config.*", "supabase/**", ".github/workflows/**"]
---

# Build and delivery gates

1. Confirm project/workspace and the authorized repository/Supabase target. A generated application must never deploy into the framework's internal project.
2. Run required type checking, linting, tests, security checks and the production build using project-native deterministic commands. A failed mandatory gate blocks delivery; missing commands/infra need an explicit, accurate result.
3. Integrate the feature branch through the approved ship/merge process and GitHub protections. Push only the approved scope; preserve rollback artifacts and evidence.
4. Prepare/publish the appropriate local runnable artifact, private GitHub release, authorized static delivery or Supabase backend/function deployment. Respect configured release approvals, account scopes and signing/license rules. Do not add a hosting provider or claim an artifact is a live deployment.
5. Apply versioned Supabase migrations to the correct independent application project through the approved deployment flow; verify RLS/Storage/auth with authorized and unauthorized test identities.
6. When a live application exists, verify the actual homepage HTTP status, relevant login/callback flow, browser errors and key API behavior/latency against the project's agreed performance budget. Exercise the selected app's real user flow, not a hardcoded sample endpoint.
7. Configure/verify optional uptime monitoring only when the project requests it, using its own authorized monitor/account. An unavailable monitor is not a fabricated success or a mandatory new installation account.

Record build/release/deployment evidence separately: commit, target, artifact hash/signature, migration version, test results and actual URLs. A server-rendered application remaining local is reported as local delivery. Preserve verification and repair loops until failures are resolved; do not bypass mandatory security/correctness checks to meet token/time budgets.
