'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { sandbox, ROOT } = require('../helpers/sandbox.cjs');
const { cloudOrigin } = require('../../framework/cloud-transport.cjs');
const { normalizePacket } = require('../../bin/work-packet.js');
const scope = { user_id: '00000000-0000-4000-8000-000000000001', workspace_id: '00000000-0000-4000-8000-000000000002', project_id: '00000000-0000-4000-8000-000000000003' };

function client(box, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'tests/helpers/cloud-client.cjs')], { cwd: box.directory, env: box.env, shell: false });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (part) => { stdout += part; }); child.stderr.on('data', (part) => { stderr += part; });
    child.on('error', reject);
    child.on('exit', (code) => { if (code !== 0) reject(new Error(stderr)); else { try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); } } });
    child.stdin.end(JSON.stringify(input));
  });
}

test('only configured Supabase or local test origins are accepted', () => {
  assert.equal(cloudOrigin('https://fixture.supabase.co/'), 'https://fixture.supabase.co');
  for (const url of ['https://other.invalid', 'http://fixture.supabase.co', 'https://user:password@fixture.supabase.co', 'https://fixture.supabase.co/arbitrary/path', 'https://fixture.supabase.co?token=fixture']) assert.throws(() => cloudOrigin(url), /UNAPPROVED_SUPABASE_ORIGIN/);
});

test('local packet normalization preserves development context without business personnel or hosting fields', () => {
  const packet = normalizePacket({ id: scope.workspace_id, project_id: scope.project_id, assignee_id: scope.user_id, current_phase: 2, definition_of_done: 'Verified behavior', blockers: ['waiting for acceptance'], deployed_url: 'http://localhost:3000' });
  assert.equal(packet.assignee_id, scope.user_id);
  assert.equal(packet.current_phase, 2);
  assert.deepEqual(packet.blockers, ['waiting for acceptance']);
  assert.equal(packet.deployed_url, 'http://localhost:3000');
  assert.equal(packet.employee, undefined);
  assert.equal(packet.employee_id, undefined);
});

test('missing cloud configuration and user authentication fail explicitly', async (t) => {
  const box = sandbox(t);
  await assert.rejects(() => client(box, { resource: 'work-packets' }), /CLOUD_SYNCHRONIZATION_NOT_CONFIGURED/);
  fs.writeFileSync(path.join(box.home, '.skyops-config.json'), JSON.stringify({ sync: { enabled: true, supabase_url: 'https://fixture.supabase.co' }, context: { ...scope, project_root: box.directory } }));
  await assert.rejects(() => client(box, { resource: 'work-packets' }), /USER_ACCESS_TOKEN_REQUIRED/);
});

test('native transport sends scope-bound real requests and rejects another project packet', async (t) => {
  const box = sandbox(t);
  let wrongProject = false;
  let observed;
  const server = http.createServer((request, response) => {
    observed = { url: request.url, headers: request.headers };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ id: scope.workspace_id, project_id: wrongProject ? '00000000-0000-4000-8000-000000000004' : scope.project_id, next_command: '/sky-plan 2' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  fs.writeFileSync(path.join(box.home, '.skyops-config.json'), JSON.stringify({ sync: { enabled: true, supabase_url: `http://127.0.0.1:${server.address().port}` }, context: { ...scope, project_root: box.directory } }));
  const packet = await client(box, { action: 'pull', options: { accessToken: 'fixture-user-token' } });
  assert.equal(packet.project_id, scope.project_id);
  assert.equal(observed.headers['skyops-workspace-id'], scope.workspace_id);
  assert.ok(observed.url.startsWith('/functions/v1/skyops/work-packets?project_id='));
  wrongProject = true;
  await assert.rejects(() => client(box, { action: 'pull', options: { accessToken: 'fixture-user-token' } }), /CLOUD_WORK_PACKET_CONTEXT_MISMATCH/);
});
