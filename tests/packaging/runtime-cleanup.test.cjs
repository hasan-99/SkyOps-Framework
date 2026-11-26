'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sandbox, ROOT } = require('../helpers/sandbox.cjs');
const flush = require('../../bin/knowledge-flush.js');

function localProject(t) {
  const box = sandbox(t);
  const daily = path.join(box.directory, '.planning/knowledge/daily-log');
  fs.mkdirSync(daily, { recursive: true });
  const now = Date.parse('2026-11-26T12:00:00Z');
  const options = flush.parseArgs(['--project', box.directory, '--host', 'codex', '--executable', process.execPath]);
  return { ...box, daily, now, options };
}

function scopedEnvironment(home, action) {
  const previous = process.env.SKYOPS_HOME;
  process.env.SKYOPS_HOME = home;
  try { return action(); } finally {
    if (previous === undefined) delete process.env.SKYOPS_HOME;
    else process.env.SKYOPS_HOME = previous;
  }
}

test('project-local flush preview is bounded, preserves checkpoints and never invokes a model', (t) => {
  const box = localProject(t);
  fs.writeFileSync(path.join(box.daily, '2026-11-25.md'), 'Observed deterministic project fix.');
  fs.writeFileSync(path.join(box.daily, '2026-11-26.md'), 'Observed authorized project decision.');
  const result = flush.run({ ...box.options, dryRun: true, maxFiles: 1 }, { now: box.now });
  assert.equal(result.model_invoked, false);
  assert.equal(result.input_files.length, 1);
  assert.equal(result.remaining_files, 1);
  assert.equal(fs.existsSync(path.join(box.directory, '.planning/knowledge/curated')), false);
  assert.equal(fs.existsSync(path.join(box.home, 'knowledge')), false);
});

test('private checkpoints cannot target framework/team scopes or contain credential-like input', (t) => {
  const box = localProject(t);
  assert.throws(() => flush.prepare({ ...box.options, scope: 'framework' }, box.now), /AUTHORIZED_SCOPE_BACKEND_REQUIRED/);
  const token = 'sk' + '_' + 'x'.repeat(40);
  fs.writeFileSync(path.join(box.daily, '2026-11-26.md'), 'Do not send ' + token);
  assert.throws(() => flush.prepare(box.options, box.now), /CREDENTIAL_LIKE_FLUSH_INPUT_REQUIRES_REDACTION/);
  assert.equal(fs.existsSync(path.join(box.directory, '.planning/knowledge/curated')), false);
});

test('validated native output curates only project memory and detects growth of an already processed daily log', (t) => {
  const box = localProject(t);
  const source = path.join(box.daily, '2026-11-26.md');
  fs.writeFileSync(source, 'A verified project-local learning.');
  let calls = 0;
  const spawn = (command, args, options) => {
    calls++;
    assert.equal(command, process.execPath);
    assert.equal(options.shell, false);
    assert.equal(options.cwd, box.directory);
    assert.equal(options.env.HOME, path.join(box.home, 'profiles/codex/user'));
    assert.ok(args.includes('features.shell_tool=false'));
    return { status: 0, stdout: JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ lessons: [{ type: 'fix', title: 'Verified fix', body: 'Use the tested deterministic project operation.' }] }) } }) + '\n' + JSON.stringify({ type: 'turn.completed' }) + '\n' };
  };
  const first = scopedEnvironment(box.home, () => flush.run(box.options, { now: box.now, spawn }));
  assert.equal(first.status, 'curated');
  assert.equal(first.lessons, 1);
  assert.ok(first.output.startsWith(path.join(box.directory, '.planning/knowledge/curated') + path.sep));
  assert.equal(fs.existsSync(path.join(box.home, 'knowledge')), false);
  assert.equal(fs.readFileSync(source, 'utf8'), 'A verified project-local learning.');
  const second = scopedEnvironment(box.home, () => flush.run(box.options, { now: box.now, spawn }));
  assert.equal(second.status, 'no_new_checkpoints');
  assert.equal(calls, 1);
  fs.appendFileSync(source, '\nA new checkpoint added later the same day.');
  scopedEnvironment(box.home, () => flush.run(box.options, { now: box.now, spawn }));
  assert.equal(calls, 2);
});

test('bad native output preserves checkpoints, releases its lock and cannot claim curation success', (t) => {
  const box = localProject(t);
  const source = path.join(box.daily, '2026-11-26.md');
  fs.writeFileSync(source, 'Keep this checkpoint.');
  const spawn = () => ({ status: 0, stdout: JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'not valid structured curation' } }) + '\n' + JSON.stringify({ type: 'turn.completed' }) + '\n' });
  assert.throws(() => scopedEnvironment(box.home, () => flush.run(box.options, { now: box.now, spawn })), /FLUSH_MODEL_OUTPUT_NOT_VALID_JSON/);
  assert.equal(fs.readFileSync(source, 'utf8'), 'Keep this checkpoint.');
  assert.equal(fs.existsSync(path.join(box.directory, '.planning/knowledge/.flush-cursor.json')), false);
  assert.equal(fs.existsSync(path.join(box.directory, '.planning/knowledge/.flush.lock')), false);
});

function bash(script, args, box, extra = {}) {
  const executable = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  return spawnSync(executable, ['--noprofile', '--norc', path.join(ROOT, script).replace(/\\/g, '/'), ...args], { cwd: box.directory, env: { ...box.env, ...extra }, encoding: 'utf8', shell: false, timeout: 10000 });
}

test('optional OS bootstrap previews selected components without changing any environment directory', (t) => {
  const box = sandbox(t);
  const target = path.join(box.directory, 'optional-tools');
  const result = bash('scripts/bootstrap-pop-os.sh', ['--node', '--native-tools'], box, { SKYOPS_BOOTSTRAP_HOME: target });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Preview only/);
  assert.equal(fs.existsSync(target), false);
});

test('project instruction generation requires explicit targets, previews and retains existing native instructions', (t) => {
  const box = sandbox(t);
  const project = path.join(box.directory, "application with 'quoted' name");
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'fixture-app', dependencies: { next: '^16.0.0', react: '^19.0.0' }, scripts: { build: 'private fixture command that must not be copied' } }));
  const options = ['--project', project, '--host', 'both'];
  const preview = bash('scripts/generate-project-claude-md.sh', options, box);
  assert.equal(preview.status, 0, preview.stderr);
  assert.ok(JSON.parse(preview.stdout).results.every((item) => item.status === 'would_create'));
  assert.equal(fs.existsSync(path.join(project, 'CLAUDE.md')), false);
  const written = bash('scripts/generate-project-claude-md.sh', [...options, '--write'], box);
  assert.equal(written.status, 0, written.stderr);
  const original = fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8');
  assert.ok(original.includes('Next.js ^16.0.0'));
  assert.ok(original.includes('npm run build'));
  assert.ok(!original.includes('private fixture command'));
  fs.appendFileSync(path.join(project, 'CLAUDE.md'), '\nUser-owned instructions.\n');
  const repeated = bash('scripts/generate-project-claude-md.sh', [...options, '--write'], box);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.ok(JSON.parse(repeated.stdout).results.every((item) => item.status === 'retained_existing'));
  assert.equal(fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8'), original + '\nUser-owned instructions.\n');
});
