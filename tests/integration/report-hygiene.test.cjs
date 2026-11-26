'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { sandbox } = require('../helpers/sandbox.cjs');
const hygiene = require('../../bin/branch-hygiene.js');

test('unborn local Git project reports unavailable PR evidence instead of remote cleanliness', (t) => {
  const box = sandbox(t);
  assert.equal(spawnSync('git', ['init', '--initial-branch=main'], { cwd: box.directory, env: box.env, encoding: 'utf8', shell: false }).status, 0);
  const result = hygiene.analyze(box.directory);
  assert.equal(result.ok, null);
  assert.equal(result.complete, false);
  assert.equal(result.remote_pr_status, 'unavailable');
  assert.equal(result.remote_pr_reason, 'github_remote_not_configured');
  assert.deepEqual(result.open_prs, []);
});

test('an explicit offline check never attempts remote discovery even with a configured repository', (t) => {
  const box = sandbox(t);
  assert.equal(spawnSync('git', ['init', '--initial-branch=main'], { cwd: box.directory, env: box.env, encoding: 'utf8', shell: false }).status, 0);
  assert.equal(spawnSync('git', ['remote', 'add', 'origin', 'https://github.com/fixture/project.git'], { cwd: box.directory, env: box.env, encoding: 'utf8', shell: false }).status, 0);
  const result = hygiene.analyze(box.directory, { offline: true });
  assert.equal(result.ok, null);
  assert.equal(result.remote_pr_reason, 'offline_requested');
  assert.equal(result.complete, false);
});
