'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sandbox, ROOT } = require('../helpers/sandbox.cjs');
const { compile } = require('../../framework/compiler.cjs');
const { transform } = require('../../scripts/migrate-identity.cjs');
const { environment, prepare, refresh } = require('../../framework/host-profiles.cjs');
const inventory = require('../../docs/audit/source-inventory.json');

test('all 29 original skills and all nine original agents compile for both hosts', () => {
  for (const host of ['claude', 'codex']) {
    const output = compile(ROOT, inventory, [host]);
    assert.equal(output.summaries.skills, 29);
    assert.equal(output.summaries.agents, 9);
    assert.equal(output.summaries.supporting_files, 10);
    assert.ok(output.catalog.every((entry) => entry.name.startsWith('sky-')));
    assert.ok(Object.keys(output.artifacts).every((name) => name.startsWith(`${host}/`)));
  }
});

test('the active command manifest exposes every preserved skill entry point', () => {
  const skills = inventory.files.filter((entry) => entry.category === 'skill').map((entry) => path.posix.basename(path.posix.dirname(entry.target_path))).sort();
  const { activeSkills } = require('../../bin/command-surface.js');
  assert.deepEqual(activeSkills().sort(), skills);
});

test('identity migration preserves legal notices and does not invent legacy service endpoints', () => {
  const input = 'Copyright 2024 Qualia contributor\nUse /qualia-build and ${QUALIA_HOME}.\nhttps://portal.qualiasolutions.net/api\n';
  const output = transform(input, 'skills/qualia-build/SKILL.md');
  assert.ok(output.includes('Copyright 2024 Qualia contributor'));
  assert.ok(output.includes('/sky-build'));
  assert.ok(output.includes('${SKYOPS_HOME}'));
  assert.ok(output.includes('https://portal.qualiasolutions.net/api'));
  assert.ok(!output.includes('skyopssolutions.net'));
});

test('host child environments isolate homes, settings, cache and credentials', (t) => {
  const box = sandbox(t);
  const inherited = { ...process.env, SKYOPS_HOME: 'unrelated-framework', QUALIA_HOME: 'unrelated', ANTHROPIC_API_KEY: 'must-not-inherit', OPENAI_API_KEY: 'must-not-inherit', CODEX_HOME: 'unrelated-codex', CLAUDE_CONFIG_DIR: 'unrelated-claude', HTTPS_PROXY: 'http://127.0.0.1:3128' };
  for (const host of ['claude', 'codex']) {
    const env = environment(box.home, host, inherited);
    assert.equal(env.SKYOPS_HOME, box.home);
    for (const key of ['HOME', 'USERPROFILE', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME']) assert.ok(env[key].startsWith(box.home + path.sep), key);
    assert.equal(env.QUALIA_HOME, undefined);
    assert.equal(env.OPENAI_API_KEY, undefined);
    assert.equal(env.ANTHROPIC_API_KEY, undefined);
    assert.equal(env.HTTPS_PROXY, 'http://127.0.0.1:3128');
    const child = spawnSync(process.execPath, ['-e', 'process.stdout.write(JSON.stringify({home:process.env.HOME,codex:process.env.CODEX_HOME,claude:process.env.CLAUDE_CONFIG_DIR}))'], { env, encoding: 'utf8', shell: false });
    assert.equal(child.status, 0);
    assert.equal(JSON.parse(child.stdout).home, env.HOME);
  }
});

test('native profile artifacts remain inside their owned root and refuse replacement', (t) => {
  const box = sandbox(t);
  const compilation = compile(ROOT, inventory, ['claude', 'codex']);
  for (const host of ['claude', 'codex']) {
    const result = prepare(box.home, host, compilation);
    assert.ok(Object.keys(result.manifest.files).every((name) => name.startsWith(`profiles/${host}/`)));
    assert.equal(result.manifest.native_validation, 'not_run');
    assert.throws(() => prepare(box.home, host, compilation), /PROFILE_ARTIFACT_ALREADY_EXISTS|PROFILE_ALREADY_PREPARED/);
    const skillPath = path.join(result.native, 'skills/sky-next/SKILL.md');
    assert.ok(fs.existsSync(skillPath));
  }
});

test('unmarked directories and linked profile destinations are refused', (t) => {
  const box = sandbox(t);
  const unrelated = path.join(box.directory, 'unrelated');
  fs.mkdirSync(unrelated);
  assert.throws(() => environment(unrelated, 'claude'), /REFUSE_UNOWNED_DIRECTORY/);
  fs.mkdirSync(path.join(box.home, 'profiles'));
  fs.symlinkSync(unrelated, path.join(box.home, 'profiles/claude'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => environment(box.home, 'claude'), /LINKED_PROFILE_REFUSED/);
  assert.deepEqual(fs.readdirSync(unrelated), []);
});

test('profile refresh preserves native authentication and user-modified artifacts', (t) => {
  const box = sandbox(t);
  const compilation = compile(ROOT, inventory, ['codex']);
  const profile = prepare(box.home, 'codex', compilation);
  const auth = path.join(profile.native, 'auth.json');
  fs.writeFileSync(auth, 'native owned fixture account state');
  const changed = { ...compilation, artifacts: { ...compilation.artifacts, 'codex/skills/sky-next/SKILL.md': Buffer.from(compilation.artifacts['codex/skills/sky-next/SKILL.md'].toString() + '\nUpdated fixture instruction.\n') } };
  const result = refresh(box.home, 'codex', changed);
  assert.equal(result.updated_artifacts, 1);
  assert.equal(fs.readFileSync(auth, 'utf8'), 'native owned fixture account state');
  const skill = path.join(profile.native, 'skills/sky-next/SKILL.md');
  fs.writeFileSync(skill, 'user edited artifact');
  assert.throws(() => refresh(box.home, 'codex', compilation), /USER_MODIFIED_PROFILE_ARTIFACT/);
  assert.equal(fs.readFileSync(skill, 'utf8'), 'user edited artifact');
  assert.equal(fs.readFileSync(auth, 'utf8'), 'native owned fixture account state');
});

test('an existing native configuration fails preflight before any profile artifacts are written', (t) => {
  const box = sandbox(t);
  const native = path.join(box.home, 'profiles/codex/native');
  fs.mkdirSync(native, { recursive: true });
  fs.writeFileSync(path.join(native, 'config.toml'), 'existing owner configuration\n');
  const compilation = compile(ROOT, inventory, ['codex']);
  assert.throws(() => prepare(box.home, 'codex', compilation), /PROFILE_CONFIG_ALREADY_EXISTS/);
  assert.deepEqual(fs.readdirSync(native), ['config.toml']);
  assert.equal(fs.existsSync(path.join(box.home, 'profiles/codex/user')), false);
  assert.equal(fs.readFileSync(path.join(native, 'config.toml'), 'utf8'), 'existing owner configuration\n');
});

test('moving generated Codex skills preserves modified files and native authentication', (t) => {
  const box = sandbox(t);
  const compilation = compile(ROOT, inventory, ['codex']);
  const profile = prepare(box.home, 'codex', compilation);
  const marker = path.join(profile.directory, 'profile-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(marker, 'utf8'));
  const relative = 'profiles/codex/user/.agents/skills/sky-next/SKILL.md';
  const old = path.join(box.home, relative);
  const bytes = compilation.artifacts['codex/skills/sky-next/SKILL.md'];
  fs.mkdirSync(path.dirname(old), { recursive: true });
  fs.writeFileSync(old, bytes);
  manifest.files[relative] = require('../../framework/package-store.cjs').digest(bytes);
  fs.writeFileSync(marker, JSON.stringify(manifest));
  fs.writeFileSync(path.join(profile.native, 'auth.json'), 'fixture account state');
  fs.writeFileSync(old, 'user modified content');
  assert.throws(() => refresh(box.home, 'codex', compilation), /USER_MODIFIED_PROFILE_ARTIFACT/);
  assert.equal(fs.readFileSync(old, 'utf8'), 'user modified content');
  fs.writeFileSync(old, bytes);
  const moved = refresh(box.home, 'codex', compilation);
  assert.equal(moved.retired_unchanged_generated_artifacts, 1);
  assert.equal(fs.existsSync(old), false);
  assert.equal(fs.readFileSync(path.join(profile.native, 'auth.json'), 'utf8'), 'fixture account state');
  assert.ok(fs.existsSync(path.join(profile.native, 'skills/sky-next/SKILL.md')));
});

test('host adapters separate native configuration, shared code and persistent knowledge paths', (t) => {
  const box = sandbox(t);
  const { adapter, renderText, hostForHome } = require('../../bin/host-adapters.js');
  for (const host of ['claude', 'codex']) {
    const options = { frameworkHome: box.home, codeRoot: ROOT };
    const facts = adapter(host, options);
    assert.equal(facts.configPath, path.join(box.home, 'profiles', host, 'native', host === 'codex' ? 'config.toml' : 'settings.json'));
    assert.equal(hostForHome(facts.home), host);
    const rendered = renderText('node ~/.claude/bin/state.js check\nRead ~/.codex/knowledge/index.md', host, options);
    assert.ok(rendered.includes(ROOT.replace(/\\/g, '/') + '/bin/state.js'));
    assert.ok(rendered.includes(box.home.replace(/\\/g, '/') + '/knowledge/index.md'));
    assert.ok(!rendered.includes('/native/bin/'));
    const archetype = renderText('${SKYOPS_HOME}/references/archetypes/website.md', host, options);
    assert.equal(archetype, ROOT.replace(/\\/g, '/') + '/references/archetypes/website.md');
  }
});
