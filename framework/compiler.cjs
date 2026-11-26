'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { safeRelative, digest } = require('./package-store.cjs');

// Generated copies are build artifacts. Shared source remains authoritative.
// No host is launched and no user/global profile is written by this compiler.
function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(text);
  if (!match) throw new Error('FRONTMATTER_REQUIRED');
  const scalar = (field) => {
    const value = new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(match[1])?.[1]?.trim();
    if (!value || /^[>|]/.test(value)) throw new Error(`INLINE_${field.toUpperCase()}_REQUIRED`);
    if (value.startsWith('"')) return JSON.parse(value);
    if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
    if (/:\s|\s#/.test(value)) throw new Error(`QUOTED_${field.toUpperCase()}_REQUIRED`);
    return value;
  };
  return { name: scalar('name'), description: scalar('description'), body: match[2], metadata: match[1] };
}

function readSource(root, relative) {
  safeRelative(relative);
  let current = root;
  for (const component of relative.split('/')) {
    current = path.join(current, component);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('LINKED_SOURCE_REFUSED');
  }
  return fs.readFileSync(current);
}

function codexSkill(text) {
  const parsed = frontmatter(text);
  const extras = [];
  let implicit;
  const metadata = parsed.metadata.split(/\r?\n/).filter((line) => {
    const match = /^(tags|argument-hint|disable-model-invocation):\s*(.*)$/.exec(line);
    if (!match) return true;
    if (match[1] === 'disable-model-invocation') {
      if (!['true', 'false'].includes(match[2])) throw new Error('INVALID_INVOCATION_POLICY');
      implicit = match[2] !== 'true';
    }
    extras.push([match[1].replaceAll('-', '_'), match[2]]);
    return false;
  }).join('\n');
  if (!extras.length) return { text };
  // Preserve host extension values as descriptive metadata; actual invocation
  // control is translated to Codex's native agents/openai.yaml policy below.
  // Never overwrite an existing metadata block without a deliberate merge.
  if (/^metadata:/m.test(metadata)) throw new Error('CODEX_METADATA_MERGE_REQUIRED');
  const extension = extras.map(([key, value]) => `  source_${key}: ${JSON.stringify(value)}`).join('\n');
  return { text: `---\n${metadata}\nmetadata:\n${extension}\n---\n${parsed.body}`, implicit };
}

function compile(root, inventory, hosts, models = {}, options = {}) {
  if (!Array.isArray(hosts) || !hosts.length || new Set(hosts).size !== hosts.length || hosts.some((host) => !['claude', 'codex'].includes(host))) throw new Error('UNSUPPORTED_OR_DUPLICATE_HOST');
  const artifacts = {};
  const catalog = [];
  const summaries = { skills: 0, agents: 0, supporting_files: 0 };
  const add = (name, bytes) => {
    safeRelative(name);
    if (Object.keys(artifacts).some((existing) => existing.toLowerCase() === name.toLowerCase())) throw new Error('ARTIFACT_COLLISION');
    artifacts[name] = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  };
  const files = inventory.files.filter((entry) => entry.target_path && ['skill', 'agent', 'internal_skill_resource'].includes(entry.category));
  for (const entry of files) {
    const relative = entry.target_path;
    const bytes = readSource(root, relative);
    if (entry.category === 'internal_skill_resource') {
      for (const host of hosts) add(`${host}/${relative}`, bytes);
      summaries.supporting_files++;
      continue;
    }
    const parsed = frontmatter(bytes.toString('utf8'));
    if (!/^sky-[a-z0-9-]+$/.test(parsed.name)) throw new Error('SOURCE_IDENTITY_NOT_MIGRATED');
    const kind = entry.category;
    if (kind === 'skill' && parsed.name !== path.posix.basename(path.posix.dirname(relative))) throw new Error('SKILL_NAME_PATH_MISMATCH');
    catalog.push({ name: parsed.name, description: parsed.description, kind, source: relative, sha256: digest(bytes) });
    summaries[kind === 'skill' ? 'skills' : 'agents']++;
    for (const host of hosts) {
      const rendered = options.renderHome ? require('../bin/host-adapters.js').renderText(bytes.toString('utf8'), host, { frameworkHome: options.renderHome, codeRoot: options.codeRoot || options.renderHome }) : bytes;
      if (kind === 'skill') {
        const native = host === 'codex' ? codexSkill(rendered.toString()) : { text: rendered };
        add(`${host}/${relative}`, native.text);
        if (native.implicit !== undefined) add(`codex/${path.posix.dirname(relative)}/agents/openai.yaml`, `policy:\n  allow_implicit_invocation: ${native.implicit}\n`);
      }
      else if (host === 'claude') {
        const model = models.claude?.[parsed.name];
        if (model !== undefined && (typeof model !== 'string' || !model.trim() || /[\r\n\0]/.test(model))) throw new Error('INVALID_AGENT_MODEL');
        let text = rendered.toString();
        if (model !== undefined) {
          const end = text.indexOf('\n---', 4);
          const metadata = text.slice(0, end);
          const updated = /^model:/m.test(metadata) ? metadata.replace(/^model:.*$/m, `model: ${JSON.stringify(model)}`) : `${metadata}\nmodel: ${JSON.stringify(model)}`;
          text = updated + text.slice(end);
        }
        add(`claude/agents/${parsed.name}.md`, text);
      }
      else {
        const model = models.codex?.[parsed.name];
        if (model !== undefined && (typeof model !== 'string' || !model.trim() || /[\r\n\0]/.test(model))) throw new Error('INVALID_AGENT_MODEL');
        const body = options.renderHome ? require('../bin/host-adapters.js').renderText(parsed.body, host, { frameworkHome: options.renderHome, codeRoot: options.codeRoot || options.renderHome }) : parsed.body;
        const instructions = `# ${parsed.name}\n\n${body}`;
        add(`codex/agents/${parsed.name}.toml`, `${model ? `model = ${JSON.stringify(model)}\n` : ''}developer_instructions = ${JSON.stringify(instructions)}\n`);
      }
    }
  }
  for (const host of hosts) {
    add(`${host}/catalog.json`, JSON.stringify(catalog, null, 2) + '\n');
    const instructionSource = path.join(root, 'skyops-templates/instructions.md');
    if (fs.existsSync(instructionSource)) {
      const { compileInstructions } = require('../bin/host-adapters.js');
      const source = readSource(root, 'skyops-templates/instructions.md').toString('utf8');
      add(`${host}/${host === 'claude' ? 'CLAUDE.md' : 'AGENTS.md'}`, compileInstructions(source, host));
    }
    if (host === 'codex') {
      const roles = catalog.filter((entry) => entry.kind === 'agent').map((entry) => `[agents.${entry.name}]\ndescription = ${JSON.stringify(entry.description)}\nconfig_file = ${JSON.stringify(`agents/${entry.name}.toml`)}\n`).join('\n');
      add('codex/roles.toml', roles);
    }
  }
  return {
    artifacts, catalog, summaries,
    validation: {
      status: 'native_validation_required',
      limitations: [
        'Artifact generation is not evidence of host discovery or execution',
        'Host-specific tool permissions, hooks, orchestration and isolation require adapter acceptance tests',
        'Codex skill search locations vary by host version; CODEX_HOME alone does not establish isolation from user skills',
      ],
    },
  };
}

module.exports = { compile, frontmatter };
