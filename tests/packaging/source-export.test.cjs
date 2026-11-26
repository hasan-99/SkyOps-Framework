'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { snapshot } = require('../../scripts/export-private-source.cjs');
const { digest } = require('../../framework/package-store.cjs');
const { sandbox } = require('../helpers/sandbox.cjs');

function fixture(t) {
  const box = sandbox(t);
  const source = path.join(box.directory, 'source');
  fs.mkdirSync(path.join(source, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(source, 'bin/example.cjs'), 'module.exports = 42;\n');
  return { ...box, source, destination: path.join(box.directory, 'export'), options: { inventory: { files: [{ source_path: 'bin/example.cjs', target_path: 'bin/example.cjs' }] }, genericReview: { files: [] }, syntheticReview: [] } };
}

test('fresh source snapshots omit original history, excluded documents and private configuration', (t) => {
  const box = fixture(t);
  fs.mkdirSync(path.join(box.source, '.git'));
  fs.writeFileSync(path.join(box.source, '.git/history'), 'private fixture history');
  fs.mkdirSync(path.join(box.source, 'docs'));
  fs.writeFileSync(path.join(box.source, 'docs/original-business-contract.md'), 'excluded fixture');
  box.options.inventory.files.push({ source_path: 'docs/original-business-contract.md', target_path: null });
  fs.writeFileSync(path.join(box.source, '.env'), 'PRIVATE_FIXTURE=true');
  box.options.inventory.files.push({ source_path: '.env', target_path: '.env' });
  const result = snapshot(box.source, box.destination, box.options);
  assert.equal(result.receipt.source_files, 1);
  assert.equal(fs.existsSync(path.join(box.destination, '.git')), false);
  assert.equal(fs.existsSync(path.join(box.destination, '.env')), false);
  assert.equal(fs.existsSync(path.join(box.destination, 'docs/original-business-contract.md')), false);
  assert.equal(fs.readFileSync(path.join(box.destination, 'bin/example.cjs'), 'utf8'), 'module.exports = 42;\n');
  assert.throws(() => snapshot(box.source, box.destination, box.options), /DESTINATION_MUST_NOT_EXIST/);
});

test('credential findings stop export before writing and never expose matched values', (t) => {
  const box = fixture(t);
  const token = 'sk' + '_' + 'x'.repeat(40);
  fs.writeFileSync(path.join(box.source, 'bin/example.cjs'), `const forbidden = '${token}';\n`);
  assert.throws(() => snapshot(box.source, box.destination, box.options), (error) => {
    assert.equal(error.message, 'SOURCE_EXPORT_CREDENTIAL_REVIEW_REQUIRED');
    assert.deepEqual(error.findings, [{ path: 'bin/example.cjs', line: 1, rule: 'credential_like_token' }]);
    assert.equal(JSON.stringify(error).includes(token), false);
    return true;
  });
  assert.equal(fs.existsSync(box.destination), false);
});

test('synthetic test exceptions require exact reviewed content, path and rule', (t) => {
  const box = fixture(t);
  const line = "const invalid = 'https://fixture-user:fixture-password@example.invalid/repo';";
  fs.writeFileSync(path.join(box.source, 'bin/example.cjs'), line + '\n');
  box.options.syntheticReview = [{ path: 'bin/example.cjs', rule: 'credential_in_url', line_sha256: digest(line) }];
  const allowed = snapshot(box.source, box.destination, box.options);
  assert.equal(allowed.receipt.reviewed_synthetic_fixture_findings, 1);
  fs.writeFileSync(path.join(box.source, 'bin/example.cjs'), line.replace('fixture-password', 'different-fixture-password') + '\n');
  assert.throws(() => snapshot(box.source, path.join(box.directory, 'changed-export'), box.options), /CREDENTIAL_REVIEW_REQUIRED/);
});

test('linked source and knowledge changed after privacy review cannot be exported', (t) => {
  const box = fixture(t);
  const file = path.join(box.source, 'bin/example.cjs');
  const original = path.join(box.directory, 'outside.cjs');
  fs.renameSync(file, original);
  fs.linkSync(original, file);
  assert.throws(() => snapshot(box.source, box.destination, box.options), /NONREGULAR_SOURCE_EXPORT_REFUSED/);
  fs.unlinkSync(file);
  fs.writeFileSync(file, 'module.exports = 42;\n');
  fs.mkdirSync(path.join(box.source, 'knowledge'));
  fs.writeFileSync(path.join(box.source, 'knowledge/index.md'), 'changed fixture knowledge');
  box.options.inventory.files.push({ source_path: 'knowledge/index.md', target_path: 'knowledge/index.md' });
  box.options.genericReview.files.push({ path: 'knowledge/index.md', after_sha256: digest('reviewed fixture knowledge') });
  assert.throws(() => snapshot(box.source, box.destination, box.options), /GENERIC_KNOWLEDGE_REVIEW_HASH_MISMATCH/);
});
