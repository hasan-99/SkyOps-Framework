#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { digest } = require('../framework/package-store.cjs');
const root = path.resolve(__dirname, '..');
const stack = process.argv[2];
if (!['landing-page', 'full-app', 'ai-agent', 'internal-tool'].includes(stack)) throw new Error('EXPLICIT_SCAFFOLD_REQUIRED');
const source = path.join(root, 'skyops-templates/stacks', stack, 'scaffold');
const resume = process.argv.includes('--resume');
const previous = resume ? JSON.parse(fs.readFileSync(path.join(root, `docs/audit/scaffold-${stack}-verification.json`), 'utf8')) : null;
if (previous && (previous.scaffold !== stack || path.dirname(path.resolve(previous.fixture)) !== path.resolve(os.tmpdir()) || !path.basename(previous.fixture).startsWith('skyops-scaffold-') || fs.lstatSync(previous.fixture).isSymbolicLink())) throw new Error('UNSAFE_SCAFFOLD_RESUME');
const directory = previous ? previous.fixture : fs.mkdtempSync(path.join(os.tmpdir(), 'skyops-scaffold-'));
const project = path.join(directory, 'project');
const home = path.join(directory, 'user');
fs.mkdirSync(home, { recursive: true });
const npmConfig = path.join(home, '.npmrc');
const globalConfig = path.join(home, 'global.npmrc');
fs.writeFileSync(npmConfig, ''); fs.writeFileSync(globalConfig, '');
const env = {};
const allowed = new Set(['path', 'pathext', 'systemroot', 'windir', 'comspec', 'temp', 'tmp', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy', 'ssl_cert_file', 'ssl_cert_dir', 'node_extra_ca_certs']);
for (const [key, value] of Object.entries(process.env)) if (allowed.has(key.toLowerCase())) env[key] = value;
let cache = path.join(directory, 'npm-cache');
const landingReceipt = path.join(root, 'docs/audit/scaffold-landing-page-verification.json');
if (stack !== 'landing-page' && fs.existsSync(landingReceipt)) {
  const prior = JSON.parse(fs.readFileSync(landingReceipt, 'utf8'));
  const fixture = path.resolve(prior.fixture || '');
  if (prior.ok && path.dirname(fixture) === path.resolve(os.tmpdir()) && path.basename(fixture).startsWith('skyops-scaffold-')) {
    const candidate = path.join(fixture, 'npm-cache');
    if (fs.existsSync(candidate) && fs.realpathSync(candidate) === candidate && !fs.lstatSync(candidate).isSymbolicLink()) cache = candidate;
  }
}
Object.assign(env, { HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'AppData/Roaming'), LOCALAPPDATA: path.join(home, 'AppData/Local'), CI: 'true', NEXT_TELEMETRY_DISABLED: '1', npm_config_cache: cache, npm_config_userconfig: npmConfig, npm_config_globalconfig: globalConfig, npm_config_registry: 'https://registry.npmjs.org' });
const npm = [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].find((file) => fs.existsSync(file));
if (!npm) throw new Error('NATIVE_NPM_CLI_JS_NOT_FOUND');
const sourceHashes = {};
function copy(relative = '') {
  const target = path.join(project, relative);
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  for (const entry of fs.readdirSync(path.join(source, relative), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('LINKED_SCAFFOLD_REFUSED');
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) copy(name);
    else {
      const bytes = fs.readFileSync(path.join(source, name));
      const destination = path.join(project, name);
      if (previous && fs.existsSync(destination)) {
        if (fs.lstatSync(destination).isSymbolicLink() || ![previous.source_hashes[name], digest(bytes)].includes(digest(fs.readFileSync(destination)))) throw new Error('MODIFIED_SCAFFOLD_RESUME_FILE');
        if (name === 'package.json' && previous.source_hashes[name] !== digest(bytes)) throw new Error('SCAFFOLD_RESUME_REQUIRES_DEPENDENCY_INSTALL');
        fs.writeFileSync(destination, bytes, { mode: 0o600 });
      } else fs.writeFileSync(destination, bytes, { flag: 'wx', mode: 0o600 });
      sourceHashes[name] = digest(bytes);
    }
  }
}
copy();
const results = previous ? previous.results.filter((result) => result.stage === 'install' && result.exit_code === 0) : [];
if (previous && results.length !== 1) throw new Error('SUCCESSFUL_DEPENDENCY_INSTALL_REQUIRED_FOR_RESUME');
for (const [name, args] of [['install', ['install', '--ignore-scripts', '--no-audit', '--no-fund']], ['lint', ['run', 'lint']], ['typecheck', ['run', 'typecheck']], ['build', ['run', 'build']]]) {
  if (previous && name === 'install') continue;
  console.log(JSON.stringify({ scaffold: stack, stage: name, state: 'running', isolated_fixture: true }));
  const started = Date.now();
  const result = spawnSync(process.execPath, [npm, ...args], { cwd: project, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 240000, maxBuffer: 8 * 1024 * 1024 });
  const log = `${result.stdout || ''}${result.stderr || ''}`;
  fs.writeFileSync(path.join(directory, `${name}.log`), log, { mode: 0o600 });
  results.push({ stage: name, exit_code: result.status, error: result.error?.code || null, duration_ms: Date.now() - started, output_sha256: digest(log), log: path.join(directory, `${name}.log`) });
  if (result.status !== 0 || result.error) break;
}
const receipt = { schema_version: 1, checked_at: new Date().toISOString(), scaffold: stack, platform: process.platform, node: process.version, fixture: directory, source_hashes: sourceHashes, results, ok: results.length === 4 && results.every((result) => result.exit_code === 0 && !result.error), credentials_inherited: false, dependency_install_scripts: 'disabled', telemetry: 'disabled', phase_gate_passed: false, limitation: 'Actual isolated scaffold dependency/lint/type/build check only; not finished application quality, real auth/RLS/API integration, browser acceptance or deployment. Original scaffold content still requires the planned project development workflow.' };
fs.writeFileSync(path.join(root, `docs/audit/scaffold-${stack}-verification.json`), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
if (!receipt.ok) process.exitCode = 1;
