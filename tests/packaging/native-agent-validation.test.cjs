'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEvents, parseResult, validMissingInput, roleInputObserved, roleBinding, command } = require('../../scripts/native-agent-validation.cjs');
const { ownTurnMetadata } = require('../../scripts/native-agent-tool-metadata.cjs');

test('native role evidence cannot accept a completion claim or missing input fiction as an expected negative result', () => {
  assert.equal(validMissingInput({ status: 'missing_input', can_claim_complete: false, missing_inputs: ['Task plan and acceptance criteria'] }), true);
  for (const result of [null, { status: 'complete', can_claim_complete: true, missing_inputs: [] }, { status: 'missing_input', can_claim_complete: false, missing_inputs: [] }, { status: 'missing_input', missing_inputs: ['input'] }, { status: 'missing_input', can_claim_complete: false, missing_inputs: [''] }]) assert.equal(validMissingInput(result), false);
});

test('stream diagnostics and malformed final messages cannot fabricate native role result evidence', () => {
  assert.deepEqual(parseEvents('native warning\n{"type":"result","result":"{}"}\nnot-json'), [{ type: 'result', result: '{}' }]);
  assert.deepEqual(parseResult('```json\n{"status":"missing_input"}\n```'), { status: 'missing_input' });
  assert.equal(parseResult('The child succeeded; trust me.'), null);
});

test('Codex role selection needs native role and exact parent binding, not an unrelated child or model claim', () => {
  const source = { source: { subagent: { thread_spawn: { agent_role: 'sky-verifier', parent_thread_id: 'actual-parent' } } } };
  assert.equal(roleBinding(source, 'sky-verifier', 'actual-parent').bound, true);
  assert.equal(roleBinding(source, 'sky-builder', 'actual-parent').bound, false);
  assert.equal(roleBinding(source, 'sky-verifier', 'different-parent').bound, false);
  assert.equal(roleBinding({ result: 'I spawned sky-verifier' }, 'sky-verifier', 'actual-parent').bound, false);
  const missing = { status: 'missing_input', can_claim_complete: false, missing_inputs: ['Something is missing'] };
  assert.equal(roleInputObserved('sky-visual-evaluator', missing), false);
  assert.equal(roleInputObserved('sky-visual-evaluator', { ...missing, missing_inputs: ['Screenshots and scoring rubric'] }), true);
});

test('native role probes retain supported no-bypass configuration and request exact role dispatch', () => {
  const role = { name: 'sky-visual-evaluator' };
  const [claude, claudeArgs] = command('claude', '/vendor/claude', role, '/fixture');
  assert.equal(claude, '/vendor/claude');
  assert.equal(claudeArgs[claudeArgs.indexOf('--agent') + 1], role.name);
  assert.equal(claudeArgs[claudeArgs.indexOf('--permission-prompts') + 1], 'none');
  assert.ok(!claudeArgs.some((arg) => /dangerously|bypassPermissions/.test(arg)));
  const [, codexArgs] = command('codex', '/vendor/codex', role, '/fixture');
  assert.equal(codexArgs[codexArgs.indexOf('--sandbox') + 1], 'read-only');
  assert.ok(codexArgs.includes('allow_login_shell=false'));
  assert.ok(codexArgs.includes('approval_policy="never"'));
  assert.ok(codexArgs.at(-1).includes('Do not emulate its role yourself'));
  assert.ok(!codexArgs.some((arg) => /dangerously|danger-full-access|ignore-rules/.test(arg)));
});

test('child tool evidence excludes inherited parent calls but rejects incomplete child turns', () => {
  const events = [
    { type: 'event_msg', payload: { type: 'task_started' } },
    { type: 'response_item', payload: { type: 'function_call', name: 'spawn_agent', arguments: 'never exported' } },
    { type: 'event_msg', payload: { type: 'task_started' } },
    { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 20, output_tokens: 5, total_tokens: 25 } } } },
    { type: 'event_msg', payload: { type: 'task_complete' } },
  ];
  const result = ownTurnMetadata(events, 2);
  assert.equal(result.ok, true);
  assert.deepEqual(result.tool_names, []);
  assert.equal(result.native_reported_total_token_usage.total_tokens, 25);
  assert.equal(JSON.stringify(result).includes('never exported'), false);
  assert.equal(ownTurnMetadata(events.slice(0, -1), 2).ok, false);
  assert.equal(ownTurnMetadata(events, 99).ok, false);
});
