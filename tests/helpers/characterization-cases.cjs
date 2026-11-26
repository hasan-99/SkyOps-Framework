'use strict';

function task(id = 'T1', overrides = {}) {
  return {
    id, title: `Implement ${id}`, wave: 1, depends_on: [], persona: 'backend',
    files_modify: [], files_create: [`src/${id}.js`], files_delete: [],
    acceptance_criteria: [`The ${id} behavior returns its documented result`],
    action: 'Implement the defined behavior and run its validation commands.', context_files: [],
    verification: [{ type: 'file-exists', path: `src/${id}.js` }], ...overrides,
  };
}

function contract(tasks = [task()], overrides = {}) {
  return {
    version: 1, phase: 1, goal: 'Deliver the specified behavior', why: 'Make the agreed user flow work',
    generated_at: '2026-11-26T00:00:00.000Z', generated_by: 'manual', source_plan_hash: '',
    success_criteria: ['All acceptance criteria have evidence'], tasks, ...overrides,
  };
}

function finding(overrides = {}) {
  return { lens: 'correctness', file: 'src/action.js', line: 12, severity: 'HIGH', title: 'Required action is not connected', votes: { real: 0, notReal: 0 }, ...overrides };
}

function cases() {
  const result = [];
  const add = (id, module, fn, args) => result.push({ id, module, function: fn, args });
  add('contract-valid', 'plan-contract', 'validate', [contract()]);
  add('contract-unknown-dependency', 'plan-contract', 'validate', [contract([task('T1', { depends_on: ['T9'], wave: 2 })])]);
  add('contract-cycle', 'plan-contract', 'validate', [contract([task('T1', { depends_on: ['T2'] }), task('T2', { depends_on: ['T1'] })])]);
  add('contract-wrong-wave', 'plan-contract', 'validate', [contract([task(), task('T2', { depends_on: ['T1'] })])]);
  add('contract-file-list-overlap', 'plan-contract', 'validate', [contract([task('T1', { files_modify: ['src/T1.js'] })])]);
  add('contract-scope-reduction', 'plan-contract', 'validate', [contract([task('T1', { action: 'Use a placeholder for now.' })])]);
  add('contract-missing-evidence', 'plan-contract', 'validate', [contract([task('T1', { verification: [] })])]);
  add('contract-shell-metacharacters', 'plan-contract', 'validate', [contract([task('T1', { verification: [{ type: 'command-exit', command: 'node;bad', args: [], expected_exit: 0 }] })])]);
  add('contract-invalid-json', 'plan-contract', 'parseSafely', ['{']);
  add('contract-stable-hash', 'plan-contract', 'hashPlan', ['A plan with explicit acceptance criteria.']);
  add('waves-small-sequential', 'wave-plan', 'plan', [contract([task(), task('T2')])]);
  add('waves-dependency-order', 'wave-plan', 'plan', [contract([task(), task('T2'), task('T3', { wave: 2, depends_on: ['T1'] }), task('T4', { wave: 3, depends_on: ['T2', 'T3'] })]), { parallel: 2 }]);
  add('waves-concurrency-cap', 'wave-plan', 'plan', [contract(Array.from({ length: 11 }, (_, i) => task(`T${i + 1}`))), { parallel: 3 }]);
  add('waves-cycle-rejected', 'wave-plan', 'plan', [contract([task('T1', { depends_on: ['T2'] }), task('T2', { depends_on: ['T1'] })])]);
  add('waves-invalid-cap', 'wave-plan', 'plan', [contract(), { parallel: 0 }]);
  add('panel-high-unjudged-fails', 'verify-panel', 'aggregate', [{ phase: 1, lenses: ['correctness'], findings: [finding()] }]);
  add('panel-tie-survives', 'verify-panel', 'aggregate', [{ phase: 1, lenses: ['correctness'], findings: [finding({ votes: { real: 2, notReal: 2 } })] }]);
  add('panel-majority-rejects', 'verify-panel', 'aggregate', [{ phase: 1, lenses: ['correctness'], findings: [finding({ votes: { real: 1, notReal: 2 } })] }]);
  add('panel-critical-fails', 'verify-panel', 'aggregate', [{ phase: 1, lenses: ['security'], findings: [finding({ lens: 'security', severity: 'CRITICAL', votes: { real: 2, notReal: 1 } })] }]);
  add('panel-low-pass', 'verify-panel', 'aggregate', [{ phase: 1, lenses: ['correctness'], findings: [finding({ severity: 'LOW' })] }]);
  add('panel-deduplicates-lenses', 'verify-panel', 'aggregate', [{ phase: 1, lenses: ['correctness', 'security'], findings: [finding({ severity: 'LOW' }), finding({ lens: 'security', severity: 'HIGH', votes: { real: 2, notReal: 1 } })] }]);
  const ctx = { output: 'Approved result', latency_ms: 80, cost_usd: 0.001 };
  for (const [id, assertion] of [
    ['contains', { type: 'contains', value: 'Approved' }],
    ['missing-string', { type: 'contains', value: 'absent' }],
    ['not-contains', { type: 'not_contains', value: 'rejected' }],
    ['equals', { type: 'equals', value: 'Approved result' }],
    ['regex', { type: 'regex', value: '^Approved' }],
    ['invalid-regex', { type: 'regex', value: '[' }],
    ['not-regex', { type: 'not_regex', value: '^Rejected' }],
    ['min-length', { type: 'min_length', value: 5 }],
    ['max-length', { type: 'max_length', value: 5 }],
    ['latency-pass', { type: 'max_latency_ms', value: 100 }],
    ['cost-fail', { type: 'max_cost_usd', value: 0.0001 }],
    ['pending-judge', { type: 'llm_rubric', rubric: 'Grounded in the supplied policy' }],
    ['judge-pass', { type: 'llm_rubric', rubric: 'Grounded in policy', verdict: 'pass' }],
    ['unknown-assertion', { type: 'unrecognized' }],
  ]) add(`eval-${id}`, 'eval-runner', 'runAssertion', [assertion, ctx]);
  add('eval-json-valid', 'eval-runner', 'runAssertion', [{ type: 'json_valid' }, { output: '{"ok":true}' }]);
  add('eval-json-path', 'eval-runner', 'runAssertion', [{ type: 'json_path', path: 'result.items.0.id', equals: 7 }, { output: '{"result":{"items":[{"id":7}]}}' }]);
  add('eval-json-missing-path', 'eval-runner', 'runAssertion', [{ type: 'json_path', path: 'missing' }, { output: '{}' }]);
  add('eval-unmeasured-latency-fails', 'eval-runner', 'runAssertion', [{ type: 'max_latency_ms', value: 100 }, { output: 'ok' }]);
  add('eval-empty-suite-fails', 'eval-runner', 'run', [{ feature: 'empty', cases: [] }]);
  add('eval-empty-assertions-fail', 'eval-runner', 'run', [{ feature: 'no-checks', cases: [{ name: 'missing checks', output: 'ok', assert: [] }] }]);
  add('eval-pending-suite-fails', 'eval-runner', 'run', [{ feature: 'judgment', cases: [{ name: 'answer', output: 'ok', assert: [{ type: 'llm_rubric', rubric: 'Grounded' }] }] }]);
  return result;
}

module.exports = { task, contract, finding, cases };
