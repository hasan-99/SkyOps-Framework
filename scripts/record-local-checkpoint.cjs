#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { digest } = require('../framework/package-store.cjs');
const root = path.resolve(__dirname, '..');
const audit = path.join(root, 'docs/audit');
const read = (name) => JSON.parse(fs.readFileSync(path.join(audit, name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(audit, name), JSON.stringify(value, null, 2) + '\n');
const output = fs.readFileSync(path.join(audit, 'current-local-tests.tap'), 'utf8');
const count = (name) => Number(new RegExp(`^# ${name} (\\d+)$`, 'm').exec(output)?.[1] || 0);
if (!count('tests') || count('tests') !== count('pass') || count('fail') || count('skipped') || count('todo')) throw new Error('CURRENT_LOCAL_TEST_GATE_FAILED');
const evidence = 'docs/audit/current-local-verification.json';
write('current-local-verification.json', { schema_version: 1, checked_at: new Date().toISOString(), command: 'node scripts/test.cjs', platform: process.platform, node: process.version, tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped'), output_sha256: digest(output), ok: true, phase_gate_passed: false, scope: 'Complete current local baseline, packaging and Git integration test suite; not full native productive workflow, cloud/RLS or end-to-end parity' });
const progress = read('progress.json');
const phase = progress.phases.find((entry) => entry.phase === 2);
phase.implementation_status = 'in_progress';
phase.verification_status = 'not_run';
phase.evidence = [...new Set([...phase.evidence, evidence, 'docs/audit/private-repository-setup.json', 'docs/audit/shared-skill-validation.json', 'docs/audit/generic-knowledge-adaptation.json', 'docs/audit/voice-credential-cleanup.json'])];
phase.partial_validation = { ...(phase.partial_validation || {}), current_local_tests: count('tests'), current_local_test_evidence: evidence, native_role_entrypoints: {} };
const parity = read('capability-parity.json');
for (const host of ['claude', 'codex']) {
  const file = `native-agent-validation-${host}.json`;
  const result = read(file);
  if (!result.ok || result.results.length !== 9) throw new Error('NATIVE_ROLE_EVIDENCE_INCOMPLETE');
  phase.partial_validation.native_role_entrypoints[host] = { passed: 9, scope: 'Actual role dispatch/missing-input negative contracts only', evidence: `docs/audit/${file}` };
  phase.evidence.push(`docs/audit/${file}`);
  for (const entry of parity.capabilities.filter((item) => item.category === 'agent')) {
    entry.evidence = [...new Set([...(entry.evidence || []), `docs/audit/${file}`])];
    entry.partial_validation = { status: 'passed', scope: 'Shared-source compilation and actual isolated native dispatch/missing-input probes on both Windows hosts; full task execution and tool-policy parity remain pending', evidence: ['docs/audit/native-agent-validation-claude.json', 'docs/audit/native-agent-validation-codex.json'] };
  }
}
for (const stack of ['landing-page', 'full-app', 'ai-agent', 'internal-tool']) {
  const file = `scaffold-${stack}-verification.json`;
  const result = read(file);
  if (!result.ok) throw new Error(`SCAFFOLD_GATE_FAILED:${stack}`);
  const entry = parity.capabilities.find((item) => item.new_implementation.includes(`skyops-templates/stacks/${stack}/scaffold/package.json`));
  if (!entry) throw new Error(`SCAFFOLD_PARITY_ENTRY_MISSING:${stack}`);
  entry.new_implementation = [...new Set([...entry.new_implementation, `skyops-templates/stacks/${stack}/scaffold/eslint.config.mjs`])];
  entry.evidence = [...new Set([...(entry.evidence || []), `docs/audit/${file}`])];
  entry.partial_validation = { status: 'passed', scope: 'Real isolated dependency install/lint/typecheck/build; scaffold remains a starter, not a finished app/auth/RLS/deployment acceptance', evidence: [`docs/audit/${file}`] };
  phase.evidence.push(`docs/audit/${file}`);
}
for (const file of read('generic-knowledge-adaptation.json').files) {
  const entry = parity.capabilities.find((item) => item.original_implementation.includes(file.path));
  if (!entry) throw new Error('UNTRACKED_GENERIC_KNOWLEDGE');
  entry.migration_status = 'in_progress';
  entry.evidence = [...new Set([...(entry.evidence || []), 'docs/audit/generic-knowledge-adaptation.json'])];
  entry.remaining_issues = ['Authorized generic source seed adapted; multi-level runtime memory, indexing, learning and authorization acceptance remain pending'];
}
progress.updated_at = new Date().toISOString();
progress.execution_cost_policy = { new_subagents: 'disabled_after_user_token_concern', further_live_model_batches: 'require_explicit_user_approval', current_work: 'deterministic_local_scripts_and_tests', completed_work_preserved: true };
progress.external_setup.github = { authenticated_owner: 'hasan-99', repository: 'hasan-99/SkyOps-Framework', private: true, source_uploaded: false, evidence: 'docs/audit/private-repository-setup.json', prior_candidate_preserved: 'hasan-99/SkyOps' };
write('progress.json', progress);
write('capability-parity.json', parity);
console.log(JSON.stringify({ current_local_tests: count('tests'), native_role_entrypoints: '9/9 each host; negative contracts only', scaffolds_built: 4, phase_2: 'in_progress', paid_model_batches: 'stopped' }));
