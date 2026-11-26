#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { digest } = require('../framework/package-store.cjs');
const root = path.resolve(__dirname, '..');
const inventory = require('../docs/audit/source-inventory.json');
const edits = [];
for (const entry of inventory.files) {
  if (!entry.target_path || entry.source_path.startsWith('knowledge/') || entry.source_path === 'package.json') continue;
  const target = path.join(root, entry.target_path);
  const before = fs.readFileSync(target, 'utf8');
  let after = before.replace(/\.sky-(?=[a-z])/g, '.skyops-');
  if (/^(?:bin|hooks)\/.*\.js$/.test(entry.target_path)) after = after.replace(/function skyopsHome\([^\n]*\) \{[\s\S]*?^\}/m, 'function skyopsHome() {\n  return require("../framework/paths.cjs").frameworkHome();\n}');
  if (after !== before) {
    fs.writeFileSync(target, after);
    edits.push({ target_path: entry.target_path, before_sha256: digest(before), after_sha256: digest(after) });
  }
}
if (edits.length) {
  const receipt = path.join(root, 'docs/audit/runtime-isolation-repairs.json');
  const prior = fs.existsSync(receipt) ? JSON.parse(fs.readFileSync(receipt, 'utf8')) : { schema_version: 1, batches: [] };
  prior.batches.push({ applied_at: new Date().toISOString(), edits });
  fs.writeFileSync(receipt, JSON.stringify(prior, null, 2) + '\n');
}
console.log(JSON.stringify({ adapted_files: edits.length, scope: 'Isolated framework home and internal configuration namespace; no unrelated installation paths inspected or changed' }));
