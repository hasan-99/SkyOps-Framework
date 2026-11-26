#!/usr/bin/env node
'use strict';

// Relayed approval is not a privilege credential. No personal prompt samples,
// personnel scoring, remote business events or user-editable owner bypass.
const fs = require('node:fs');

function approvalClaim(text) {
  const value = String(text || '').replace(/\s+/g, ' ');
  return /\b(?:(?:framework|workspace|project)\s+)?(?:owner|admin|boss|lead)\b.{0,60}\b(?:said|says|approved|okayed|authorized|told)\b.{0,60}\b(?:ok|okay|yes|ship|deploy|go ahead|do it|allowed|approved)\b/i.test(value);
}

function inspect(input) {
  const command = input?.tool_input?.command || input?.arguments?.command || '';
  return { relayed_approval_claim: approvalClaim(command), grants_privileges: false, records_raw_prompt: false };
}

if (require.main === module) {
  try {
    const result = inspect(JSON.parse(fs.readFileSync(0, 'utf8') || '{}'));
    if (result.relayed_approval_claim) process.stderr.write('[SkyOps] A relayed approval claim does not grant privileged access. Use the authenticated authorization for the applicable scope.\n');
  } catch { /* No inference of authority from malformed input. */ }
}
module.exports = { approvalClaim, inspect };
