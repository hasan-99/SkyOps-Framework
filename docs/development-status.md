# SkyOps development status

The authoritative scope and phase gates are in [SKYOPS_TRANSFORMATION_PLAN.md](../SKYOPS_TRANSFORMATION_PLAN.md). This checkout is undergoing transformation. It is not a production-ready SkyOps release.

## Available now

Requires a separately installed Node.js 22 or later. No dependency installation, account, cloud resource or AI host is required for these commands:

```text
node bin/skyops.cjs identity
node bin/skyops.cjs catalog
node bin/skyops.cjs progress
node bin/skyops.cjs status --json
node bin/skyops.cjs doctor
node bin/skyops.cjs license policy
node scripts/verify-baseline.cjs
node scripts/verify-packaging.cjs
```

`catalog` lists the complete audited agent/skill metadata and migration status. It does not load their bodies, memory or knowledge into an AI session. Listing an entry does not certify that it is already migrated or executable on a native host.

The package lifecycle module verifies a complete payload against an explicitly trusted manifest hash, requires signed release and user/device installation authorization, refuses unowned installation directories, serializes changes, stages updates, switches the active version atomically, validates rollback content and signed offline entitlement, and preserves user data on uninstall. Unfinished source cannot be installed by these commands. Tests use real temporary files, ephemeral test keys and synthetic release contents; no framework or native host has been installed globally.

Owner-controlled licensing is approved: **2 active devices per user**, configurable, and a **hard maximum 24-hour signed license window**, replacing the previous seven-day policy. Validate at each online startup and automatically during active sessions; automatically renew legitimate leases using secure session refresh. There is no public registration. Supabase invitation/owner approval/license lifecycle/device quotas and protected package delivery remain pending. Production signing trust is not configured. CLI install/update/rollback currently fail closed until their trusted authorization integration exists. The read-only `license policy` command reports defaults, not a granted license or an operational administration backend.

The default owned installation directory is `~/.skyops-framework`. `SKYOPS_HOME` may select a different dedicated directory. A pre-existing directory is never adopted merely because it is empty. No default host profile, unrelated installation or system PATH is modified.

## Remaining Phase 2 gates

- Migrate source identity and cross-references without weakening any original development capability.
- Complete host-specific packaging, supported hooks/tool-policy mapping, platform launchers and native discovery/execution tests.
- Verify that the new runtime cannot load the unrelated .NET SkyOps configuration, skills, agents or cache.
- Validate independently on Windows, Linux, macOS and WSL with both supported hosts.
- Complete local onboarding and safe private source/release distribution. Authenticated onboarding follows Phases 4–5.

The compiler generates skill/resource copies from shared source and native agent artifacts without modifying that source. Generated artifacts are not evidence of native host acceptance. Unknown or incompatible host behavior must fail its gate instead of dropping a capability.

## Host adapter evidence and limitation

Official references checked on 26 November 2026:

- [Codex skill discovery and configuration](https://developers.openai.com/codex/skills/).
- [Codex role and skill configuration](https://developers.openai.com/codex/config-reference/).
- [Claude Code native skills](https://code.claude.com/docs/en/skills).

Codex documents repository, user, administrator and bundled skill search locations. Therefore setting `CODEX_HOME` alone does not prove the isolation this project requires. Native launches remain gated until the supported host version's actual discovery behavior and isolation are tested. No attempt has been made to inspect, modify or reuse the unrelated .NET framework to bypass that gate.

## Package trust and recovery

Hashes detect changes relative to a manifest. They do not establish publisher authenticity by themselves. Signed-release verification must use pinned trust from an authenticated owner-controlled bootstrap, never a package's self-supplied public key. The manifest's gate flag is release metadata, not a signature or a replacement for CI evidence. Ordinary users will obtain packages through Supabase authorization/private Storage without source-repository access; that delivery backend is not yet implemented.

Lifecycle operations reject symbolic links, hard-linked payload files, traversal, alternate streams, case-colliding names and unlisted payloads. Local OS account compromise and concurrent malicious filesystem replacement are outside the package checksum trust boundary. Use a user-owned installation directory with restrictive OS permissions; cross-account/OS ACL validation remains part of release testing.

If a process stops before activating a fully copied release, rerunning installation can verify and activate the existing complete snapshot. Incomplete staging never becomes active. A stale lifecycle lock fails closed; automatic stale-lock recovery and operating-system crash/power-loss durability require further validation. Uninstall removes only receipt-listed unchanged owned files and active-version selection; it retains modified files, user-added files/directories, synchronized/local user data and native profile data. It never recursively erases an installation or release tree. Empty directory cleanup is limited to parents of verified removed components.

No performance improvement, full functional parity, cloud isolation or production-readiness claim has been made.

## Current local and native checkpoint

The CLI now routes local status, trust/doctor, planning hygiene, synchronization queue and project evaluation to the preserved helpers. `progress` reports transformation progress; `status` reports the actual local framework/project snapshot. Invoke the qualified Node path during development so the unrelated .NET framework's global commands cannot be selected.

Reports and snapshots strip credentials/query strings from Git remote metadata and omit local filesystem remotes. Local project labels are separate from actual cloud UUIDs; no team or cloud project identity is invented. Queue counts are context-scoped, corruption remains a recovery condition, and queued data is not described as delivered. Framework files, native profiles and persistent data use separate path roots.

Both vendor sign-ins were verified in the new isolated profiles on 26 November 2026. The corrected Codex discovery test uses an independent repository outside the profile/core directories. All 29 skills are discovered from the isolated native config-home skills location. The earlier test inside the profile was insufficient working-directory-independence evidence. Neither discovery nor successful sign-in certifies full skill/agent behavior.

A read-only MXC sandbox probe passed on this Windows device using managed requirements. The model-backed router tests retain read-only sandboxing/explicit tool restrictions, deny shell-profile loading and record bounded actual usage. Individual result receipts are authoritative; no entire phase is passed by a router test. Reference: [official Windows sandbox configuration](https://learn.chatgpt.com/docs/windows/windows-sandbox).

## Licensing boundaries

The new Ed25519 verification code checks purpose, key identity/status/validity, issuer, audience, times, exact manifest hash/version/channel/sequence and user/device/license claim binding. Installation authorizations are restricted to at most five minutes. Offline claims are bounded by the configured offline policy. These checks do not implement server-side owner approval, account/license revocation checks, one-time activation challenges, device quota enforcement, secure device key storage or production trust rotation; those remain explicit phase gates.

Signed runtime leases cannot authorize a fresh installation. Offline rollback requires both a valid release attestation within the permitted release floor and a valid signed offline lease. Online services remain subject to fresh server-side account/license/resource authorization; offline licensing does not grant memory/project access. Revocation cannot immediately disable a disconnected device with an unexpired lease. Local clock-rollback detection is best-effort when the user controls the machine.

Locally delivered code, skills and prompts can be inspected, copied or patched. Signatures provide integrity/authenticity, not source secrecy or unbreakable DRM. Enforce owned service access and package delivery server-side. Preserve data and allow export/recovery/uninstall after expiry; do not delete projects or introduce surveillance. All private signing keys used by tests are ephemeral and have not been installed as production trust.

## Finalized runtime states and safe deprovisioning

Active licenses permit execution with a valid lease and required validation. Suspended/expired licenses disable execution without automatic uninstall. Permanent revocation disables execution and may initiate only the official local uninstaller, after a fresh purpose-specific signed response bound to user/license/device and a new request challenge, and matching explicit installation-time consent. Unknown status, connectivity/authentication errors, invalid responses and Supabase outages never trigger removal. An otherwise valid lease may cover transient uncertainty; after its 24-hour maximum, online validation is required. Confirmed revocation cannot be undone for the same license by an older active lease.

The pure runtime evaluator schedules active-session checks at a five-minute technical default and signals automatic renewal. Actual online startup hooks, authenticated refresh/validation transport and protected persisted disabled state remain pending; local tests do not imply that either coding host is already enforcing the policy.

The local deprovisioning function accepts signed status data only. It cannot accept remote paths, commands or arbitrary scripts. With no valid consent record, execution is disabled and automatic removal is refused. The official uninstaller preserves user projects, generated applications, user source, personal data, coding hosts, unrelated files/frameworks, and all modified/unverified components. Export/recovery/manual uninstall remain available. Previously copied files and patched clients cannot be guaranteed to deprovision.
