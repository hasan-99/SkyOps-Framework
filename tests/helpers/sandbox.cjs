'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
function sandbox(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'skyops-test-'));
  const home = path.join(directory, 'framework-home');
  fs.mkdirSync(home);
  const { OWNER_FILE, OWNER } = require('../../framework/package-store.cjs');
  fs.writeFileSync(path.join(home, OWNER_FILE), JSON.stringify(OWNER));
  t.after(() => {
    if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('skyops-test-')) throw new Error('Unsafe test cleanup target');
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const env = { ...process.env, QUALIA_HOME: home, SKYOPS_HOME: home, QUALIA_ACTOR: 'fixture-user', SKYOPS_ACTOR: 'fixture-user' };
  function run(script, args = [], overrides = {}) {
    return spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
      cwd: directory, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 15000, shell: false,
    });
  }
  function json(script, args = [], overrides = {}) {
    const result = run(script, args, overrides);
    if (result.error) throw result.error;
    try { return { code: result.status, value: JSON.parse(result.stdout), stderr: result.stderr }; }
    catch { throw new Error(`Expected JSON from ${script}: ${result.stderr || result.stdout}`); }
  }
  return { directory, home, env, run, json };
}
module.exports = { ROOT, sandbox };
