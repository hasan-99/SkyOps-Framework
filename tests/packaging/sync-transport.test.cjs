'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { sandbox, ROOT } = require('../helpers/sandbox.cjs');
const context = { user_id: 'fixture-user', workspace_id: 'fixture-workspace', project_id: 'fixture-project' };

function client(box, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'tests/helpers/sync-client.cjs')], { cwd: box.directory, env: box.env, shell: false });
    let output = ''; let error = '';
    child.stdout.on('data', (bytes) => { output += bytes; });
    child.stderr.on('data', (bytes) => { error += bytes; });
    child.on('error', reject);
    child.on('exit', (code) => { if (code !== 0) reject(new Error(error)); else { try { resolve(JSON.parse(output)); } catch (failure) { reject(failure); } } });
    child.stdin.end(JSON.stringify(input));
  });
}

function configure(box, extra = {}) { fs.writeFileSync(path.join(box.home, '.skyops-config.json'), JSON.stringify({ context: { ...context, project_root: box.directory }, ...extra })); }
const item = (id = 'fixture-event') => ({ client_report_id: id, idempotency_key: id, context, payload: JSON.stringify({ action: 'verify_pass', project_id: context.project_id }) });

test('events queue locally without any cloud account, legacy service or shared key', async (t) => {
  const box = sandbox(t);
  configure(box);
  const event = box.json('bin/development-events.js', ['emit', 'verify_pass', '--json']);
  assert.equal(event.value.queued, true);
  const queue = await client(box, { action: 'read' });
  assert.equal(queue.queue.length, 1);
  assert.equal(queue.queue[0].url, undefined);
  assert.equal(queue.queue[0].context.user_id, context.user_id);
});

test('concurrent enqueue operations preserve every queued item', async (t) => {
  const box = sandbox(t);
  configure(box);
  await Promise.all(Array.from({ length: 8 }, (_, index) => client(box, { action: 'enqueue', count: 5, item: item(`writer-${index}`) })));
  const queue = await client(box, { action: 'read' });
  assert.equal(queue.queue.length, 40);
  assert.equal(new Set(queue.queue.map((entry) => entry.client_report_id)).size, 40);
});

test('deduplication is context-scoped and never replaces another user record', async (t) => {
  const box = sandbox(t);
  configure(box);
  await client(box, { action: 'enqueue', item: item() });
  await client(box, { action: 'enqueue', item: { ...item(), context: { ...context, user_id: 'other-user' } } });
  await client(box, { action: 'enqueue', item: { ...item(), payload: '{"action":"updated"}' } });
  const queue = await client(box, { action: 'read' });
  assert.equal(queue.queue.length, 2);
  assert.equal(queue.queue.find((entry) => entry.context.user_id === context.user_id).revision, 2);
  assert.equal(queue.queue.find((entry) => entry.context.user_id === 'other-user').revision, 1);
});

test('unconfigured, foreign context, off-origin and service-key uploads fail without network access', async (t) => {
  const box = sandbox(t);
  configure(box);
  assert.equal((await client(box, { action: 'post', item: item(), token: 'fixture-user-token' })).error, 'sync endpoint not configured');
  configure(box, { sync: { supabase_url: 'https://fixture.supabase.co' } });
  assert.equal((await client(box, { action: 'post', item: { ...item(), context: { ...context, user_id: 'other-user' } }, token: 'fixture-user-token' })).code, '403');
  assert.equal((await client(box, { action: 'post', item: { ...item(), url: 'https://unrelated.invalid' }, token: 'fixture-user-token' })).code, '403');
  assert.equal((await client(box, { action: 'post', item: item(), token: 'sb_secret_fixture' })).code, '401');
});

test('the sync client makes a real loopback request with pinned context and idempotency', async (t) => {
  const box = sandbox(t);
  let captured;
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', (bytes) => { body += bytes; });
    request.on('end', () => { captured = { url: request.url, headers: request.headers, body }; response.writeHead(201, { 'content-type': 'application/json' }); response.end('{"accepted":true}'); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  configure(box, { sync: { enabled: true, supabase_url: `http://127.0.0.1:${server.address().port}` } });
  const result = await client(box, { action: 'post', item: item(), token: 'fixture-user-token' });
  assert.equal(result.code, '201');
  assert.equal(captured.url, '/functions/v1/skyops/sync');
  assert.equal(captured.headers['skyops-workspace-id'], context.workspace_id);
  assert.equal(captured.headers['skyops-project-id'], context.project_id);
  assert.equal(captured.headers['idempotency-key'], 'fixture-event');
  assert.deepEqual(JSON.parse(captured.body), JSON.parse(item().payload));
});

test('corrupt queues and credential-bearing headers are preserved or refused, never silently cleared', async (t) => {
  const box = sandbox(t);
  configure(box);
  await assert.rejects(() => client(box, { action: 'enqueue', item: { ...item(), headers: { Authorization: 'do-not-store' } } }), /must not contain credentials/);
  const file = path.join(box.home, '.skyops-sync-queue.json');
  fs.writeFileSync(file, 'not valid json');
  await assert.rejects(() => client(box, { action: 'enqueue', item: item() }), /SYNC_QUEUE_CORRUPT/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'not valid json');
  assert.ok(fs.readdirSync(box.home).some((name) => name.startsWith('.skyops-sync-queue.json.bak.')));
});

test('draining preserves writes and revised records queued during an in-flight upload', async (t) => {
  const box = sandbox(t);
  let received;
  const requestReceived = new Promise((resolve) => { received = resolve; });
  let releaseResponse;
  const respond = new Promise((resolve) => { releaseResponse = resolve; });
  const server = http.createServer((request, response) => {
    request.resume();
    request.on('end', async () => { received(); await respond; response.writeHead(201); response.end('{}'); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  configure(box, { sync: { enabled: true, supabase_url: `http://127.0.0.1:${server.address().port}` } });
  await client(box, { action: 'enqueue', item: item('first') });
  const drained = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'bin/sync-queue.js'), '--quiet'], { cwd: box.directory, env: { ...box.env, SKYOPS_ACCESS_TOKEN: 'fixture-user-token' }, shell: false, stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', resolve);
  });
  await requestReceived;
  await client(box, { action: 'enqueue', item: item('late') });
  await client(box, { action: 'enqueue', item: { ...item('first'), payload: '{"action":"updated"}' } });
  releaseResponse();
  assert.equal(await drained, 0);
  const queue = await client(box, { action: 'read' });
  assert.equal(queue.queue.length, 2);
  assert.equal(queue.queue.find((entry) => entry.client_report_id === 'first').revision, 2);
  assert.equal(queue.queue.find((entry) => entry.client_report_id === 'first').payload, '{"action":"updated"}');
});

test('show/clear operate on the selected context and preserve other queued users', async (t) => {
  const box = sandbox(t);
  configure(box);
  await client(box, { action: 'enqueue', item: item('mine') });
  await client(box, { action: 'enqueue', item: { ...item('other'), context: { ...context, user_id: 'other-user' } } });
  const show = box.run('bin/sync-queue.js', ['show']);
  assert.equal(show.status, 0);
  assert.ok(show.stdout.includes('mine'));
  assert.ok(!show.stdout.includes('other'));
  assert.equal(box.run('bin/sync-queue.js', ['clear']).status, 0);
  const queue = await client(box, { action: 'read' });
  assert.equal(queue.queue.length, 1);
  assert.equal(queue.queue[0].client_report_id, 'other');
});
