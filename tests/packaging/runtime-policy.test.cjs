'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { signingFixture } = require('../helpers/signing-fixture.cjs');
const { sandbox } = require('../helpers/sandbox.cjs');
const { challenge, verifyStatus, evaluateLicense } = require('../../framework/license-runtime.cjs');
const store = require('../../framework/package-store.cjs');

function runtime() {
  const fixture = signingFixture('a'.repeat(64));
  const nonce = challenge();
  const status = (state, extra = {}) => fixture.token('status', { ...fixture.identity, state, challenge: nonce, ...extra });
  const input = { trust: fixture.trust, context: fixture.context, request_challenge: nonce, offline_token: fixture.security.offline_token };
  return { ...fixture, nonce, status, input };
}

function installed(t, consent) {
  const box = sandbox(t);
  const directory = path.join(box.directory, 'package');
  const home = path.join(box.directory, 'owned-installation');
  fs.mkdirSync(directory);
  const body = 'module.exports = "owned fixture";\n';
  fs.writeFileSync(path.join(directory, 'owned.cjs'), body);
  const manifest = JSON.stringify({ schema_version: 1, framework: 'skyops', version: '1.0.0', release_gate: 'passed', files: { 'owned.cjs': store.digest(body) } });
  fs.writeFileSync(path.join(directory, 'skyops-release.json'), manifest);
  const fixture = signingFixture(store.digest(manifest));
  if (consent) fixture.security.deprovisioning_consent = { accepted: true, policy_version: 1 };
  store.install(directory, store.digest(manifest), home, fixture.security);
  const nonce = challenge();
  const status = (state, extra = {}) => fixture.token('status', { ...fixture.identity, state, challenge: nonce, ...extra });
  return { ...box, ...fixture, home, nonce, status };
}

test('active online verification schedules automatic revalidation within five minutes', () => {
  const fixture = runtime();
  const result = evaluateLicense({ ...fixture.input, status_token: fixture.status('active') });
  assert.equal(result.execution_allowed, true);
  assert.equal(result.validation_confirmed_online, true);
  assert.equal(result.next_validation_at, fixture.context.now + 300);
  assert.equal(result.renew_automatically, true);
});

test('connectivity, authentication or service uncertainty never triggers removal', () => {
  const fixture = runtime();
  for (const token of [undefined, '', 'network-error', 'auth-error', 'service-outage']) {
    const result = evaluateLicense({ ...fixture.input, status_token: token });
    assert.equal(result.execution_allowed, true);
    assert.equal(result.online_validation_required, true);
    assert.equal(result.deprovisioning, 'none');
  }
  const expired = evaluateLicense({ ...fixture.input, context: { ...fixture.context, now: fixture.context.now + 86400 } });
  assert.equal(expired.execution_allowed, false);
  assert.equal(expired.deprovisioning, 'none');
  assert.equal(expired.export_available, true);
  assert.equal(expired.uninstall_available, true);
});

test('suspension and expiry disable execution but do not request uninstallation', () => {
  const fixture = runtime();
  for (const state of ['suspended', 'expired']) {
    const result = evaluateLicense({ ...fixture.input, status_token: fixture.status(state) });
    assert.equal(result.state, state);
    assert.equal(result.execution_allowed, false);
    assert.equal(result.deprovisioning, 'none');
    assert.equal(result.recovery_available, true);
  }
});

test('a previously confirmed suspension cannot be bypassed with a cached active lease', () => {
  const fixture = runtime();
  assert.equal(evaluateLicense({ ...fixture.input, last_confirmed_state: 'suspended' }).execution_allowed, false);
  assert.equal(evaluateLicense({ ...fixture.input, last_confirmed_state: 'suspended', status_token: fixture.status('active') }).execution_allowed, true);
});

test('permanent revocation remains terminal for the same license and cannot be inferred from uncertainty', () => {
  const fixture = runtime();
  const confirmed = evaluateLicense({ ...fixture.input, status_token: fixture.status('revoked', { permanent: true }) });
  assert.equal(confirmed.execution_allowed, false);
  assert.equal(confirmed.deprovisioning, 'verify_installation_consent');
  const replay = evaluateLicense({ ...fixture.input, last_confirmed_state: 'revoked', status_token: fixture.status('active') });
  assert.equal(replay.execution_allowed, false);
  assert.equal(replay.deprovisioning, 'none');
  assert.throws(() => verifyStatus(fixture.status('revoked'), fixture.trust, fixture.context, fixture.nonce), /PERMANENT_REVOCATION_NOT_CONFIRMED/);
});

test('status confirmation rejects another challenge, license, device and expired response', () => {
  const fixture = runtime();
  assert.throws(() => verifyStatus(fixture.status('revoked', { permanent: true }), fixture.trust, fixture.context, challenge()), /STATUS_IDENTITY_OR_FRESHNESS_MISMATCH/);
  for (const change of [{ license_id: 'another-license' }, { device_id: '2'.repeat(64) }, { sub: 'another-user' }]) assert.throws(() => verifyStatus(fixture.status('revoked', { permanent: true, ...change }), fixture.trust, fixture.context, fixture.nonce), /STATUS_IDENTITY_OR_FRESHNESS_MISMATCH/);
  assert.throws(() => verifyStatus(fixture.status('revoked', { permanent: true }), fixture.trust, { ...fixture.context, now: fixture.context.now + 120 }, fixture.nonce), /INVALID_SIGNED_TIME/);
});

test('revocation without recorded installation consent disables execution without uninstalling', (t) => {
  const fixture = installed(t, false);
  const result = store.deprovision(fixture.home, fixture.status('revoked', { permanent: true }), fixture.trust, fixture.context, fixture.nonce);
  assert.equal(result.execution_disabled, true);
  assert.equal(result.uninstalled, false);
  assert.equal(result.reason, 'INSTALLATION_CONSENT_REQUIRED');
  assert.equal(fs.existsSync(path.join(fixture.home, 'releases/1.0.0/owned.cjs')), true);
});

test('consented revocation uses the official uninstaller and preserves user files and projects', (t) => {
  const fixture = installed(t, true);
  fs.mkdirSync(path.join(fixture.home, 'user-data'));
  fs.writeFileSync(path.join(fixture.home, 'user-data/memory.json'), '{"private":true}');
  const release = path.join(fixture.home, 'releases/1.0.0');
  fs.mkdirSync(path.join(release, 'user-project'));
  fs.mkdirSync(path.join(release, 'user-empty-folder'));
  fs.writeFileSync(path.join(release, 'user-project/source.js'), 'user source code');
  const outsideProject = path.join(fixture.directory, 'application');
  fs.mkdirSync(outsideProject);
  fs.writeFileSync(path.join(outsideProject, 'app.js'), 'application source');
  const result = store.deprovision(fixture.home, fixture.status('revoked', { permanent: true }), fixture.trust, fixture.context, fixture.nonce);
  assert.equal(result.uninstalled, true);
  assert.equal(result.execution_disabled, true);
  assert.equal(fs.existsSync(path.join(release, 'owned.cjs')), false);
  assert.equal(fs.readFileSync(path.join(release, 'user-project/source.js'), 'utf8'), 'user source code');
  assert.equal(fs.existsSync(path.join(release, 'user-empty-folder')), true);
  assert.equal(fs.readFileSync(path.join(outsideProject, 'app.js'), 'utf8'), 'application source');
  assert.equal(fs.readFileSync(path.join(fixture.home, 'user-data/memory.json'), 'utf8'), '{"private":true}');
});

test('modified framework files are preserved and reported during manual uninstallation', (t) => {
  const fixture = installed(t, true);
  const file = path.join(fixture.home, 'releases/1.0.0/owned.cjs');
  fs.writeFileSync(file, 'user modified source');
  const result = store.uninstall(fixture.home);
  assert.equal(fs.readFileSync(file, 'utf8'), 'user modified source');
  assert.ok(result.retained_modified_files.some((name) => name.endsWith('owned.cjs')));
});

test('modified unrecognized activation metadata is preserved rather than deleted', (t) => {
  const fixture = installed(t, false);
  const file = path.join(fixture.home, 'active.json');
  fs.writeFileSync(file, '{"user_data":"preserve"}');
  const result = store.uninstall(fixture.home);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"user_data":"preserve"}');
  assert.ok(result.retained_modified_files.includes('active.json'));
});

test('outages, temporary states and invalid consent cannot initiate uninstall', (t) => {
  const fixture = installed(t, true);
  for (const state of ['active', 'suspended', 'expired']) assert.equal(store.deprovision(fixture.home, fixture.status(state), fixture.trust, fixture.context, fixture.nonce).uninstalled, false);
  assert.throws(() => store.deprovision(fixture.home, 'service-outage', fixture.trust, fixture.context, fixture.nonce), /INVALID_SIGNED_TOKEN/);
  const consent = path.join(fixture.home, store.CONSENT_FILE);
  const record = JSON.parse(fs.readFileSync(consent, 'utf8'));
  record.user_id = 'another-user';
  fs.writeFileSync(consent, JSON.stringify(record));
  assert.equal(store.deprovision(fixture.home, fixture.status('revoked', { permanent: true }), fixture.trust, fixture.context, fixture.nonce).uninstalled, false);
  assert.equal(fs.existsSync(path.join(fixture.home, 'releases/1.0.0/owned.cjs')), true);
});

test('unsafe cleanup is refused without re-enabling execution or touching unrelated files', (t) => {
  const fixture = installed(t, true);
  const outside = path.join(fixture.directory, 'unrelated');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'unrelated');
  fs.symlinkSync(outside, path.join(fixture.home, 'releases/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = store.deprovision(fixture.home, fixture.status('revoked', { permanent: true }), fixture.trust, fixture.context, fixture.nonce);
  assert.equal(result.execution_disabled, true);
  assert.equal(result.uninstalled, false);
  assert.equal(result.reason, 'SAFE_UNINSTALL_REFUSED');
  assert.equal(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'unrelated');
  assert.equal(fs.existsSync(path.join(fixture.home, 'releases/1.0.0/owned.cjs')), true);
});
