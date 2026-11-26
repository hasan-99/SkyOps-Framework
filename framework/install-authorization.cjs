'use strict';

const { verifyRelease, verifyEntitlement } = require('./signed-claims.cjs');

// Caller supplies pinned bootstrap trust, never trust read from a release package.
// Supabase issues installation grants only after online owner/license/device checks.
function authorizeInstallation(checkedPackage, security) {
  if (!security?.trust || !security?.release_token || !security?.installation_token || !security?.context) throw new Error('SIGNED_INSTALLATION_AUTHORIZATION_REQUIRED');
  const context = { ...security.context, manifest_sha256: checkedPackage.manifest_sha256, version: checkedPackage.manifest.version };
  const release = verifyRelease(security.release_token, security.trust, context);
  const installation = verifyEntitlement(security.installation_token, 'installation', security.trust, context);
  if (installation.release_sequence !== release.sequence || installation.channel !== release.channel) throw new Error('INSTALLATION_CHANNEL_OR_SEQUENCE_MISMATCH');
  return { release_sequence: release.sequence, authorization_id: installation.authorization_id, user_id: installation.sub, device_id: installation.device_id, expires_at: installation.exp };
}

function authorizeRollback(checkedPackage, security) {
  if (!security?.trust || !security?.release_token || !security?.offline_token || !security?.context) throw new Error('SIGNED_ROLLBACK_AUTHORIZATION_REQUIRED');
  const context = { ...security.context, manifest_sha256: checkedPackage.manifest_sha256, version: checkedPackage.manifest.version };
  const release = verifyRelease(security.release_token, security.trust, context);
  verifyEntitlement(security.offline_token, 'offline', security.trust, context);
  return { release_sequence: release.sequence };
}

module.exports = { authorizeInstallation, authorizeRollback };
