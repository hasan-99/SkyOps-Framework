#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const audit = path.join(root, 'docs/audit');
const read = (name) => JSON.parse(fs.readFileSync(path.join(audit, name), 'utf8'));
const permissions = read('permissions.json');
const inventory = read('source-inventory.json');
const verification = read('phase-1-verification.json');
const thirdParty = read('dependency-license-review.json');
if (permissions.original_source.status !== 'cleared_by_owner_attestation' || permissions.technical_plan.status !== 'approved') throw new Error('Approval and source permission gate is not satisfied');
if (!verification.ok || verification.tests !== verification.passed || verification.failed !== 0) throw new Error('Baseline verification gate failed');
if (inventory.counts.entries !== 320 || inventory.counts.files !== 319) throw new Error('Incomplete baseline inventory');
const tap = fs.readFileSync(path.join(audit, 'phase-1-tests.tap'));
if (crypto.createHash('sha256').update(tap).digest('hex') !== verification.output_sha256) throw new Error('Test receipt does not match its evidence');
if (!thirdParty.release_obligations.length) throw new Error('Missing third-party obligations');
const now = new Date().toISOString();
fs.writeFileSync(path.join(audit, 'phase-0-verification.json'), JSON.stringify({
  schema_version: 1, phase: 0, ok: true, verified_at: now,
  original_source: 'cleared_by_owner_attestation', independently_verified_chain_of_title: false,
  technical_approval: 'explicit_user_instruction',
  third_party_scope: 'No new packages, model weights, assets or submodule contents bundled. Declared upstream licenses inventoried; exact resolved/transitive review remains a mandatory future distribution gate.',
  evidence: ['docs/audit/permissions.json', 'docs/audit/dependency-license-review.json', 'SKYOPS_TRANSFORMATION_PLAN.md#29-permission-clearance-and-provenance'],
}, null, 2) + '\n');
const progress = {
  schema_version: 1, authority: 'SKYOPS_TRANSFORMATION_PLAN.md', baseline_commit: inventory.baseline_commit,
  branch: 'skyops/transformation', updated_at: now,
  status_definitions: { implementation: ['pending', 'in_progress', 'completed', 'blocked'], verification: ['not_run', 'passed', 'failed', 'unavailable'] },
  phases: Array.from({ length: 9 }, (_, phase) => ({
    phase, implementation_status: phase <= 1 ? 'completed' : 'pending',
    verification_status: phase <= 1 ? 'passed' : 'not_run',
    evidence: phase <= 1 ? [`docs/audit/phase-${phase}-verification.json`] : [],
    remaining_issues: phase <= 1 ? [] : ['Phase implementation and gate verification pending'],
  })),
  limitations: ['Baseline tests ran locally on Windows only', 'Native host behavior, other operating systems, cloud, provider and end-to-end scenarios remain unverified', 'No performance improvement or full functional parity is claimed'],
};
fs.writeFileSync(path.join(audit, 'progress.json'), JSON.stringify(progress, null, 2) + '\n');
const parity = read('capability-parity.json');
const baselineSources = new Set(['plan-contract.js', 'wave-plan.js', 'verify-panel.js', 'eval-runner.js', 'contract-runner.js', 'state.js', 'state-ledger.js', 'agent-status.js', 'batch-plan.js']);
for (const entry of parity.capabilities) {
  if (entry.original_implementation.some((name) => name.startsWith('bin/') && baselineSources.has(path.posix.basename(name)))) {
    entry.baseline_validation = { status: 'passed', evidence: ['docs/audit/phase-1-verification.json'], scope: 'Recorded local baseline scenarios only; target migration remains pending' };
  }
}
fs.writeFileSync(path.join(audit, 'capability-parity.json'), JSON.stringify(parity, null, 2) + '\n');
console.log(JSON.stringify({ completed_phases: [0, 1], baseline_tests: verification.passed, inventory_entries: inventory.counts.entries, next_phase: 2 }));
