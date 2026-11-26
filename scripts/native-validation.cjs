#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { validateHome } = require('../framework/package-store.cjs');
const { prepare, refresh, environment, profilePaths } = require('../framework/host-profiles.cjs');
const { compile } = require('../framework/compiler.cjs');
const root = path.resolve(__dirname, '..');
const [action, host, executable] = process.argv.slice(2);
const requestedHome = process.env.SKYOPS_VALIDATION_HOME || path.join(os.homedir(), '.skyops-framework-validation');

function run() {
  if (!['prepare', 'refresh', 'login', 'status'].includes(action) || !['claude', 'codex'].includes(host)) throw new Error('USAGE: native-validation.cjs prepare|refresh|login|status claude|codex [absolute-host-executable]');
  const home = validateHome(requestedHome, action === 'prepare');
  if (action === 'prepare' || action === 'refresh') {
    const inventory = require('../docs/audit/source-inventory.json');
    const core = require('../framework/validation-core.cjs').copyValidationCore(root, home, inventory);
    const compiled = compile(root, inventory, [host], {}, { renderHome: home });
    if (action === 'refresh') return { core, profile: refresh(home, host, compiled), purpose: 'Owner development acceptance only; not production activation' };
    const profile = prepare(home, host, compiled);
    return { purpose: 'Isolated owner development validation only; not a licensed production installation', host, profile: profile.directory, compiled: compiled.summaries, authenticated: false, next: 'Run the login command locally. Do not share credentials or tokens.' };
  }
  if (!executable || !path.isAbsolute(executable) || !fs.statSync(executable).isFile()) throw new Error('ABSOLUTE_NATIVE_HOST_EXECUTABLE_REQUIRED');
  const profile = profilePaths(home, host);
  if (!fs.existsSync(path.join(profile.directory, 'profile-manifest.json'))) throw new Error('PREPARE_PROFILE_FIRST');
  const args = host === 'claude' ? ['auth', action === 'login' ? 'login' : 'status'] : ['login', ...(action === 'status' ? ['status'] : [])];
  let command = executable;
  let argv = args;
  if (process.platform === 'win32' && path.extname(executable).toLowerCase() === '.ps1') {
    command = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
    argv = ['-NoProfile', '-File', executable, ...args];
  }
  const result = spawnSync(command, argv, { cwd: profile.user, env: environment(home, host), shell: false, stdio: action === 'login' ? 'inherit' : 'pipe', encoding: 'utf8', windowsHide: false });
  if (result.error) throw result.error;
  // Never echo account identifiers, credentials or native authentication output.
  return { host, authenticated: result.status === 0, exit_code: result.status, isolated_profile: profile.directory, purpose: 'Owner development validation; production framework activation remains gated' };
}

try {
  const result = run();
  if (action === 'status') fs.writeFileSync(path.join(root, `docs/audit/native-auth-${host}.json`), JSON.stringify({ schema_version: 1, checked_at: new Date().toISOString(), ...result }, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
catch (error) { console.error(JSON.stringify({ error: error.code || error.message })); process.exitCode = 1; }
