#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { safeRelative, digest } = require('../framework/package-store.cjs');

function credentialFindings(relative, bytes) {
  const patterns = [
    ['credential_like_token', /\b(?:sk[_-]|gh[pousr]_|github_pat_|sb_secret_)[A-Za-z0-9_-]{20,}\b/],
    ['private_key_material', /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/],
    ['jwt_literal', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
    ['credential_in_url', /https?:\/\/[^\s/"'<>]+:[^\s/"'<>]+@/i],
  ];
  const findings = [];
  bytes.toString('utf8').split(/\r?\n/).forEach((line, index) => {
    for (const [rule, expression] of patterns) if (expression.test(line)) findings.push({ path: relative, line: index + 1, rule });
  });
  return findings;
}

function readSource(root, relative) {
  safeRelative(relative);
  let current = root;
  for (const component of relative.split('/')) {
    current = path.join(current, component);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('LINKED_SOURCE_EXPORT_REFUSED');
  }
  const stat = fs.lstatSync(current);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error('NONREGULAR_SOURCE_EXPORT_REFUSED');
  return fs.readFileSync(current);
}

function snapshot(sourceRoot, destination, options = {}) {
  sourceRoot = path.resolve(sourceRoot);
  destination = path.resolve(destination);
  if (fs.existsSync(destination)) throw new Error('SOURCE_EXPORT_DESTINATION_MUST_NOT_EXIST');
  if (destination === sourceRoot || sourceRoot.startsWith(destination + path.sep)) throw new Error('UNSAFE_SOURCE_EXPORT_DESTINATION');
  const inventory = options.inventory || JSON.parse(readSource(sourceRoot, 'docs/audit/source-inventory.json'));
  const review = options.genericReview || JSON.parse(readSource(sourceRoot, 'docs/audit/generic-knowledge-adaptation.json'));
  const syntheticReviewPath = path.join(sourceRoot, 'docs/audit/source-export-synthetic-fixtures.json');
  const syntheticReview = options.syntheticReview || (fs.existsSync(syntheticReviewPath) ? JSON.parse(readSource(sourceRoot, 'docs/audit/source-export-synthetic-fixtures.json')).entries : []);
  const generic = new Map(review.files.map((file) => [file.path, file.after_sha256]));
  const excluded = new Set(inventory.files.filter((file) => !file.target_path).map((file) => file.source_path));
  const candidates = new Set(inventory.files.filter((file) => file.target_path).map((file) => file.target_path));
  const assets = path.join(sourceRoot, 'framework/runtime-assets.json');
  if (fs.existsSync(assets)) for (const name of JSON.parse(readSource(sourceRoot, 'framework/runtime-assets.json')).files) candidates.add(name);
  const addDirectory = (relative) => {
    const directory = path.join(sourceRoot, relative);
    if (!fs.existsSync(directory)) return;
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('LINKED_SOURCE_EXPORT_REFUSED');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error('LINKED_SOURCE_EXPORT_REFUSED');
      if (entry.isDirectory()) addDirectory(name);
      else if (entry.isFile()) candidates.add(name);
    }
  };
  for (const directory of ['framework', 'tests', 'scripts', 'docs', '.github']) addDirectory(directory);
  for (const name of ['AGENTS.md', 'CLAUDE.md', 'SKYOPS_TRANSFORMATION_PLAN.md', 'package.json', '.gitignore']) if (fs.existsSync(path.join(sourceRoot, name))) candidates.add(name);
  const files = {};
  const rejected = [];
  const findings = [];
  for (const relative of [...candidates].sort()) {
    safeRelative(relative);
    if (relative === 'docs/audit/private-source-export.json') continue; // local snapshot pointer changes after copying
    const privatePath = /^(?:\.git|\.skyops-dev-tools|node_modules|profiles|sessions|config|cache|backups|file-history)(?:\/|$)|(?:^|\/)(?:auth\.json|credentials[^/]*|[^/]*\.(?:key|pem|pyc))$|(?:^|\/)__pycache__(?:\/|$)|(?:^|\/)\.env(?:\.[^/]*)?$/i.test(relative);
    if (excluded.has(relative) || privatePath || (relative.startsWith('knowledge/') && !generic.has(relative))) {
      rejected.push({ path: relative, reason: 'Excluded/private/unreviewed source category' });
      continue;
    }
    const bytes = readSource(sourceRoot, relative);
    if (relative.startsWith('knowledge/') && generic.get(relative) !== digest(bytes)) throw new Error('GENERIC_KNOWLEDGE_REVIEW_HASH_MISMATCH');
    findings.push(...credentialFindings(relative, bytes));
    files[relative] = bytes;
  }
  const unreviewed = findings.filter((finding) => !syntheticReview.some((entry) => entry.path === finding.path && entry.rule === finding.rule && entry.line_sha256 === digest(files[finding.path].toString('utf8').split(/\r?\n/)[finding.line - 1])));
  if (unreviewed.length) {
    const error = new Error('SOURCE_EXPORT_CREDENTIAL_REVIEW_REQUIRED');
    error.findings = unreviewed;
    throw error;
  }
  // All reads and checks precede the first destination write. This is a fresh
  // source snapshot, never an original Git-history push or a user installation.
  fs.mkdirSync(destination, { recursive: false, mode: 0o700 });
  const hashes = {};
  for (const [relative, bytes] of Object.entries(files)) {
    const target = path.join(destination, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
    hashes[relative] = digest(bytes);
  }
  const receipt = {
    schema_version: 1, created_at: new Date().toISOString(), purpose: 'Private owner development source snapshot only',
    original_git_history_included: false, original_private_history_included: false,
    credential_pattern_findings: findings.length, unreviewed_credential_pattern_findings: 0, reviewed_synthetic_fixture_findings: findings.length, files: hashes, excluded: rejected,
    source_files: Object.keys(hashes).length, production_release: false, phase_gate_passed: false,
    limitation: 'Allowlist/known-pattern checks and reviewed seed hashes are not a complete DLP, third-party clearance, signed-release or production-readiness proof. Tests and review remain required before distribution.',
  };
  fs.writeFileSync(path.join(destination, 'source-snapshot.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { destination, receipt };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'skyops-private-source-'));
  try {
    const result = snapshot(root, path.join(parent, 'repository'));
    fs.writeFileSync(path.join(root, 'docs/audit/private-source-export.json'), JSON.stringify({ ...result.receipt, destination: result.destination }, null, 2) + '\n');
    console.log(JSON.stringify({ destination: result.destination, source_files: result.receipt.source_files, source_uploaded: false, production_release: false }));
  } catch (error) {
    console.error(JSON.stringify({ error: error.code || error.message, findings: error.findings || [], destination_created: fs.existsSync(path.join(parent, 'repository')) }));
    process.exitCode = 1;
  }
}

module.exports = { snapshot, credentialFindings };
