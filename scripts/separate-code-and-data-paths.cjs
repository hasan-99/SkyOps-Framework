#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { digest } = require('../framework/package-store.cjs');
const root = path.resolve(__dirname, '..');
const inventory = require('../docs/audit/source-inventory.json');
const changes = [];
for (const entry of inventory.files) {
  if (!entry.target_path || !/^(?:bin|hooks)\/.*\.js$/.test(entry.target_path)) continue;
  const file = path.join(root, entry.target_path);
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(/path\.join\(SKYOPS_HOME,\s*(["'])(bin|rules|skyops-templates|skyops-design|skyops-references|skills|agents)\1/g, 'path.join(require("../framework/paths.cjs").codeRoot(), "$2"');
  if (after !== before) { fs.writeFileSync(file, after); changes.push({ path: entry.target_path, before_sha256: digest(before), after_sha256: digest(after) }); }
}
if (changes.length) fs.writeFileSync(path.join(root, 'docs/audit/code-data-path-adaptation.json'), JSON.stringify({ schema_version: 1, timestamp: new Date().toISOString(), scope: 'Versioned immutable code/resources separate from persistent owned user installation data', changes }, null, 2) + '\n');
console.log(JSON.stringify({ changed_files: changes.length }));
