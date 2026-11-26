#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const audit = path.join(root, 'docs/audit');
const read = (name) => JSON.parse(fs.readFileSync(path.join(audit, name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(audit, name), JSON.stringify(value, null, 2) + '\n');
const migrated = read('identity-migration.json');
const parity = read('capability-parity.json');
const local = read('phase-2-packaging-verification.json');
if (!local.ok) throw new Error('LOCAL_GATE_TESTS_MUST_PASS');
for (const file of migrated.files) {
  const entry = parity.capabilities.find((capability) => capability.original_implementation.includes(file.source_path));
  if (!entry) throw new Error(`UNTRACKED_PRESERVED_COMPONENT:${file.source_path}`);
  entry.migration_status = 'in_progress';
  entry.new_implementation = [file.target_path];
  entry.evidence = [...new Set([...(entry.evidence || []), 'docs/audit/identity-migration.json'])];
  if (['agent', 'skill', 'internal_skill_resource'].includes(entry.category)) {
    entry.partial_validation = { status: 'passed', scope: 'Actual migrated source compiles to both host artifact sets; not native execution/full functional parity', evidence: ['docs/audit/phase-2-packaging-verification.json'] };
    entry.remaining_issues = ['Native policy/invocation and functional workflow acceptance remain pending', 'Legacy service and removed-hosting references need contextual adaptation where present'];
  }
  if (file.source_path === 'skills/zoho-workflow/SKILL.md') {
    entry.adaptation_kind = 'Preserved provider capabilities; reconstructed direct-provider routing after approved business-server exclusion';
    entry.remaining_issues = ['Configured provider acceptance, template calculations and reconstructed original server behavior remain unverified'];
  }
}
const nativeEvidence = ['docs/audit/codex-native-discovery-existing-profile.json', 'docs/audit/codex-native-router.json', 'docs/audit/claude-native-router.json'];
for (const file of ['bin/status-snapshot.js', 'bin/trust-score.js', 'bin/report-payload.js', 'bin/project-snapshot.js', 'bin/branch-hygiene.js', 'bin/erp-retry.js', 'hooks/pre-deploy-gate.js']) {
  const entry = parity.capabilities.find((item) => item.original_implementation.includes(file));
  if (!entry) throw new Error(`UNTRACKED_ADAPTED_HELPER:${file}`);
  entry.partial_validation = { status: 'passed', scope: 'Specific local diagnostics, privacy, scoped queue or mandatory-gate regression contracts only; not complete functionality/tenant security parity', evidence: ['docs/audit/phase-2-packaging-verification.json'] };
  entry.evidence = [...new Set([...(entry.evidence || []), 'docs/audit/phase-2-packaging-verification.json'])];
  entry.remaining_issues = ['Native host policy/hook integration and representative complete workflow acceptance remain pending', 'Cloud authorization/isolation is not established by local transport tests'];
}
const router = parity.capabilities.find((item) => item.new_implementation.includes('skills/sky-next/SKILL.md'));
if (!router) throw new Error('ROUTER_CAPABILITY_MISSING');
router.partial_validation = { status: 'passed', scope: 'Actual empty-project routing on both native Windows hosts with local state-tool evidence; remaining routing states and full workflow acceptance pending', evidence: nativeEvidence };
router.evidence = [...new Set([...(router.evidence || []), ...nativeEvidence])];
write('capability-parity.json', parity);
const progress = read('progress.json');
progress.updated_at = new Date().toISOString();
progress.provisioning = { internal_supabase_project: { display_name: 'SkyOps', region: 'eu-central-1', reference: null, status: 'not_created', reason: 'User reports Free plan active project limit reached', existing_projects_must_not_be_reused_or_modified: true }, local_supabase_testing: 'authorized', docker: 'Developer/test prerequisite only; engine running; no cloud project provisioned' };
const phase = progress.phases.find((entry) => entry.phase === 2);
phase.implementation_status = 'in_progress';
phase.verification_status = 'not_run';
phase.evidence = [...new Set([...phase.evidence, 'docs/audit/identity-migration.json', 'docs/audit/runtime-isolation-repairs.json', 'docs/audit/state-transport-adaptation.json', 'docs/audit/code-data-path-adaptation.json', 'docs/audit/native-host-smoke.json', 'docs/audit/claude-native-profile.json', 'docs/audit/codex-sandbox-probe.json', 'docs/audit/linux-packaging-verification.json', 'docs/audit/runtime-surface.json', ...nativeEvidence])];
phase.partial_validation = { status: 'passed', tests: local.tests, platform: local.platform, linux_component_tests: read('linux-packaging-verification.json').tests, evidence: ['docs/audit/phase-2-packaging-verification.json', 'docs/audit/linux-packaging-verification.json'], native_discovery: 'Codex 29 skills from an independent repository, no parse errors or outside non-system skills', native_router: 'Both authenticated Windows hosts ran the real local state check and routed an empty fixture to sky-new; one bounded scenario only', claude: 'Authenticated isolated native profile; all-role/skill workflow acceptance remains pending' };
phase.remaining_issues = ['Remaining legacy service/removed-hosting/public-distribution references', 'Remaining skill/agent native execution, hook/tool-policy adapters and complete workflow acceptance', 'Linux native hosts, macOS and standalone WSL validation; container components alone are insufficient', 'Sanitized private source export and actual GitHub CI/release validation', 'Production signing trust/bootstrap, licensed delivery and later-phase server authorization'];
progress.external_setup = { github: { authenticated_owner: 'hasan-99', repository: 'hasan-99/SkyOps-Framework', private: true, created_empty: true, source_uploaded: false, evidence: 'docs/audit/private-repository-setup.json', prior_candidate_preserved: 'hasan-99/SkyOps' }, standalone_wsl: 'No development distro installed; only docker-desktop was listed', cloud_supabase: 'Dedicated new project remains pending; existing projects untouched; local Supabase stack tests are authorized but not yet run' };
write('progress.json', progress);
const oldDiscovery = read('codex-native-discovery.json');
oldDiscovery.evidence_status = 'superseded_fixture_did_not_prove_independent_project_discovery';
oldDiscovery.correction = 'The previous fixture ran inside the profile user directory. Use codex-native-discovery-existing-profile.json, whose fixture is an independent repository outside the profile/core.';
write('codex-native-discovery.json', oldDiscovery);
const priorProbePath = path.join(audit, 'claude-native-discovery.json');
if (fs.existsSync(priorProbePath)) {
  const probe = read('claude-native-discovery.json');
  probe.evidence_status = 'invalid_methodology_not_a_definition_discovery_probe';
  probe.correction = 'claude agents --json lists background sessions. Neither agent discovery nor an agent defect is inferred from the empty list.';
  write('claude-native-discovery.json', probe);
}
console.log(JSON.stringify({ phase: 2, completed: false, locally_passing_tests: local.tests, migrated_source_entries: migrated.files.length, supabase_cloud: 'pending_new_project', original_net_framework: 'untouched' }));
