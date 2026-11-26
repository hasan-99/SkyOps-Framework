'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { frameworkHome } = require('./paths.cjs');

function cloudOrigin(value) {
  const url = new URL(value);
  const loopback = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((!loopback && (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname))) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('UNAPPROVED_SUPABASE_ORIGIN');
  return url.origin;
}

function cloudConfig() {
  const file = path.join(frameworkHome(), '.skyops-config.json');
  let config = {};
  if (fs.existsSync(file)) {
    if (fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).nlink !== 1) throw new Error('LINKED_CONFIGURATION_REFUSED');
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return { enabled: config.sync?.enabled === true, url: config.sync?.supabase_url || null, context: config.context || null };
}

async function request(resource, options = {}) {
  if (!['work-packets', 'project-snapshots'].includes(resource)) throw new Error('UNSUPPORTED_CLOUD_RESOURCE');
  const cfg = options.cloud || cloudConfig();
  if (!cfg.enabled || !cfg.url) throw new Error('CLOUD_SYNCHRONIZATION_NOT_CONFIGURED');
  const scope = cfg.context;
  if (!scope?.user_id || !scope.workspace_id || !scope.project_id) throw new Error('AUTHENTICATED_PROJECT_CONTEXT_REQUIRED');
  if (!require('./paths.cjs').projectContextMatches(scope, options.cwd || process.cwd())) throw new Error('SELECTED_PROJECT_ROOT_MISMATCH');
  const token = options.accessToken || process.env.SKYOPS_ACCESS_TOKEN;
  if (!token || /^(?:sb_secret_|sb_publishable_)/.test(token)) throw new Error('USER_ACCESS_TOKEN_REQUIRED');
  try { if (JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')).role === 'service_role') throw new Error('SERVICE_ROLE_FORBIDDEN_IN_CLIENT'); }
  catch (error) { if (error.message === 'SERVICE_ROLE_FORBIDDEN_IN_CLIENT') throw error; }
  const url = new URL(`/functions/v1/skyops/${resource}`, cloudOrigin(cfg.url));
  url.searchParams.set('project_id', scope.project_id);
  const response = await fetch(url, {
    method: options.method || 'GET', redirect: 'error', signal: AbortSignal.timeout(options.timeout || 5000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'SkyOps-Workspace-Id': String(scope.workspace_id), 'SkyOps-Project-Id': String(scope.project_id) },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const reader = response.body?.getReader();
  const chunks = [];
  let length = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 1048576) throw new Error('CLOUD_RESPONSE_EXCEEDS_LIMIT');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel().catch(() => {}); }
  }
  if (!response.ok) throw new Error(`CLOUD_REQUEST_FAILED:${response.status}`);
  const bytes = Buffer.concat(chunks);
  return { status: response.status, body: bytes.length ? JSON.parse(bytes.toString('utf8')) : null };
}

module.exports = { cloudOrigin, cloudConfig, request };
