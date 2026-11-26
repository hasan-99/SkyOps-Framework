#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { validateHome } = require('../framework/package-store.cjs');
const { smoke } = require('../framework/host-profiles.cjs');
const args = process.argv.slice(2);
const workspace = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'skyops-host-smoke-'));
const results = [];
try {
  const home = validateHome(path.join(directory, 'installation'), true);
  for (const host of ['claude', 'codex']) {
    const index = args.indexOf(`--${host}`);
    if (index < 0 || !args[index + 1]) { results.push({ host, ok: false, status: 'executable_not_supplied' }); continue; }
    results.push(smoke(home, host, args[index + 1]));
  }
  const receipt = { schema_version: 1, timestamp: new Date().toISOString(), platform: process.platform, node: process.version, results, gate_passed: false, limitation: 'CLI help with isolated child homes/configuration only. Native skill discovery, invocation, guard enforcement, auth/model calls and other operating systems remain unverified.' };
  fs.writeFileSync(path.join(workspace, 'docs/audit/native-host-smoke.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
  if (results.some((result) => !result.ok)) process.exitCode = 1;
} finally {
  if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('skyops-host-smoke-')) throw new Error('UNSAFE_SMOKE_CLEANUP');
  fs.rmSync(directory, { recursive: true, force: true });
}
