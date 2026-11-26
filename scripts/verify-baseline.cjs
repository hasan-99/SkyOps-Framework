#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = [
  'tests/baseline/characterization.test.cjs',
  'tests/baseline/inventory.test.cjs',
  'tests/baseline/state-and-evidence.test.cjs',
];
const started = new Date().toISOString();
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...tests], {
  cwd: root, encoding: 'utf8', timeout: 120000, shell: false,
});
const output = result.stdout || '';
const count = (name) => Number(new RegExp(`^# ${name} (\\d+)$`, 'm').exec(output)?.[1] || 0);
const total = count('tests');
const passed = count('pass');
const failed = count('fail');
const ok = result.status === 0 && !result.error && total > 0 && passed === total && failed === 0 && count('skipped') === 0 && count('todo') === 0;
const receipt = {
  schema_version: 1, phase: 1, kind: 'original_baseline_and_inventory_verification',
  started_at: started, finished_at: new Date().toISOString(), node: process.version, platform: process.platform,
  command: ['node', '--test', '--test-reporter=tap', ...tests],
  exit_code: result.status, ok, tests: total, passed, failed, skipped: count('skipped'),
  output_sha256: crypto.createHash('sha256').update(output).digest('hex'),
  implementation_parity_claimed: false,
  limitation: 'Local Node baseline behavior and inventory only. No native host, cloud, provider, or end-to-end application validation is claimed.',
};
fs.writeFileSync(path.join(root, 'docs/audit/phase-1-tests.tap'), output);
fs.writeFileSync(path.join(root, 'docs/audit/phase-1-verification.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
if (!ok) { process.stderr.write(result.stderr || result.error?.message || output); process.exitCode = 1; }
