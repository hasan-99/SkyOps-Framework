'use strict';

const crypto = require('node:crypto');
const { verifyClaims, verifyEntitlement } = require('./signed-claims.cjs');
const policy = require('./license-policy.json');

function challenge() { return crypto.randomBytes(32).toString('hex'); }

function verifyStatus(token, trust, context, requestChallenge) {
  if (!Number.isSafeInteger(context?.now) || !Number.isSafeInteger(context.last_trusted_time) || context.now < context.last_trusted_time) throw new Error('INVALID_STATUS_CLOCK');
  const claims = verifyClaims(token, 'status', trust, context.now);
  if (!/^[a-f0-9]{64}$/.test(requestChallenge || '') || !/^[a-f0-9]{64}$/.test(context.device_id || '') || typeof context.user_id !== 'string' || !context.user_id || claims.challenge !== requestChallenge || claims.sub !== context.user_id || claims.device_id !== context.device_id || claims.license_id !== context.license_id || !context.license_id || !policy.license_states.includes(claims.state) || claims.exp - claims.iat > 300) throw new Error('STATUS_IDENTITY_OR_FRESHNESS_MISMATCH');
  if (claims.state === 'revoked' && claims.permanent !== true) throw new Error('PERMANENT_REVOCATION_NOT_CONFIRMED');
  return claims;
}

// Pure policy evaluator: no network, deletion, shell or remote commands.
// The host controller must attempt validation at every online startup and on
// the returned schedule; Phase 4 supplies the authenticated Supabase transport.
function evaluateLicense({ trust, context, offline_token, status_token, request_challenge, last_confirmed_state = null }) {
  let status = null;
  try { if (status_token) status = verifyStatus(status_token, trust, context, request_challenge); }
  catch { /* Uncertain/invalid response must never be interpreted as revocation. */ }
  const known = last_confirmed_state === 'revoked' ? 'revoked' : status?.state || last_confirmed_state;
  const recovery = { export_available: true, recovery_available: true, uninstall_available: true };
  if (known === 'revoked') return { ...recovery, execution_allowed: false, state: 'revoked', deprovisioning: status?.state === 'revoked' ? 'verify_installation_consent' : 'none', online_validation_required: true };
  if (['suspended', 'expired'].includes(known)) return { ...recovery, execution_allowed: false, state: known, deprovisioning: 'none', online_validation_required: true };
  try {
    const lease = verifyEntitlement(offline_token, 'offline', trust, context);
    return { ...recovery, execution_allowed: true, state: 'active', deprovisioning: 'none', online_validation_required: !status, next_validation_at: Math.min(lease.exp, context.now + policy.active_session_revalidation_seconds), renew_automatically: true, validation_confirmed_online: status?.state === 'active' };
  } catch {
    return { ...recovery, execution_allowed: false, state: 'unknown_or_lease_expired', deprovisioning: 'none', online_validation_required: true };
  }
}

module.exports = { challenge, verifyStatus, evaluateLicense };
