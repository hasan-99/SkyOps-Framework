'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT, sandbox } = require('../helpers/sandbox.cjs');

test('local OWNER claims cannot disable mandatory quality gates', (t) => {
  const box = sandbox(t);
  fs.writeFileSync(path.join(box.home, '.skyops-config.json'), '{"role":"OWNER"}');
  for (const name of ['SKYOPS_SKIP_LINT', 'SKYOPS_SKIP_SLOP', 'SKYOPS_SHIP_FORCE']) {
    const result = box.run('hooks/pre-deploy-gate.js', [], { [name]: '1' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /cannot be skipped|cannot be bypassed/);
  }
});

test('delivery hook ignores unrelated read commands without running project checks', (t) => {
  const box = sandbox(t);
  fs.writeFileSync(path.join(box.directory, 'package.json'), JSON.stringify({ scripts: { build: 'exit 1' } }));
  const result = spawnSync(process.execPath, [path.join(ROOT, 'hooks/pre-deploy-gate.js')], {
    cwd: box.directory, env: { ...box.env, SKYOPS_SKIP_LINT: '1' }, encoding: 'utf8', shell: false,
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'node --version' } }), timeout: 5000,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('destructive database operations cannot be authorized by an environment bypass', (t) => {
  const box = sandbox(t);
  const run = (command) => spawnSync(process.execPath, [path.join(ROOT, 'hooks/supabase-destructive-guard.js')], { cwd: box.directory, env: { ...box.env, SKYOPS_ALLOW_DESTRUCTIVE: '1', SUPABASE_DB_URL: '' }, encoding: 'utf8', shell: false, input: JSON.stringify({ tool_input: { command } }), timeout: 5000 });
  for (const command of ['supabase db reset --linked', 'supabase db reset --local --linked', 'supabase db reset --local; supabase db reset --linked', 'supabase migration repair 20260101 --status applied', 'supabase db push --force']) {
    assert.equal(run(command).status, 2);
  }
  assert.equal(run('supabase db reset --local').status, 0);
  assert.equal(run('supabase db diff').status, 0);
});

test('environment variables cannot bypass irreversible Git deletion guards', (t) => {
  const box = sandbox(t);
  for (const command of ['git clean -fd', 'git branch -D main', 'git push --force origin main']) {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'hooks/git-guardrails.js')], { cwd: box.directory, env: { ...box.env, SKYOPS_ALLOW_DESTRUCTIVE: '1' }, encoding: 'utf8', shell: false, input: JSON.stringify({ tool_input: { command } }), timeout: 5000 });
    assert.equal(result.status, 2);
  }
});
