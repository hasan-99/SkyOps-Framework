#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { validateHome } = require('../framework/package-store.cjs');
const { environment } = require('../framework/host-profiles.cjs');
const executable = process.argv[2];
if (!executable || !path.isAbsolute(executable)) throw new Error('ABSOLUTE_CLAUDE_EXECUTABLE_REQUIRED');
const home = validateHome(process.env.SKYOPS_VALIDATION_HOME || path.join(os.homedir(), '.skyops-framework-validation'));
const project = path.join(home, 'acceptance', `claude-router-${crypto.randomUUID()}`);
fs.mkdirSync(project, { recursive: true, mode: 0o700 });
const env = environment(home, 'claude');
const git = spawnSync('git', ['-c', 'init.defaultBranch=main', 'init', '--quiet'], { cwd: project, env, encoding: 'utf8', shell: false });
if (git.status !== 0) throw new Error('FIXTURE_GIT_INIT_FAILED');
const helper = path.join(home, 'bin/state.js').replace(/\\/g, '/');
const prompt = 'Use /sky-next in this empty Git development fixture. Run its local state check and return the next command and observed reason in two lines. Do not create or modify project files, commit, push, browse, inspect credentials or other profiles, call cloud integrations or delegate. Do not load shell profiles.';
const args = ['--print', '--verbose', '--output-format', 'stream-json', '--no-session-persistence', '--max-budget-usd', '1', '--permission-prompts', 'none', '--setting-sources', 'user', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--tools', 'Read,Glob,Grep,Bash,Skill', '--allowedTools', 'Read', 'Glob', 'Grep', 'Skill(sky-next)', `Bash(node ${helper} check)`, `Bash(node "${helper}" check)`, '--', prompt];
const started = Date.now();
const run = spawnSync(executable, args, { cwd: project, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
const events = [];
for (const line of (run.stdout || '').split(/\r?\n/)) { try { events.push(JSON.parse(line)); } catch { /* Do not record raw native diagnostics. */ } }
const calls = events.filter((event) => event.type === 'assistant').flatMap((event) => event.message?.content || []).filter((item) => item.type === 'tool_use');
const results = events.filter((event) => event.type === 'user').flatMap((event) => event.message?.content || []).filter((item) => item.type === 'tool_result');
const state = calls.find((item) => item.name === 'Bash' && /\bnode(?:\.exe)?\b/.test(item.input?.command || '') && String(item.input?.command || '').includes('state.js') && /\bcheck\b/.test(item.input?.command || ''));
const stateResult = state && results.find((item) => item.tool_use_id === state.id && JSON.stringify(item.content).includes('NO_PROJECT'));
const final = events.findLast((event) => event.type === 'result');
const unexpected = fs.readdirSync(project).filter((name) => name !== '.git');
const receipt = {
  schema_version: 1, host: 'claude', platform: process.platform, checked_at: new Date().toISOString(), duration_ms: Date.now() - started,
  scenario: 'Actual sky-next invocation in an independent empty Git fixture', exit_code: run.status,
  ok: run.status === 0 && !!stateResult && (final?.result || '').includes('/sky-new') && !unexpected.length,
  state_helper_executed_successfully: !!stateResult, tool_calls: calls.map((item) => item.name), tool_result_errors: results.filter((item) => item.is_error).length,
  expected_state_result: 'NO_PROJECT', observed_expected_nonzero_state_result: !!stateResult,
  unexpected_tool_result_errors: results.filter((item) => item.is_error && item !== stateResult).length,
  tool_observations: calls.map((item) => ({ name: item.name, mentions_state_check: String(item.input?.command || '').includes('state.js') && /\bcheck\b/.test(item.input?.command || ''), results: results.filter((result) => result.tool_use_id === item.id).map((result) => ({ is_error: result.is_error === true, contains_no_project: JSON.stringify(result.content).includes('NO_PROJECT') })) })),
  actual_token_usage: final?.usage || null, actual_cost_usd: final?.total_cost_usd ?? null,
  final_message: String(final?.result || '').slice(0, 2000), result_subtype: final?.subtype || null, unexpected_project_files: unexpected,
  process_error: run.error?.code || null, stderr_bytes: Buffer.byteLength(run.stderr || ''), output_bytes: Buffer.byteLength(run.stdout || ''),
  permission_denials: (final?.permission_denials || []).map((item) => ({ tool_name: item.tool_name })),
  phase_gate_passed: false, production_activation: false,
  limitation: 'One bounded native router scenario only. No other skills/agents, host hook mapping, tenant backend, other operating systems or full E2E parity is certified.',
};
fs.writeFileSync(path.join(__dirname, '../docs/audit/claude-native-router.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
if (!receipt.ok) process.exitCode = 1;
