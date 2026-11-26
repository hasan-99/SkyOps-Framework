#!/usr/bin/env node
// ~/.claude/bin/auto-report.js — B1 auto-capture (framework side).
//
// Fires at SHIP TIME: when a SkyOps project's tracking.json reaches
// status `shipped`, POST a session report to the ERP tagged `source: "auto"`,
// so the ERP reflects real shipped work without anyone running /sky-report.
//
// Design (mirrors the constraints learned the hard way):
//   • Ship-time, NOT per-turn. The Stop hook fires every turn; this guards on
//     status===shipped + a per-shipped-unit dedupe marker, so it POSTs exactly
//     ONCE per shipped (milestone, phase) — never a per-turn spam stream.
//   • Fail-soft. Never throws, never blocks. On any upload failure it enqueues
//     to the existing erp-retry queue (drained by session-start) and exits 0.
//   • One ERP-upload seam. Reuses erp-retry's postOnce/enqueue/config/key
//     readers and report-payload's buildPayload — no duplicated contract.
//   • No double-posting. The dedupe marker means re-running on the same shipped
//     unit is a no-op; the ERP also UPSERTs on (project_id, client_report_id).
//
// Invoked fire-and-forget (detached) by hooks/stop-session-log.js, or directly:
//   node auto-report.js            # run the guarded auto-report for cwd
//   SOURCE handled internally as "auto"; set DRY_RUN=1 to mark the report dry.

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { buildPayload } = require("./report-payload.js");
const { enqueue, readConfig } = require("./sync-queue.js");

function skyopsHome() {
  return require("../framework/paths.cjs").frameworkHome();
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function markerFile(home, projectKey) {
  const safe = String(projectKey || "project").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
  return path.join(skyopsHome(home), `.skyops-auto-report-${safe}.json`);
}

function allocateReportId(cwd) {
  // Sequential QS-REPORT-NN via state.js (the same allocator /sky-report uses).
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "state.js"), "next-report-id"], {
      cwd,
      encoding: "utf8",
      timeout: 4000,
    });
    if (r.status === 0 && r.stdout) {
      const parsed = JSON.parse(r.stdout);
      if (parsed && parsed.report_id) return parsed.report_id;
    }
  } catch {}
  return "";
}

// The single decision + action. Returns a small status object; never throws.
async function maybeAutoReport({ cwd = process.cwd(), home = os.homedir(), env = process.env } = {}) {
  let lockFile;
  let lockDescriptor;
  try {
    // Local development evidence does not require a cloud account/shared key.
    const cfg = readConfig();
    if (cfg.reporting && cfg.reporting.autoCapture === false) return { skipped: 'auto-capture-disabled' };

    // Guard 2 — SkyOps project at SHIP time only.
    const tracking = readJson(path.join(cwd, ".planning", "tracking.json"));
    if (!tracking) return { skipped: "no-project" };
    if (String(tracking.status) !== "shipped") return { skipped: "not-shipped" };

    // Guard 3 — dedupe: one report per shipped (milestone, phase).
    const projectKey = crypto.createHash('sha256').update(JSON.stringify([cfg.context?.user_id || 'local', tracking.project_id || path.resolve(cwd)])).digest('hex');
    const unit = `${tracking.milestone || 1}:${tracking.phase || 0}:shipped`;
    const mFile = markerFile(home, projectKey);
    lockFile = mFile + '.lock';
    try { lockDescriptor = fs.openSync(lockFile, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') return { skipped: 'report-capture-in-progress' }; throw error; }
    const marker = readJson(mFile) || {};
    if (marker.last === unit) return { skipped: "already-reported", unit };

    // Allocate a sequential client_report_id (the ERP dedupe key).
    const clientReportId = allocateReportId(cwd);
    const idempotencyKey = crypto.randomUUID();
    const payload = buildPayload({
      cwd,
      home,
      env: { ...env, SOURCE: "auto", CLIENT_REPORT_ID: clientReportId },
    });
    const body = JSON.stringify(payload);
    if (env.DRY_RUN === '1') return { dry_run: true, client_report_id: clientReportId, unit };
    if (!clientReportId) throw new Error('REPORT_ID_ALLOCATION_FAILED');
    const reports = path.join(cwd, '.planning', 'reports');
    fs.mkdirSync(reports, { recursive: true });
    const localFile = path.join(reports, `${clientReportId}.json`);
    fs.writeFileSync(localFile, body + '\n', { mode: 0o600 });

    const writeMarker = (extra) => {
      try {
        fs.writeFileSync(
          mFile,
          JSON.stringify({ last: unit, client_report_id: clientReportId, at: new Date().toISOString(), ...extra }, null, 2),
          { mode: 0o600 },
        );
      } catch {}
    };

    const context = cfg.context;
    if (cfg.sync?.enabled !== true || !context?.user_id || !context.workspace_id || !context.project_id || !require('../framework/paths.cjs').projectContextMatches(context, cwd) || (tracking.project_id && tracking.project_id !== context.project_id)) {
      writeMarker({ local: true });
      return { local: clientReportId, path: localFile, unit, synchronization: 'not_enabled_or_context_not_selected' };
    }

    // Any non-200 → enqueue for the retry queue (session-start drains it).
    // Mark the unit so we don't re-allocate a new id on the next turn; the
    // queued item carries this client_report_id and the ERP dedupes on it.
    enqueue({
        client_report_id: clientReportId,
        idempotency_key: idempotencyKey,
        context,
        payload: body,
      });
    writeMarker({ queued: true });
    return { queued: clientReportId, path: localFile, unit, synchronization: 'pending_server_acknowledgment' };
  } catch (e) {
    // Auto-capture must never break a session.
    return { skipped: "error", error: e && e.message ? e.message : String(e) };
  } finally {
    if (lockDescriptor !== undefined) { fs.closeSync(lockDescriptor); fs.unlinkSync(lockFile); }
  }
}

module.exports = { maybeAutoReport };

if (require.main === module) {
  maybeAutoReport()
    .then((r) => {
      if (process.env.SKYOPS_DEBUG) process.stdout.write(JSON.stringify(r) + "\n");
      process.exit(0);
    })
    .catch(() => process.exit(0));
}
