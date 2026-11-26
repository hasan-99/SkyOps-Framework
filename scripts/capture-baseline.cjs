#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const { BASELINE, ROOT } = require('./audit-baseline.cjs');
const { cases } = require('../tests/helpers/characterization-cases.cjs');

const names = ['plan-contract', 'wave-plan', 'verify-panel', 'eval-runner'];
const destination = path.join(ROOT, 'docs/audit/baseline-characterization.json');
if (fs.existsSync(destination)) throw new Error('Frozen baseline already exists; refusing to overwrite reference evidence');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skyops-characterization-'));
try {
  const modules = {};
  const sources = [];
  for (const name of names) {
    const source = `bin/${name}.js`;
    const body = execFileSync('git', ['show', `${BASELINE}:${source}`], { cwd: ROOT });
    fs.writeFileSync(path.join(temporary, `${name}.js`), body);
    sources.push({ path: source, sha256: crypto.createHash('sha256').update(body).digest('hex') });
  }
  for (const name of names) modules[name] = require(path.join(temporary, `${name}.js`));
  const results = [];
  for (const scenario of cases()) {
    const started = performance.now();
    let result;
    try { result = { returned: modules[scenario.module][scenario.function](...structuredClone(scenario.args)) }; }
    catch (error) { result = { threw: { name: error.name, message: error.message } }; }
    results.push({ ...scenario, result, elapsed_ms: Number((performance.now() - started).toFixed(4)) });
  }
  const record = {
    schema_version: 1, baseline_commit: BASELINE, captured_at: new Date().toISOString(),
    method: 'Execute only four approved deterministic baseline modules extracted from immutable Git blobs; no installed host/profile or provider is invoked.',
    measurement_scope: 'Local deterministic helpers only. Not an AI workflow benchmark or evidence of a performance improvement.',
    environment: { node: process.version, platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model, memory_bytes: os.totalmem() },
    sources, cases: results,
  };
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ baseline_commit: BASELINE, cases: results.length, output: path.relative(ROOT, destination) }));
} finally {
  const parent = path.resolve(os.tmpdir());
  if (path.dirname(path.resolve(temporary)) !== parent || !path.basename(temporary).startsWith('skyops-characterization-')) throw new Error('Unsafe temporary cleanup target');
  fs.rmSync(temporary, { recursive: true, force: true });
}
