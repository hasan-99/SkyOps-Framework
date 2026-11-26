'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readTree } = require('../../scripts/audit-baseline.cjs');
const inventory = require('../../docs/audit/source-inventory.json');
const parity = require('../../docs/audit/capability-parity.json');
const permissions = require('../../docs/audit/permissions.json');
const root = path.resolve(__dirname, '../..');

test('every immutable source entry has exactly one inventory disposition', () => {
  const paths = inventory.files.map((file) => file.source_path);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual([...paths].sort(), readTree().map((entry) => entry.source_path).sort());
  assert.equal(inventory.counts.entries, 320);
  assert.equal(inventory.counts.files, 319);
  assert.equal(inventory.counts.gitlinks, 1);
});

test('every retained source component has a parity entry and a confined target', () => {
  const sourceCapabilities = parity.capabilities.filter((entry) => entry.original_implementation.length);
  for (const file of inventory.files) {
    if (file.classification === 'approved_exclusion') { assert.equal(file.target_path, null); continue; }
    assert.equal(sourceCapabilities.filter((entry) => entry.original_implementation.includes(file.source_path)).length, 1);
    assert.ok(file.target_path && !file.target_path.startsWith('/') && !file.target_path.split('/').includes('..'));
  }
  const targets = inventory.files.map((file) => file.target_path).filter(Boolean);
  assert.equal(new Set(targets).size, targets.length, 'Two source files must not be silently merged');
});

test('all nine agents and all twenty-nine skills are preserved', () => {
  assert.equal(inventory.files.filter((file) => file.category === 'agent').length, 9);
  assert.equal(inventory.files.filter((file) => file.category === 'skill').length, 29);
  for (const file of inventory.files.filter((file) => ['agent', 'skill'].includes(file.category))) assert.equal(file.classification, 'preserved');
});

test('every runtime helper, template, rule and design document is inventoried', () => {
  for (const [category, expected] of Object.entries({ runtime_helper: 41, template: 88, rule: 13, design: 8 })) {
    assert.equal(inventory.files.filter((file) => file.category === category).length, expected, category);
  }
});

test('original user history and installation state cannot enter target memory or runtime', () => {
  const privateFiles = inventory.files.filter((file) => /^knowledge\/daily-log\//.test(file.source_path));
  assert.equal(privateFiles.length, 49);
  for (const file of privateFiles) { assert.equal(file.classification, 'approved_exclusion'); assert.equal(file.target_path, null); }
  for (const name of ['knowledge/client-prefs.md', 'knowledge/deployment-map.md', 'knowledge/email-signature.html', '.qualia-config.json']) {
    assert.equal(inventory.files.find((file) => file.source_path === name).classification, 'approved_exclusion');
  }
});

test('source permission is explicitly attested without claiming independent verification', () => {
  assert.equal(permissions.original_source.status, 'cleared_by_owner_attestation');
  assert.equal(permissions.original_source.independently_verified_chain_of_title, false);
  assert.equal(permissions.third_party_policy.resolved_versions_and_transitives_reviewed_before_distribution, true);
});

test('all ten acceptance scenarios and required measurement fields are specified', () => {
  const scenarios = JSON.parse(fs.readFileSync(path.join(root, 'docs/audit/acceptance-scenarios.json'), 'utf8'));
  assert.equal(scenarios.scenarios.length, 10);
  assert.equal(new Set(scenarios.scenarios.map((scenario) => scenario.id)).size, 10);
  for (const scenario of scenarios.scenarios) {
    assert.ok(scenario.acceptance.length >= 3);
    assert.ok(scenario.negative_checks.length > 0);
    assert.ok(scenario.measurements.includes('quality'));
    assert.ok(scenario.measurements.includes('tokens_actual_or_unavailable'));
    assert.equal(scenario.execution_status, 'not_run');
  }
});

test('authoritative plan records all approved refinements and phase gates', () => {
  const plan = fs.readFileSync(path.join(root, 'SKYOPS_TRANSFORMATION_PLAN.md'), 'utf8');
  for (let section = 1; section <= 32; section++) assert.match(plan, new RegExp(`^## ${section}\\. `, 'm'));
  assert.match(plan, /Approval status:\*\* APPROVED/);
  assert.match(plan, /CLEARED BY OWNER ATTESTATION/);
  assert.doesNotMatch(plan, /Awaiting explicit approval of the complete plan/);
});
