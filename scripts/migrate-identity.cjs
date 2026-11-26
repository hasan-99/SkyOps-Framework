#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { digest, safeRelative } = require('../framework/package-store.cjs');
const ROOT = path.resolve(__dirname, '..');

function transform(text, source) {
  // Legal notices and third-party attribution are retained verbatim.
  const notices = [];
  let output = text.replace(/^.*(?:copyright|SPDX-License-Identifier|licensed under|all rights reserved).*$/gim, (line) => {
    notices.push(line); return `__SKYOPS_PRESERVED_NOTICE_${notices.length - 1}__`;
  });
  const legacyReferences = [];
  output = output.replace(/https?:\/\/[^\s<>"'`)]*qualia[^\s<>"'`)]*|qualiasolutions\.(?:net|com)|mcp__qualia[-_]erp\w*/gi, (value) => {
    legacyReferences.push(value); return `__SKYOPS_LEGACY_REFERENCE_${legacyReferences.length - 1}__`;
  });
  output = output
    .replace(/qualia-(templates|design|references|ui)/g, 'skyops-$1')
    .replace(/qualia-framework(?:-install)?/g, 'skyops')
    .replace(/erp-retry\.js/g, 'sync-queue.js')
    .replace(/erp-event\.js/g, 'development-events.js')
    .replace(/fawzi-approval-guard/g, 'approval-guard')
    .replace(/vercel-account-guard/g, 'deployment-target-guard')
    .replace(/qualia-guide\.md/g, 'skyops-guide.md')
    .replace(/skills\/qualia\//g, 'skills/sky-next/')
    .replace(/\/qualia(?=[\s`'".,:;!?)}\]|]|$)/g, '/sky-next')
    .replace(/qualia-/g, 'sky-')
    .replace(/QUALIA/g, 'SKYOPS')
    .replace(/Qualia/g, 'SkyOps')
    .replace(/qualia/g, 'skyops');
  // Domain replacements above deliberately do not invent a replacement service.
  // Legacy service/domain references remain identifiable and block distribution.
  if (source === 'skills/qualia/SKILL.md') output = output.replace(/^name: skyops$/m, 'name: sky-next');
  if (source === 'skills/deep-research/SKILL.md') output = output.replace(/^name: deep-research$/m, 'name: sky-deep-research');
  if (source === 'skills/zoho-workflow/SKILL.md') output = output.replace(/^name: zoho-workflow$/m, 'name: sky-zoho-workflow');
  if (source === 'bin/command-surface.js') output = output.replace(/"skyops"/g, '"sky-next"');
  if (/\.(?:md|html|sh)$/.test(source)) {
    output = output.replace(/C:\\Users\\hasan\\\.claude/g, '${SKYOPS_HOME}')
      .replace(/(?:~|\$HOME|\$\{HOME\})\/\.claude\//g, '${SKYOPS_HOME}/');
  }
  if (/^(?:bin|hooks)\/.*\.js$/.test(source)) {
    output = output.replace(/function skyopsHome\(\) \{[\s\S]*?^\}/m, 'function skyopsHome() {\n  return require("../framework/paths.cjs").frameworkHome();\n}');
    output = output.replace(/path\.join\((os\.homedir\(\)|HOME), (["'])\.claude\2\)/g, 'require("../framework/paths.cjs").frameworkHome()');
  }
  return output.replace(/__SKYOPS_PRESERVED_NOTICE_(\d+)__/g, (_, index) => notices[Number(index)])
    .replace(/__SKYOPS_LEGACY_REFERENCE_(\d+)__/g, (_, index) => legacyReferences[Number(index)]);
}

function migrate(apply) {
  const inventoryPath = path.join(ROOT, 'docs/audit/source-inventory.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const receiptPath = path.join(ROOT, 'docs/audit/identity-migration.json');
  if (fs.existsSync(receiptPath)) throw new Error('MIGRATION_ALREADY_RECORDED_DO_NOT_OVERWRITE_EVIDENCE');
  const operations = [];
  for (const entry of inventory.files) {
    if (!entry.target_path || entry.source_path === 'package.json' || entry.source_path.startsWith('knowledge/')) continue;
    safeRelative(entry.source_path); safeRelative(entry.target_path);
    const source = path.join(ROOT, entry.source_path);
    const target = path.join(ROOT, entry.target_path);
    if (fs.lstatSync(source).isSymbolicLink()) throw new Error('LINKED_SOURCE_REFUSED');
    const before = fs.readFileSync(source);
    if (digest(before) !== entry.sha256 && digest(Buffer.from(before.toString('utf8').replace(/\r\n/g, '\n'))) !== entry.sha256) throw new Error(`SOURCE_CHANGED_REQUIRES_REVIEW:${entry.source_path}`);
    if (source !== target && fs.existsSync(target)) throw new Error(`TARGET_ALREADY_EXISTS:${entry.target_path}`);
    const after = Buffer.from(transform(before.toString('utf8'), entry.source_path));
    operations.push({ entry, source, target, after, before_sha256: digest(before), after_sha256: digest(after) });
  }
  if (apply) {
    for (const operation of operations) {
      fs.mkdirSync(path.dirname(operation.target), { recursive: true });
      fs.writeFileSync(operation.target, operation.after);
      if (operation.source !== operation.target) fs.unlinkSync(operation.source);
      operation.entry.migration_status = 'in_progress';
      operation.entry.validation_status = 'not_run';
    }
    fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2) + '\n');
    fs.writeFileSync(receiptPath, JSON.stringify({ schema_version: 1, scope: 'Mechanical source identity/path adaptation only; functionality, domain decoupling and native host behavior remain pending', baseline_commit: inventory.baseline_commit, applied_at: new Date().toISOString(), files: operations.map((op) => ({ source_path: op.entry.source_path, target_path: op.entry.target_path, before_sha256: op.before_sha256, after_sha256: op.after_sha256, functional_parity_verified: false })) }, null, 2) + '\n');
  }
  return { apply, inspected_files: operations.length, renamed_files: operations.filter((op) => op.source !== op.target).length, changed_files: operations.filter((op) => op.before_sha256 !== op.after_sha256).length };
}

if (require.main === module) console.log(JSON.stringify(migrate(process.argv.includes('--apply'))));
module.exports = { transform };
