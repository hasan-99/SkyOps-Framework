#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { digest } = require('../framework/package-store.cjs');
const root = path.resolve(__dirname, '..');
const tests = fs.readdirSync(path.join(root, 'tests/packaging')).filter((name) => name.endsWith('.test.cjs')).sort().map((name) => `tests/packaging/${name}`);
const started = new Date().toISOString();
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', '--test-reporter=tap', ...tests], { cwd: root, encoding: 'utf8', timeout: 60000, shell: false });
const output = result.stdout || '';
const count = (name) => Number(new RegExp(`^# ${name} (\\d+)$`, 'm').exec(output)?.[1] || 0);
const ok = result.status === 0 && !result.error && count('tests') > 0 && count('pass') === count('tests') && count('fail') === 0 && count('skipped') === 0 && count('todo') === 0;
const receipt = {
  schema_version: 1, phase: 2, kind: 'partial_packaging_unit_and_lifecycle_verification',
  started_at: started, finished_at: new Date().toISOString(), node: process.version, platform: process.platform,
  command: ['node', '--test', '--test-concurrency=2', '--test-reporter=tap', ...tests], exit_code: result.status,
  ok, tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped'),
  output_sha256: digest(output), phase_gate_passed: false, implementation_parity_claimed: false,
  limitations: ['Ephemeral test keys, synthetic packages and compiler fixtures; no production trust or release created', 'Supabase invitations, owner approval, licenses/device quotas, issuance and delivery remain unimplemented/unverified', 'Native host discovery, execution, policy mapping and isolation remain unverified', 'Full source branding migration and host adapters remain pending', 'Windows local execution only'],
};
fs.writeFileSync(path.join(root, 'docs/audit/phase-2-packaging-tests.tap'), output);
fs.writeFileSync(path.join(root, 'docs/audit/phase-2-packaging-verification.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
if (!ok) { process.stderr.write(result.stderr || result.error?.message || output); process.exitCode = 1; }
