'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function frameworkHome() {
  const home = path.resolve(process.env.SKYOPS_HOME || path.join(os.homedir(), '.skyops-framework'));
  if (home === path.resolve(os.homedir()) || home === path.parse(home).root) throw new Error('UNSAFE_FRAMEWORK_HOME');
  if (fs.existsSync(home)) require('./package-store.cjs').validateHome(home);
  return home;
}

function hostHome(host) {
  if (!['claude', 'codex'].includes(host)) throw new Error('UNSUPPORTED_HOST');
  return path.join(frameworkHome(), 'profiles', host);
}

function codeRoot() { return path.resolve(__dirname, '..'); }

function projectContextMatches(context, cwd = process.cwd()) {
  if (typeof context?.project_root !== 'string' || !path.isAbsolute(context.project_root)) return false;
  try {
    const selected = fs.realpathSync(context.project_root);
    if (selected === fs.realpathSync(os.homedir()) || selected === path.parse(selected).root) return false;
    const relative = path.relative(selected, fs.realpathSync(cwd));
    return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
  } catch { return false; }
}

module.exports = { frameworkHome, hostHome, projectContextMatches, codeRoot };
