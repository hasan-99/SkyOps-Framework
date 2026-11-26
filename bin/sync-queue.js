#!/usr/bin/env node
// ~/.claude/bin/sync-queue.js
//
// ERP report retry queue. /sky-report enqueues a report here if the
// inline 3-attempt-with-backoff upload fails. session-start.js drains the
// queue quietly on the next Claude Code launch; `skyops erp-flush`
// drains it verbosely on demand.
//
// Why a queue: the prior v5.8 implementation told the user "$REPORT will
// appear in ERP after retry" but had no retry mechanism — data was stranded
// locally until the employee manually re-ran /sky-report. Found by the
// 2026-05-11 deep-research audit. This module makes the promise real.
//
// Idempotency: every enqueued item carries the Idempotency-Key header that
// the original report attempt used. The ERP UPSERTs on
// (project_id, client_report_id) and deduplicates Idempotency-Key for 24h,
// so retry-of-a-just-succeeded item is safe.
//
// Hard rules:
// - Never throw out the queue file on parse error — back it up and start fresh.
// - Max 10 attempts per item before marking give_up=true (stops the cycle).
// - 401/422 are permanent failures: keep the item but mark give_up=true so
//   the user can see it and resolve manually (typically: fix the API key).
// - The CLI invocation NEVER exits non-zero unless the queue file is unreadable —
//   we don't want session-start.js to surface "hook error" red banners.
//
// Usage:
//   node sync-queue.js                  # drain all (with default 3-attempt budget per item)
//   node sync-queue.js --quiet          # no stdout unless errors
//   node sync-queue.js --max=3          # drain at most 3 items this run
//   node sync-queue.js --timeout=3000   # ms timeout per upload attempt
//   node sync-queue.js show             # print queue contents, drain nothing
//   node sync-queue.js clear            # delete the queue (use after manual fix)

const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const http = require("http");
const urlLib = require("url");

const HOME = os.homedir();
function skyopsHome() {
  return require("../framework/paths.cjs").frameworkHome();
}

const SKYOPS_HOME = skyopsHome();
const QUEUE_FILE = path.join(SKYOPS_HOME, ".skyops-sync-queue.json");
const CONFIG_FILE = path.join(SKYOPS_HOME, ".skyops-config.json");

const MAX_GIVE_UP_ATTEMPTS = 10;
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_ITEMS = 100;

// ─── Args ───────────────────────────────────────────────
const args = process.argv.slice(2);
const ACTION = (args[0] && !args[0].startsWith("--")) ? args[0] : "drain";
const QUIET = args.includes("--quiet");
function flag(name, fallback) {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  if (!found) return fallback;
  const v = found.split("=", 2)[1];
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
const MAX_ITEMS = flag("max", DEFAULT_MAX_ITEMS);
const TIMEOUT_MS = flag("timeout", DEFAULT_TIMEOUT_MS);

function log(msg) { if (!QUIET) process.stdout.write(msg + "\n"); }
function logErr(msg) { process.stderr.write(msg + "\n"); }

// ─── Queue I/O ──────────────────────────────────────────
function readQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return { queue: [] };
  if (fs.lstatSync(QUEUE_FILE).isSymbolicLink() || fs.statSync(QUEUE_FILE).nlink !== 1) throw new Error('LINKED_SYNC_QUEUE_REFUSED');
  try {
    const raw = fs.readFileSync(QUEUE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.queue)) throw new Error('invalid queue shape');
    return parsed;
  } catch (e) {
    // Corrupt queue — back up and start fresh. Never silently destroy data.
    const bak = `${QUEUE_FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
    try { fs.copyFileSync(QUEUE_FILE, bak); } catch {}
    logErr(`sync-queue: corrupt queue preserved; recovery backup at ${bak}`);
    throw new Error('SYNC_QUEUE_CORRUPT_REQUIRES_RECOVERY');
  }
}

function writeQueueUnlocked(data) {
  const dir = path.dirname(QUEUE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Atomic: write tmp, rename. Mode 0600 because the payload contains
  // session notes that may reference internal project state.
  const tmp = `${QUEUE_FILE}.tmp.${process.pid}.${require('crypto').randomUUID()}`;
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data, null, 2) + "\n"); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  // Windows readers/scanners may briefly hold a handle that prevents replacing
  // the destination. Keep the old file intact and retry the atomic operation;
  // never delete the destination as a fallback. Exhaustion preserves both files.
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(tmp, QUEUE_FILE); break; }
    catch (error) {
      if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 99) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
}

function withQueueLock(operation) {
  const lock = QUEUE_FILE + '.lock';
  let fd;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { fd = fs.openSync(lock, 'wx', 0o600); break; }
    catch (error) {
      // Windows can report a delete-pending lock as EPERM/EACCES instead of
      // EEXIST. Retry boundedly; never steal a lock or override permissions.
      if (error.code !== 'EEXIST' && !(process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code))) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  if (fd === undefined) throw new Error('SYNC_QUEUE_BUSY');
  try { return operation(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

function writeQueue(data) { return withQueueLock(() => writeQueueUnlocked(data)); }
function scopeKey(context) { return JSON.stringify([context?.user_id || null, context?.workspace_id || null, context?.project_id || null, context?.local_project || null]); }
function itemKey(item) { return scopeKey(item.context) + ':' + item.client_report_id; }
function activeContext() { return readConfig().context || { local_project: require('crypto').createHash('sha256').update(path.resolve(process.cwd())).digest('hex') }; }

function enqueue({ client_report_id, idempotency_key, url, payload, last_error, headers, context }) {
  if (!client_report_id || !payload) {
    throw new Error("enqueue: client_report_id and payload are required");
  }
  const selectedContext = context || activeContext();
  if (headers && Object.keys(headers).some((name) => !/^SkyOps-(?:Event-Id|Event-Timestamp|Signature)$/i.test(name))) throw new Error('queue headers must not contain credentials or routing overrides');
  return withQueueLock(() => {
  const data = readQueue();
  // Dedupe — if this report id is already queued, update the existing item
  // instead of appending a duplicate.
  const existing = data.queue.find((it) => it.client_report_id === client_report_id && scopeKey(it.context) === scopeKey(selectedContext));
  if (existing) {
    existing.idempotency_key = idempotency_key || existing.idempotency_key;
    existing.url = url;
    existing.context = selectedContext;
    existing.revision = (existing.revision || 0) + 1;
    existing.payload = payload;
    if (headers) existing.headers = headers;
    existing.last_error = last_error || existing.last_error || "";
    existing.attempts = existing.attempts || 0;
    existing.give_up = false; // unblock a retry if user fixed the underlying issue
    existing.enqueued_at = new Date().toISOString();
  } else {
    data.queue.push({
      client_report_id,
      idempotency_key: idempotency_key || "",
      url,
      context: selectedContext,
      revision: 1,
      payload,
      ...(headers ? { headers } : {}),
      enqueued_at: new Date().toISOString(),
      attempts: 0,
      last_error: last_error || "",
      give_up: false,
    });
  }
  writeQueueUnlocked(data);
  });
}

// ─── HTTP upload (native https — no curl bearer leak via /proc) ──
function postOnce(item, apiKey) {
  return new Promise((resolve) => {
    const cfg = readConfig();
    if (!require('../framework/paths.cjs').projectContextMatches(cfg.context)) return resolve({ code: '403', body: '', error: 'selected project root does not match the current directory' });
    const base = cfg.sync && cfg.sync.supabase_url;
    if (!base) return resolve({ code: "—", body: "", error: "sync endpoint not configured" });
    let configured;
    try { configured = new URL(base); } catch { return resolve({ code: "—", body: "", error: "invalid configured Supabase URL" }); }
    const local = configured.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(configured.hostname);
    if ((!local && (configured.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(configured.hostname))) || configured.username || configured.password || configured.search || configured.hash || !['', '/'].includes(configured.pathname)) return resolve({ code: '403', body: '', error: 'unapproved sync origin' });
    const endpoint = configured.origin + '/functions/v1/skyops/sync';
    if (item.url && item.url !== endpoint) return resolve({ code: '403', body: '', error: 'queued target does not match configured sync endpoint' });
    if (!cfg.context || !cfg.context.user_id || !cfg.context.workspace_id || !cfg.context.project_id || !item.context || item.context.user_id !== cfg.context.user_id || item.context.workspace_id !== cfg.context.workspace_id || item.context.project_id !== cfg.context.project_id) return resolve({ code: '403', body: '', error: 'queue identity/context mismatch' });
    if (!apiKey || /^(?:sb_secret_|sb_publishable_)/.test(apiKey)) return resolve({ code: '401', body: '', error: 'authenticated user access token required' });
    try { if (JSON.parse(Buffer.from(apiKey.split('.')[1] || '', 'base64url').toString('utf8')).role === 'service_role') return resolve({ code: '401', body: '', error: 'server service-role credentials are forbidden in client synchronization' }); } catch { /* Provider validates the supplied user token. */ }
    let u;
    try { u = urlLib.parse(endpoint); } catch {
      return resolve({ code: "—", body: "", error: "invalid url" });
    }
    const lib = u.protocol === "https:" ? https : http;
    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(item.payload),
      "SkyOps-Workspace-Id": String(cfg.context.workspace_id),
      "SkyOps-Project-Id": String(cfg.context.project_id),
    };
    if (item.idempotency_key) headers["Idempotency-Key"] = item.idempotency_key;
    // Per-item custom headers (e.g. the signed-event envelope:
    // SkyOps-Event-Id / SkyOps-Event-Timestamp / SkyOps-Signature). Auth +
    // Content-* are framework-owned and not overridable.
    if (item.headers && typeof item.headers === "object") {
      for (const [k, v] of Object.entries(item.headers)) {
        if (!/^SkyOps-(?:Event-Id|Event-Timestamp|Signature)$/i.test(k)) continue;
        headers[k] = String(v);
      }
    }
    const req = lib.request({
      method: "POST",
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.path,
      headers,
      timeout: TIMEOUT_MS,
    }, (res) => {
      let chunks = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { chunks += c; if (Buffer.byteLength(chunks) > 65536) req.destroy(new Error('sync response exceeds limit')); });
      res.on("end", () => resolve({ code: String(res.statusCode), body: chunks.trim(), error: null }));
    });
    req.on("error", (e) => resolve({ code: "—", body: "", error: e.message || "request failed" }));
    req.on("timeout", () => { try { req.destroy(new Error("timeout")); } catch {} });
    req.write(item.payload);
    req.end();
  });
}

function readApiKey() {
  // A caller may supply the user session in memory via secure environment
  // setup. Never import a legacy shared key or persist bearer tokens in queues.
  return process.env.SKYOPS_ACCESS_TOKEN || "";
}

function readConfig() {
  try {
    if (fs.lstatSync(CONFIG_FILE).isSymbolicLink() || fs.statSync(CONFIG_FILE).nlink !== 1) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch { return {}; }
}

// ─── Actions ────────────────────────────────────────────
async function actionDrain() {
  const data = readQueue();
  if (data.queue.length === 0) {
    log("erp-retry: queue empty");
    return { drained: 0, kept: 0, give_up: 0 };
  }

  const cfg = readConfig();
  const syncEnabled = cfg.sync && cfg.sync.enabled === true;
  if (!syncEnabled) {
    log("erp-retry: ERP disabled in config; skipping drain (queue preserved)");
    return { drained: 0, kept: data.queue.length, give_up: 0 };
  }

  const apiKey = readApiKey();
  if (!apiKey) {
    log("erp-retry: API key missing; skipping drain (queue preserved)");
    return { drained: 0, kept: data.queue.length, give_up: 0 };
  }

  let drained = 0;
  let give_up = 0;
  const remaining = [];
  let processed = 0;
  const revisions = new Map(data.queue.map((item) => [itemKey(item), item.revision || 0]));

  for (const item of data.queue) {
    if (scopeKey(item.context) !== scopeKey(cfg.context)) { remaining.push(item); continue; }
    // Already given up — keep but don't try.
    if (item.give_up) {
      remaining.push(item);
      continue;
    }
    // Respect the per-run cap.
    if (processed >= MAX_ITEMS) {
      remaining.push(item);
      continue;
    }
    processed++;

    const result = await postOnce(item, apiKey);
    item.last_attempt_at = new Date().toISOString();

    if (/^2\d\d$/.test(result.code)) {
      drained++;
      log(`  ✓ uploaded ${item.client_report_id}`);
      continue; // omit from remaining
    }

    item.attempts = (item.attempts || 0) + 1;
    item.last_error = result.error
      ? `network: ${result.error}`
      : `HTTP ${result.code}${result.body ? `: ${result.body.slice(0, 200)}` : ""}`;

    if (result.code === "401" || result.code === "422") {
      // Permanent — surface to user.
      item.give_up = true;
      give_up++;
      log(`  ✗ ${item.client_report_id} permanent fail (HTTP ${result.code}) — leaving in queue for manual review`);
    } else if (item.attempts >= MAX_GIVE_UP_ATTEMPTS) {
      item.give_up = true;
      give_up++;
      log(`  ✗ ${item.client_report_id} gave up after ${item.attempts} attempts (last: ${item.last_error})`);
    } else {
      log(`  · ${item.client_report_id} retry pending (attempt ${item.attempts}, last: ${item.last_error})`);
    }
    remaining.push(item);
  }

  withQueueLock(() => {
    const current = readQueue();
    const kept = new Map(remaining.map((item) => [itemKey(item), item]));
    const merged = current.queue.flatMap((item) => {
      const key = itemKey(item);
      if (!revisions.has(key) || (item.revision || 0) !== revisions.get(key)) return [item];
      return kept.has(key) ? [kept.get(key)] : [];
    });
    writeQueueUnlocked({ queue: merged });
  });

  if (drained > 0 || give_up > 0 || !QUIET) {
    log(`erp-retry: drained=${drained} kept=${remaining.length} give_up=${give_up}`);
  }
  return { drained, kept: remaining.length, give_up };
}

function actionShow() {
  const data = readQueue();
  data.queue = data.queue.filter((item) => scopeKey(item.context) === scopeKey(activeContext()));
  if (data.queue.length === 0) {
    log("queue empty");
    return;
  }
  log(`${data.queue.length} item(s) in queue:`);
  for (const item of data.queue) {
    log(`  ${item.client_report_id}  enqueued=${item.enqueued_at}  attempts=${item.attempts || 0}${item.give_up ? "  GIVE_UP" : ""}`);
    if (item.last_error) log(`    last_error: ${item.last_error}`);
  }
}

function actionClear() {
  return withQueueLock(() => {
  if (!fs.existsSync(QUEUE_FILE)) {
    log("queue already absent");
    return;
  }
  // Back up rather than rm — destructive ops on user data deserve a recovery point.
  const bak = `${QUEUE_FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
  try { fs.copyFileSync(QUEUE_FILE, bak); } catch {}
  const data = readQueue();
  data.queue = data.queue.filter((item) => scopeKey(item.context) !== scopeKey(activeContext()));
  writeQueueUnlocked(data);
  log(`queue cleared (backup at ${bak})`);
  });
}

// ─── Export for in-process use (sky-report skill enqueues directly;
//     auto-report.js reuses the POST + config/key readers so there is ONE
//     ERP-upload seam, not two). ──
function scopedSummary() {
  const context = activeContext();
  const entries = readQueue().queue.filter((item) => scopeKey(item.context) === scopeKey(context));
  return { pending: entries.length, last_attempt: entries.reduce((latest, item) => Math.max(latest, Date.parse(item.last_attempt_at || '') || 0), 0) };
}

module.exports = { enqueue, readQueue, writeQueue, postOnce, readApiKey, readConfig, scopedSummary };

// ─── CLI entrypoint ─────────────────────────────────────
if (require.main === module) {
  (async () => {
    try {
      if (ACTION === "drain") await actionDrain();
      else if (ACTION === 'enqueue') {
        const fileIndex = args.indexOf('--payload-file');
        if (fileIndex < 0 || !args[fileIndex + 1]) throw new Error('--payload-file is required');
        const file = path.resolve(args[fileIndex + 1]);
        const reports = path.resolve(process.cwd(), '.planning', 'reports');
        if (!file.startsWith(reports + path.sep) || fs.lstatSync(file).isSymbolicLink()) throw new Error('REPORT_PAYLOAD_MUST_BE_A_LOCAL_REPORT_FILE');
        let cursor = process.cwd();
        for (const component of path.relative(process.cwd(), file).split(path.sep)) {
          cursor = path.join(cursor, component);
          if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('LINKED_REPORT_PATH_REFUSED');
        }
        const payload = fs.readFileSync(file, 'utf8');
        const parsed = JSON.parse(payload);
        if (parsed.dry_run === true) throw new Error('DRY_RUN_REPORTS_CANNOT_BE_QUEUED');
        const context = activeContext();
        if (context.project_id && parsed.project_id && context.project_id !== parsed.project_id) throw new Error('REPORT_PROJECT_CONTEXT_MISMATCH');
        enqueue({ client_report_id: parsed.client_report_id, idempotency_key: require('crypto').randomUUID(), context, payload });
        log(JSON.stringify({ queued: parsed.client_report_id, delivered: false }));
      }
      else if (ACTION === "show") actionShow();
      else if (ACTION === "clear") actionClear();
      else {
        logErr(`erp-retry: unknown action "${ACTION}". Use: drain | show | clear`);
        process.exit(2);
      }
    } catch (e) {
      logErr(`erp-retry: ${e && e.message ? e.message : e}`);
      // Soft-fail so session-start.js never blocks.
      process.exit(ACTION === 'drain' ? 0 : 1);
    }
  })();
}
