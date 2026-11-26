#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { environment, profilePaths } = require('../framework/host-profiles.cjs');
const { validateHome, digest } = require('../framework/package-store.cjs');
const { frontmatter } = require('../framework/compiler.cjs');
const root = path.resolve(__dirname, '..');
const roles = fs.readdirSync(path.join(root, 'agents')).filter((name) => name.endsWith('.md')).map((file) => {
  const bytes = fs.readFileSync(path.join(root, 'agents', file));
  const parsed = frontmatter(bytes.toString());
  return { name: parsed.name, source: `agents/${file}`, source_sha256: digest(bytes), description: parsed.description };
});

function parseEvents(text) {
  return String(text || '').split(/\r?\n/).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
}

function parseResult(text) {
  const value = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(value); } catch { return null; }
}

function validMissingInput(result) {
  return Boolean(result && result.status === 'missing_input' && result.can_claim_complete === false && Array.isArray(result.missing_inputs) && result.missing_inputs.length > 0 && result.missing_inputs.every((item) => typeof item === 'string' && item.trim()));
}

function roleInputObserved(role, result) {
  if (!validMissingInput(result)) return false;
  const text = result.missing_inputs.join(' ');
  const requirements = {
    'sky-builder': [/task|plan/i],
    'sky-plan-checker': [/plan/i],
    'sky-planner': [/project|phase|requirements/i],
    'sky-qa-browser': [/url|running|application|browser|server/i],
    'sky-research-synthesizer': [/STACK/i, /FEATURES/i, /ARCHITECTURE/i, /PITFALLS/i],
    'sky-researcher': [/domain|dimension|project|scope/i],
    'sky-roadmapper': [/project|requirements|research|summary/i],
    'sky-verifier': [/phase|goal|plan|contract|acceptance|criteria/i],
    'sky-visual-evaluator': [/screenshot/i, /rubric/i],
  };
  return !!requirements[role] && requirements[role].every((expression) => expression.test(text));
}

function sessionFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('LINKED_VALIDATION_SESSION_PATH_REFUSED');
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('LINKED_VALIDATION_SESSION_PATH_REFUSED');
    return entry.isDirectory() ? sessionFiles(file) : entry.isFile() && entry.name.endsWith('.jsonl') ? [file] : [];
  });
}

function readSessionMetadata(file) {
  if (fs.lstatSync(file).nlink !== 1) throw new Error('HARDLINKED_VALIDATION_SESSION_REFUSED');
  const fd = fs.openSync(file, 'r');
  let text = '';
  try {
    const buffer = Buffer.alloc(8192);
    while (!text.includes('\n') && Buffer.byteLength(text) < 1024 * 1024) {
      const length = fs.readSync(fd, buffer);
      if (!length) break;
      text += buffer.subarray(0, length).toString('utf8');
    }
  } finally { fs.closeSync(fd); }
  try {
    const event = JSON.parse(text.split('\n')[0]);
    return event.type === 'session_meta' ? event.payload : null;
  } catch { return null; }
}

function roleBinding(metadata, expectedRole, parentThread) {
  const roles = [], parents = [], sourceKeys = [];
  const visit = (value, prefix = '') => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const field = prefix ? `${prefix}.${key}` : key;
      if (/agent_?role|agent_?type|parent_?thread_?id|parent_?id/i.test(key)) sourceKeys.push(field);
      if (/^(?:agent_?role|agent_?type|role)$/i.test(key) && child === expectedRole) roles.push(field);
      if (/^(?:parent_?thread_?id|parent_?id)$/i.test(key) && child === parentThread) parents.push(field);
      if (typeof child === 'object') visit(child, field);
    }
  };
  visit(metadata);
  return { bound: roles.length > 0 && parents.length > 0, matched_role_fields: roles, matched_parent_fields: parents, observed_binding_fields: sourceKeys };
}

const probe = 'This is a missing-input acceptance probe for your actual registered agent role. The fixture has no project brief, plan, task, research files, running application, screenshots or verification evidence. Do not invent inputs, scores, results or completion. Do not use tools, delegate, create files, browse, inspect credentials or other profiles, commit, push or contact integrations. State which inputs your own real agent instructions require before productive work can start. Return only JSON with status="missing_input", missing_inputs as a nonempty array of concise strings, and can_claim_complete=false. This is not a request to execute your full workflow.';

function command(host, executable, role, fixture) {
  if (host === 'claude') return [
    executable, ['--print', '--verbose', '--output-format', 'stream-json', '--no-session-persistence', '--max-budget-usd', '0.50',
      '--permission-prompts', 'none', '--setting-sources', 'user', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--agent', role.name, '--tools', '',
      '--disallowedTools', 'Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch', 'NotebookEdit', '--', probe],
  ];
  const parentPrompt = `Use native agent delegation to invoke exactly one registered custom agent named ${role.name}. Do not emulate its role yourself and do not select a default/fallback agent if the named role is unavailable. Wait for the child and close its thread after receiving its answer. Do not run shell commands, edit files, browse or call other integrations. Send the child this exact request: ${probe}\nReturn only JSON {"requested_role":"${role.name}","role_available":true,"child_result":<the child's actual JSON>}. If native dispatch fails, return {"requested_role":"${role.name}","role_available":false,"error":"<concise native error>"}. Never fabricate a child result or success.`;
  return [executable, ['exec', '--json', '--sandbox', 'read-only', '--cd', fixture,
    '-c', 'approval_policy="never"', '-c', 'allow_login_shell=false', '-c', 'web_search="disabled"',
    '-c', 'shell_environment_policy.experimental_use_profile=false', '-c', 'shell_environment_policy.ignore_default_excludes=false',
    '-c', 'agents.enabled=true', '-c', 'agents.max_concurrent_threads_per_session=1',
    '-c', 'features.apps=false', '-c', 'features.plugins=false', '-c', 'features.memories=false',
    ...(process.platform === 'win32' ? ['-c', 'windows.sandbox="mxc"'] : []), parentPrompt]];
}

function runChild(executable, args, options) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true });
    let stdout = '', stderr = '';
    let processError = null;
    const timeout = setTimeout(() => { processError = 'NATIVE_AGENT_TIMEOUT'; child.kill(); }, 120000);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; if (Buffer.byteLength(stdout) > 8 * 1024 * 1024) { processError = 'OUTPUT_LIMIT'; child.kill(); } });
    child.stderr.on('data', (chunk) => { stderr += chunk; if (Buffer.byteLength(stderr) > 1024 * 1024) { processError = 'DIAGNOSTIC_LIMIT'; child.kill(); } });
    child.on('error', (error) => { processError = error.code || 'NATIVE_START_FAILED'; });
    child.on('close', (code) => { clearTimeout(timeout); resolve({ code, stdout, stderr_bytes: Buffer.byteLength(stderr), stderr_categories: [
      ['agent_not_found', /agent[^\n]*(?:not found|unknown|unavailable)/i], ['invalid_option', /unknown option|invalid option|unexpected argument/i],
      ['tool_configuration_error', /tools?[^\n]*(?:invalid|required|empty|missing)|(?:invalid|required|empty|missing)[^\n]*tools?/i],
      ['agent_configuration_error', /agent[^\n]*(?:invalid|configuration|config)|(?:invalid|required|missing)[^\n]*agent/i],
      ['permission_denied', /permission[^\n]*denied|not allowed|blocked by policy/i], ['schema_error', /schema|structured.output|json.schema/i],
    ].filter(([, expression]) => expression.test(stderr)).map(([name]) => name), stderr_agent_mentions: [...new Set(stderr.match(/\bsky-[a-z-]+\b/g) || [])], stderr_sha256: digest(stderr), processError }); });
  });
}

async function validateRole(host, executable, home, role) {
  const profile = profilePaths(home, host);
  const fixture = path.join(home, 'acceptance', `agent-validation-${host}-${role.name}-${crypto.randomUUID()}`);
  fs.mkdirSync(fixture, { recursive: true, mode: 0o700 });
  const env = environment(home, host);
  const git = spawnSync('git', ['-c', 'init.defaultBranch=main', 'init', '--quiet'], { cwd: fixture, env, encoding: 'utf8', shell: false });
  if (git.status !== 0) throw new Error('NATIVE_AGENT_FIXTURE_GIT_FAILED');
  const artifact = path.join(profile.native, 'agents', role.name + (host === 'claude' ? '.md' : '.toml'));
  if (fs.lstatSync(artifact).isSymbolicLink()) throw new Error('LINKED_AGENT_ARTIFACT_REFUSED');
  const artifactHash = digest(fs.readFileSync(artifact));
  const sessions = path.join(profile.native, 'sessions');
  const previousSessions = host === 'codex' ? new Set(sessionFiles(sessions)) : new Set();
  const [binary, args] = command(host, executable, role, fixture);
  const started = Date.now();
  const run = await runChild(binary, args, { cwd: fixture, env });
  const events = parseEvents(run.stdout);
  const unexpectedFiles = fs.readdirSync(fixture).filter((name) => name !== '.git');
  const common = { role: role.name, source: role.source, source_sha256: role.source_sha256, native_artifact_sha256: artifactHash,
    artifact_unchanged: digest(fs.readFileSync(artifact)) === artifactHash, duration_ms: Date.now() - started,
    exit_code: run.code, process_error: run.processError, stderr_bytes: run.stderr_bytes, stderr_categories: run.stderr_categories, stderr_agent_mentions: run.stderr_agent_mentions, stderr_sha256: run.stderr_sha256, unexpected_project_files: unexpectedFiles,
    scope: 'Registered native role entrypoint and missing-input response only; not productive workflow/tool-policy parity', full_functional_parity_verified: false };
  if (host === 'claude') {
    const initialized = events.find((event) => event.type === 'system' && event.subtype === 'init');
    const result = events.findLast((event) => event.type === 'result');
    const parsed = parseResult(result?.result);
    const toolCalls = events.filter((event) => event.type === 'assistant').flatMap((event) => event.message?.content || []).filter((item) => item.type === 'tool_use');
    const available = Array.isArray(initialized?.agents) && initialized.agents.includes(role.name);
    const outside = (initialized?.agents || []).filter((name) => name.startsWith('sky-') && !roles.some((role) => role.name === name));
    return { ...common, ok: run.code === 0 && !run.processError && available && roleInputObserved(role.name, parsed) && !outside.length && !toolCalls.length && !unexpectedFiles.length && common.artifact_unchanged,
      native_requested_agent: role.name, native_role_registered: available, native_dispatch_method: 'Claude --agent',
      required_role_input_observed: roleInputObserved(role.name, parsed), unexpected_framework_agents: outside,
      effective_tools: initialized?.tools || [], actual_tool_calls: toolCalls.map((item) => item.name),
      model: initialized?.model || null, result_subtype: result?.subtype || null, result: parsed,
      unparsed_result_present: !parsed && !!result?.result, usage: result?.usage || null, actual_cost_usd: result?.total_cost_usd ?? null,
      permission_denials: (result?.permission_denials || []).map((item) => item.tool_name) };
  }
  const items = events.filter((event) => event.type === 'item.completed').map((event) => event.item || {});
  const final = items.findLast((item) => item.type === 'agent_message')?.text || '';
  const parsed = parseResult(final);
  const allItems = events.filter((event) => event.item).map((event) => ({ ...event.item, event_type: event.type }));
  const collab = allItems.filter((item) => /collab/i.test(item.type || ''));
  const spawnEvents = collab.filter((item) => /spawn/i.test(item.tool || item.tool_name || ''));
  const parentThread = events.find((event) => event.type === 'thread.started')?.thread_id;
  const bindings = sessionFiles(sessions).filter((file) => !previousSessions.has(file)).map((file) => roleBinding(readSessionMetadata(file), role.name, parentThread));
  const nativeBound = bindings.some((binding) => binding.bound);
  return { ...common, ok: run.code === 0 && !run.processError && parsed?.requested_role === role.name && parsed?.role_available === true && roleInputObserved(role.name, parsed?.child_result) && nativeBound && !unexpectedFiles.length && common.artifact_unchanged,
    native_dispatch_method: 'Codex named role through native agent delegation', result: parsed,
    required_role_input_observed: roleInputObserved(role.name, parsed?.child_result),
    native_child_role_and_parent_bound: nativeBound, child_session_bindings: bindings,
    collaboration_events: collab.map((item) => ({ type: item.type, event_type: item.event_type, tool: item.tool || item.tool_name || null, fields: Object.keys(item), status: item.status || null, receiver_count: item.receiver_thread_ids?.length ?? null })),
    observed_item_types: [...new Set(allItems.map((item) => item.type))],
    actual_shell_calls: items.filter((item) => item.type === 'command_execution').length,
    usage: events.findLast((event) => event.type === 'turn.completed')?.usage || null,
    usage_scope: 'Native CLI reported parent-turn usage; child aggregation is not established', sandbox: process.platform === 'win32' ? 'mxc_read_only' : 'native_read_only' };
}

async function main(argv) {
  const [host, executable, requestedRole] = argv;
  if (!['claude', 'codex'].includes(host) || !path.isAbsolute(executable || '') || !fs.statSync(executable).isFile()) throw new Error('USAGE: native-agent-validation.cjs claude|codex absolute-native-executable [sky-role]');
  const selected = requestedRole ? roles.filter((role) => role.name === requestedRole) : roles;
  if (!selected.length) throw new Error('UNKNOWN_CANONICAL_AGENT_ROLE');
  const home = validateHome(process.env.SKYOPS_VALIDATION_HOME || path.join(os.homedir(), '.skyops-framework-validation'));
  const results = [];
  const queue = [...selected];
  const receiptPath = path.join(root, `docs/audit/native-agent-validation-${host}${requestedRole ? '-pilot' : ''}.json`);
  const receipt = () => ({ schema_version: 1, host, checked_at: new Date().toISOString(), platform: process.platform, concurrency_limit: 2,
    expected_roles: selected.map((role) => role.name), tested_roles: results.length, passed: results.filter((item) => item.ok).length,
    ok: results.length === selected.length && results.every((item) => item.ok), results,
    phase_gate_passed: false, production_activation: false,
    limitations: ['Missing-input native role entrypoint probes only; no implementation, design scoring, research, browser QA or cloud/provider workflow acceptance', 'No per-agent tool-policy equivalence, cross-tenant security or full functional parity claim', 'No existing .NET framework/configuration/cache or existing Supabase project was accessed'] });
  await Promise.all(Array.from({ length: Math.min(2, selected.length) }, async () => {
    while (queue.length) {
      const role = queue.shift();
      const result = await validateRole(host, executable, home, role);
      results.push(result);
      fs.writeFileSync(receiptPath, JSON.stringify(receipt(), null, 2) + '\n');
      console.log(JSON.stringify({ host, role: role.name, ok: result.ok, duration_ms: result.duration_ms, reason: result.process_error || result.result_subtype || result.result?.error || null }));
    }
  }));
  const final = receipt();
  console.log(JSON.stringify({ receipt: path.relative(root, receiptPath), host, tested: final.tested_roles, passed: final.passed, ok: final.ok, phase_gate_passed: false }));
  if (!final.ok) process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2)).catch((error) => { console.error(JSON.stringify({ error: error.code || error.message })); process.exitCode = 1; });
module.exports = { parseEvents, parseResult, validMissingInput, roleInputObserved, roleBinding, readSessionMetadata, sessionFiles, command };
