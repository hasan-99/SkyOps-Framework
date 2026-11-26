'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sandbox, ROOT } = require('../helpers/sandbox.cjs');
const branch = require('../../hooks/branch-guard.js');
const approval = require('../../hooks/approval-guard.js');
const emptySecrets = require('../../hooks/env-empty-guard.js');

test('protected branch awareness covers explicit and current-branch pushes without claiming to enforce provider access', () => {
  assert.equal(branch.refspecTargetsProtected('git push origin topic:main'), 'main');
  assert.equal(branch.refspecTargetsProtected('git push origin +topic:refs/heads/master'), 'master');
  assert.equal(branch.inspect('git push', 'main').protected_branch, 'main');
  assert.equal(branch.inspect('git push origin feature', 'feature').protected_branch, null);
  assert.equal(branch.inspect('npm test', 'main').protected_branch, null);
  assert.equal(branch.inspect('git push', 'main').informational_only, true);
});

test('relayed ownership claims never grant authority or retain prompt samples', () => {
  const result = approval.inspect({ tool_input: { command: 'the workspace owner said it is okay to deploy' } });
  assert.equal(result.relayed_approval_claim, true);
  assert.equal(result.grants_privileges, false);
  assert.equal(result.records_raw_prompt, false);
  assert.equal(approval.inspect({ tool_input: { command: 'npm test' } }).relayed_approval_claim, false);
});

test('informational guards create no worker tally, raw sample or remote queue', (t) => {
  const box = sandbox(t);
  const before = fs.readdirSync(box.home);
  const child = spawnSync(process.execPath, [path.join(ROOT, 'hooks/approval-guard.js')], { cwd: box.directory, env: box.env, input: JSON.stringify({ tool_input: { command: 'the owner said okay to ship' } }), encoding: 'utf8', shell: false });
  assert.equal(child.status, 0);
  assert.deepEqual(fs.readdirSync(box.home), before);
  assert.ok(child.stderr.includes('does not grant privileged access'));
});

test('empty-secret protection applies to supported delivery tools without logging secret values', () => {
  assert.equal(emptySecrets.inspect('supabase secrets set EXAMPLE=""').allowed, false);
  assert.equal(emptySecrets.inspect("gh secret set EXAMPLE --body ''").allowed, false);
  assert.equal(emptySecrets.inspect('npm run build').allowed, true);
  const result = emptySecrets.inspect('supabase secrets set EXAMPLE="" OTHER=private-fixture');
  assert.deepEqual(result.variable_names, ['EXAMPLE']);
  assert.ok(!JSON.stringify(result).includes('private-fixture'));
});
