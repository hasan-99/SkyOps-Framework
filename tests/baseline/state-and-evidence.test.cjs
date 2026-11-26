'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sandbox } = require('../helpers/sandbox.cjs');
const { contract } = require('../helpers/characterization-cases.cjs');
const { runContract, runCheck } = require('../../bin/contract-runner.js');
const statuses = require('../../bin/agent-status.js');
const ledger = require('../../bin/state-ledger.js');

function initialize(box) {
  const result = box.json('bin/state.js', ['init', '--project', 'Cedar Workspace', '--phases', JSON.stringify([{ name: 'Foundation', goal: 'Persist a validated record' }, { name: 'Delivery', goal: 'Verify the result' }])]);
  assert.equal(result.code, 0, JSON.stringify(result.value));
  return path.join(box.directory, '.planning');
}

test('machine evidence runs actual files and commands and preserves failures', (t) => {
  const box = sandbox(t);
  fs.mkdirSync(path.join(box.directory, 'src'));
  fs.writeFileSync(path.join(box.directory, 'src/T1.js'), 'export const answer = 42;');
  assert.equal(runContract(contract(), { cwd: box.directory, no_write: true }).ok, true);
  assert.equal(runCheck(box.directory, { type: 'grep-match', path: 'src/T1.js', pattern: 'answer = 42', expect: 'present' }).ok, true);
  assert.equal(runCheck(box.directory, { type: 'grep-match', path: 'src/T1.js', pattern: 'answer', expect: 'absent' }).ok, false);
  assert.equal(runCheck(box.directory, { type: 'behavioral', evidence_required: [{ path: 'missing.json', description: 'Recorded result' }] }).ok, false);
  const command = { type: 'command-exit', command: process.execPath, args: ['-e', 'process.stdout.write("accepted")'], expected_exit: 0, expect_stdout_match: '^accepted$' };
  assert.equal(runCheck(box.directory, command).ok, true);
  assert.equal(runCheck(box.directory, { ...command, args: ['-e', 'process.exit(7)'] }).ok, false);
  assert.equal(runCheck(box.directory, { ...command, expect_stdout_match: '^missing$' }).ok, false);
});

test('state transitions require plans, contracts, machine evidence and sufficient verification', (t) => {
  const box = sandbox(t);
  const planning = initialize(box);
  const state = (...args) => box.json('bin/state.js', args);
  const missing = state('transition', '--to', 'planned', '--phase', '1');
  assert.equal(missing.code, 1);
  assert.equal(missing.value.error, 'MISSING_FILE');
  fs.writeFileSync(path.join(planning, 'phase-1-plan.md'), '# Phase 1\n\n## Task 1\n**Acceptance Criteria:**\n- Record persists.\n');
  assert.equal(state('transition', '--to', 'planned', '--phase', '1').value.error, 'MISSING_CONTRACT');
  fs.writeFileSync(path.join(planning, 'phase-1-contract.json'), JSON.stringify(contract()));
  assert.equal(state('transition', '--to', 'planned', '--phase', '1').code, 0);
  assert.equal(state('transition', '--to', 'built', '--phase', '1', '--tasks-done', '1', '--tasks-total', '1').code, 0);
  fs.writeFileSync(path.join(planning, 'phase-1-verification.md'), 'INSUFFICIENT EVIDENCE\nPASS');
  assert.equal(state('transition', '--to', 'verified', '--phase', '1', '--verification', 'pass').value.error, 'INSUFFICIENT_EVIDENCE');
  fs.writeFileSync(path.join(planning, 'phase-1-verification.md'), '## Verdict\nPASS\nValidated the required behavior.');
  assert.equal(state('transition', '--to', 'verified', '--phase', '1', '--verification', 'pass').value.error, 'MISSING_EVIDENCE');
  fs.mkdirSync(path.join(box.directory, 'src'));
  fs.writeFileSync(path.join(box.directory, 'src/T1.js'), 'export const answer = 42;');
  const checked = box.json('bin/contract-runner.js', [path.join(planning, 'phase-1-contract.json'), '--cwd', box.directory, '--json']);
  assert.equal(checked.code, 0);
  assert.equal(state('transition', '--to', 'verified', '--phase', '1', '--verification', 'pass').code, 0);
  assert.equal(ledger.validate(box.directory).ok, true);
});

test('legacy-to-increment migration can restore original state and tracking bytes', (t) => {
  const box = sandbox(t);
  const planning = initialize(box);
  const originalState = fs.readFileSync(path.join(planning, 'STATE.md'));
  const originalTracking = fs.readFileSync(path.join(planning, 'tracking.json'));
  assert.equal(box.json('bin/state.js', ['migrate']).code, 0);
  assert.equal(fs.readdirSync(path.join(planning, 'increments')).length, 2);
  const cursor = JSON.parse(fs.readFileSync(path.join(planning, '.cursor.json'), 'utf8'));
  assert.equal(box.json('bin/state.js', ['claim', '--id', cursor.current_increment]).code, 0);
  const denied = box.json('bin/state.js', ['claim', '--id', cursor.current_increment], { QUALIA_ACTOR: 'another-user', SKYOPS_ACTOR: 'another-user' });
  assert.equal(denied.value.error, 'ALREADY_CLAIMED');
  assert.equal(box.json('bin/state.js', ['migrate', '--revert']).code, 0);
  assert.deepEqual(fs.readFileSync(path.join(planning, 'STATE.md')), originalState);
  assert.deepEqual(fs.readFileSync(path.join(planning, 'tracking.json')), originalTracking);
});

test('recovery journal restores an interrupted pair before the next mutation', (t) => {
  const box = sandbox(t);
  const planning = initialize(box);
  const state = fs.readFileSync(path.join(planning, 'STATE.md'), 'utf8');
  const tracking = fs.readFileSync(path.join(planning, 'tracking.json'), 'utf8');
  fs.writeFileSync(path.join(planning, '.state.journal'), JSON.stringify({ state, tracking, pid: 0, ts: '2026-11-26T00:00:00.000Z' }));
  fs.writeFileSync(path.join(planning, 'STATE.md'), 'interrupted content');
  assert.equal(box.json('bin/state.js', ['next-report-id']).code, 0);
  assert.equal(fs.readFileSync(path.join(planning, 'STATE.md'), 'utf8'), state);
  assert.equal(fs.existsSync(path.join(planning, '.state.journal')), false);
});

test('wave barrier holds missing, running and blocked tasks until every expected task is done', (t) => {
  const box = sandbox(t);
  const definition = { tasks: [{ id: 'T1', wave: 1 }, { id: 'T2', wave: 1 }] };
  assert.equal(statuses.barrier(box.directory, definition).ok, false);
  statuses.writeStatus(box.directory, { task: 'T1', status: 'DONE', commit: 'fixture-commit' });
  statuses.writeStatus(box.directory, { task: 'T2', status: 'RUNNING' });
  assert.equal(statuses.barrier(box.directory, definition).ok, false);
  statuses.writeStatus(box.directory, { task: 'T2', status: 'BLOCKED', note: 'Required fixture missing' });
  assert.equal(statuses.barrier(box.directory, definition).blocked, 1);
  statuses.writeStatus(box.directory, { task: 'T2', status: 'DONE', commit: 'fixture-commit-two' });
  assert.equal(statuses.barrier(box.directory, definition).ok, true);
  assert.throws(() => statuses.writeStatus(box.directory, { task: '../outside', status: 'DONE' }), /invalid task/);
});

test('ledger detects edits to hash-chained development history', (t) => {
  const box = sandbox(t);
  ledger.append(box.directory, { action: 'fixture-first', actor: 'fixture-user' });
  ledger.append(box.directory, { action: 'fixture-second', actor: 'fixture-user' });
  assert.equal(ledger.validate(box.directory).ok, true);
  const file = ledger.ledgerPath(box.directory);
  const events = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
  events[0].action = 'tampered';
  fs.writeFileSync(file, events.map(JSON.stringify).join('\n') + '\n');
  assert.equal(ledger.validate(box.directory).ok, false);
});

test('batch migration assigns each file once and respects worker concurrency', (t) => {
  const box = sandbox(t);
  const result = box.json('bin/batch-plan.js', ['--batch-size', '2', '--max-workers', '2', '--json', 'a.ts', 'b.ts', 'a.ts', 'c.ts', 'd.ts', 'e.ts']);
  assert.equal(result.code, 0);
  const files = result.value.batches.flatMap((batch) => batch.files);
  assert.equal(files.length, 5);
  assert.equal(new Set(files).size, 5);
  assert.ok(result.value.batches.every((batch) => batch.files.length <= 2));
  assert.ok(result.value.waves.every((wave) => wave.length <= 2));
});
