'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { signingFixture } = require('../helpers/signing-fixture.cjs');
const { sandbox } = require('../helpers/sandbox.cjs');
const { verifyClaims, verifyEntitlement, verifyRelease } = require('../../framework/signed-claims.cjs');
const { authorizeInstallation, authorizeRollback } = require('../../framework/install-authorization.cjs');
const store = require('../../framework/package-store.cjs');
const policy = require('../../framework/license-policy.json');
const hash = 'a'.repeat(64);
const checked = { manifest_sha256: hash, manifest: { version: '1.0.0' } };

test('owner-confirmed limits are two devices and at most 24 offline hours', () => {
  assert.equal(policy.default_device_limit, 2);
  assert.equal(policy.default_offline_validity_seconds, 86400);
  assert.equal(policy.maximum_offline_validity_seconds, 86400);
  assert.equal(policy.installation_approval, 'framework_owner_required');
  assert.equal(policy.access, 'invitation_only');
  assert.equal(policy.production_trust_status, 'not_configured');
});

test('properly signed release and user/device-bound installation claims verify', () => {
  const fixture = signingFixture(hash);
  const result = authorizeInstallation(checked, fixture.security);
  assert.equal(result.user_id, fixture.context.user_id);
  assert.equal(result.release_sequence, 100);
});

test('hash integrity alone cannot authorize installation and creates no installation root', (t) => {
  const box = sandbox(t);
  const source = path.join(box.directory, 'payload');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'content.txt'), 'verified fixture');
  const manifest = JSON.stringify({ schema_version: 1, framework: 'skyops', version: '1.0.0', release_gate: 'passed', files: { 'content.txt': store.digest('verified fixture') } });
  fs.writeFileSync(path.join(source, 'skyops-release.json'), manifest);
  const home = path.join(box.directory, 'new-install');
  assert.throws(() => store.install(source, store.digest(manifest), home), /SIGNED_INSTALLATION_AUTHORIZATION_REQUIRED/);
  assert.equal(fs.existsSync(home), false);
});

test('an offline runtime lease cannot be used as an installation authorization', () => {
  const fixture = signingFixture(hash);
  assert.throws(() => authorizeInstallation(checked, { ...fixture.security, installation_token: fixture.security.offline_token }), /INVALID_SIGNATURE_HEADER/);
});

test('signature alteration, unsigned algorithm and unknown key are rejected', () => {
  const fixture = signingFixture(hash);
  const [header, payload, signature] = fixture.security.release_token.split('.');
  const changed = Buffer.from(JSON.stringify({ ...fixture.release, iss: 'skyops', aud: 'skyops:release', iat: fixture.context.now, exp: fixture.context.now + 120, version: '9.9.9' })).toString('base64url');
  assert.throws(() => verifyClaims(`${header}.${changed}.${signature}`, 'release', fixture.trust, fixture.context.now), /INVALID_SIGNATURE/);
  const unsigned = Buffer.from(JSON.stringify({ alg: 'none', typ: 'skyops-release+jwt', kid: 'fixture-release' })).toString('base64url');
  assert.throws(() => verifyClaims(`${unsigned}.${payload}.${signature}`, 'release', fixture.trust, fixture.context.now), /INVALID_SIGNATURE_HEADER/);
  assert.throws(() => verifyClaims(fixture.security.release_token, 'release', { keys: [] }, fixture.context.now), /UNTRUSTED_SIGNING_KEY/);
});

test('wrong audience and revoked/expired or purpose-confused signing keys fail closed', () => {
  const fixture = signingFixture(hash);
  const wrong = fixture.token('release', { ...fixture.release, aud: 'some-other-product' });
  assert.throws(() => verifyClaims(wrong, 'release', fixture.trust, fixture.context.now), /INVALID_SIGNED_AUDIENCE/);
  const revoked = structuredClone(fixture.trust);
  revoked.keys[0].status = 'revoked';
  assert.throws(() => verifyClaims(fixture.security.release_token, 'release', revoked, fixture.context.now), /SIGNING_KEY_INACTIVE/);
  const expired = structuredClone(fixture.trust);
  expired.keys[0].not_after = fixture.context.now;
  assert.throws(() => verifyClaims(fixture.security.release_token, 'release', expired, fixture.context.now), /SIGNING_KEY_INACTIVE/);
  assert.throws(() => verifyClaims(fixture.security.release_token, 'installation', fixture.trust, fixture.context.now), /INVALID_SIGNATURE_HEADER/);
});

test('leases reject another user, device, absent clock context and ordinary clock rollback', () => {
  const fixture = signingFixture(hash);
  for (const context of [
    { ...fixture.context, user_id: 'another-user' },
    { ...fixture.context, device_id: '2'.repeat(64) },
  ]) assert.throws(() => verifyEntitlement(fixture.security.offline_token, 'offline', fixture.trust, context), /ENTITLEMENT_IDENTITY_MISMATCH/);
  assert.throws(() => verifyEntitlement(fixture.security.offline_token, 'offline', fixture.trust, { ...fixture.context, now: undefined }), /TRUSTED_CLOCK_CONTEXT_REQUIRED/);
  assert.throws(() => verifyEntitlement(fixture.security.offline_token, 'offline', fixture.trust, { ...fixture.context, last_trusted_time: fixture.context.now + 1 }), /CLOCK_ROLLBACK/);
});

test('offline validity passes just before 24 hours and fails at the exact expiry', () => {
  const fixture = signingFixture(hash);
  verifyEntitlement(fixture.security.offline_token, 'offline', fixture.trust, { ...fixture.context, now: fixture.context.now + 86399 });
  assert.throws(() => verifyEntitlement(fixture.security.offline_token, 'offline', fixture.trust, { ...fixture.context, now: fixture.context.now + 86400 }), /INVALID_SIGNED_TIME/);
  const tooLong = fixture.token('offline', { ...fixture.identity, exp: fixture.context.now + 86401 });
  assert.throws(() => verifyEntitlement(tooLong, 'offline', fixture.trust, fixture.context), /OFFLINE_VALIDITY_EXCEEDED/);
  assert.throws(() => verifyEntitlement(tooLong, 'offline', fixture.trust, { ...fixture.context, max_offline_seconds: 604800 }), /OFFLINE_VALIDITY_EXCEEDED/);
});

test('installation grants reject the wrong release, stale grant, sequence and channel', () => {
  const fixture = signingFixture(hash);
  assert.throws(() => authorizeInstallation({ ...checked, manifest_sha256: 'b'.repeat(64) }, fixture.security), /RELEASE_BINDING_OR_DOWNGRADE_REJECTED/);
  assert.throws(() => authorizeInstallation(checked, { ...fixture.security, context: { ...fixture.context, now: fixture.context.now + 120 } }), /INVALID_SIGNED_TIME/);
  const identity = { ...fixture.identity, manifest_sha256: hash, authorization_id: 'grant', release_sequence: 99, channel: 'private' };
  assert.throws(() => authorizeInstallation(checked, { ...fixture.security, installation_token: fixture.token('installation', identity) }), /INSTALLATION_CHANNEL_OR_SEQUENCE_MISMATCH/);
  assert.throws(() => authorizeInstallation(checked, { ...fixture.security, installation_token: fixture.token('installation', { ...identity, release_sequence: 100, channel: 'other' }) }), /INSTALLATION_CHANNEL_OR_SEQUENCE_MISMATCH/);
  assert.throws(() => authorizeInstallation(checked, { ...fixture.security, installation_token: fixture.token('installation', { ...identity, exp: fixture.context.now + 301 }) }), /INSTALLATION_AUTHORIZATION_TOO_LONG/);
});

test('release floor blocks unauthorized downgrades while valid offline rollback remains available', () => {
  const fixture = signingFixture(hash);
  assert.throws(() => verifyRelease(fixture.security.release_token, fixture.trust, { ...fixture.context, minimum_sequence: 101 }), /RELEASE_BINDING_OR_DOWNGRADE_REJECTED/);
  assert.equal(authorizeRollback(checked, fixture.security).release_sequence, 100);
  assert.throws(() => authorizeRollback(checked, { ...fixture.security, offline_token: undefined }), /SIGNED_ROLLBACK_AUTHORIZATION_REQUIRED/);
});
