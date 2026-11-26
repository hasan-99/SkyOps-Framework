#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { validateHome } = require('../framework/package-store.cjs');
const { sessionFiles, readSessionMetadata, roleBinding } = require('./native-agent-validation.cjs');
const root = path.resolve(__dirname, '..');

function ownTurnMetadata(events, historyBoundary = 0) {
  if (!Number.isSafeInteger(historyBoundary) || historyBoundary < 0 || historyBoundary >= events.length) return { ok: false, reason: 'INVALID_HISTORY_BOUNDARY' };
  const start = events.findIndex((event, index) => index >= historyBoundary && event.type === 'event_msg' && event.payload?.type === 'task_started');
  if (start < 0) return { ok: false, reason: 'OWN_TURN_START_NOT_FOUND' };
  const own = events.slice(start);
  const complete = own.some((event) => event.type === 'event_msg' && event.payload?.type === 'task_complete');
  const calls = own.filter((event) => event.type === 'response_item' && ['function_call', 'custom_tool_call'].includes(event.payload?.type)).map((event) => String(event.payload.name || 'unknown_tool'));
  const reportedUsage = own.findLast((event) => event.type === 'event_msg' && event.payload?.type === 'token_count')?.payload?.info?.total_token_usage || {};
  const usage = Object.fromEntries(['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens'].filter((key) => Number.isSafeInteger(reportedUsage[key]) && reportedUsage[key] >= 0).map((key) => [key, reportedUsage[key]]));
  return { ok: complete, reason: complete ? null : 'OWN_TURN_NOT_COMPLETE', inherited_history_boundary: historyBoundary, own_turn_start: start, tool_names: calls, native_reported_total_token_usage: usage };
}

function readEvents(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 8 * 1024 * 1024) throw new Error('UNSAFE_OR_OVERSIZED_SYNTHETIC_SESSION');
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function verify(home, mainReceipt) {
  home = validateHome(home);
  if (mainReceipt.host !== 'codex' || mainReceipt.tested_roles !== 9 || !mainReceipt.ok) throw new Error('COMPLETE_NATIVE_ROLE_RECEIPT_REQUIRED');
  const native = path.join(home, 'profiles/codex/native');
  const acceptance = path.join(home, 'acceptance');
  const records = sessionFiles(path.join(native, 'sessions')).map((file) => ({ file, metadata: readSessionMetadata(file) }));
  const result = [];
  for (const role of mainReceipt.expected_roles) {
    const parents = records.filter(({ metadata }) => {
      if (!metadata || !['exec', 'cli'].includes(metadata.source) || !metadata.cwd) return false;
      const relative = path.relative(acceptance, metadata.cwd);
      return relative && !relative.includes(path.sep) && relative.startsWith(`agent-validation-codex-${role}-`) && Date.parse(metadata.timestamp) <= Date.parse(mainReceipt.checked_at);
    }).sort((a, b) => Date.parse(b.metadata.timestamp) - Date.parse(a.metadata.timestamp));
    const parent = parents[0];
    const children = parent ? records.filter(({ metadata }) => roleBinding(metadata, role, parent.metadata.id).bound && metadata.cwd === parent.metadata.cwd) : [];
    const parentTools = parent ? ownTurnMetadata(readEvents(parent.file)) : { ok: false, reason: 'SYNTHETIC_PARENT_NOT_FOUND' };
    const childTools = children.map(({ file, metadata }) => ({ role_and_parent_bound: true, ...ownTurnMetadata(readEvents(file), metadata.subagent_history_start_ordinal) }));
    const unexpectedParentTools = (parentTools.tool_names || []).filter((name) => !/(?:^|\.)(?:spawn_agent|wait|close_agent|wait_agent|send_message|send_input)$/.test(name));
    result.push({ role, synthetic_parent_created_at: parent?.metadata.timestamp || null, child_count: children.length,
      parent: parentTools, children: childTools, unexpected_parent_tool_names: unexpectedParentTools,
      ok: !!parent && parentTools.ok && !unexpectedParentTools.length && childTools.length === 1 && childTools.every((child) => child.ok && child.tool_names.length === 0) });
  }
  return { schema_version: 1, host: 'codex', checked_at: new Date().toISOString(), evidence_source: 'Native session metadata and tool-name/usage fields from the latest matching synthetic agent-validation parent/child fixtures only',
    referenced_role_receipt: 'docs/audit/native-agent-validation-codex.json', results: result, tested_roles: result.length, ok: result.length === 9 && result.every((item) => item.ok), phase_gate_passed: false,
    limitations: ['No token/auth files, previous/global project/session bodies or tool arguments/results are exported', 'Inherited parent history is excluded using the recorded native child boundary and own-turn lifecycle', 'No productive workflow, browser/visual acceptance, per-agent tool authorization or full parity claim', 'Reported child token counters are preserved individually; no unsupported aggregate cost/performance claim'] };
}

if (require.main === module) {
  try {
    const home = process.env.SKYOPS_VALIDATION_HOME || path.join(os.homedir(), '.skyops-framework-validation');
    const main = JSON.parse(fs.readFileSync(path.join(root, 'docs/audit/native-agent-validation-codex.json'), 'utf8'));
    const receipt = verify(home, main);
    fs.writeFileSync(path.join(root, 'docs/audit/native-agent-validation-codex-tool-metadata.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify({ ok: receipt.ok, roles: receipt.tested_roles, passed: receipt.results.filter((item) => item.ok).length, phase_gate_passed: false }));
    if (!receipt.ok) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ error: error.code || error.message })); process.exitCode = 1; }
}

module.exports = { ownTurnMetadata, verify };
