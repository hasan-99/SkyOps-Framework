#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { validateHome } = require('../framework/package-store.cjs');
const { prepare, environment } = require('../framework/host-profiles.cjs');
const { compile } = require('../framework/compiler.cjs');
const root = path.resolve(__dirname, '..');
const executable = process.argv[2];
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skyops-claude-discovery-'));
try {
  if (!executable || !path.isAbsolute(executable)) throw new Error('ABSOLUTE_CLAUDE_EXECUTABLE_REQUIRED');
  const home = validateHome(path.join(temporary, 'installation'), true);
  const compiled = compile(root, require('../docs/audit/source-inventory.json'), ['claude']);
  const profile = prepare(home, 'claude', compiled);
  const result = spawnSync(executable, ['auth', 'status'], { env: environment(home, 'claude'), cwd: profile.user, encoding: 'utf8', shell: false, timeout: 30000, windowsHide: true });
  const expected = compiled.catalog.filter((entry) => entry.kind === 'agent').map((entry) => entry.name).sort();
  const output = result.stdout || '';
  const diagnostic = result.stderr || '';
  let status = {};
  try { status = JSON.parse(output); } catch { /* Do not echo native account details. */ }
  const isolated = typeof status.configDirectory === 'string' && path.resolve(status.configDirectory) === path.resolve(profile.native);
  const receipt = { schema_version: 1, host: 'claude', checked_at: new Date().toISOString(), platform: process.platform, exit_code: result.status, compiled_agents: expected, authenticated: status.loggedIn === true, native_config_isolated: isolated, ok: !result.error && isolated, stdout_bytes: Buffer.byteLength(output), stderr_bytes: Buffer.byteLength(diagnostic), gate_passed: false, limitation: 'Native authentication/config-directory diagnostic only, not agent or skill discovery. Agent/skill invocation, guard enforcement, model/cloud calls and other operating systems remain unverified.' };
  fs.writeFileSync(path.join(root, 'docs/audit/claude-native-profile.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
  if (!receipt.ok) console.error(diagnostic.replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]').slice(0, 400));
  if (!receipt.ok) process.exitCode = 1;
} finally {
  if (path.dirname(temporary) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('skyops-claude-discovery-')) throw new Error('UNSAFE_DISCOVERY_CLEANUP');
  // Preserve this explicit validation directory for inspection; no deletion.
}
