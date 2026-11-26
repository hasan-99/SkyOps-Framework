#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const inventory = require('../docs/audit/source-inventory.json');
const patterns = [
  ['legacy_identity', /qualia/i],
  ['removed_hosting_integration', /\b(?:vercel|railway)\b/i],
  ['removed_business_infrastructure', /\bERP\b|portal\.qualiasolutions|employee[_ -](?:id|performance|monitor)/i],
  ['hardcoded_original_home', /C:\\Users\\hasan|\/(?:home|Users)\/(?:hasan|fawzi)\//i],
  ['unapproved_public_framework_distribution', /npm\s+(?:view|install\s+-g).*skyops|npx\s+skyops/],
];
const findings = [];
for (const entry of inventory.files) {
  if (!entry.target_path || entry.source_path.startsWith('knowledge/')) continue;
  const file = path.join(root, entry.target_path);
  if (!fs.existsSync(file)) { findings.push({ path: entry.target_path, category: 'missing_preserved_target', line: null }); continue; }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    if (/copyright|SPDX-License-Identifier|licensed under|all rights reserved/i.test(lines[index])) continue;
    for (const [category, regex] of patterns) if (regex.test(lines[index])) findings.push({ path: entry.target_path, line: index + 1, category, classification: 'requires_manual_contract_review' });
  }
}
const counts = Object.fromEntries(patterns.map(([category]) => [category, findings.filter((item) => item.category === category).length]));
const receipt = { schema_version: 1, timestamp: new Date().toISOString(), scope: 'Audited target paths only; metadata/line numbers, no file contents or credential values', counts, findings, gate_passed: findings.length === 0, limitation: 'Lexical surface checks; findings include documentation/comments and require contextual classification. This is not a security/parity proof.' };
fs.writeFileSync(path.join(root, 'docs/audit/runtime-surface.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ counts, findings: findings.length, gate_passed: receipt.gate_passed }));
