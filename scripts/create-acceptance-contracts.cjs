#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'docs/audit/acceptance-scenarios.json');
if (fs.existsSync(file)) throw new Error('Acceptance contracts already exist; refusing to replace approved scenario evidence');
const definitions = [
  ['landing-page', 'New landing page', ['Capture requirements and application-owned visual identity', 'Build a runnable responsive landing page', 'Pass accessibility and relevant browser checks', 'Verify the selected supported delivery target'], ['Framework branding must not override the application brand', 'Artifact publication must not be labelled a live deployment']],
  ['full-stack', 'Complete full-stack application', ['Use a separate application Supabase project', 'Exercise real signup/login and persisted user data', 'Verify application RLS with multiple users', 'Pass implementation, tests and truthful delivery gates'], ['Reject the internal SkyOps project as an application migration target', 'Deny access to another application user data']],
  ['ai-application', 'AI-powered application', ['Use a real configured optional provider', 'Validate inputs, errors and applicable persistence', 'Run deterministic and model-judged evaluations', 'Record measurable latency and provider usage when available'], ['Unjudged rubrics fail acceptance', 'Unavailable provider is reported rather than returning a fake answer']],
  ['existing-project', 'Existing project improvement', ['Map the existing repository', 'Preserve unaffected requirements and behavior', 'Implement the scoped improvement', 'Run affected regression and quality checks'], ['Do not reduce scope to achieve a quick budget', 'Reject unrelated file modifications during constrained work']],
  ['visual-refinement', 'UI/UX design and visual refinement', ['Load relevant project-specific design context', 'Run the applicable polish and visual-evaluation paths', 'Preserve nine-dimension rubric and reduced-motion handling', 'Compare rendered results at relevant viewport sizes'], ['Do not pass a failed critical design gate', 'Do not claim screenshot inspection when unavailable']],
  ['collaboration', 'Multi-user collaboration', ['Create or join authorized workspaces and teams', 'Share only explicitly authorized project context', 'Coordinate task dependencies and claims', 'Transfer ownership without orphaning a resource'], ['Reject invitation replay and role escalation', 'Revoke inherited access when explicitly denied']],
  ['host-switch', 'Switching between Claude Code and Codex', ['Authenticate as the same SkyOps user', 'Discover and invoke required skill entry points independently', 'Restore bounded authorized project context', 'Preserve native capabilities without requiring the other host'], ['Never load the separate .NET SkyOps installation', 'Do not reuse a previous user context after switching identity']],
  ['offline-sync', 'Offline execution and synchronization', ['Continue permitted local work without cloud connectivity', 'Persist identity/resource-scoped operations', 'Reauthorize and deduplicate replay', 'Surface revision conflicts without losing work'], ['Reject replay after permission revocation', 'Stale writes must not resurrect deleted content']],
  ['memory-isolation', 'Cross-user memory isolation', ['Exercise personal, team, workspace and project scopes', 'Authorize semantic candidates before content retrieval', 'Apply parent-document authorization to revisions/chunks', 'Enforce equivalent MCP, Storage and cache boundaries'], ['Reject guessed resource IDs and cross-tenant joins', 'Framework ownership must not grant private content access', 'Never promote private content automatically']],
  ['installation', 'Installation, update and rollback', ['Install either native host independently in owned profiles', 'Verify package and owned-file receipts', 'Update atomically and preserve user data', 'Recover an interrupted update and uninstall only owned files'], ['Do not overwrite unrelated installations', 'Reject altered packages and unsafe cleanup paths']],
];
const measurements = ['quality', 'security', 'correctness', 'execution_time_ms', 'tokens_actual_or_unavailable', 'injected_context_bytes', 'agent_calls', 'mcp_calls', 'integration_calls', 'database_requests', 'embedding_work', 'storage_bytes', 'sync_bytes', 'depth', 'model_versions', 'limitations'];
const scenarios = definitions.map(([id, title, acceptance, negative_checks]) => ({
  id, title, acceptance, negative_checks, measurements,
  host_matrix: ['claude', 'codex'], platform_matrix: ['windows', 'linux', 'macos', 'wsl'],
  fixture_policy: 'Synthetic authorized data only; no original private history or credentials',
  execution_status: 'not_run', evidence: [],
}));
fs.writeFileSync(file, JSON.stringify({ schema_version: 1, authority: 'SKYOPS_TRANSFORMATION_PLAN.md', scenarios }, null, 2) + '\n');
console.log(JSON.stringify({ scenarios: scenarios.length, written: path.relative(root, file) }));
