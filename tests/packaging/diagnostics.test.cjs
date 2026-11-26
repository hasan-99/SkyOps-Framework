'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sandbox } = require('../helpers/sandbox.cjs');

test('qualified CLI diagnostics reuse the single core and never certify unchecked native hooks', (t) => {
  const box = sandbox(t);
  const native = path.join(box.home, 'profiles/codex/native');
  fs.mkdirSync(native, { recursive: true });
  fs.writeFileSync(path.join(box.home, 'profiles/codex/profile-manifest.json'), '{"framework":"skyops","host":"codex","native_validation":"not_run"}');
  fs.writeFileSync(path.join(native, 'AGENTS.md'), 'fixture native instructions');
  fs.writeFileSync(path.join(native, 'config.toml'), '# fixture');
  const result = box.json('bin/skyops.cjs', ['doctor']);
  assert.equal(result.code, 0);
  assert.equal(result.value.status, 'DEGRADED');
  assert.equal(result.value.checks.install.status, 'pass');
  assert.ok(result.value.checks.hooks.issues.includes('codex: native hook execution not verified'));
  assert.equal(result.value.checks.developer_experience.status, 'pass');
  assert.equal(result.value.checks.erp, undefined);
  assert.equal(result.value.checks.employee_experience, undefined);
  assert.equal(fs.existsSync(path.join(native, 'bin')), false);
});

test('status uses the scoped JSON queue and preserves corrupt data instead of reporting empty', (t) => {
  const box = sandbox(t);
  const queue = path.join(box.home, '.skyops-sync-queue.json');
  const context = { user_id: 'fixture-user', workspace_id: 'fixture-workspace', project_id: 'fixture-project', project_root: box.directory };
  fs.writeFileSync(path.join(box.home, '.skyops-config.json'), JSON.stringify({ context }));
  fs.writeFileSync(queue, JSON.stringify({ queue: [{ context, client_report_id: 'visible', last_attempt_at: '2026-11-26T00:00:00Z' }, { context: { ...context, user_id: 'other-user' }, client_report_id: 'private' }] }));
  const result = box.json('bin/skyops.cjs', ['status', '--json']);
  assert.equal(result.code, 0);
  assert.equal(result.value.synchronization.pending, 1);
  assert.ok(result.value.synchronization.last_attempt > 0);
  assert.equal(JSON.stringify(result.value).includes('other-user'), false);
  fs.writeFileSync(queue, '{corrupt fixture');
  const corrupt = box.json('bin/skyops.cjs', ['status', '--json']);
  assert.equal(corrupt.value.synchronization.status, 'recovery_required');
  assert.equal(corrupt.value.synchronization.pending, null);
  assert.equal(fs.readFileSync(queue, 'utf8'), '{corrupt fixture');
});

test('planning CLI keeps organization preview-only unless write is explicitly requested', (t) => {
  const box = sandbox(t);
  const planning = path.join(box.directory, '.planning');
  fs.mkdirSync(planning);
  fs.writeFileSync(path.join(planning, 'diagnostic-output.txt'), 'keep fixture');
  const preview = box.json('bin/skyops.cjs', ['planning-hygiene', 'organize', '--json']);
  assert.equal(preview.value.status, 'dry_run');
  assert.equal(fs.readFileSync(path.join(planning, 'diagnostic-output.txt'), 'utf8'), 'keep fixture');
  assert.equal(preview.value.moves.length, 1);
});
