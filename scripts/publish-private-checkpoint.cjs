#!/usr/bin/env node
'use strict';
// Owner development checkpoint only; never produces a user installation/release.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { digest } = require('../framework/package-store.cjs');
const root = path.resolve(__dirname, '..');
const target = 'hasan-99/SkyOps-Framework';
const gh = process.argv[2];
if (!gh || !path.isAbsolute(gh)) throw new Error('ABSOLUTE_AUTHENTICATED_GITHUB_CLI_REQUIRED');
const setupPath = path.join(root, 'docs/audit/private-repository-setup.json');
const setup = JSON.parse(fs.readFileSync(setupPath, 'utf8'));
if (setup.repository !== target || !setup.created || !setup.private || !setup.user_approved_repository_name || setup.source_uploaded) throw new Error('INITIAL_PRIVATE_REPOSITORY_CHECKPOINT_ONLY');
const record = JSON.parse(fs.readFileSync(path.join(root, 'docs/audit/private-source-export.json'), 'utf8'));
const directory = path.resolve(record.destination);
if (path.dirname(path.dirname(directory)) !== path.resolve(os.tmpdir()) || !path.basename(path.dirname(directory)).startsWith('skyops-private-source-')) throw new Error('UNSAFE_PRIVATE_SOURCE_SNAPSHOT');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skyops-github-checkpoint-'));
let sequence = 0;
function api(method, resource, body, allowMissing = false) {
  const args = ['api', '--method', method, `repos/${target}/${resource}`];
  if (!resource) args.splice(3, 1, `repos/${target}`);
  if (body) {
    const file = path.join(temporary, `${++sequence}.json`);
    fs.writeFileSync(file, JSON.stringify(body), { mode: 0o600, flag: 'wx' });
    args.push('--input', file);
  }
  const run = spawnSync(gh, args, { encoding: 'utf8', shell: false, windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  let result;
  try { result = JSON.parse(run.stdout || '{}'); } catch { throw new Error('INVALID_GITHUB_RESPONSE'); }
  if (allowMissing && String(result.status) === '409' && /empty/i.test(result.message || '')) return { status: '404' };
  if (run.status !== 0 && !(allowMissing && String(result.status) === '404')) throw new Error(`GITHUB_REQUEST_FAILED:${method}:${resource}:${result.status || run.error?.code || run.status}`);
  return result;
}
const repo = api('GET', '');
if (!repo.private || repo.full_name !== target || !repo.permissions?.admin) throw new Error('PRIVATE_OWNER_REPOSITORY_REQUIRED');
if (Math.abs(Date.parse(repo.created_at) - Date.parse(setup.checked_at)) > 300000) throw new Error('PREEXISTING_REPOSITORY_REFUSED');
const existing = api('GET', 'git/ref/heads/main', null, true);
if (String(existing.status) !== '404') throw new Error('REMOTE_NOT_EMPTY_REVIEW_REQUIRED');
const tree = [];
for (const [relative, expected] of Object.entries(record.files)) {
  const bytes = fs.readFileSync(path.join(directory, relative));
  if (digest(bytes) !== expected) throw new Error('SOURCE_SNAPSHOT_CHANGED');
  if (fs.existsSync(path.join(root, relative)) && digest(fs.readFileSync(path.join(root, relative))) !== expected) throw new Error(`WORKING_SOURCE_CHANGED:${relative}`);
  const text = bytes.toString('utf8');
  const mode = /^(?:bin|scripts|hooks)\//.test(relative) && text.startsWith('#!') ? '100755' : '100644';
  if (digest(Buffer.from(text)) === expected) tree.push({ path: relative, mode, type: 'blob', content: text });
  else tree.push({ path: relative, mode, type: 'blob', sha: api('POST', 'git/blobs', { content: bytes.toString('base64'), encoding: 'base64' }).sha });
}
// GitHub initializes the new repository with its authenticated account identity.
// No invented email, global Git configuration or original source history is used.
const plan = fs.readFileSync(path.join(directory, 'SKYOPS_TRANSFORMATION_PLAN.md'));
const first = api('PUT', 'contents/SKYOPS_TRANSFORMATION_PLAN.md', { message: 'Record approved SkyOps transformation plan', branch: 'main', content: plan.toString('base64') });
const base = api('GET', `git/commits/${first.commit.sha}`);
const createdTree = api('POST', 'git/trees', { base_tree: base.tree.sha, tree });
const commit = api('POST', 'git/commits', { message: 'Add reviewed SkyOps development foundation and validation contracts', tree: createdTree.sha, parents: [first.commit.sha] });
api('PATCH', 'git/refs/heads/main', { sha: commit.sha, force: false });
setup.source_uploaded = true;
setup.repository_id = repo.id;
setup.development_commit = commit.sha;
setup.release_published = false;
fs.writeFileSync(setupPath, JSON.stringify(setup, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'docs/audit/private-source-checkpoint.json'), JSON.stringify({ schema_version: 1, checked_at: new Date().toISOString(), repository: target, private: true, commit: commit.sha, source_files: tree.length, original_git_history_uploaded: false, release_published: false, production_activation: false, phase_gate_passed: false }, null, 2) + '\n');
console.log(JSON.stringify({ repository: target, private: true, commit: commit.sha, source_files: tree.length, release_published: false }));
