#!/usr/bin/env bash
# Generate native project instructions only inside explicitly selected projects.
# Preview by default; --write never overwrites an existing instruction file.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
node - "$SCRIPT_DIR/.." "$@" <<'SKYOPS_PROJECT_MD'
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const codeRoot = path.resolve(process.argv[2]);
const args = process.argv.slice(3);
let project, base, host = 'claude', write = false;
for (let index = 0; index < args.length; index++) {
  const flag = args[index];
  if (flag === '--write') write = true;
  else if (flag === '--project') project = args[++index];
  else if (flag === '--projects-base') base = args[++index];
  else if (flag === '--host') host = args[++index];
  else if (flag === '--help') {
    console.log('generate-project-claude-md.sh --project <absolute-project-path> | --projects-base <absolute-projects-directory> [--host claude|codex|both] [--write]');
    process.exit(0);
  } else throw new Error('UNKNOWN_PROJECT_INSTRUCTION_OPTION');
}
if (!['claude', 'codex', 'both'].includes(host) || Boolean(project) === Boolean(base)) throw new Error('SELECT_ONE_EXPLICIT_PROJECT_OR_BASE_AND_SUPPORTED_HOST');
const safeRemote = require(path.join(codeRoot, 'framework/git-metadata.cjs')).safeRemote;
function selectedDirectory(value) {
  if (!value || !path.isAbsolute(value)) throw new Error('ABSOLUTE_PROJECT_DIRECTORY_REQUIRED');
  const target = path.resolve(value);
  if (target === path.parse(target).root || target === path.resolve(os.homedir())) throw new Error('UNSAFE_PROJECT_DIRECTORY');
  if (fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isDirectory()) throw new Error('LINKED_OR_INVALID_PROJECT_DIRECTORY');
  return fs.realpathSync(target);
}
function json(projectRoot, relative) {
  let current = projectRoot;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('LINKED_PROJECT_METADATA_REFUSED');
  }
  if (!fs.existsSync(current)) return {};
  const stat = fs.lstatSync(current);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error('NONREGULAR_PROJECT_METADATA_REFUSED');
  return JSON.parse(fs.readFileSync(current, 'utf8'));
}
function label(value) { return String(value || '').replace(/[\r\n`]/g, ' ').trim().slice(0, 320); }
let candidates;
if (project) candidates = [selectedDirectory(project)];
else {
  const root = selectedDirectory(base);
  candidates = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const directory = path.join(root, entry.name);
    if (['Live-Projects', 'aiagents', 'voice', 'websites'].includes(entry.name)) {
      for (const child of fs.readdirSync(directory, { withFileTypes: true })) if (child.isDirectory() && !child.isSymbolicLink()) candidates.push(path.join(directory, child.name));
    } else candidates.push(directory);
  }
}
const results = [];
for (const directory of candidates) {
  const current = selectedDirectory(directory);
  if (!['package.json', 'requirements.txt', 'pyproject.toml', 'src'].some((name) => fs.existsSync(path.join(current, name)))) { results.push({ project: current, status: 'not_a_recognized_application' }); continue; }
  const manifest = json(current, 'package.json');
  const selected = json(current, '.planning/skyops-project.json');
  const dependencies = { ...(manifest.dependencies || {}), ...(manifest.devDependencies || {}) };
  const stack = [];
  if (dependencies.next) stack.push('Next.js ' + label(dependencies.next));
  else if (fs.existsSync(path.join(current, 'package.json'))) stack.push('Node.js');
  if (dependencies.react) stack.push('React ' + label(dependencies.react));
  if (dependencies.typescript || fs.existsSync(path.join(current, 'tsconfig.json'))) stack.push('TypeScript');
  if (dependencies['@supabase/supabase-js']) stack.push('Supabase');
  if (dependencies.tailwindcss) stack.push('Tailwind CSS');
  if (fs.existsSync(path.join(current, 'requirements.txt')) || fs.existsSync(path.join(current, 'pyproject.toml'))) stack.push('Python');
  const remoteResult = spawnSync('git', ['config', '--get', 'remote.origin.url'], { cwd: current, encoding: 'utf8', timeout: 3000, shell: false });
  const remote = remoteResult.status === 0 ? safeRemote((remoteResult.stdout || '').trim()) : '';
  const commands = Object.keys(manifest.scripts || {}).filter((name) => /^[a-zA-Z0-9:_-]+$/.test(name)).map((name) => '- `npm run ' + name + '`');
  const facts = [
    '# ' + label(manifest.name || path.basename(current)), '', '## Purpose',
    label(manifest.description) || 'Existing application; inspect its requirements and source before changing behavior.',
    '', '## Declared stack', stack.join(', ') || 'Inspect the existing project; no supported package manifest declares its complete stack.',
    '', '## Project configuration',
    ...(remote ? ['- Repository: ' + remote] : []),
    ...(typeof selected.application_supabase_ref === 'string' && /^[a-z0-9-]{3,64}$/i.test(selected.application_supabase_ref) ? ['- Declared application Supabase reference: `' + selected.application_supabase_ref + '` (validate scoped authorization before any remote operation).'] : []),
    '- Local development, configured GitHub automation and the application\'s own Supabase resources are separate from internal framework infrastructure.',
    '- A build/release artifact is not proof of a live production deployment. Use the project\'s actual authorized runtime and verified URL.',
    '', '## Declared commands', ...(commands.length ? commands : ['No package scripts were declared. Read the project documentation before choosing build/test commands.']),
    '', '## Working rules',
    '- Read existing instructions, requirements and code before edits. Preserve the application\'s own visual identity.',
    '- Use the isolated SkyOps host launcher; do not import another framework\'s profiles, memory, agents or configuration.',
    '- Use feature branches and the project\'s mandatory security, correctness, testing and review gates.',
    '- Project metadata and local role labels never grant cloud or administrative authorization.',
    '- Keep secrets in secure project-specific configuration. Never copy credentials, client history or another application\'s Supabase configuration.',
    '- Load relevant skills and bounded authorized personal/team/project context only when needed.',
    '',
  ].join('\n');
  for (const targetHost of host === 'both' ? ['claude', 'codex'] : [host]) {
    const filename = targetHost === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
    const target = path.join(current, filename);
    if (fs.existsSync(target) || fs.lstatSync(current).isSymbolicLink()) { results.push({ project: current, file: filename, status: 'retained_existing' }); continue; }
    if (!write) { results.push({ project: current, file: filename, status: 'would_create' }); continue; }
    fs.writeFileSync(target, facts, { flag: 'wx', mode: 0o600 });
    results.push({ project: current, file: filename, status: 'created' });
  }
}
console.log(JSON.stringify({ write, hosts: host, results, existing_files_overwritten: false, cloud_resources_modified: false }, null, 2));
SKYOPS_PROJECT_MD
