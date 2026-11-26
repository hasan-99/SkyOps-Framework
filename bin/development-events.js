#!/usr/bin/env node
// development-events.js — local development lifecycle event envelopes.
// Events queue locally without a cloud account. Optional HMAC signing uses an
// explicitly configured event signing secret, never a shared business API key.
// The configured user-authenticated synchronization transport is responsible for
// remote authorization; a signature alone cannot grant resource access.
// Usage: development-events.js emit <action> [--target type:ref] [--project uuid]
//        [--workspace uuid] [--meta k=v] [--ctx k=v] [--json] [--dry-run]
// Exit: 0 = queued/skipped, 2 = malformed invocation. No external send occurs here.

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

function skyopsHome() {
  return require("../framework/paths.cjs").frameworkHome();
}
const SKYOPS_HOME = skyopsHome();
const CONFIG_FILE = path.join(SKYOPS_HOME, ".skyops-config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}
function readApiKey() {
  return process.env.SKYOPS_EVENT_SIGNING_SECRET || "";
}

// Canonical signature bytes: `${id}.${timestamp}.${rawBody}`. The queue
// retains the exact serialized body; optional receivers must use these bytes.
function signingContent(id, timestamp, rawBody) {
  return `${id}.${timestamp}.${rawBody}`;
}
function computeSignature(content, secret) {
  return crypto.createHmac("sha256", secret).update(content).digest("base64");
}

// Build (and optionally sign) the envelope. Pure; injectable id/now for tests.
function buildSignedEvent(action, opts = {}) {
  const cfg = opts.config || readConfig();
  const apiKey = opts.apiKey != null ? opts.apiKey : readApiKey();
  const id = opts.id || (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
  const ts = String(opts.now != null ? opts.now : Math.floor(Date.now() / 1000));

  const event = {
    action,
    actor: opts.actor || { user_id: cfg.context?.user_id || null },
    ...(opts.targets && opts.targets.length ? { targets: opts.targets } : {}),
    ...(opts.context ? { context: opts.context } : {}),
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
    occurred_at: opts.occurredAt || new Date(Number(ts) * 1000).toISOString(),
    ...(opts.projectId ? { project_id: opts.projectId } : {}),
    ...(opts.workspaceId ? { workspace_id: opts.workspaceId } : {}),
  };

  const payload = JSON.stringify(event);
  const headers = { "SkyOps-Event-Id": id, "SkyOps-Event-Timestamp": ts };
  // Sign only when configured. Cloud access still requires authenticated,
  // scoped server authorization; signature issuance is not that authority.
  if (apiKey) headers["SkyOps-Signature"] = computeSignature(signingContent(id, ts, payload), apiKey);

  return { id, ts, event, payload, headers };
}

// In-process emit (hooks/skills can require this). Returns a result object;
// returns explicit queue errors without claiming network delivery.
function emitEvent(action, opts = {}) {
  const cfg = opts.config || readConfig();
  const built = buildSignedEvent(action, { ...opts, config: cfg });
  if (opts.dryRun) return { ok: true, dryRun: true, ...built };

  try {
    const retryPath = path.join(require("../framework/paths.cjs").codeRoot(), "bin", "sync-queue.js");
    const enqueue = fs.existsSync(retryPath)
      ? require(retryPath).enqueue
      : require("./sync-queue.js").enqueue;
    enqueue({
      client_report_id: built.id, // event_id is unique → no false dedupe
      idempotency_key: built.id,
      context: opts.identityContext || cfg.context || null,
      payload: built.payload,
      headers: built.headers,
    });
    return { ok: true, queued: true, ...built };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e), ...built };
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────
function parseKv(list) {
  const out = {};
  for (const item of list) {
    const i = item.indexOf("=");
    if (i > 0) out[item.slice(0, i)] = item.slice(i + 1);
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] !== "emit") {
    process.stderr.write("development-events.js emit <action> [--target type:ref] [--project uuid] [--meta k=v] [--ctx k=v] [--json] [--dry-run]\n");
    process.exit(2);
  }
  const action = argv[1];
  if (!action || action.startsWith("--")) {
    process.stderr.write("development-events.js: <action> is required (e.g. verify_pass)\n");
    process.exit(2);
  }
  const targets = [];
  const metaKv = [];
  const ctxKv = [];
  const opts = { json: false, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") {
      const t = argv[++i] || "";
      const c = t.indexOf(":");
      targets.push(c > 0 ? { type: t.slice(0, c), ref: t.slice(c + 1) } : { ref: t });
    } else if (a === "--project") opts.projectId = argv[++i];
    else if (a === "--workspace") opts.workspaceId = argv[++i];
    else if (a === "--meta") metaKv.push(argv[++i] || "");
    else if (a === "--ctx") ctxKv.push(argv[++i] || "");
    else if (a === "--json") opts.json = true;
    else if (a === "--dry-run") opts.dryRun = true;
  }
  if (targets.length) opts.targets = targets;
  if (metaKv.length) opts.metadata = parseKv(metaKv);
  if (ctxKv.length) opts.context = parseKv(ctxKv);

  const result = emitEvent(action, opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.skipped) {
    console.log(`development-events: skipped (${result.skipped})`);
  } else if (result.dryRun) {
    console.log(`development-events: [dry-run] ${action} id=${result.id} signed=${!!result.headers["SkyOps-Signature"]}`);
  } else if (result.queued) {
    console.log(`⬢ event queued: ${action} (${result.id})`);
  } else if (!result.ok) {
    console.error(`development-events: ${result.error}`);
  }
  process.exit(0);
}

module.exports = { emitEvent, buildSignedEvent, signingContent, computeSignature };

if (require.main === module) main();
