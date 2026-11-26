'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sandbox, ROOT } = require('../helpers/sandbox.cjs');
const { signingFixture } = require('../helpers/signing-fixture.cjs');
const { check } = require('../../hooks/auto-update.js');

function capture(box, prompt) {
  return spawnSync(process.execPath, [path.join(ROOT, 'hooks/usage-capture.js')], { cwd: box.directory, env: box.env, input: JSON.stringify({ cwd: box.directory, prompt }), encoding: 'utf8', shell: false, timeout: 5000 });
}

test('raw prompt capture defaults off while structured command metrics remain available', (t) => {
  const box = sandbox(t);
  fs.mkdirSync(path.join(box.directory, '.planning'));
  assert.equal(capture(box, '/sky-build private text that must not be retained').status, 0);
  const usage = JSON.parse(fs.readFileSync(path.join(box.directory, '.planning/.session-usage.json'), 'utf8'));
  assert.equal(usage.command_usage['sky-build'], 1);
  assert.deepEqual(usage.prompt_samples, []);
});

test('raw prompts require explicit opt-in in the isolated configuration', (t) => {
  const box = sandbox(t);
  fs.mkdirSync(path.join(box.directory, '.planning'));
  fs.writeFileSync(path.join(box.home, '.skyops-config.json'), JSON.stringify({ privacy: { captureRawPrompts: true } }));
  assert.equal(capture(box, '/sky-plan opted-in fixture').status, 0);
  const usage = JSON.parse(fs.readFileSync(path.join(box.directory, '.planning/.session-usage.json'), 'utf8'));
  assert.deepEqual(usage.prompt_samples, ['/sky-plan opted-in fixture']);
});

test('development metrics and prompt capture can both be disabled', (t) => {
  const box = sandbox(t);
  fs.mkdirSync(path.join(box.directory, '.planning'));
  fs.writeFileSync(path.join(box.home, '.skyops-config.json'), JSON.stringify({ privacy: { developmentMetrics: false, captureRawPrompts: false } }));
  assert.equal(capture(box, '/sky-build').status, 0);
  assert.equal(fs.existsSync(path.join(box.directory, '.planning/.session-usage.json')), false);
});

test('update notices require a fresh signed release and never query a public registry', (t) => {
  const box = sandbox(t);
  const fixture = signingFixture('a'.repeat(64));
  assert.equal(check(box.home, fixture.trust, fixture.context.now).status, 'not_checked');
  fs.writeFileSync(path.join(box.home, 'active.json'), JSON.stringify({ schema_version: 1, active: { release_sequence: 99 } }));
  const cache = { checked_at: fixture.context.now, manifest_sha256: 'a'.repeat(64), version: '1.0.0', channel: 'private', release_token: fixture.security.release_token };
  fs.writeFileSync(path.join(box.home, '.skyops-release-catalog.json'), JSON.stringify(cache));
  assert.equal(check(box.home, fixture.trust, fixture.context.now).status, 'update_available');
  assert.throws(() => check(box.home, { keys: [] }, fixture.context.now), /UNTRUSTED_SIGNING_KEY/);
  assert.throws(() => check(box.home, fixture.trust, fixture.context.now + 86400), /STALE_OR_INCOMPLETE_RELEASE_CATALOG/);
  const code = fs.readFileSync(path.join(ROOT, 'hooks/auto-update.js'), 'utf8');
  assert.ok(!/spawnSync|execSync|npm view|npx/.test(code));
});
