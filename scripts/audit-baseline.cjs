#!/usr/bin/env node
'use strict';

// Metadata-only inventory of the approved immutable baseline. Never exports file contents.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = '0cd3dd5c903767de55c86d3661ad36148307afd8';
const OUTPUT = path.join(ROOT, 'docs', 'audit');
const RENAMES = new Map([
  ['bin/qualia-ui.js', 'bin/skyops-ui.js'],
  ['bin/erp-retry.js', 'bin/sync-queue.js'],
  ['bin/erp-event.js', 'bin/development-events.js'],
  ['hooks/fawzi-approval-guard.js', 'hooks/approval-guard.js'],
  ['hooks/vercel-account-guard.js', 'hooks/deployment-target-guard.js'],
  ['qualia-guide.md', 'skyops-guide.md'],
]);

function targetPath(source) {
  if (RENAMES.has(source)) return RENAMES.get(source);
  return source
    .replace(/^qualia-(design|templates|references)\//, 'skyops-$1/')
    .replace(/^skills\/qualia\//, 'skills/sky-next/')
    .replace(/^skills\/qualia-/, 'skills/sky-')
    .replace(/^skills\/deep-research\//, 'skills/sky-deep-research/')
    .replace(/^skills\/zoho-workflow\//, 'skills/sky-zoho-workflow/');
}

function disposition(source, type) {
  if (type === 'commit') return ['approved_exclusion', 'unpopulated_third_party_submodule', null];
  if (/^knowledge\/daily-log\//.test(source) || /^knowledge\/(client-prefs\.md|deployment-map\.md|email-signature\.html|\.claude\.lnk)$/.test(source)) {
    return ['approved_exclusion', 'original_private_history_or_installation_data', null];
  }
  if (/^teams\/.*\/inboxes\//.test(source)) return ['approved_exclusion', 'historical_session_payload', null];
  if (/^\.qualia-/.test(source) || source === '.last-cleanup' || source === 'plugins/known_marketplaces.json') {
    return ['approved_exclusion', 'regenerate_clean_skyops_installation_state', null];
  }
  if (/CLAUDE\.md\.bak\./.test(source) || source.includes('__pycache__/') || source.endsWith('.bypass')) {
    return ['approved_exclusion', 'historical_or_generated_artifact_not_active_runtime', null];
  }
  if (source.startsWith('knowledge/')) return ['preserved', 'generic_knowledge_requires_content_review', targetPath(source)];
  return ['preserved', 'retain_capability_and_adapt_approved_identity_and_infrastructure', targetPath(source)];
}

function readTree() {
  const raw = execFileSync('git', ['ls-tree', '-rz', '--full-tree', BASELINE], { cwd: ROOT });
  return raw.toString('utf8').split('\0').filter(Boolean).map((line) => {
    const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(line);
    if (!match) throw new Error('Unexpected Git tree entry');
    return { mode: match[1], type: match[2], git_object: match[3], source_path: match[4] };
  });
}

function readBlobs(entries) {
  const objects = entries.filter((entry) => entry.type === 'blob');
  const raw = execFileSync('git', ['cat-file', '--batch'], {
    cwd: ROOT, input: objects.map((entry) => entry.git_object).join('\n') + '\n', maxBuffer: 32 * 1024 * 1024,
  });
  const blobs = new Map();
  let offset = 0;
  for (const entry of objects) {
    const end = raw.indexOf(10, offset);
    const header = raw.subarray(offset, end).toString('ascii').split(' ');
    if (header[0] !== entry.git_object || header[1] !== 'blob') throw new Error('Git blob identity mismatch');
    const size = Number(header[2]);
    const body = raw.subarray(end + 1, end + 1 + size);
    if (body.length !== size || raw[end + 1 + size] !== 10) throw new Error('Truncated Git blob');
    blobs.set(entry.source_path, body);
    offset = end + 2 + size;
  }
  return blobs;
}

function category(source) {
  if (/^skills\/[^/]+\/SKILL\.md$/.test(source)) return 'skill';
  if (source.startsWith('agents/')) return 'agent';
  if (source.startsWith('bin/')) return 'runtime_helper';
  if (source.startsWith('hooks/')) return 'hook';
  if (source.startsWith('qualia-templates/')) return 'template';
  if (source.startsWith('qualia-design/')) return 'design';
  if (source.startsWith('rules/')) return 'rule';
  if (source.startsWith('skills/')) return 'internal_skill_resource';
  if (source.startsWith('scripts/')) return 'automation';
  if (source.startsWith('knowledge/')) return 'knowledge';
  return 'documentation_or_configuration';
}

function createInventory() {
  const entries = readTree();
  const blobs = readBlobs(entries);
  const files = entries.map((entry) => {
    const body = blobs.get(entry.source_path);
    const [classification, reason, target] = disposition(entry.source_path, entry.type);
    return {
      ...entry,
      bytes: body ? body.length : null,
      sha256: body ? crypto.createHash('sha256').update(body).digest('hex') : null,
      category: category(entry.source_path), classification, disposition_reason: reason,
      target_path: target, inventory_status: 'verified_against_git_tree',
      migration_status: 'pending', validation_status: 'not_run',
      required_actions: /scripts\/voice-(hotkey\.py|input\.sh)$/.test(entry.source_path)
        ? ['remove_credential_fallback_without_copying_value', 'retain_optional_linux_voice_behavior'] : [],
    };
  });
  const capabilities = files.filter((file) => file.classification !== 'approved_exclusion').map((file) => {
    const source = file.source_path;
    const body = blobs.get(source).toString('utf8');
    const headings = /\.(md|html)$/.test(source) && !source.startsWith('knowledge/')
      ? [...body.matchAll(/^#{1,4} ([^\r\n]+)$/gm)].map((match) => match[1]).filter((heading) => !heading.startsWith('If ')).slice(0, 160) : [];
    return {
      id: `${file.category}:${source}`, category: file.category, classification: 'preserved',
      original_implementation: [source], new_implementation: [file.target_path],
      source_hash: file.sha256, source_subsections: headings,
      flag_tokens: source.startsWith('skills/') ? [...new Set(body.match(/--[a-z][a-z0-9-]*/g) || [])].sort() : [],
      flag_inventory_kind: 'lexical_tokens_include_underlying_cli_options_require_contract_review',
      migration_status: 'pending', validation_status: 'not_run', evidence: [], remaining_issues: ['Target implementation and scenario validation pending'],
    };
  });
  const additional = [
    ['reconstructed', 'installer', ['bin/install.js', 'bin/uninstall.js']],
    ['reconstructed', 'main-cli', ['bin/skyops.js']],
    ['reconstructed', 'instruction-compiler', ['bin/compile-instructions.js']],
    ['reconstructed', 'memory-mcp', ['mcp/skyops/server.mjs']],
    ['reconstructed', 'framework-tests', ['tests/']],
    ['new_requirement', 'multi-tenant-authorization', ['supabase/migrations/', 'lib/authorization.js']],
    ['new_requirement', 'account-lifecycle-administration', ['lib/auth.js', 'supabase/migrations/']],
    ['new_requirement', 'authorized-semantic-search', ['lib/search.js', 'lib/embeddings.js']],
    ['new_requirement', 'offline-conflict-aware-sync', ['lib/sync.js', 'lib/conflicts.js']],
    ['new_requirement', 'adaptive-depth-and-budgets', ['lib/context.js', 'lib/config.js']],
    ['new_requirement', 'onboarding-and-device-restoration', ['bin/skyops.js', 'lib/auth.js']],
  ].map(([classification, id, targets]) => ({
    id, category: classification, classification, original_implementation: [], new_implementation: targets,
    migration_status: 'pending', validation_status: 'not_run', evidence: [], remaining_issues: ['Not implemented or validated'],
  }));
  const inventory = {
    schema_version: 1, baseline_commit: BASELINE,
    privacy: 'Metadata and hashes only. No private file contents, credential values or original user history exported.',
    counts: { entries: files.length, files: files.filter((file) => file.type === 'blob').length, gitlinks: files.filter((file) => file.type === 'commit').length }, files,
  };
  const parity = {
    schema_version: 1, authority: 'SKYOPS_TRANSFORMATION_PLAN.md', baseline_commit: BASELINE,
    status_note: 'Inventory coverage is not functional parity. Baseline test evidence is separate from migrated target verification.',
    approved_exclusions: ['ERP and portal', 'employee performance monitoring', 'Vercel and Railway integrations', 'original private history and credentials', 'generated caches and old installation state'],
    capabilities: [...capabilities, ...additional],
  };
  return { inventory, parity };
}

function main() {
  const { inventory, parity } = createInventory();
  if (process.argv.includes('--write')) {
    const destinations = ['source-inventory.json', 'capability-parity.json'].map((name) => path.join(OUTPUT, name));
    if (destinations.some((file) => fs.existsSync(file))) throw new Error('Baseline records already exist; refusing to overwrite migration evidence');
    fs.mkdirSync(OUTPUT, { recursive: true });
    fs.writeFileSync(destinations[0], JSON.stringify(inventory, null, 2) + '\n');
    fs.writeFileSync(destinations[1], JSON.stringify(parity, null, 2) + '\n');
  }
  console.log(JSON.stringify({ baseline_commit: BASELINE, ...inventory.counts, capabilities: parity.capabilities.length, written: process.argv.includes('--write') }));
}

module.exports = { BASELINE, ROOT, targetPath, disposition, readTree, readBlobs, createInventory };
if (require.main === module) main();
