'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateHome, safeRelative, digest } = require('./package-store.cjs');

function copyValidationCore(sourceRoot, requestedHome, inventory) {
  const home = validateHome(requestedHome);
  const categories = new Set(['runtime_helper', 'hook', 'rule', 'template', 'design', 'skill', 'agent', 'internal_skill_resource', 'reference']);
  const names = inventory.files.filter((entry) => entry.target_path && (categories.has(entry.category) || entry.target_path.startsWith('references/') || entry.target_path.startsWith('skyops-references/'))).map((entry) => entry.target_path);
  names.push(...JSON.parse(fs.readFileSync(path.join(sourceRoot, 'framework/runtime-assets.json'), 'utf8')).files);
  for (const name of fs.readdirSync(path.join(sourceRoot, 'framework'))) if (/\.(cjs|json)$/.test(name)) names.push(`framework/${name}`);
  names.push('bin/skyops.cjs', 'package.json', 'docs/audit/source-inventory.json', 'docs/audit/progress.json');
  const recordPath = path.join(home, 'validation-core-manifest.json');
  if (fs.existsSync(recordPath) && fs.lstatSync(recordPath).isSymbolicLink()) throw new Error('LINKED_VALIDATION_MANIFEST_REFUSED');
  const previous = fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath, 'utf8')) : { schema_version: 1, purpose: 'owner_development_validation', files: {} };
  if (previous.purpose !== 'owner_development_validation') throw new Error('NOT_A_VALIDATION_CORE');
  const operations = [];
  for (const name of [...new Set(names)]) {
    safeRelative(name);
    let source = sourceRoot;
    let destination = home;
    for (const part of name.split('/')) {
      source = path.join(source, part); destination = path.join(destination, part);
      for (const candidate of [source, destination]) if (fs.existsSync(candidate) && fs.lstatSync(candidate).isSymbolicLink()) throw new Error('LINKED_CORE_PATH_REFUSED');
    }
    const bytes = fs.readFileSync(source);
    const hash = digest(bytes);
    if (fs.existsSync(destination)) {
      if (fs.statSync(destination).nlink !== 1) throw new Error('HARDLINKED_VALIDATION_CORE_REFUSED');
      const current = digest(fs.readFileSync(destination));
      if (current === hash) continue;
      if (current !== previous.files[name]) throw new Error(`USER_MODIFIED_VALIDATION_CORE:${name}`);
    }
    operations.push({ name, destination, bytes, hash });
  }
  for (const operation of operations) {
    fs.mkdirSync(path.dirname(operation.destination), { recursive: true, mode: 0o700 });
    fs.writeFileSync(operation.destination, operation.bytes, { mode: 0o600 });
    previous.files[operation.name] = operation.hash;
  }
  fs.writeFileSync(recordPath, JSON.stringify(previous, null, 2) + '\n', { mode: 0o600 });
  return { copied_or_updated: operations.length, purpose: previous.purpose, original_private_knowledge_imported: false, production_activation: false };
}

module.exports = { copyValidationCore };
