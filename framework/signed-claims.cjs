'use strict';

const crypto = require('node:crypto');
const TYPES = Object.freeze({ release: 'skyops-release+jwt', installation: 'skyops-installation+jwt', offline: 'skyops-offline-license+jwt', status: 'skyops-license-status+jwt' });
const fail = (code) => { throw new Error(code); };
const encoded = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256;

function decode(part) {
  if (!/^[a-zA-Z0-9_-]+$/.test(part)) fail('INVALID_SIGNED_ENCODING');
  const bytes = Buffer.from(part, 'base64url');
  if (bytes.toString('base64url') !== part) fail('INVALID_SIGNED_ENCODING');
  const value = JSON.parse(bytes.toString('utf8'));
  // Reject duplicate keys, whitespace variants and ambiguous JSON encodings.
  if (!value || typeof value !== 'object' || Array.isArray(value) || encoded(value) !== part) fail('NONCANONICAL_SIGNED_CLAIMS');
  return value;
}

function signClaims(purpose, claims, kid, privateKey) {
  if (!TYPES[purpose] || !text(kid)) fail('INVALID_SIGNING_PURPOSE');
  const key = crypto.createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== 'ed25519') fail('ED25519_KEY_REQUIRED');
  const input = `${encoded({ alg: 'EdDSA', typ: TYPES[purpose], kid })}.${encoded(claims)}`;
  return `${input}.${crypto.sign(null, Buffer.from(input), key).toString('base64url')}`;
}

function verifyClaims(token, purpose, trust, now = Math.floor(Date.now() / 1000)) {
  if (!TYPES[purpose] || !integer(now) || typeof token !== 'string' || token.length > 16384) fail('INVALID_SIGNED_TOKEN');
  const parts = token.split('.');
  if (parts.length !== 3) fail('INVALID_SIGNED_TOKEN');
  const header = decode(parts[0]);
  if (Object.keys(header).sort().join(',') !== 'alg,kid,typ' || header.alg !== 'EdDSA' || header.typ !== TYPES[purpose] || !text(header.kid)) fail('INVALID_SIGNATURE_HEADER');
  const keys = trust?.keys?.filter((key) => key.kid === header.kid && key.purpose === purpose);
  if (!keys || keys.length !== 1) fail('UNTRUSTED_SIGNING_KEY');
  const key = keys[0];
  if (key.status !== 'active' || !integer(key.not_before) || !integer(key.not_after) || now < key.not_before || now >= key.not_after) fail('SIGNING_KEY_INACTIVE');
  const publicKey = crypto.createPublicKey(key.public_key_pem);
  if (publicKey.asymmetricKeyType !== 'ed25519') fail('ED25519_KEY_REQUIRED');
  const signature = Buffer.from(parts[2], 'base64url');
  if (signature.length !== 64 || signature.toString('base64url') !== parts[2] || !crypto.verify(null, Buffer.from(parts[0] + '.' + parts[1]), publicKey, signature)) fail('INVALID_SIGNATURE');
  const claims = decode(parts[1]);
  if (claims.iss !== 'skyops' || claims.aud !== `skyops:${purpose}`) fail('INVALID_SIGNED_AUDIENCE');
  if (!integer(claims.iat) || !integer(claims.exp) || claims.iat > now || claims.exp <= now || claims.exp <= claims.iat || claims.iat < key.not_before || claims.exp > key.not_after) fail('INVALID_SIGNED_TIME');
  return claims;
}

function verifyEntitlement(token, purpose, trust, context) {
  if (!['installation', 'offline'].includes(purpose)) fail('INVALID_ENTITLEMENT_PURPOSE');
  if (!integer(context?.now)) fail('TRUSTED_CLOCK_CONTEXT_REQUIRED');
  const claims = verifyClaims(token, purpose, trust, context.now);
  if (!text(context.user_id) || !/^[a-f0-9]{64}$/.test(context.device_id || '') || claims.sub !== context.user_id || claims.device_id !== context.device_id || !text(claims.license_id) || (context.license_id !== undefined && claims.license_id !== context.license_id) || !integer(claims.policy_version) || claims.policy_version < 1) fail('ENTITLEMENT_IDENTITY_MISMATCH');
  if (!integer(context.last_trusted_time) || context.last_trusted_time > context.now) fail('CLOCK_ROLLBACK_OR_TRUSTED_TIME_MISSING');
  if (purpose === 'offline') {
    if (!integer(context.max_offline_seconds) || context.max_offline_seconds <= 0 || claims.exp - claims.iat > Math.min(context.max_offline_seconds, 86400)) fail('OFFLINE_VALIDITY_EXCEEDED');
  } else {
    if (claims.exp - claims.iat > 300) fail('INSTALLATION_AUTHORIZATION_TOO_LONG');
    if (!/^[a-f0-9]{64}$/.test(context.manifest_sha256 || '') || claims.manifest_sha256 !== context.manifest_sha256 || !text(claims.authorization_id)) fail('INSTALLATION_RELEASE_MISMATCH');
  }
  return claims;
}

function verifyRelease(token, trust, context) {
  const claims = verifyClaims(token, 'release', trust, context.now);
  if (!/^[a-f0-9]{64}$/.test(context.manifest_sha256 || '') || claims.manifest_sha256 !== context.manifest_sha256 || claims.version !== context.version || !text(context.channel) || claims.channel !== context.channel || !integer(claims.sequence) || !integer(context.minimum_sequence) || claims.sequence < context.minimum_sequence) fail('RELEASE_BINDING_OR_DOWNGRADE_REJECTED');
  return claims;
}

module.exports = { signClaims, verifyClaims, verifyEntitlement, verifyRelease };
