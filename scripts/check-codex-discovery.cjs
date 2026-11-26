#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { validateHome } = require('../framework/package-store.cjs');
const { environment, prepare, profilePaths } = require('../framework/host-profiles.cjs');
const { compile } = require('../framework/compiler.cjs');
const root = path.resolve(__dirname, '..');
const executable = process.argv[2];
const retainTestDirectory = process.argv.includes('--retain-test-directory');
const existingProfile = process.argv.includes('--existing-profile');
if (!executable || !path.isAbsolute(executable)) throw new Error('ABSOLUTE_CODEX_EXECUTABLE_REQUIRED');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skyops-discovery-'));

async function inspect() {
  const home = existingProfile ? validateHome(process.env.SKYOPS_VALIDATION_HOME || path.join(os.homedir(), '.skyops-framework-validation')) : validateHome(path.join(temporary, 'installation'), true);
  const compiled = compile(root, require('../docs/audit/source-inventory.json'), ['codex']);
  const profile = existingProfile ? profilePaths(home, 'codex') : prepare(home, 'codex', compiled);
  const env = environment(home, 'codex');
  const cwd = path.join(temporary, 'project');
  fs.mkdirSync(cwd);
  const git = spawnSync('git', ['-c', 'init.defaultBranch=main', 'init', '--quiet', cwd], { env, encoding: 'utf8', shell: false });
  if (git.status !== 0) throw new Error('ISOLATED_PROJECT_INIT_FAILED');
  const child = spawn(executable, ['app-server'], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true });
  const pending = new Map();
  let sequence = 0;
  let buffer = '';
  let stderrBytes = 0;
  child.stderr.on('data', (bytes) => { stderrBytes += bytes.length; });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (text) => {
    buffer += text;
    if (buffer.length > 8 * 1024 * 1024) { child.kill(); return; }
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
      try {
        const message = JSON.parse(line);
        if (pending.has(message.id)) { const request = pending.get(message.id); pending.delete(message.id); message.error ? request.reject(new Error(`RPC_ERROR:${message.error.code}`)) : request.resolve(message.result); }
      } catch { /* Ignore non-protocol diagnostic lines; never echo contents. */ }
    }
  });
  const failPending = (error) => { for (const request of pending.values()) request.reject(error); pending.clear(); };
  child.on('error', failPending);
  child.on('exit', () => failPending(new Error('HOST_EXITED_BEFORE_RESPONSE')));
  const call = (method, params) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
  const timer = setTimeout(() => { failPending(new Error('DISCOVERY_TIMEOUT')); child.kill(); }, 25000);
  let receipt;
  try {
    const initialized = await call('initialize', { clientInfo: { name: 'skyops_discovery_verifier', version: '0.1.0' }, capabilities: { experimentalApi: true } });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    const result = await call('skills/list', { cwds: [cwd], forceReload: true });
    const records = result.data || [];
    const skills = records.flatMap((record) => record.skills || []);
    const errors = records.flatMap((record) => record.errors || []);
    const expected = compiled.catalog.filter((entry) => entry.kind === 'skill').map((entry) => entry.name).sort();
    const actual = skills.filter((skill) => skill.name?.startsWith('sky-')).map((skill) => skill.name).sort();
    const outside = skills.filter((skill) => skill.scope !== 'system' && skill.scope !== 'SYSTEM' && typeof skill.path === 'string' && !path.resolve(skill.path).startsWith(home + path.sep));
    receipt = { schema_version: 1, host: 'codex', platform: process.platform, fixture_outside_profile_and_framework_core: true, existing_validation_profile: existingProfile, checked_at: new Date().toISOString(), native_user_agent: initialized.userAgent || null, expected_skills: expected, discovered_framework_skills: actual, parse_errors: errors.length, outside_non_system_skills: outside.map((skill) => ({ name: skill.name, scope: skill.scope })), disabled_framework_skills: skills.filter((skill) => skill.name?.startsWith('sky-') && skill.enabled === false).map((skill) => skill.name), ok: JSON.stringify(expected) === JSON.stringify(actual) && !errors.length && !outside.length && !skills.some((skill) => skill.name?.startsWith('sky-') && skill.enabled === false), stderr_bytes: stderrBytes, gate_passed: false, limitation: 'Native skill metadata discovery only. No model call, skill execution, memory/cloud access, hooks, agent role or non-Windows validation is claimed.' };
  } finally {
    clearTimeout(timer);
    child.stdin.end();
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      const stop = setTimeout(() => { child.kill(); resolve(); }, 3000);
      child.once('exit', () => { clearTimeout(stop); resolve(); });
    });
  }
  return receipt;
}

(async () => {
  try {
    const receipt = await inspect();
    receipt.test_directory_retained = retainTestDirectory;
    fs.writeFileSync(path.join(root, `docs/audit/codex-native-discovery${existingProfile ? '-existing-profile' : ''}.json`), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt));
    if (!receipt.ok) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
  finally {
    if (path.dirname(temporary) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('skyops-discovery-')) throw new Error('UNSAFE_DISCOVERY_CLEANUP');
    if (!retainTestDirectory) fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 15, retryDelay: 200 });
  }
})();
