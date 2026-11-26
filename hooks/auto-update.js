#!/usr/bin/env node
'use strict';

// Tool hooks only surface previously authenticated private release metadata.
// Fetch/download belongs to the licensed CLI; never install in a live session.
const fs = require('node:fs');
const path = require('node:path');
const { verifyRelease } = require('../framework/signed-claims.cjs');

function check(home, trust, now = Math.floor(Date.now() / 1000)) {
  const file = path.join(home, '.skyops-release-catalog.json');
  if (!fs.existsSync(file)) return { status: 'not_checked', reason: 'No authenticated release catalog cached' };
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('LINKED_RELEASE_CACHE_REFUSED');
  const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
  const active = JSON.parse(fs.readFileSync(path.join(home, 'active.json'), 'utf8'));
  if (!Number.isSafeInteger(cached.checked_at) || cached.checked_at > now || now - cached.checked_at >= 86400 || !Number.isSafeInteger(active.active?.release_sequence)) throw new Error('STALE_OR_INCOMPLETE_RELEASE_CATALOG');
  const claims = verifyRelease(cached.release_token, trust, { now, manifest_sha256: cached.manifest_sha256, version: cached.version, channel: cached.channel, minimum_sequence: active.active.release_sequence });
  return { status: claims.sequence > active.active.release_sequence ? 'update_available' : 'no_newer_signed_release', version: claims.version, sequence: claims.sequence };
}

if (require.main === module) {
  try {
    const home = require('../framework/paths.cjs').frameworkHome();
    const result = check(home, require('../framework/trust-roots.json'));
    if (result.status === 'update_available') fs.writeFileSync(path.join(home, '.skyops-update-available.json'), JSON.stringify({ latest: result.version, release_sequence: result.sequence, detected_at: new Date().toISOString(), signature_verified: true }), { mode: 0o600 });
  } catch { /* Missing/untrusted/unavailable updates cannot disrupt work. */ }
}

module.exports = { check };
