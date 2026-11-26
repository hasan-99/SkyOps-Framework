'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sandbox, ROOT } = require('../helpers/sandbox.cjs');
const store = require('../../framework/package-store.cjs');
const { catalog } = require('../../framework/catalog.cjs');
const { signingFixture } = require('../helpers/signing-fixture.cjs');

function fixture(t, version = '1.0.0') {
  const box = sandbox(t);
  const source = path.join(box.directory, `package-${version}`);
  const home = path.join(box.directory, 'isolated-install');
  fs.mkdirSync(source);
  fs.mkdirSync(path.join(source, 'bin'));
  fs.writeFileSync(path.join(source, 'bin/fixture.cjs'), `module.exports = ${JSON.stringify(version)};\n`);
  const manifest = { schema_version: 1, framework: 'skyops', version, release_gate: 'passed', files: { 'bin/fixture.cjs': store.digest(fs.readFileSync(path.join(source, 'bin/fixture.cjs'))) } };
  function save() {
    const content = JSON.stringify(manifest, null, 2) + '\n';
    fs.writeFileSync(path.join(source, 'skyops-release.json'), content);
    return store.digest(content);
  }
  const hash = save();
  return { ...box, source, home, manifest, save, hash, security: signingFixture(hash, version).security };
}

test('catalog lists all 29 skills and 9 specialists without importing their bodies', () => {
  const entries = catalog(ROOT);
  assert.equal(entries.filter((entry) => entry.kind === 'skill').length, 29);
  assert.equal(entries.filter((entry) => entry.kind === 'agent').length, 9);
  assert.ok(entries.filter((entry) => entry.kind === 'skill').every((entry) => entry.name.startsWith('sky-')));
  assert.ok(entries.filter((entry) => entry.kind === 'agent').every((entry) => entry.name.startsWith('sky-')));
  assert.ok(entries.every((entry) => !('body' in entry) && !('prompt' in entry)));
  assert.ok(entries.every((entry) => ['pending', 'in_progress', 'completed', 'blocked'].includes(entry.migration_status)));
});

test('private identity and help are available without an account or native coding host', (t) => {
  const box = sandbox(t);
  const identity = box.json('bin/skyops.cjs', ['identity']);
  assert.equal(identity.code, 0);
  assert.equal(identity.value.organization, 'Nexus-AI');
  assert.deepEqual(identity.value.hosts, ['claude', 'codex']);
  assert.equal(box.json('bin/skyops.cjs', ['help']).code, 0);
  const unsupported = box.run('bin/skyops.cjs', ['unsupported']);
  assert.equal(unsupported.status, 1);
  assert.equal(JSON.parse(unsupported.stderr).error, 'UNKNOWN_COMMAND_OR_INVALID_ARGUMENTS');
});

test('trusted hashes are required and unfinished source cannot be installed', (t) => {
  const box = fixture(t);
  assert.throws(() => store.install(box.source, '0'.repeat(64), box.home), /UNTRUSTED_MANIFEST_HASH/);
  assert.equal(fs.existsSync(box.home), false);
  box.manifest.release_gate = 'pending';
  assert.throws(() => store.install(box.source, box.save(), box.home), /RELEASE_GATE_NOT_PASSED/);
  assert.equal(fs.existsSync(box.home), false);
});

test('content tampering and extra payloads are rejected before installation', (t) => {
  const box = fixture(t);
  fs.writeFileSync(path.join(box.source, 'bin/fixture.cjs'), 'modified');
  assert.throws(() => store.install(box.source, box.hash, box.home), /PACKAGE_HASH_MISMATCH/);
  fs.writeFileSync(path.join(box.source, 'bin/fixture.cjs'), 'module.exports = "1.0.0";\n');
  fs.writeFileSync(path.join(box.source, 'unlisted.txt'), 'unlisted');
  assert.throws(() => store.install(box.source, box.hash, box.home), /UNLISTED_PACKAGE_CONTENT/);
  assert.equal(fs.existsSync(box.home), false);
});

test('path traversal, Windows alternate streams and case collisions are rejected', (t) => {
  const box = fixture(t);
  for (const name of ['../escape', '/absolute', 'C:/escape', 'bin\\escape', 'bin/file:stream', 'bin/CON.txt', 'bin/trailing.', 'bin//empty']) assert.throws(() => store.safeRelative(name), /UNSAFE_PACKAGE_PATH/);
  box.manifest.files['bin/FIXTURE.cjs'] = box.manifest.files['bin/fixture.cjs'];
  assert.throws(() => store.verifyPackage(box.source, box.save()), /PACKAGE_PATH_COLLISION/);
});

test('an existing unrelated directory is never adopted or changed', (t) => {
  const box = fixture(t);
  fs.mkdirSync(box.home);
  fs.writeFileSync(path.join(box.home, 'keep.txt'), 'unrelated installation');
  assert.throws(() => store.install(box.source, box.hash, box.home, box.security), /REFUSE_UNOWNED_DIRECTORY/);
  assert.equal(fs.readFileSync(path.join(box.home, 'keep.txt'), 'utf8'), 'unrelated installation');
  assert.deepEqual(fs.readdirSync(box.home), ['keep.txt']);
});

test('install, update, rollback and uninstall retain separate user data', (t) => {
  const one = fixture(t, '1.0.0');
  const two = fixture(t, '1.1.0');
  assert.equal(store.install(one.source, one.hash, one.home, one.security).version, '1.0.0');
  fs.mkdirSync(path.join(one.home, 'user-data'));
  fs.writeFileSync(path.join(one.home, 'user-data/local-state.json'), '{"private":true}');
  assert.equal(store.install(two.source, two.hash, one.home, two.security).previous, '1.0.0');
  assert.equal(store.state(one.home).active.version, '1.1.0');
  assert.equal(store.rollback(one.home, one.security).version, '1.0.0');
  assert.equal(store.state(one.home).active.version, '1.0.0');
  assert.equal(store.uninstall(one.home).user_data_preserved, true);
  assert.equal(fs.readFileSync(path.join(one.home, 'user-data/local-state.json'), 'utf8'), '{"private":true}');
  assert.equal(fs.existsSync(path.join(one.home, 'releases')), false);
  assert.equal(fs.existsSync(path.join(one.home, store.OWNER_FILE)), true);
  assert.equal(store.state(one.home).active, null);
});

test('a corrupt rollback release cannot replace the active version', (t) => {
  const one = fixture(t, '1.0.0');
  const two = fixture(t, '1.1.0');
  store.install(one.source, one.hash, one.home, one.security);
  store.install(two.source, two.hash, one.home, two.security);
  fs.writeFileSync(path.join(one.home, 'releases/1.0.0/bin/fixture.cjs'), 'tampered');
  assert.throws(() => store.rollback(one.home, one.security), /PACKAGE_HASH_MISMATCH/);
  assert.equal(store.state(one.home).active.version, '1.1.0');
});

test('concurrent lifecycle operations cannot alter active selection', (t) => {
  const one = fixture(t);
  const two = fixture(t, '1.1.0');
  store.install(one.source, one.hash, one.home, one.security);
  fs.writeFileSync(path.join(one.home, '.lifecycle.lock'), 'held');
  assert.throws(() => store.install(two.source, two.hash, one.home, two.security), /INSTALLATION_BUSY/);
  assert.throws(() => store.uninstall(one.home), /INSTALLATION_BUSY/);
  assert.equal(store.state(one.home).active.version, '1.0.0');
});

test('source changes after install do not change the installed snapshot', (t) => {
  const box = fixture(t);
  store.install(box.source, box.hash, box.home, box.security);
  fs.writeFileSync(path.join(box.source, 'bin/fixture.cjs'), 'source changed');
  const copied = path.join(box.home, 'releases/1.0.0');
  assert.equal(store.verifyPackage(copied, box.hash).manifest.version, '1.0.0');
});

test('hard-linked package files cannot be used to mutate a release indirectly', (t) => {
  const box = fixture(t);
  fs.linkSync(path.join(box.source, 'bin/fixture.cjs'), path.join(box.directory, 'hardlink.cjs'));
  assert.throws(() => store.verifyPackage(box.source, box.hash), /SPECIAL_OR_LINKED_PACKAGE_FILE/);
});

test('repeating a verified installation preserves the rollback version', (t) => {
  const one = fixture(t);
  const two = fixture(t, '1.1.0');
  store.install(one.source, one.hash, one.home, one.security);
  store.install(two.source, two.hash, one.home, two.security);
  assert.equal(store.install(two.source, two.hash, one.home, two.security).already_active, true);
  assert.equal(store.state(one.home).previous.version, '1.0.0');
});

test('an interrupted release selection recovers only a verified complete snapshot', (t) => {
  const box = fixture(t);
  store.install(box.source, box.hash, box.home, box.security);
  fs.unlinkSync(path.join(box.home, 'active.json'));
  assert.equal(store.install(box.source, box.hash, box.home, box.security).recovered_snapshot, true);
  assert.equal(store.state(box.home).active.version, '1.0.0');
});

test('linked installation roots and linked package directories cannot reach another directory', (t) => {
  const box = fixture(t);
  const outside = path.join(box.directory, 'unrelated');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'must remain unchanged');
  fs.symlinkSync(outside, box.home, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => store.install(box.source, box.hash, box.home, box.security), /LINKED_PATH_REFUSED/);
  assert.equal(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'must remain unchanged');
  fs.symlinkSync(outside, path.join(box.source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => store.verifyPackage(box.source, box.hash), /LINKED_PACKAGE_REFUSED/);
});

test('uninstall refuses a linked release tree without deleting its target', (t) => {
  const box = fixture(t);
  store.install(box.source, box.hash, box.home, box.security);
  const outside = path.join(box.directory, 'unrelated');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'must remain unchanged');
  fs.symlinkSync(outside, path.join(box.home, 'releases/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => store.uninstall(box.home), /LINKED_PACKAGE_REFUSED/);
  assert.equal(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'must remain unchanged');
  assert.equal(store.state(box.home).active.version, '1.0.0');
});
