#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isDeploymentCommand, validateDeploymentTarget } = require('../framework/deployment-target.cjs');

function readProjectFile(cwd, relative) {
  let current = path.resolve(cwd);
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) return null;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('LINKED_DEPLOYMENT_CONFIGURATION_REFUSED');
  }
  const stat = fs.lstatSync(current);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error('NONREGULAR_DEPLOYMENT_CONFIGURATION_REFUSED');
  return fs.readFileSync(current, 'utf8');
}

function main(input, cwd = process.cwd()) {
  const command = input?.tool_input?.command || input?.arguments?.command || '';
  if (!isDeploymentCommand(command)) return { allowed: true, scope: 'not_a_deployment_command' };
  const configuration = readProjectFile(cwd, '.planning/skyops-project.json');
  const context = configuration ? JSON.parse(configuration) : null;
  const reference = context && readProjectFile(cwd, 'supabase/.temp/project-ref');
  if (reference) context.linked_supabase_ref = reference.trim();
  return validateDeploymentTarget(command, context);
}

if (require.main === module) {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    const result = main(raw ? JSON.parse(raw) : {});
    if (!result.allowed) { console.error(`BLOCKED: ${result.reason}`); process.exitCode = 2; }
  } catch { console.error('BLOCKED: DEPLOYMENT_TARGET_COULD_NOT_BE_VERIFIED'); process.exitCode = 2; }
}
module.exports = { main };
