'use strict';

const crypto = require('node:crypto');
const { signClaims } = require('../../framework/signed-claims.cjs');

// Ephemeral test-only keys. Never written to source, bootstrap trust or profiles.
function signingFixture(hash, version = '1.0.0') {
  const now = 1795680000;
  const trust = { keys: [] };
  const signers = {};
  for (const purpose of ['release', 'installation', 'offline', 'status']) {
    const pair = crypto.generateKeyPairSync('ed25519');
    signers[purpose] = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    trust.keys.push({ kid: `fixture-${purpose}`, purpose, status: 'active', not_before: now - 100, not_after: now + 31536000, public_key_pem: pair.publicKey.export({ type: 'spki', format: 'pem' }) });
  }
  const context = { now, last_trusted_time: now, user_id: 'fixture-user', license_id: 'fixture-license', device_id: '1'.repeat(64), channel: 'private', minimum_sequence: 0, max_offline_seconds: 86400, manifest_sha256: hash, version };
  const sequence = 100;
  function token(purpose, overrides = {}) {
    const claims = { iss: 'skyops', aud: `skyops:${purpose}`, iat: now, exp: now + (purpose === 'offline' ? 86400 : 120), ...overrides };
    return signClaims(purpose, claims, `fixture-${purpose}`, signers[purpose]);
  }
  const release = { manifest_sha256: hash, version, sequence, channel: 'private', exp: now + 86400 };
  const identity = { sub: context.user_id, device_id: context.device_id, license_id: 'fixture-license', policy_version: 1 };
  const security = {
    trust, context,
    release_token: token('release', release),
    installation_token: token('installation', { ...identity, manifest_sha256: hash, release_sequence: sequence, channel: 'private', authorization_id: 'fixture-grant' }),
    offline_token: token('offline', identity),
  };
  return { trust, context, token, release, identity, security };
}

module.exports = { signingFixture };
