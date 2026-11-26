#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { validateHome } = require('../framework/package-store.cjs');
const { environment } = require('../framework/host-profiles.cjs');
const root = path.resolve(__dirname, '..');
const executable = process.argv[2];
if (!executable || !path.isAbsolute(executable)) throw new Error('ABSOLUTE_CODEX_EXECUTABLE_REQUIRED');
const home = validateHome(process.env.SKYOPS_VALIDATION_HOME || path.join(os.homedir(), '.skyops-framework-validation'));
const project = path.join(home, 'acceptance', `router-${crypto.randomUUID()}`);
if (!project.startsWith(home + path.sep)) throw new Error('UNSAFE_FIXTURE_PATH');
fs.mkdirSync(project, { recursive: true, mode: 0o700 });
const env = environment(home, 'codex');
const git = spawnSync('git', ['-c', 'init.defaultBranch=main', 'init', '--quiet'], { cwd: project, env, encoding: 'utf8', shell: false });
if (git.status !== 0) throw new Error('FIXTURE_GIT_INIT_FAILED');
const prompt = 'Use $sky-next for this empty development fixture. Determine the next framework command from actual local state. Do not create a project, plan or source files; do not commit, push, browse, inspect credentials or other profiles, call cloud/integration tools, or delegate. Use host-native shell syntax without loading shell profiles. Return the next command and the observed reason in two short lines.';
const args = ['exec', '--json', '--sandbox', 'read-only', '--cd', project, '-c', 'approval_policy="never"', '-c', 'allow_login_shell=false', '-c', 'web_search="disabled"', '-c', 'shell_environment_policy.experimental_use_profile=false', '-c', 'shell_environment_policy.ignore_default_excludes=false', ...(process.platform === 'win32' ? ['-c', 'windows.sandbox="mxc"'] : []), prompt];
const started = Date.now();
const run = spawnSync(executable, args, { cwd: project, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
const events = [];
for (const line of (run.stdout || '').split(/\r?\n/)) { try { events.push(JSON.parse(line)); } catch { /* Never print raw native diagnostics. */ } }
const items = events.filter((event) => event.type === 'item.completed').map((event) => event.item || {});
const commands = items.filter((item) => item.type === 'command_execution');
// In an empty fixture the real state helper intentionally returns exit 1 with
// NO_PROJECT. A model's final claim alone cannot satisfy this assertion.
const helper = commands.find((item) => /\bnode(?:\.exe)?\b/.test(String(item.command || '')) && String(item.command || '').includes('state.js') && /\bcheck\b/.test(String(item.command || '')) && [0, 1].includes(item.exit_code) && /NO_PROJECT/.test(item.aggregated_output || ''));
const message = items.filter((item) => item.type === 'agent_message').map((item) => item.text || '').join('\n');
const usage = events.find((event) => event.type === 'turn.completed')?.usage || null;
const unexpected = fs.readdirSync(project).filter((name) => name !== '.git');
const receipt = {
  schema_version: 1, host: 'codex', platform: process.platform, scenario: 'Actual sky-next invocation in an empty isolated Git fixture',
  checked_at: new Date().toISOString(), duration_ms: Date.now() - started, exit_code: run.status,
  ok: run.status === 0 && !!helper && message.includes('/sky-new') && !unexpected.length,
  state_helper_executed_successfully: !!helper, command_calls: commands.length, actual_token_usage: usage,
  expected_state_result: 'NO_PROJECT', observed_state_exit_code: helper?.exit_code ?? null,
  command_observations: commands.map((item) => ({ fields: Object.keys(item), exit_code: item.exit_code, mentions_state_check: String(item.command || '').includes('state.js') && /\bcheck\b/.test(String(item.command || '')), output_has_no_project: /NO_PROJECT/.test(item.aggregated_output || '') })),
  sandbox: process.platform === 'win32' ? 'mxc_read_only' : 'native_read_only', shell_profiles_allowed: false,
  final_message: message.slice(0, 2000), unexpected_project_files: unexpected,
  native_error_categories: events.filter((event) => event.type === 'error').map((event) => String(event.message || '').replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]').slice(0, 300)),
  stderr_bytes: Buffer.byteLength(run.stderr || ''), process_error: run.error?.code || null,
  transport_diagnostic: /blocked by policy|Rejected\(/i.test(run.stderr || '') ? 'native_command_policy_rejected' : /timed?\s*out|timeout/i.test(run.stderr || '') ? 'native_transport_timeout' : run.stderr ? 'native_diagnostics_present_not_recorded' : null,
  phase_gate_passed: false, production_activation: false,
  limitation: 'One native router scenario only. No claim of other skills, agent tool-policy parity, Claude, other operating systems, cloud or full E2E acceptance.',
};
fs.writeFileSync(path.join(root, 'docs/audit/codex-native-router.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
if (!receipt.ok) process.exitCode = 1;
