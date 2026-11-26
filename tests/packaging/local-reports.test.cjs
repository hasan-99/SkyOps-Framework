'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sandbox } = require('../helpers/sandbox.cjs');

function initialize(box, status = 'shipped') {
  const initial = box.json('bin/state.js', ['init', '--project', 'Report Fixture', '--phases', '[{"name":"Delivery","goal":"Verified fixture"}]']);
  assert.equal(initial.code, 0);
  const file = path.join(box.directory, '.planning/tracking.json');
  const tracking = JSON.parse(fs.readFileSync(file, 'utf8'));
  tracking.status = status;
  fs.writeFileSync(file, JSON.stringify(tracking));
}

test('shipped work produces one local development report without cloud configuration', (t) => {
  const box = sandbox(t);
  initialize(box);
  const result = box.json('tests/helpers/report-client.cjs');
  assert.equal(result.code, 0);
  assert.match(result.value.local, /^SKYOPS-REPORT-\d+$/);
  assert.ok(fs.existsSync(result.value.path));
  const report = JSON.parse(fs.readFileSync(result.value.path, 'utf8'));
  assert.equal(report.source, 'auto');
  assert.equal(report.status, 'shipped');
  assert.deepEqual(report.prompt_samples, []);
  assert.equal(report.team_id, undefined);
  assert.equal(report.session_duration_minutes, undefined);
  assert.equal(box.json('tests/helpers/report-client.cjs').value.skipped, 'already-reported');
});

test('in-progress work and disabled capture do not produce false shipped reports', (t) => {
  const box = sandbox(t);
  initialize(box, 'built');
  assert.equal(box.json('tests/helpers/report-client.cjs').value.skipped, 'not-shipped');
  fs.writeFileSync(path.join(box.home, '.skyops-config.json'), '{"reporting":{"autoCapture":false}}');
  assert.equal(box.json('tests/helpers/report-client.cjs').value.skipped, 'auto-capture-disabled');
});

test('raw prompt samples stay out of reports until capture and synchronization are explicitly enabled', (t) => {
  const box = sandbox(t);
  initialize(box);
  fs.writeFileSync(path.join(box.directory, '.planning/.session-usage.json'), '{"prompt_samples":["private fixture"],"command_usage":{"sky-build":1}}');
  const payload = () => box.json('bin/report-payload.js').value;
  assert.deepEqual(payload().prompt_samples, []);
  fs.writeFileSync(path.join(box.home, '.skyops-config.json'), '{"privacy":{"captureRawPrompts":true}}');
  assert.deepEqual(payload().prompt_samples, []);
  fs.writeFileSync(path.join(box.home, '.skyops-config.json'), '{"privacy":{"captureRawPrompts":true,"syncRawPrompts":true}}');
  assert.deepEqual(payload().prompt_samples, ['private fixture']);
});

test('authorized synchronization queues a report but never claims cloud delivery', (t) => {
  const box = sandbox(t);
  initialize(box);
  fs.writeFileSync(path.join(box.home, '.skyops-config.json'), JSON.stringify({ context: { user_id: 'fixture-user', workspace_id: 'fixture-workspace', project_id: '00000000-0000-4000-8000-000000000003', project_root: box.directory }, sync: { enabled: true } }));
  const result = box.json('tests/helpers/report-client.cjs');
  assert.match(result.value.queued, /^SKYOPS-REPORT-\d+$/);
  assert.equal(result.value.synchronization, 'pending_server_acknowledgment');
  assert.equal(result.value.posted, undefined);
  assert.ok(fs.existsSync(result.value.path));
  const queue = JSON.parse(fs.readFileSync(path.join(box.home, '.skyops-sync-queue.json'), 'utf8'));
  assert.equal(queue.queue.length, 1);
  assert.equal(queue.queue[0].url, undefined);
});

test('a selected context belonging to another local project cannot receive the current report', (t) => {
  const box = sandbox(t);
  initialize(box);
  const other = path.join(box.directory, 'different-project');
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(box.home, '.skyops-config.json'), JSON.stringify({ context: { user_id: 'fixture-user', workspace_id: 'fixture-workspace', project_id: 'fixture-project', project_root: other }, sync: { enabled: true } }));
  const result = box.json('tests/helpers/report-client.cjs');
  assert.match(result.value.local, /^SKYOPS-REPORT-\d+$/);
  assert.equal(result.value.queued, undefined);
  assert.equal(fs.existsSync(path.join(box.home, '.skyops-sync-queue.json')), false);
});

test('an untracked project has a local label but no fabricated cloud identity', (t) => {
  const box = sandbox(t);
  const payload = box.json('bin/report-payload.js').value;
  assert.equal(payload.project_id, null);
  assert.equal(payload.project_key, path.basename(box.directory));
  assert.equal(payload.client_report_id, '');
  assert.equal(payload.verification, 'pending');
});

test('reports and snapshots remove Git URL credentials and omit local filesystem remotes', (t) => {
  const box = sandbox(t);
  initialize(box);
  const file = path.join(box.directory, '.planning/tracking.json');
  const tracking = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...tracking, git_remote: 'https://fixture-user:fixture-secret@github.com/example/project.git?token=private#private' }));
  const report = box.json('bin/report-payload.js').value;
  assert.equal(report.git_remote, 'https://github.com/example/project.git');
  const snapshot = box.json('bin/project-snapshot.js').value;
  assert.equal(snapshot.identifiers.git_remote, 'https://github.com/example/project.git');
  assert.equal(snapshot.identifiers.project_id, null);
  assert.equal(snapshot.identifiers.team_id, undefined);
  const { safeRemote } = require('../../framework/git-metadata.cjs');
  assert.equal(safeRemote('ssh://private-user@github.com/example/project.git'), 'ssh://github.com/example/project.git');
  assert.equal(safeRemote('private-user@github.com:example/project.git'), 'github.com:example/project.git');
  for (const remote of ['C:\\private\\project', '/home/private/project', 'file:///private/project', 'https://bad\nvalue']) assert.equal(safeRemote(remote), '');
  assert.equal(JSON.stringify(report).includes('fixture-secret'), false);
});
