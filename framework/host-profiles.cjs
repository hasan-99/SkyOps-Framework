'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateHome, safeRelative, digest } = require('./package-store.cjs');

function contained(home, relative) {
  safeRelative(relative);
  const target = path.resolve(home, relative);
  if (!target.startsWith(path.resolve(home) + path.sep)) throw new Error('PROFILE_PATH_ESCAPE');
  let current = home;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('LINKED_PROFILE_REFUSED');
  }
  return target;
}

function profilePaths(requestedHome, host) {
  if (!['claude', 'codex'].includes(host)) throw new Error('UNSUPPORTED_HOST');
  const home = validateHome(requestedHome);
  return { home, host, directory: contained(home, `profiles/${host}`), native: contained(home, `profiles/${host}/native`), user: contained(home, `profiles/${host}/user`) };
}

function environment(requestedHome, host, inherited = process.env) {
  const profile = profilePaths(requestedHome, host);
  const env = {};
  const names = ['PATH', 'PATHEXT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'TERM', 'COLORTERM', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS'];
  for (const name of names) for (const [key, value] of Object.entries(inherited)) if (key.toLowerCase() === name.toLowerCase()) env[key] = value;
  // Scoped child-process home/config, never the user's actual/global profile.
  Object.assign(env, {
    SKYOPS_HOME: profile.home, SKYOPS_HOST: host,
    HOME: profile.user, USERPROFILE: profile.user,
    APPDATA: path.join(profile.user, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(profile.user, 'AppData', 'Local'),
    XDG_CONFIG_HOME: path.join(profile.user, '.config'), XDG_CACHE_HOME: path.join(profile.user, '.cache'), XDG_DATA_HOME: path.join(profile.user, '.local', 'share'),
    CLAUDE_CONFIG_DIR: contained(profile.home, `profiles/${host}/claude-config`),
    CODEX_HOME: contained(profile.home, `profiles/${host}/codex-config`),
  });
  if (host === 'claude') env.CLAUDE_CONFIG_DIR = profile.native;
  else env.CODEX_HOME = profile.native;
  return env;
}

function prepare(requestedHome, host, compilation) {
  const profile = profilePaths(requestedHome, host);
  if (!compilation.artifacts[`${host}/catalog.json`]) throw new Error('HOST_ARTIFACTS_REQUIRED');
  const manifest = { schema_version: 1, framework: 'skyops', host, files: {}, native_validation: 'not_run' };
  const copies = {};
  for (const [name, bytes] of Object.entries(compilation.artifacts)) {
    if (!name.startsWith(`${host}/`)) continue;
    const relative = name.slice(host.length + 1);
    // Native Codex also supports its config-home skills root. Keep the private
    // generated copy there so discovery is independent of working directory
    // and Windows' OS-level home-directory resolution.
    const destination = `profiles/${host}/native/${relative}`;
    const target = contained(profile.home, destination);
    // No overwrite/merge of existing profiles, even profiles under our root.
    if (fs.existsSync(target)) throw new Error('PROFILE_ARTIFACT_ALREADY_EXISTS');
    manifest.files[destination] = digest(bytes);
    copies[destination] = bytes;
  }
  const roleSource = compilation.artifacts['codex/roles.toml'];
  if (host === 'codex' && roleSource) {
    const destination = 'profiles/codex/native/config.toml';
    if (fs.existsSync(contained(profile.home, destination))) throw new Error('PROFILE_CONFIG_ALREADY_EXISTS');
    copies[destination] = roleSource;
    manifest.files[destination] = digest(roleSource);
  }
  const marker = contained(profile.home, `profiles/${host}/profile-manifest.json`);
  if (fs.existsSync(marker)) throw new Error('PROFILE_ALREADY_PREPARED');
  for (const [relative, hash] of Object.entries(manifest.files)) {
    const target = contained(profile.home, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.writeFileSync(target, copies[relative], { flag: 'wx', mode: 0o600 });
    if (digest(fs.readFileSync(target)) !== hash) throw new Error('PROFILE_COPY_HASH_MISMATCH');
  }
  fs.mkdirSync(profile.user, { recursive: true, mode: 0o700 });
  fs.mkdirSync(profile.native, { recursive: true, mode: 0o700 });
  fs.writeFileSync(marker, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { ...profile, manifest };
}

function smoke(requestedHome, host, executable) {
  const profile = profilePaths(requestedHome, host);
  if (!path.isAbsolute(executable) || !fs.statSync(executable).isFile()) throw new Error('ABSOLUTE_HOST_EXECUTABLE_REQUIRED');
  fs.mkdirSync(profile.user, { recursive: true, mode: 0o700 });
  fs.mkdirSync(profile.native, { recursive: true, mode: 0o700 });
  let command = executable;
  let args = ['--help'];
  if (process.platform === 'win32' && path.extname(executable).toLowerCase() === '.ps1') {
    command = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
    args = ['-NoProfile', '-NonInteractive', '-File', executable, '--help'];
  }
  const result = spawnSync(command, args, { cwd: profile.user, env: environment(requestedHome, host), encoding: 'utf8', timeout: 30000, shell: false, windowsHide: true });
  return { host, ok: result.status === 0 && !result.error, exit_code: result.status, help_bytes: Buffer.byteLength(result.stdout || ''), error: result.error?.code || null, scope: 'Isolated CLI help only; no login, model call, skill invocation or framework execution', profile: profile.directory };
}

function refresh(requestedHome, host, compilation) {
  const profile = profilePaths(requestedHome, host);
  const marker = contained(profile.home, `profiles/${host}/profile-manifest.json`);
  const previous = JSON.parse(fs.readFileSync(marker, 'utf8'));
  if (previous.framework !== 'skyops' || previous.host !== host || previous.schema_version !== 1) throw new Error('INVALID_PROFILE_OWNERSHIP');
  const desired = {};
  for (const [name, bytes] of Object.entries(compilation.artifacts)) {
    if (!name.startsWith(`${host}/`)) continue;
    const relative = name.slice(host.length + 1);
    const destination = `profiles/${host}/native/${relative}`;
    desired[destination] = bytes;
  }
  if (host === 'codex' && compilation.artifacts['codex/roles.toml']) desired['profiles/codex/native/config.toml'] = compilation.artifacts['codex/roles.toml'];
  const changes = [];
  const retired = [];
  for (const [relative, hash] of Object.entries(previous.files)) {
    if (Object.hasOwn(desired, relative)) continue;
    // Only prior generated skills in this profile may be retired. Unknown
    // manifest records cannot authorize removal of authentication or user data.
    if (!relative.startsWith(`profiles/${host}/user/.agents/skills/`)) throw new Error('UNRECOGNIZED_RETIRED_PROFILE_ARTIFACT');
    const target = contained(profile.home, relative);
    if (!fs.existsSync(target)) continue;
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.nlink !== 1 || digest(fs.readFileSync(target)) !== hash) throw new Error(`USER_MODIFIED_PROFILE_ARTIFACT:${relative}`);
    retired.push(relative);
  }
  for (const [relative, bytes] of Object.entries(desired)) {
    const target = contained(profile.home, relative);
    if (fs.existsSync(target)) {
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.nlink !== 1) throw new Error('LINKED_OR_SPECIAL_PROFILE_ARTIFACT');
      const actual = digest(fs.readFileSync(target));
      if (actual === digest(bytes)) continue;
      if (actual !== previous.files[relative]) throw new Error(`USER_MODIFIED_PROFILE_ARTIFACT:${relative}`);
    }
    changes.push([relative, bytes]);
  }
  const updated = { ...previous, native_validation: 'not_run', files: { ...previous.files } };
  for (const [relative, bytes] of changes) {
    const target = contained(profile.home, relative);
    if (fs.existsSync(target)) {
      const backup = contained(profile.home, `profiles/${host}/artifact-backups/${digest(fs.readFileSync(target))}/${path.basename(target)}`);
      fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 });
      if (!fs.existsSync(backup)) fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.writeFileSync(target, bytes, { mode: 0o600 });
    updated.files[relative] = digest(bytes);
  }
  for (const relative of retired) {
    const target = contained(profile.home, relative);
    const actual = digest(fs.readFileSync(target));
    if (actual !== previous.files[relative]) throw new Error(`USER_MODIFIED_PROFILE_ARTIFACT:${relative}`);
    const backup = contained(profile.home, `profiles/${host}/artifact-backups/${actual}/${path.basename(target)}`);
    fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 });
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
    fs.unlinkSync(target);
    delete updated.files[relative];
  }
  fs.writeFileSync(marker, JSON.stringify(updated, null, 2) + '\n', { mode: 0o600 });
  return { host, updated_artifacts: changes.length, retired_unchanged_generated_artifacts: retired.length, authentication_files_modified: false, native_validation: 'not_run' };
}

module.exports = { profilePaths, environment, prepare, refresh, smoke };
