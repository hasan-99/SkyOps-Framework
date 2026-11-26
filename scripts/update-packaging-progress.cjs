#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { digest } = require('../framework/package-store.cjs');
const root = path.resolve(__dirname, '..');
const audit = path.join(root, 'docs/audit');
const read = (name) => JSON.parse(fs.readFileSync(path.join(audit, name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(audit, name), JSON.stringify(value, null, 2) + '\n');
const evidence = 'docs/audit/phase-2-packaging-verification.json';
const receipt = read('phase-2-packaging-verification.json');
if (!receipt.ok || receipt.output_sha256 !== digest(fs.readFileSync(path.join(audit, 'phase-2-packaging-tests.tap')))) throw new Error('INVALID_PACKAGING_EVIDENCE');
const progress = read('progress.json');
if (!progress.phases.filter((phase) => phase.phase < 2).every((phase) => phase.implementation_status === 'completed' && phase.verification_status === 'passed')) throw new Error('PREDECESSOR_GATE_NOT_PASSED');
const phase = progress.phases.find((item) => item.phase === 2);
if (progress.phases.some((item) => item.phase > 2 && item.implementation_status !== 'pending')) throw new Error('DO_NOT_REWIND_LATER_PROGRESS');
phase.implementation_status = 'in_progress';
phase.verification_status = 'not_run';
phase.partial_validation = { status: 'passed', tests: receipt.tests, platform: receipt.platform, evidence: [evidence] };
phase.evidence = [evidence, 'docs/development-status.md'];
phase.remaining_issues = ['Full source identity migration', 'Native host adapters, tool-policy mapping, discovery/execution and isolation', 'Cross-platform validation and private distribution', 'Production signing trust/bootstrap and license-aware host integration', 'Phase 4 server authorization gates must pass before any ordinary-user production activation', 'Phase gate has not passed'];
progress.updated_at = new Date().toISOString();
write('progress.json', progress);
const parity = read('capability-parity.json');
const components = {
  installer: { files: ['framework/package-store.cjs', 'bin/skyops.cjs'], remaining: ['Host installation/profile integration and source/release distribution', 'All-platform acceptance and release gate'] },
  'main-cli': { files: ['bin/skyops.cjs', 'framework/identity.json', 'framework/catalog.cjs'], remaining: ['Remaining approved development, auth, memory, collaboration and integration commands depend on later phases'] },
  'instruction-compiler': { files: ['framework/compiler.cjs'], remaining: ['Migrated original source, host-specific policies and native execution acceptance'] },
  'framework-tests': { files: ['tests/', 'scripts/verify-baseline.cjs', 'scripts/verify-packaging.cjs'], remaining: ['Later phase security, cloud, native host, all-OS and end-to-end tests'] },
};
for (const entry of parity.capabilities) {
  if (!components[entry.id]) continue;
  entry.new_implementation = components[entry.id].files;
  entry.migration_status = 'in_progress';
  entry.validation_status = 'not_run';
  entry.partial_validation = { status: 'passed', evidence: [evidence], scope: 'Implemented local subcontracts only; no complete capability parity claim' };
  entry.evidence = [evidence];
  if (entry.id === 'framework-tests') entry.evidence.unshift('docs/audit/phase-1-verification.json');
  entry.remaining_issues = components[entry.id].remaining;
}
write('capability-parity.json', parity);
const inventory = read('source-inventory.json');
const packageEntry = inventory.files.find((entry) => entry.source_path === 'package.json');
packageEntry.migration_status = 'in_progress';
packageEntry.validation_status = 'not_run';
packageEntry.required_actions = ['Revalidate final private release metadata and distribution payload after native adapter gates'];
write('source-inventory.json', inventory);
const packageCapability = parity.capabilities.find((entry) => entry.original_implementation.includes('package.json'));
packageCapability.migration_status = 'in_progress';
packageCapability.evidence = [evidence];
packageCapability.remaining_issues = ['Final release metadata and distribution payload validation'];
write('capability-parity.json', parity);
console.log(JSON.stringify({ phase: 2, status: 'in_progress', local_packaging_tests: receipt.tests, gate_passed: false }));
