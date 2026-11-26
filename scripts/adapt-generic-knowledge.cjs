#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { digest } = require('../framework/package-store.cjs');
const root = path.resolve(__dirname, '..');
const receiptFile = path.join(root, 'docs/audit/generic-knowledge-adaptation.json');
if (fs.existsSync(receiptFile)) throw new Error('GENERIC_KNOWLEDGE_ADAPTATION_ALREADY_RECORDED');
const files = {
  'agents.md': `# SkyOps knowledge and memory structure

This is authorized generic engineering knowledge. It contains no original user, client or project history. It is a seed reference, not a grant of access to personal/team/project memory or proof that the planned backend has passed acceptance.

## Retrieve deliberately

Read the current authorized scope's index first, then one or two relevant files. Never load all knowledge or raw logs into every session. Bound retrieval by relevance and context budgets. Verify stale technical advice against the actual project and current primary documentation. Report insufficient evidence rather than inventing a recalled lesson.

## Separate scopes

- Framework knowledge: approved generic engineering/design patterns accessible to authorized framework users.
- Personal memory: an individual user's private preferences, authorized learning and execution context.
- Team/workspace memory: conventions and decisions restricted to the applicable authorized members.
- Project memory: requirements, architecture, tasks, design, verification and history restricted to authorized project members.

Local execution state and offline queues remain available. Cloud-backed retrieval/synchronization requires current authentication and authorization. A local role label, framework ownership or a retrieved document cannot grant access to another user's private memory. The complete multi-level backend/cache/retrieval implementation and tests are Phase 5 gates.

## Raw, curated and indexed tiers

Preserve the raw → curated → indexed progression within each authorized scope. Structured session checkpoints support recovery. Raw prompt capture is off by default and separately opted in; checkpoints must not silently become prompt transcripts. Curated patterns and recurring fix recipes are indexed; concepts/connections capture durable cross-references. Learn/recall/flush must retain these mechanisms without moving private material into shared framework knowledge automatically.

Use /sky-learn and /sky-recall for deliberate learning/retrieval. Update the applicable index with a new entry. Private project preferences stay in their project scope. A promotion to shared knowledge requires explicit authorization and a review that removes private information. Initialize new users with empty personal histories; never copy original daily logs, rosters, deployment maps or credentials.

## Local structure and safety

The framework's owned data directory is separate from core code and isolated host profiles. Generic seed files include index.md, learned-patterns.md, common-fixes.md, supabase-patterns.md, voice-agent-patterns.md and the attributed Claude reference guide. These files must never be mistaken for a global shared store of private logs.

Do not place keys, tokens, passwords or unapproved sensitive material in knowledge files. Apply configured retention/deletion, encrypted private cache and authenticated conflict-aware synchronization when implemented. Report unavailable initialization/backend capabilities honestly rather than claiming a working private memory service from markdown files alone.
`,
  'index.md': `# SkyOps generic engineering knowledge index

Read this index, then retrieve only relevant bounded references. This index is framework-level generic seed knowledge; it is not a personal history or a directory of private projects.

| Topic | Reference |
| --- | --- |
| General engineering patterns and learning boundaries | learned-patterns.md |
| Recurring build, runtime and verification fixes | common-fixes.md |
| Supabase authentication, RLS, relations and migrations | supabase-patterns.md |
| Optional voice services, call flows and verification | voice-agent-patterns.md |
| Knowledge tiers, scopes and privacy | agents.md |
| Attributed technical reference for native Claude concepts | claudecode-bible.md |

Personal preferences and history belong to the authenticated user's personal index. Workspace conventions and project decisions belong to their authorized indexes. Project-local .planning/ state supports continuation and recovery. Do not infer another user's access, roster or deployment configuration from a generic knowledge file.

Use /sky-learn for a new authorized pattern or fix and update its scoped index in the same operation. A new user starts with clean memory. Missing entries mean no recorded evidence, not permission to invent or import original client history. Promotion from private material to shared knowledge requires explicit authorization and sanitization.
`,
  'common-fixes.md': `# Generic engineering fix recipes

These are reusable technical lessons extracted without original user/client/project history. Verify version-specific behavior before applying a recipe. No old project IDs, dates, contacts, commit references or infrastructure settings are imported.

## Build and dependency failures

- Module not found: compare filename/import casing; filesystem case sensitivity varies by operating system and volume. Test the Linux build as well as the primary development environment.
- Memory exhaustion: measure the build first, then configure an appropriate Node heap limit in the selected local/CI environment. Do not assume a fixed heap size fits every machine.
- Missing dependencies: restore using the selected project's package manager and lockfile (for example npm ci when a valid npm lockfile exists). Inspect unexpected changes; never delete user files as a repair shortcut.
- Stale generated database types: regenerate from the explicitly selected application's schema/project. Never point application type generation at the internal framework database.

## Runtime and deployment differences

Compare Node version, environment contracts and filename casing between local and GitHub CI environments. Public frontend environment variables are commonly embedded at build time; runtime changes alone may not update the client bundle. A blank page may come from browser-only window/document access during server rendering. An API failure may come from missing server configuration or an accidentally local development URL. Inspect actual logs and request URLs without printing secrets.

## Trailing whitespace in an API URL

A pasted newline in a configured API base URL can produce escaped newlines in request paths, causing failures that resemble CORS or routing errors. Inspect the actual request URL and validate configuration at startup. Correct the value through the project's secure configuration channel, then rebuild/restart as required. Do not hardcode a replacement credential or use removed-provider deployment commands.

## Supabase authorization, relations and connections

An authorized mutation can match zero rows without a transport error. Handle errors and check affected/returned rows for sensitive transitions, subject to RLS. Never report success solely because HTTP succeeded, disable RLS as a fix or reveal another tenant's row existence. Insert policy failures are not universally silent: handle their explicit errors too.

Use generated relation types: one-to-many relations and many-to-one relations have different shapes. Preserve a normalization helper where an actual contract needs it, rather than assuming every foreign key returns an array. For connection exhaustion, inspect connection usage and the configured pooler/limits; do not blindly reduce database limits.

## Next.js rendering and cache state

Hydration failures require matching server/client initial output; isolate browser-only dynamic content appropriately. Add the client directive only to components needing client hooks. After authorized mutations, invalidate the relevant server route/cache and any actual client query cache; do not assume every application uses SWR.

## Image CDN size variants and cross-platform flags

Choose a size supported by the configured image provider rather than multiplying srcset widths blindly. Verify responses and CSP image origins. Regional-indicator emoji rendering varies across platforms; tested image/icon assets can preserve consistent country indicators. The application's own asset/provider policy determines the solution.

## Contract evidence collisions and cross-platform command execution

Reserve .planning/evidence/phase-{N}-contract-run.json for the contract runner's own output. Give builder-collected evidence a different descriptive path and reference it explicitly, or the runner can overwrite its own input evidence.

On Windows, a command-exit check using npx may fail because a direct process launcher cannot execute a .cmd wrapper as a native executable. Prefer process.execPath with the installed tool's real JavaScript entry point when appropriate, or a reviewed platform-specific launcher. Preserve exit status and never repair this by disabling validation.

After an authorized plan/contract edit, recompute source_plan_hash using the existing plan-contract helper. A hash mismatch is drift requiring review, not permission to accept stale evidence.

## Managed audio-player lifecycle

A hook-managed audio player may release its native object automatically on unmount. Calling remove again can cause a double-release failure. Follow the installed library version's ownership contract: pause a hook-owned player when appropriate and let its hook dispose it; explicitly created players need their documented cleanup. Test unmount, retry and source replacement. Keep debugging evidence scoped and redacted.
`,
  'learned-patterns.md': `# Generic engineering patterns

Authorized generic seed knowledge only. Private user, client and project histories are excluded. Verify technical/version-specific advice before applying it.

## Working context and quality

- Confirm the working directory and selected user/workspace/project before acting.
- Read applicable project instructions before edits. Claude Code and Codex retain their native instruction mechanisms while sharing the SkyOps core.
- Run the relevant deterministic type, lint, test, build and verification checks. Choose execution depth by risk; mandatory security/correctness checks are never waived.
- Use feature branches and configured repository protections. Preserve the approved integration and verified delivery workflow.
- Distinguish a validated runnable artifact from a live deployment. Run real post-delivery checks against the actual authorized application URL.
- Enable optional monitoring only for the selected application's configured account; never inherit an original organization's status page or require an optional account for local installation.
- Authorize server mutations with the current user and enforce database RLS. Use server-only credentials only on trusted server paths.

## Privacy and efficient execution

- Never expose service-role secrets in client code or commit secret environment files.
- Use secure scoped configuration, never hardcoded keys or another project's credentials.
- Avoid dynamic execution and unsafe HTML insertion; when rendering approved HTML is necessary, use a reviewed sanitizer and the application's security policy.
- Use direct file search for simple lookups instead of unnecessary agent calls.
- Retrieve bounded relevant knowledge; do not reload the whole framework or repeat completed research without a reason.
- Raw prompt capture is explicitly opted in. Do not promote private user/team/project context into shared framework knowledge automatically.

## Project specialist discovery

Load the selected project's own conventions and relevant authorized specialists for financial calculations, Arabic/RTL, notifications or subscriptions when those capabilities are actually present. Do not claim that an unavailable domain-specific skill exists. Preserve the generic learning structure and relevance-based triggering without importing original client-only skill names or histories.

## Sensitive mutation evidence

Handle database errors and verify affected/returned rows for sensitive state changes. A filtered update/delete may affect no authorized rows without a transport error; insert authorization failures may return explicit errors. Test both. Keep RLS active and avoid exposing private row existence. See common-fixes.md and supabase-patterns.md.

## Adding lessons

Use /sky-learn in the authorized scope, retain supporting evidence and update its index. Personal memories start empty. Shared generic knowledge requires explicit authorization, sanitization and review; a framework administrator does not automatically gain access to private source memories.
`,
  'supabase-patterns.md': `# Supabase engineering patterns

Generic authorized knowledge, not imported project configuration. The framework has one dedicated internal Supabase project. Every generated application has its own independent project, database/migrations, authentication, storage, RLS and environment configuration.

## Setup and schema

Use the application's explicitly selected project/reference and region. Keep keys in secure environment configuration; use the appropriate public client credential only where intended, and keep secret/service credentials server-only. Create the actual server/client SDK boundaries required by the chosen stack. Generate types against the selected application schema. Apply reviewed migrations through local tests and the authorized CI workflow; never repurpose an existing unrelated project.

## Ownership policy example

This illustrates personal ownership only; it is not a complete team/workspace/project RBAC schema:

\`\`\`sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own rows" ON my_table FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Insert own rows" ON my_table FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own rows" ON my_table FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
\`\`\`

Authorize memberships and roles from trusted server/database authority, never editable user metadata. Match UPDATE and SELECT policies, validate ownership on writes, and enforce storage policies separately. Test each operation as different users and tenants, including attempts to move rows into another scope. Shared framework ownership alone must not grant access to private user/project data.

## Session and mutation checks

Validate the actual authenticated user/session before server mutations and enforce per-resource authorization. Session refresh cannot confer revoked membership or license authority. Handle explicit errors and unexpected zero affected/returned rows; HTTP success alone is not business success. Do not assume every RLS denial has the same response shape.

## Relations and query shapes

Use generated relation types and actual schema cardinality. One-to-many relationships and many-to-one relationships do not always return the same shape. Preserve normalization helpers for real contracts rather than assuming every foreign key is an array. Reference: https://supabase.com/docs/guides/database/joins-and-nesting

Avoid unnecessary queries, unbounded memory retrieval and credential-bearing logs. Local execution/offline queues do not bypass cloud authorization; synchronization must recheck current permissions. Actual framework auth/RLS/storage/license/memory behavior requires its planned backend and isolation tests.
`,
  'voice-agent-patterns.md': `# Optional voice-agent engineering patterns

Preserve optional VAPI, Retell, ElevenLabs and related voice integration capabilities without importing original client projects, phone numbers, account defaults or deployment maps. Initial SkyOps installation and normal development do not require voice accounts/hardware.

## Configured assistant and call flow

1. Use the selected user's/project's authorized provider account and optional integration configuration.
2. Configure the actual model, voice, system prompt, tools, first message and call/webhook flow. Resolve provider identifiers from the configured account; do not assume a historical display name is a valid voice ID.
3. Run webhooks on the selected application's local development runtime or compatible Supabase Edge Functions. Use the application's own infrastructure, not the framework's internal database.
4. Connect an authorized phone number only when requested and verify provider scopes and ownership.
5. Test real authorized calls, interruption/error paths, provider callbacks and measured latency before declaring acceptance.

## Webhook and tool security

Authenticate the raw provider callback using the provider's current documented signature or authentication scheme before parsing/trusting events. Test tampered, missing-auth, replayed, malformed and unauthorized callbacks. Do not copy an undefined verifier or invent a provider header/algorithm. Route function/tool calls, call completion and status updates through authorized project operations with idempotency and bounded retries. Provider integration implementations and live acceptance remain explicit gates.

## Voice selection

Retain professional, friendly, energetic and low-latency/economical voice-selection use cases. Provider, voice ID, model and language are configurable per application. Evaluate intelligibility, interruption handling, latency and cost with actual authorized provider options; no original client identity is inherited.

## Conversation and privacy

Keep spoken responses concise, confirm important information and handle interruptions gracefully. Measure first-response latency against the project's target (the original target was below 500 ms); do not claim it without a real measurement. Preserve useful diagnostic events, but redact secrets, minimize synchronized data and configure retention. Recording/transcripts require the applicable explicit authorization; do not log everything indiscriminately or absorb private conversations into shared knowledge.

## Optional local input

Linux/Wayland voice/hotkey implementations remain optional. Configure provider secrets securely and enable hardware features only when requested. Windows/macOS equivalents are not required for the first release. No audio file or historical recording is seeded into user memory or a distribution package.
`,
};
const records = [];
for (const [name, text] of Object.entries(files)) {
  const file = path.join(root, 'knowledge', name);
  const before = fs.readFileSync(file);
  fs.writeFileSync(file, text);
  records.push({ path: `knowledge/${name}`, before_sha256: digest(before), after_sha256: digest(text), classification: 'Authorized generic technical knowledge retained; private historical material excluded', functional_parity_verified: false });
}
const bible = path.join(root, 'knowledge/claudecode-bible.md');
const before = fs.readFileSync(bible);
const revised = before.toString('utf8').replaceAll('Qualia', 'SkyOps').replaceAll('qualia-', 'sky-').replaceAll('/qualia', '/sky-next').replaceAll('#qualia-gap-analysis', '#skyops-gap-analysis');
const notice = '\n> Attributed versioned technical reference, not current runtime configuration or security defaults. Preserve the upstream notice in docs/licenses/claude-howto-MIT.txt. Validate examples against the installed native host; no example may bypass current mandatory authorization/security/correctness gates. Historical capability counts in the comparison are not the approved preservation inventory.\n';
const text = revised.replace(/\n/, '\n' + notice);
fs.writeFileSync(bible, text);
records.push({ path: 'knowledge/claudecode-bible.md', before_sha256: digest(before), after_sha256: digest(text), upstream_license_evidence: 'docs/audit/claude-howto-license.json', functional_parity_verified: false });
const receipt = { schema_version: 1, applied_at: new Date().toISOString(), files: records, private_data_excluded: ['Original client/project histories, IDs, contacts and commit references embedded in generic notes', 'Original project-only skill names, team roster and deployment-map references', 'All original daily logs and private knowledge files; not read or imported by this script'], learning_mechanisms_preserved: ['Scoped raw/curated/index tiers', 'Learn/recall/flush concepts and cross-reference structure', 'Generic engineering/design/technical lessons'], personal_memory_imported: false, implementation_scope: 'Reviewed generic source seed adaptation only; not operational multi-tenant memory/backend validation' };
fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ adapted_generic_files: records.length, personal_memory_imported: false, cloud_memory_written: false }));
