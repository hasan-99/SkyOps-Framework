#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = ['baseline', 'packaging', 'integration'].flatMap((group) => fs.readdirSync(path.join(root, 'tests', group)).filter((name) => name.endsWith('.test.cjs')).sort().map((name) => `tests/${group}/${name}`));
const child = spawn(process.execPath, ['--test', '--test-concurrency=2', ...tests], { cwd: root, stdio: 'inherit', shell: false, windowsHide: true });
child.on('error', (error) => { console.error(error.code || 'TEST_PROCESS_START_FAILED'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
