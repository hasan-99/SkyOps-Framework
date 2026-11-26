'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { authorizeInstallation, authorizeRollback } = require('./install-authorization.cjs');

const OWNER_FILE = '.skyops-framework-owner.json';
const OWNER = { schema_version: 1, owner: 'Nexus-AI', product: 'skyops-framework', isolated: true };
const INDEX_FILE = 'installed-releases.json';
const CONSENT_FILE = 'deprovisioning-consent.json';
const CONSENT_TEXT = 'On confirmed permanent license revocation, disable SkyOps and run its official uninstaller to remove only verified SkyOps-owned unchanged installation components. Preserve projects, generated applications, source code, personal data, coding hosts, unrelated files and frameworks. Connectivity/authentication/service errors never trigger removal.';
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = (code) => { throw new Error(code); };

function safeRelative(value) {
  if (typeof value !== 'string' || !value || /[\\:<>"|?*\x00-\x1f]/.test(value) || value.startsWith('/') || value.split('/').some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) fail('UNSAFE_PACKAGE_PATH');
  return value;
}

function noLinks(absolute) {
  let cursor = path.parse(path.resolve(absolute)).root;
  for (const part of path.resolve(absolute).slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) fail('LINKED_PATH_REFUSED');
  }
}

function atomicJSON(file, value) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  try { fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

function validateHome(home, create = false) {
  const absolute = path.resolve(home);
  if (absolute === path.parse(absolute).root || absolute === path.resolve(os.homedir())) fail('UNSAFE_INSTALL_ROOT');
  noLinks(absolute);
  const marker = path.join(absolute, OWNER_FILE);
  if (!fs.existsSync(absolute)) {
    if (!create) fail('NOT_AN_OWNED_INSTALLATION');
    fs.mkdirSync(absolute, { recursive: true, mode: 0o700 });
    atomicJSON(marker, OWNER);
  } else if (!fs.existsSync(marker)) {
    // Even an empty pre-existing directory requires explicit separate ownership.
    fail('REFUSE_UNOWNED_DIRECTORY');
  }
  noLinks(marker);
  if (JSON.stringify(JSON.parse(fs.readFileSync(marker, 'utf8'))) !== JSON.stringify(OWNER)) fail('INVALID_INSTALLATION_OWNER');
  return absolute;
}

function walk(directory, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    safeRelative(relative);
    if (entry.isSymbolicLink()) fail('LINKED_PACKAGE_REFUSED');
    if (entry.isDirectory()) files.push(...walk(path.join(directory, entry.name), relative + '/'));
    else if (entry.isFile()) files.push(relative);
    else fail('SPECIAL_PACKAGE_FILE_REFUSED');
  }
  return files.sort();
}

function verifyPackage(directory, expectedManifestHash) {
  const root = path.resolve(directory);
  noLinks(root);
  const manifestPath = path.join(root, 'skyops-release.json');
  noLinks(manifestPath);
  const bytes = fs.readFileSync(manifestPath);
  if (!/^[a-f0-9]{64}$/.test(expectedManifestHash || '') || digest(bytes) !== expectedManifestHash) fail('UNTRUSTED_MANIFEST_HASH');
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.schema_version !== 1 || manifest.framework !== 'skyops' || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(manifest.version || '')) fail('INVALID_RELEASE_IDENTITY');
  if (manifest.release_gate !== 'passed') fail('RELEASE_GATE_NOT_PASSED');
  if (!manifest.files || Array.isArray(manifest.files) || typeof manifest.files !== 'object' || !Object.keys(manifest.files).length) fail('EMPTY_RELEASE');
  const names = Object.keys(manifest.files).sort();
  const folded = new Set();
  for (const name of names) {
    safeRelative(name);
    if (name === 'skyops-release.json' || folded.has(name.toLowerCase())) fail('PACKAGE_PATH_COLLISION');
    folded.add(name.toLowerCase());
    if (!/^[a-f0-9]{64}$/.test(manifest.files[name])) fail('INVALID_FILE_HASH');
  }
  // Validate all metadata before touching payload paths. On case-sensitive
  // hosts the first case-colliding spelling may not be an existing file.
  for (const name of names) {
    noLinks(path.join(root, name));
    const stat = fs.statSync(path.join(root, name));
    if (!stat.isFile() || stat.nlink !== 1) fail('SPECIAL_OR_LINKED_PACKAGE_FILE');
    if (digest(fs.readFileSync(path.join(root, name))) !== manifest.files[name]) fail('PACKAGE_HASH_MISMATCH');
  }
  const actual = walk(root).filter((name) => name !== 'skyops-release.json');
  if (JSON.stringify(actual) !== JSON.stringify(names)) fail('UNLISTED_PACKAGE_CONTENT');
  return { manifest, manifest_sha256: expectedManifestHash };
}

function withLock(home, operation) {
  const lock = path.join(home, '.lifecycle.lock');
  noLinks(lock);
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') fail('INSTALLATION_BUSY'); throw error; }
  try { return operation(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

function state(home) {
  const file = path.join(home, 'active.json');
  noLinks(file);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { active: null, previous: null };
}

function releasePath(home, version) {
  if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(version || '')) fail('INVALID_RELEASE_VERSION');
  const target = path.join(home, 'releases', version);
  noLinks(target);
  return target;
}

function installedIndex(home) {
  const file = path.join(home, INDEX_FILE);
  noLinks(file);
  if (!fs.existsSync(file)) return { schema_version: 1, releases: {} };
  const index = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (index.schema_version !== 1 || !index.releases || typeof index.releases !== 'object' || Array.isArray(index.releases)) fail('INVALID_OWNED_RELEASE_INDEX');
  return index;
}

function selectRelease(home, checked, prior, security, authorization) {
  const version = checked.manifest.version;
  const index = installedIndex(home);
  index.releases[version] = { manifest_sha256: checked.manifest_sha256, files: checked.manifest.files };
  atomicJSON(path.join(home, INDEX_FILE), index);
  if (!prior.active && security.deprovisioning_consent?.accepted === true) {
    if (security.deprovisioning_consent.policy_version !== 1) fail('UNKNOWN_DEPROVISIONING_POLICY');
    const file = path.join(home, CONSENT_FILE);
    noLinks(file);
    atomicJSON(file, { schema_version: 1, policy_version: 1, policy_sha256: digest(CONSENT_TEXT), accepted: true, user_id: security.context.user_id, device_id: security.context.device_id, accepted_at: security.context.now });
  }
  atomicJSON(path.join(home, 'active.json'), { schema_version: 1, active: { version, manifest_sha256: checked.manifest_sha256, release_sequence: authorization.release_sequence }, previous: prior.active });
}

function install(directory, expectedHash, requestedHome, security) {
  // Verify before creating or mutating installation directories.
  const checked = verifyPackage(directory, expectedHash);
  const authorization = authorizeInstallation(checked, security);
  const home = validateHome(requestedHome, true);
  return withLock(home, () => {
    const prior = state(home);
    const destination = releasePath(home, checked.manifest.version);
    if (fs.existsSync(destination)) {
      // A process may have stopped after copying a release but before selection.
      // Recover only if the existing snapshot matches the trusted manifest.
      verifyPackage(destination, expectedHash);
      if (prior.active?.version === checked.manifest.version && prior.active?.manifest_sha256 === expectedHash) return { home, version: checked.manifest.version, previous: prior.previous?.version || null, already_active: true };
      selectRelease(home, checked, prior, security, authorization);
      return { home, version: checked.manifest.version, previous: prior.active?.version || null, recovered_snapshot: true };
    }
    const stage = path.join(home, `.stage-${crypto.randomUUID()}`);
    fs.mkdirSync(stage, { mode: 0o700 });
    try {
      for (const name of ['skyops-release.json', ...Object.keys(checked.manifest.files)]) {
        const target = path.join(stage, name);
        fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
        fs.copyFileSync(path.join(directory, name), target, fs.constants.COPYFILE_EXCL);
      }
      verifyPackage(stage, expectedHash);
      fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      fs.renameSync(stage, destination);
      selectRelease(home, checked, prior, security, authorization);
      return { home, version: checked.manifest.version, previous: prior.active?.version || null };
    } finally {
      // This UUID directory is constructed under a verified owned root only.
      if (path.dirname(stage) !== home) fail('UNSAFE_STAGE_CLEANUP');
      if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true });
    }
  });
}

function rollback(requestedHome, security) {
  const home = validateHome(requestedHome);
  return withLock(home, () => {
    const prior = state(home);
    if (!prior.previous) fail('NO_PREVIOUS_RELEASE');
    const checked = verifyPackage(releasePath(home, prior.previous.version), prior.previous.manifest_sha256);
    authorizeRollback(checked, security);
    atomicJSON(path.join(home, 'active.json'), { schema_version: 1, active: prior.previous, previous: prior.active });
    return { version: prior.previous.version, previous: prior.active?.version || null };
  });
}

function uninstall(requestedHome) {
  const home = validateHome(requestedHome);
  return withLock(home, () => {
    const releases = path.join(home, 'releases');
    noLinks(releases);
    // Never recursively delete a release tree: it may contain user-added files.
    // Preflight all receipts/paths before removing any verified owned component.
    if (fs.existsSync(releases)) walk(releases);
    const index = installedIndex(home);
    const active = path.join(home, 'active.json');
    noLinks(active);
    let ownedActive = false;
    if (fs.existsSync(active)) {
      try {
        const selection = JSON.parse(fs.readFileSync(active, 'utf8'));
        ownedActive = selection.schema_version === 1 && Object.keys(selection).sort().join(',') === 'active,previous,schema_version' && selection.active && index.releases[selection.active.version]?.manifest_sha256 === selection.active.manifest_sha256;
      } catch { /* Unknown/modified metadata is retained, not deleted. */ }
    }
    const removals = [];
    const retained = [];
    for (const [version, receipt] of Object.entries(index.releases)) {
      const directory = releasePath(home, version);
      if (!receipt.files || typeof receipt.files !== 'object' || Array.isArray(receipt.files) || !/^[a-f0-9]{64}$/.test(receipt.manifest_sha256 || '')) fail('INVALID_OWNED_RELEASE_RECEIPT');
      const names = { ...receipt.files, 'skyops-release.json': receipt.manifest_sha256 };
      for (const [name, hash] of Object.entries(names)) {
        safeRelative(name);
        if (!/^[a-f0-9]{64}$/.test(hash)) fail('INVALID_OWNED_FILE_HASH');
        const file = path.join(directory, name);
        noLinks(file);
        if (!fs.existsSync(file)) continue;
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.nlink !== 1 || digest(fs.readFileSync(file)) !== hash) retained.push(path.relative(home, file));
        else removals.push(file);
      }
    }
    for (const file of removals) fs.unlinkSync(file);
    const ownedParents = new Set();
    for (const file of removals) {
      let directory = path.dirname(file);
      while (directory.startsWith(releases + path.sep)) { ownedParents.add(directory); directory = path.dirname(directory); }
    }
    for (const directory of [...ownedParents].sort((a, b) => b.length - a.length)) if (fs.existsSync(directory) && !fs.readdirSync(directory).length) fs.rmdirSync(directory);
    if (fs.existsSync(releases) && !fs.readdirSync(releases).length) fs.rmdirSync(releases);
    if (ownedActive) fs.unlinkSync(active);
    else if (fs.existsSync(active)) retained.push('active.json');
    return { home, uninstalled: true, user_data_preserved: true, removed_owned_files: removals.length, retained_modified_files: retained };
  });
}

function deprovision(requestedHome, statusToken, trust, context, requestChallenge) {
  const { verifyStatus } = require('./license-runtime.cjs');
  const status = verifyStatus(statusToken, trust, context, requestChallenge);
  if (status.state !== 'revoked' || status.permanent !== true) return { execution_disabled: status.state !== 'active', uninstalled: false, reason: 'NO_CONFIRMED_PERMANENT_REVOCATION' };
  const home = validateHome(requestedHome);
  const file = path.join(home, CONSENT_FILE);
  noLinks(file);
  if (!fs.existsSync(file)) return { execution_disabled: true, uninstalled: false, reason: 'INSTALLATION_CONSENT_REQUIRED' };
  const consent = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (consent.accepted !== true || consent.policy_version !== 1 || consent.policy_sha256 !== digest(CONSENT_TEXT) || consent.user_id !== context.user_id || consent.device_id !== context.device_id || !Number.isSafeInteger(consent.accepted_at)) return { execution_disabled: true, uninstalled: false, reason: 'INSTALLATION_CONSENT_INVALID' };
  try { return { ...uninstall(home), execution_disabled: true, reason: 'CONFIRMED_PERMANENT_REVOCATION_WITH_CONSENT' }; }
  catch (error) { return { execution_disabled: true, uninstalled: false, reason: 'SAFE_UNINSTALL_REFUSED', error: error.code || error.message }; }
}

module.exports = { OWNER_FILE, OWNER, CONSENT_FILE, CONSENT_TEXT, digest, safeRelative, validateHome, verifyPackage, install, rollback, uninstall, deprovision, state };
