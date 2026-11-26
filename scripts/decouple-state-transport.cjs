#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { digest } = require('../framework/package-store.cjs');
const root = path.resolve(__dirname, '..');
const changes = [];
for (const relative of ['bin/project-snapshot.js', 'bin/work-packet.js']) {
  const file = path.join(root, relative);
  const before = fs.readFileSync(file, 'utf8');
  let after = before.replace(/function erpConfig\(options = \{\}\) \{[\s\S]*?^\}/m, 'function cloudConfig() { return require("../framework/cloud-transport.cjs").cloudConfig(); }');
  if (relative.includes('project-snapshot')) {
    after = after.replace(/function uploadSnapshot\(snapshot, options = \{\}\) \{[\s\S]*?^\}/m, 'function uploadSnapshot(snapshot, options = {}) {\n  return require("../framework/cloud-transport.cjs").request("project-snapshots", { ...options, method: "POST", body: snapshot });\n}');
    after = after.replace(/^.*uuid\(tracking\.erp_project_id\).*\r?\n/m, '');
  } else {
    after = after.replace(/function fetchJson\(url, key, options = \{\}\) \{[\s\S]*?^\}/m, '');
    after = after.replace(/async function pullWorkPacket\(options = \{\}\) \{[\s\S]*?^\}/m, 'async function pullWorkPacket(options = {}) {\n  const cfg = options.cloud || cloudConfig();\n  const projectId = uuid(options.projectId) || uuid(cfg.context?.project_id) || trackingProjectId(options.cwd || process.cwd());\n  if (!projectId || projectId !== cfg.context?.project_id) throw new Error("SELECTED_PROJECT_CONTEXT_MISMATCH");\n  const response = await require("../framework/cloud-transport.cjs").request("work-packets", { ...options, cloud: cfg });\n  const packet = normalizePacket(response.body);\n  if (!packet || packet.project_id !== projectId) throw new Error("CLOUD_WORK_PACKET_CONTEXT_MISMATCH");\n  return packet;\n}');
    after = after.replace('packet.project_id || packet.erp_project_id', 'packet.project_id').replace('return uuid(tracking.erp_project_id);', 'return uuid(tracking.project_id);')
      .replace('employee_id: uuid(packet.employee_id) || null,', 'assignee_id: uuid(packet.assignee_id) || null,')
      .replace('vercel_url: typeof packet.vercel_url === "string" ? packet.vercel_url : null,', 'deployed_url: typeof packet.deployed_url === "string" ? packet.deployed_url : null,')
      .replace('employee: packet.employee && typeof packet.employee === "object" ? packet.employee : null,', 'assignee: packet.assignee && typeof packet.assignee === "object" ? packet.assignee : null,')
      .replace(/^.*mission_url:.*\r?\n/m, '');
  }
  after = after.replace(/^  erpConfig,$/m, '  cloudConfig,');
  if (after !== before) {
    fs.writeFileSync(file, after);
    changes.push({ path: relative, before_sha256: digest(before), after_sha256: digest(after), scope: 'Retain local snapshot/packet generation; replace unavailable business service transport with configured authenticated Supabase transport' });
  }
}
const receipt = path.join(root, 'docs/audit/state-transport-adaptation.json');
if (changes.length) fs.writeFileSync(receipt, JSON.stringify({ schema_version: 1, adapted_at: new Date().toISOString(), changes, server_acceptance: 'pending' }, null, 2) + '\n');
console.log(JSON.stringify({ adapted: changes.length, server_acceptance: 'pending' }));
