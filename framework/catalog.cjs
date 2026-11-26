'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Inventory metadata only: listing commands never loads agent prompts or memory.
function catalog(root) {
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/audit/source-inventory.json'), 'utf8'));
  const entries = inventory.files.filter((entry) => ['skill', 'agent'].includes(entry.category) && entry.target_path);
  return entries.map((entry) => ({
    id: `${entry.category}:${entry.target_path}`,
    kind: entry.category,
    name: entry.category === 'skill' ? path.posix.basename(path.posix.dirname(entry.target_path)) : require('./identity.json').command_prefix + path.posix.basename(entry.target_path, '.md'),
    target_path: entry.target_path,
    migration_status: entry.migration_status,
    validation_status: entry.validation_status,
  })).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

module.exports = { catalog };
