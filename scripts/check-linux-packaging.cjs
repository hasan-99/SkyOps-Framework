#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { digest } = require('../framework/package-store.cjs');
const root = path.resolve(__dirname, '..');
const image = 'node@sha256:be979e5523c76fa4d5ca4ebd3099078f220aa47ec39c48ad5b5df9314debd6eb';
const tests = fs.readdirSync(path.join(root, 'tests/packaging')).filter((name) => name.endsWith('.test.cjs')).sort().map((name) => `tests/packaging/${name}`);
const args = ['run', '--rm', '--network', 'none', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=256m', '--mount', `type=bind,source=${root},target=/workspace,readonly`, '--workdir', '/workspace', image, 'node', '--test', '--test-reporter=tap', ...tests];
const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 120000, shell: false, maxBuffer: 8 * 1024 * 1024 });
const output = result.stdout || '';
const count = (name) => Number(new RegExp(`^# ${name} (\\d+)$`, 'm').exec(output)?.[1] || 0);
const receipt = { schema_version: 1, image, platform: 'linux_container', host: process.platform, timestamp: new Date().toISOString(), tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped'), exit_code: result.status, ok: result.status === 0 && count('tests') > 0 && count('tests') === count('pass') && !count('skipped'), output_sha256: digest(output), phase_gate_passed: false, network: 'disabled; loopback fixture servers only', source_mount: 'read_only', limitation: 'Linux Node component/transport tests only. No Linux AI host, Supabase services, macOS, WSL or application end-to-end validation is claimed.' };
fs.writeFileSync(path.join(root, 'docs/audit/linux-packaging-tests.tap'), output);
fs.writeFileSync(path.join(root, 'docs/audit/linux-packaging-verification.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
if (!receipt.ok) { process.stderr.write((result.stderr || '') + output.slice(-16000)); process.exitCode = 1; }
