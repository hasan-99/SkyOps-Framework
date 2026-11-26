'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sandbox } = require('../helpers/sandbox.cjs');
const { compile } = require('../../framework/compiler.cjs');

function fixture(t) {
  const box = sandbox(t);
  const sources = {
    'skills/sky-example/SKILL.md': '---\nname: sky-example\ndescription: "Build a verified example"\nallowed-tools: Read\n---\nRead references/guide.md only when needed.\nKeep the mandatory evidence gate.\n',
    'skills/sky-example/references/guide.md': '# Supporting reference\nLoad on demand.\n',
    'agents/builder.md': '---\nname: sky-builder\ndescription: Execute one verified task\ntools: Read, Write, Bash\n---\nRead before making claims.\nDo not pass a failed verification gate.\n',
  };
  for (const [name, text] of Object.entries(sources)) {
    fs.mkdirSync(path.dirname(path.join(box.directory, name)), { recursive: true });
    fs.writeFileSync(path.join(box.directory, name), text);
  }
  const inventory = { files: Object.keys(sources).map((name) => ({ target_path: name, category: name.endsWith('SKILL.md') ? 'skill' : name.startsWith('agents/') ? 'agent' : 'internal_skill_resource' })) };
  return { ...box, sources, inventory };
}

test('one shared skill body and its resources produce independent artifacts for either host', (t) => {
  const box = fixture(t);
  for (const host of ['claude', 'codex']) {
    const result = compile(box.directory, box.inventory, [host]);
    assert.deepEqual(result.summaries, { skills: 1, agents: 1, supporting_files: 1 });
    assert.equal(result.artifacts[`${host}/skills/sky-example/SKILL.md`].toString(), box.sources['skills/sky-example/SKILL.md']);
    assert.equal(result.artifacts[`${host}/skills/sky-example/references/guide.md`].toString(), box.sources['skills/sky-example/references/guide.md']);
    assert.ok(Object.keys(result.artifacts).every((name) => name.startsWith(`${host}/`)));
    assert.equal(result.validation.status, 'native_validation_required');
  }
});

test('catalog stays bounded to metadata and excludes instruction bodies and references', (t) => {
  const box = fixture(t);
  const result = compile(box.directory, box.inventory, ['claude', 'codex']);
  assert.equal(result.catalog.length, 2);
  const text = result.artifacts['codex/catalog.json'].toString();
  assert.ok(!text.includes('Keep the mandatory evidence gate'));
  assert.ok(!text.includes('Load on demand'));
  assert.ok(result.artifacts['codex/agents/sky-builder.toml'].toString().includes('Do not pass a failed verification gate.'));
  assert.equal(result.artifacts['claude/agents/sky-builder.md'].toString(), box.sources['agents/builder.md']);
});

test('agent model overrides are platform-specific and do not duplicate or alter shared prompts', (t) => {
  const box = fixture(t);
  const result = compile(box.directory, box.inventory, ['codex'], { codex: { 'sky-builder': 'configured-model' } });
  assert.ok(result.artifacts['codex/agents/sky-builder.toml'].toString().startsWith('model = "configured-model"\n'));
  assert.equal(fs.readFileSync(path.join(box.directory, 'agents/builder.md'), 'utf8'), box.sources['agents/builder.md']);
  const claude = compile(box.directory, box.inventory, ['claude'], { claude: { 'sky-builder': 'configured-claude-model' } });
  assert.match(claude.artifacts['claude/agents/sky-builder.md'].toString(), /model: "configured-claude-model"/);
  assert.ok(claude.artifacts['claude/agents/sky-builder.md'].toString().includes('tools: Read, Write, Bash'));
  assert.throws(() => compile(box.directory, box.inventory, ['claude'], { claude: { 'sky-builder': 'invalid\nmodel' } }), /INVALID_AGENT_MODEL/);
});

test('missing components, old identities, duplicate hosts and invalid names fail compilation', (t) => {
  const box = fixture(t);
  assert.throws(() => compile(box.directory, box.inventory, ['cursor']), /UNSUPPORTED_OR_DUPLICATE_HOST/);
  assert.throws(() => compile(box.directory, box.inventory, ['codex', 'codex']), /UNSUPPORTED_OR_DUPLICATE_HOST/);
  fs.writeFileSync(path.join(box.directory, 'skills/sky-example/SKILL.md'), box.sources['skills/sky-example/SKILL.md'].replace('name: sky-example', 'name: old-example'));
  assert.throws(() => compile(box.directory, box.inventory, ['claude']), /SOURCE_IDENTITY_NOT_MIGRATED/);
  fs.unlinkSync(path.join(box.directory, 'skills/sky-example/SKILL.md'));
  assert.throws(() => compile(box.directory, box.inventory, ['claude']), /ENOENT/);
});

test('ambiguous unquoted YAML descriptions fail before a native host can silently omit an agent', (t) => {
  const box = fixture(t);
  fs.writeFileSync(path.join(box.directory, 'agents/builder.md'), box.sources['agents/builder.md'].replace('description: Execute one verified task', 'description: Execute one task. Default: strict'));
  assert.throws(() => compile(box.directory, box.inventory, ['claude', 'codex']), /QUOTED_DESCRIPTION_REQUIRED/);
});

test('compiling artifacts performs no filesystem writes or profile installation', (t) => {
  const box = fixture(t);
  const before = fs.readdirSync(box.directory);
  compile(box.directory, box.inventory, ['claude', 'codex']);
  assert.deepEqual(fs.readdirSync(box.directory), before);
  assert.equal(fs.existsSync(path.join(box.directory, '.claude')), false);
  assert.equal(fs.existsSync(path.join(box.directory, '.codex')), false);
});

test('explicit-only invocation and host hint metadata survive the shared-source host translation', (t) => {
  const box = fixture(t);
  const file = path.join(box.directory, 'skills/sky-example/SKILL.md');
  const source = box.sources['skills/sky-example/SKILL.md'].replace('allowed-tools: Read', 'allowed-tools: Read\ndisable-model-invocation: true\nargument-hint: "[target]"\ntags: [verification, example]');
  fs.writeFileSync(file, source);
  const output = compile(box.directory, box.inventory, ['claude', 'codex']);
  assert.equal(output.artifacts['claude/skills/sky-example/SKILL.md'].toString(), source);
  const codex = output.artifacts['codex/skills/sky-example/SKILL.md'].toString();
  assert.ok(codex.includes('source_argument_hint:'));
  assert.ok(codex.includes('source_tags:'));
  assert.ok(codex.endsWith('Read references/guide.md only when needed.\nKeep the mandatory evidence gate.\n'));
  assert.equal(output.artifacts['codex/skills/sky-example/agents/openai.yaml'].toString(), 'policy:\n  allow_implicit_invocation: false\n');
  assert.equal(fs.readFileSync(file, 'utf8'), source);
});

test('installation path rendering happens before Codex TOML encoding and leaves shared prompts unchanged', (t) => {
  const box = fixture(t);
  const { validateHome } = require('../../framework/package-store.cjs');
  const home = validateHome(path.join(box.directory, 'framework with spaces'), true);
  const file = path.join(box.directory, 'agents/builder.md');
  const text = box.sources['agents/builder.md'] + '\nRun node ${SKYOPS_HOME}/bin/state.js check.\n';
  fs.writeFileSync(file, text);
  const result = compile(box.directory, box.inventory, ['claude', 'codex'], {}, { renderHome: home });
  const toml = result.artifacts['codex/agents/sky-builder.toml'].toString();
  const encoded = toml.match(/^developer_instructions = (.+)$/m)[1];
  const instructions = JSON.parse(encoded);
  assert.ok(instructions.includes(`node "${home.replace(/\\/g, '/')}/bin/state.js" check.`));
  assert.ok(!instructions.includes('${SKYOPS_HOME}'));
  assert.equal(fs.readFileSync(file, 'utf8'), text);
});
