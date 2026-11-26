#!/usr/bin/env node
'use strict';

// Preserve protected-branch awareness without personnel tallies or remote
// reporting. This hook is informational; repository protections authorize push.
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

function refspecTargetsProtected(command) {
  if (typeof command !== 'string' || !/\bgit\s+push\b/.test(command)) return null;
  const tokens = command.split(/\s+/).filter(Boolean);
  const index = tokens.indexOf('push');
  for (let position = index + 1; position < tokens.length; position++) {
    let token = tokens[position].replace(/^['"]|['"]$/g, '').replace(/^\+/, '');
    if (token.startsWith('-')) continue;
    if (token.includes(':')) token = token.slice(token.lastIndexOf(':') + 1);
    token = token.replace(/^refs\/heads\//, '');
    if (token === 'main' || token === 'master') return token;
  }
  return null;
}

function inspect(command, currentBranch) {
  if (!/\bgit\s+push\b/.test(command || '')) return { protected_branch: null, informational_only: true };
  const target = refspecTargetsProtected(command) || (['main', 'master'].includes(currentBranch) ? currentBranch : null);
  return { protected_branch: target, informational_only: true, ...(target ? { notice: 'Use the approved ship/integration workflow and respect repository protections; this notice grants no bypass.' } : {}) };
}

if (require.main === module) {
  try {
    const payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
    const command = payload.tool_input?.command || payload.arguments?.command || '';
    if (/\bgit\s+push\b/.test(command)) {
      const git = spawnSync('git', ['branch', '--show-current'], { encoding: 'utf8', timeout: 3000, shell: false });
      const result = inspect(command, (git.stdout || '').trim());
      if (result.notice) process.stderr.write(`[SkyOps] ${result.notice}\n`);
    }
  } catch { /* Informational hook never blocks or changes repository policy. */ }
}
module.exports = { refspecTargetsProtected, inspect };
