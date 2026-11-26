#!/usr/bin/env node
// bin/status-snapshot.js — operator status snapshot. Mirrors ECC's
// `ecc status --markdown --write status.md`, but stays vertical to SkyOps:
// install health + active project + work in flight + ERP queue + memory state.
//
// Usage:
//   skyops status                       # print markdown to stdout
//   skyops status --write [path]        # write to file (default: ./STATUS.md)
//   skyops status --json                # machine-readable JSON
//   skyops status --exit-code           # exit 1 if readiness warnings exist
//
// Designed for cross-session paste — every line is fully qualified, no
// runtime variables, no secrets. Safe to paste into a Slack / GitHub
// comment / handoff doc.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const _start = Date.now();

function skyopsHome() {
  return require("../framework/paths.cjs").frameworkHome();
}

function git(args, opts = {}) {
  try {
    const r = spawnSync("git", args, { encoding: "utf8", timeout: 2000, shell: false, ...opts });
    if (r.status !== 0) return "";
    return (r.stdout || "").trim();
  } catch {
    return "";
  }
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function safeStatM(p) {
  try { return fs.statSync(p).mtimeMs; } catch { return 0; }
}

function humanAge(ms) {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  if (diff < 0) return "future";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

function parseArgs(argv) {
  const args = { write: false, writePath: "", json: false, exitCode: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--write") {
      args.write = true;
      if (argv[i + 1] && !argv[i + 1].startsWith("--")) args.writePath = argv[++i];
    } else if (a.startsWith("--write=")) {
      args.write = true;
      args.writePath = a.slice("--write=".length);
    } else if (a === "--json") {
      args.json = true;
    } else if (a === "--exit-code") {
      args.exitCode = true;
    }
  }
  return args;
}

function collectInstallHealth() {
  const qhome = skyopsHome();
  const cfgPath = path.join(qhome, ".skyops-config.json");
  const cfg = readJson(cfgPath) || {};
  const pkgPath = path.join(__dirname, "..", "package.json");
  const pkg = readJson(pkgPath) || {};

  const paths = require('../framework/paths.cjs');
  const installedTargets = ['claude', 'codex'].filter((host) => fs.existsSync(path.join(paths.hostHome(host), 'profile-manifest.json'))).map((host) => host === 'codex' ? 'Codex' : 'Claude');

  // Sanity: required core scripts exist?
  const required = [
    "bin/state.js",
    "bin/command-surface.js",
    "bin/prune-deprecated.js",
    "hooks/pre-compact.js",
    "hooks/stop-session-log.js",
  ];
  const missing = [];
  for (const home of [paths.codeRoot()]) {
    for (const rel of required) {
      if (!fs.existsSync(path.join(home, rel))) missing.push(`${path.basename(home)}:${rel}`);
    }
  }

  return {
    package_version: pkg.version || "?",
    installed_version: cfg.version || "?",
    installed_by: cfg.installed_by || "?",
    role: cfg.role || "?",
    installed_at: cfg.installed_at || "?",
    targets: installedTargets,
    missing_files: missing,
    healthy: missing.length === 0 && !!cfg.version,
  };
}

function collectActiveProject() {
  const cwd = process.cwd();
  const repoRoot = git(["rev-parse", "--show-toplevel"], { cwd }) || cwd;
  const planningDir = path.join(repoRoot, ".planning");
  if (!fs.existsSync(planningDir)) {
    return { is_project: false, repo: path.basename(repoRoot) };
  }

  const tracking = readJson(path.join(planningDir, "tracking.json")) || {};
  const stateText = (() => {
    try { return fs.readFileSync(path.join(planningDir, "STATE.md"), "utf8"); } catch { return ""; }
  })();
  const phaseLine = stateText.split("\n").find((l) => /^Phase:/i.test(l)) || "";
  const statusLine = stateText.split("\n").find((l) => /^Status:/i.test(l)) || "";

  // Verification status of current phase.
  const phase = tracking.phase || 0;
  const vPath = phase ? path.join(planningDir, `phase-${phase}-verification.md`) : "";
  let verifyState = "unverified";
  let failCount = 0;
  if (vPath && fs.existsSync(vPath)) {
    try {
      const v = fs.readFileSync(vPath, "utf8");
      failCount = (v.match(/\bFAIL\b/g) || []).length + (v.match(/INSUFFICIENT EVIDENCE/g) || []).length;
      verifyState = failCount > 0 ? "FAILED" : "passed";
    } catch {}
  }

  return {
    is_project: true,
    repo: path.basename(repoRoot),
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot }) || "?",
    phase_line: phaseLine.trim() || `Phase: ${tracking.phase || "?"} of ${tracking.total_phases || tracking.phase_total || "?"}`,
    status_line: statusLine.trim() || `Status: ${tracking.status || "?"}`,
    verify_state: verifyState,
    verify_fail_count: failCount,
    gap_cycles_used: (tracking.gap_cycles || {})[String(phase)] || 0,
    gap_cycle_limit: tracking.gap_cycle_limit || 2,
  };
}

function collectWorkInFlight() {
  const cwd = process.cwd();
  const modified = git(["diff", "--name-only", "HEAD"], { cwd }).split("\n").filter(Boolean);
  const staged = git(["diff", "--name-only", "--cached"], { cwd }).split("\n").filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard"], { cwd }).split("\n").filter(Boolean);
  const commitsAhead = (() => {
    const head = git(["rev-parse", "HEAD"], { cwd });
    const upstream = git(["rev-parse", "@{u}"], { cwd });
    if (!head || !upstream) return 0;
    const out = git(["rev-list", "--count", `${upstream}..HEAD`], { cwd });
    return parseInt(out, 10) || 0;
  })();
  return {
    modified: modified.slice(0, 20),
    staged: staged.slice(0, 20),
    untracked: untracked.slice(0, 20),
    commits_ahead: commitsAhead,
  };
}

function collectSyncQueue() {
  try {
    return { ...require('./sync-queue.js').scopedSummary(), status: 'readable' };
  } catch {
    return { pending: null, last_attempt: 0, status: 'recovery_required' };
  }
}

function collectMemoryState() {
  const qhome = skyopsHome();
  const dailyDir = path.join(qhome, "knowledge", "daily-log");
  const lastFlushStamp = path.join(qhome, ".skyops-last-flush");
  const lastLearnScanStamp = path.join(qhome, ".skyops-last-learning-scan");

  let entriesThisWeek = 0;
  if (fs.existsSync(dailyDir)) {
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    for (const f of fs.readdirSync(dailyDir)) {
      if (!f.endsWith(".md")) continue;
      const m = f.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
      if (!m) continue;
      const date = new Date(m[1] + "T00:00:00Z").getTime();
      if (date >= sevenDaysAgo) entriesThisWeek++;
    }
  }

  return {
    last_flush_mtime: safeStatM(lastFlushStamp),
    last_learn_scan_mtime: safeStatM(lastLearnScanStamp),
    daily_log_days_this_week: entriesThisWeek,
  };
}

function readinessWarnings(snap) {
  const warnings = [];
  if (!snap.install.healthy) warnings.push(`install: ${snap.install.missing_files.length} missing file(s) — run \`skyops doctor\``);
  if (snap.project.is_project) {
    if (snap.project.verify_state === "FAILED") warnings.push(`phase ${snap.project.phase_line} has ${snap.project.verify_fail_count} FAIL marker(s)`);
    if (snap.project.gap_cycles_used >= snap.project.gap_cycle_limit) warnings.push(`gap-cycle limit reached (${snap.project.gap_cycles_used}/${snap.project.gap_cycle_limit})`);
  }
  if (snap.synchronization.status === 'recovery_required') warnings.push('Synchronization queue requires recovery; contents preserved');
  else if (snap.synchronization.pending > 0) warnings.push(`Synchronization queue: ${snap.synchronization.pending} pending in selected context`);
  if (snap.memory.last_flush_mtime === 0) warnings.push("knowledge has never been flushed — run `skyops flush`");
  return warnings;
}

function renderMarkdown(snap, warnings) {
  const lines = [];
  lines.push(`# SkyOps status — ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Snapshot of installed framework + active project. Generated by \`skyops status\`. Safe to paste into a handoff.`);
  lines.push("");

  // ── Install ──────────────────────────────────────
  lines.push("## Install");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| Package version | \`${snap.install.package_version}\` |`);
  lines.push(`| Installed version | \`${snap.install.installed_version}\` |`);
  lines.push(`| Owner / role | ${snap.install.installed_by} / ${snap.install.role} |`);
  lines.push(`| Targets | ${snap.install.targets.join(", ") || "(none)"} |`);
  lines.push(`| Health | ${snap.install.healthy ? "✅ healthy" : `⚠ ${snap.install.missing_files.length} missing file(s)`} |`);
  if (snap.install.missing_files.length > 0) {
    lines.push("");
    lines.push("Missing:");
    for (const m of snap.install.missing_files.slice(0, 10)) lines.push(`- ${m}`);
  }
  lines.push("");

  // ── Active project ───────────────────────────────
  lines.push("## Active project");
  if (!snap.project.is_project) {
    lines.push(`Repo: \`${snap.project.repo}\` — not a SkyOps project (no \`.planning/\` directory).`);
  } else {
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(`| Repo | \`${snap.project.repo}\` |`);
    lines.push(`| Branch | \`${snap.project.branch}\` |`);
    lines.push(`| ${snap.project.phase_line.replace(/\|/g, "\\|")} | |`);
    lines.push(`| ${snap.project.status_line.replace(/\|/g, "\\|")} | |`);
    lines.push(`| Verification | ${snap.project.verify_state === "FAILED" ? `⚠ FAILED (${snap.project.verify_fail_count} marker(s))` : snap.project.verify_state} |`);
    lines.push(`| Gap cycles | ${snap.project.gap_cycles_used} / ${snap.project.gap_cycle_limit} |`);
  }
  lines.push("");

  // ── Work in flight ───────────────────────────────
  lines.push("## Work in flight");
  const total = snap.work.modified.length + snap.work.staged.length + snap.work.untracked.length;
  if (total === 0 && snap.work.commits_ahead === 0) {
    lines.push("Clean.");
  } else {
    if (snap.work.commits_ahead > 0) lines.push(`- ${snap.work.commits_ahead} commit(s) ahead of upstream`);
    if (snap.work.staged.length > 0) {
      lines.push("");
      lines.push(`### Staged (${snap.work.staged.length})`);
      for (const f of snap.work.staged) lines.push(`- ${f}`);
    }
    if (snap.work.modified.length > 0) {
      lines.push("");
      lines.push(`### Modified (${snap.work.modified.length})`);
      for (const f of snap.work.modified) lines.push(`- ${f}`);
    }
    if (snap.work.untracked.length > 0) {
      lines.push("");
      lines.push(`### Untracked (${snap.work.untracked.length})`);
      for (const f of snap.work.untracked) lines.push(`- ${f}`);
    }
  }
  lines.push("");

  // ── Scoped synchronization queue ─────────────────
  lines.push("## Synchronization queue");
  if (snap.synchronization.status === 'recovery_required') {
    lines.push('Queue unreadable; recovery required. No contents removed.');
  } else if (snap.synchronization.pending === 0) {
    lines.push("No pending reports.");
  } else {
    lines.push(`${snap.synchronization.pending} pending. Last attempt ${humanAge(snap.synchronization.last_attempt)}.`);
    lines.push("");
    lines.push("Drain: `skyops sync-queue drain`");
  }
  lines.push("");

  // ── Memory ───────────────────────────────────────
  lines.push("## Memory");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| Last flush | ${humanAge(snap.memory.last_flush_mtime)} |`);
  lines.push(`| Last learning scan | ${humanAge(snap.memory.last_learn_scan_mtime)} |`);
  lines.push(`| Daily-log days (last 7) | ${snap.memory.daily_log_days_this_week} |`);
  lines.push("");

  // ── Readiness warnings ───────────────────────────
  if (warnings.length === 0) {
    lines.push("## Readiness");
    lines.push("✅ All green.");
  } else {
    lines.push("## Readiness warnings");
    for (const w of warnings) lines.push(`- ⚠ ${w}`);
  }
  lines.push("");

  lines.push("---");
  lines.push(`_Generated in ${Date.now() - _start}ms by \`skyops status\`._`);
  return lines.join("\n") + "\n";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const snap = {
    install: collectInstallHealth(),
    project: collectActiveProject(),
    work: collectWorkInFlight(),
    synchronization: collectSyncQueue(),
    memory: collectMemoryState(),
    generated_at: new Date().toISOString(),
  };
  const warnings = readinessWarnings(snap);

  if (args.json) {
    process.stdout.write(JSON.stringify({ ...snap, warnings }, null, 2) + "\n");
  } else {
    const md = renderMarkdown(snap, warnings);
    if (args.write) {
      const out = args.writePath || path.join(process.cwd(), "STATUS.md");
      fs.writeFileSync(out, md);
      console.log(`Wrote ${out}`);
    } else {
      process.stdout.write(md);
    }
  }

  if (args.exitCode && warnings.length > 0) {
    process.exit(1);
  }
}

module.exports = { main, collectInstallHealth, collectActiveProject, collectWorkInFlight, collectSyncQueue, collectMemoryState, readinessWarnings };

if (require.main === module) {
  try { main(); }
  catch (e) {
    console.error(`status failed: ${e.message}`);
    process.exit(1);
  }
}
