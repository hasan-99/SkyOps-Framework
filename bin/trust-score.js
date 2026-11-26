#!/usr/bin/env node
// SkyOps trust score — compact harness health summary.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const pc = require("./plan-contract.js");
const ledger = require("./state-ledger.js");
const { binFiles } = require("./runtime-manifest.js");
const { ACTIVE_SKILLS } = require("./command-surface.js");

const HOMES = [
  { name: "SkyOps", dir: require("../framework/paths.cjs").codeRoot(), dataDir: require("../framework/paths.cjs").frameworkHome() },
];

const REQUIRED_BIN = binFiles();

// Spine scripts: the load-bearing executables that, if they fail to even parse,
// render the install dead. binFiles() does not include these, so probe them
// explicitly — existence AND Node loadability (`--check`). A syntax-broken
// cli.js (the C1 regression) must force overall status off PASS.
const SPINE_SCRIPTS = ["skyops.cjs", "../framework/package-store.cjs", "state.js"];

const REQUIRED_HOOKS = [
  "session-start.js", "auto-update.js", "branch-guard.js", "pre-push.js",
  "pre-deploy-gate.js", "migration-guard.js", "git-guardrails.js",
  "stop-session-log.js", "approval-guard.js", "deployment-target-guard.js", "env-empty-guard.js",
  "supabase-destructive-guard.js",
];

const REQUIRED_DESIGN_FILES = [
  "design-laws.md",
  "design-rubric.md",
  "design-brand.md",
  "design-product.md",
  "design-reference.md",
  "frontend.md",
  "graphics.md",
];

const REQUIRED_DEVELOPER_SKILLS = ACTIVE_SKILLS;

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}
function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}
function readText(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

function installedHomes() {
  return HOMES.filter((h) => exists(path.join(h.dataDir, require('../framework/package-store.cjs').OWNER_FILE)));
}

function inspectInstall(homes) {
  if (homes.length === 0) {
    return { status: "fail", score: 0, issues: ["no SkyOps install config found"], targets: [] };
  }
  const issues = [];
  let spineBroken = false;
  for (const home of homes) {
    for (const f of REQUIRED_BIN) {
      if (!exists(path.join(home.dir, "bin", f))) issues.push(`${home.name}: missing bin/${f}`);
    }
    // Spine probe: Node loadability of spine scripts that ARE installed.
    // Shared core scripts are checked once; native profile artifacts are checked
    // separately. A missing or syntax-broken spine cannot pass installation.
    for (const f of SPINE_SCRIPTS) {
      const fp = path.join(home.dir, "bin", f);
      if (!exists(fp)) { issues.push(`${home.name}: missing spine ${f}`); spineBroken = true; continue; }
      const r = spawnSync(process.execPath, ["--check", fp], { encoding: "utf8", timeout: 5000, shell: false, windowsHide: true });
      if (r.status !== 0) {
        const detail = (r.stderr || r.error?.message || "").split("\n")[0].trim();
        issues.push(`${home.name}: spine bin/${f} fails --check${detail ? ` (${detail})` : ""}`);
        spineBroken = true;
      }
    }
    const profiles = ['claude', 'codex'].filter((host) => exists(path.join(home.dataDir || home.dir, 'profiles', host, 'profile-manifest.json')));
    if (!profiles.length) issues.push('No isolated native host profile prepared');
    for (const host of profiles) {
      const native = path.join(home.dataDir || home.dir, 'profiles', host, 'native');
      const required = host === 'claude' ? ['CLAUDE.md', 'settings.json'] : ['AGENTS.md', 'config.toml'];
      for (const relative of required) if (!exists(path.join(native, relative))) issues.push(`${host}: missing ${relative}`);
    }
  }
  // A broken spine is a hard failure: the install cannot run. Force fail status
  // (drives overall status to FAIL) and zero the score regardless of other issues.
  if (spineBroken) {
    return {
      status: "fail",
      score: 0,
      issues,
      targets: homes.map((h) => h.name),
    };
  }
  return {
    status: issues.length ? "degraded" : "pass",
    score: issues.length ? Math.max(6, 20 - issues.length * 2) : 20,
    issues,
    targets: homes.map((h) => h.name),
  };
}

function inspectHooks(homes) {
  if (homes.length === 0) return { status: "fail", score: 0, issues: ["no install targets"] };
  const issues = [];
  for (const home of homes) {
    for (const h of REQUIRED_HOOKS) {
      if (!exists(path.join(home.dir, "hooks", h))) issues.push(`${home.name}: missing hooks/${h}`);
    }
    for (const host of ['claude', 'codex']) {
      const marker = path.join(home.dataDir || home.dir, 'profiles', host, 'profile-manifest.json');
      if (exists(marker) && readJson(marker)?.hook_validation !== 'passed') issues.push(`${host}: native hook execution not verified`);
    }
  }
  return {
    status: issues.length ? "degraded" : "pass",
    score: issues.length ? Math.max(4, 12 - issues.length) : 12,
    issues,
  };
}

function inspectProject(cwd) {
  const planning = path.join(cwd, ".planning");
  if (!exists(planning)) return { status: "not_applicable", score: 12, issues: [], phase: null };
  const tracking = readJson(path.join(planning, "tracking.json"));
  const stateText = readText(path.join(planning, "STATE.md"));
  const issues = [];
  if (!tracking) issues.push("tracking.json missing or invalid");
  if (!stateText) issues.push("STATE.md missing");
  const phaseMatch = stateText.match(/^Phase:\s*(\d+)/m);
  const statusMatch = stateText.match(/^Status:\s*(.+)$/m);
  const phase = phaseMatch ? Number(phaseMatch[1]) : (tracking && Number(tracking.phase)) || 1;
  if (!phaseMatch && stateText) issues.push("STATE.md phase header missing");
  if (!statusMatch && stateText) issues.push("STATE.md status missing");
  return {
    status: issues.length ? "degraded" : "pass",
    score: issues.length ? Math.max(4, 12 - issues.length * 4) : 12,
    issues,
    phase,
    project_status: statusMatch ? statusMatch[1].trim() : tracking?.status || "",
  };
}

function inspectContracts(cwd, phase) {
  const planning = path.join(cwd, ".planning");
  if (!exists(planning) || !phase) return { status: "not_applicable", score: 18, issues: [] };
  const planPath = path.join(planning, `phase-${phase}-plan.md`);
  const contractPath = path.join(planning, `phase-${phase}-contract.json`);
  if (!exists(planPath)) return { status: "not_applicable", score: 18, issues: [] };
  if (!exists(contractPath)) return { status: "degraded", score: 6, issues: [`phase ${phase}: JSON contract missing`] };
  const loaded = pc.readContractFile(contractPath);
  if (!loaded.ok) return { status: "fail", score: 0, issues: [`phase ${phase}: contract unreadable (${loaded.message || loaded.error})`] };
  const errors = pc.validate(loaded.contract);
  if (errors.length) return { status: "fail", score: 0, issues: [`phase ${phase}: contract invalid (${errors.length} issue(s))`] };
  const drift = pc.checkDrift(contractPath, planPath);
  if (drift.ok && drift.drift) return { status: "fail", score: 0, issues: [`phase ${phase}: contract drifted from plan`] };
  return { status: "pass", score: 18, issues: [], contract: path.relative(cwd, contractPath) };
}

function inspectLedger(cwd) {
  const planning = path.join(cwd, ".planning");
  if (!exists(planning)) return { status: "not_applicable", score: 10, issues: [] };
  const file = ledger.ledgerPath(cwd);
  if (!exists(file)) return { status: "degraded", score: 4, issues: ["state ledger missing"] };
  const result = ledger.validate(cwd);
  if (!result.ok) return { status: "fail", score: 0, issues: result.errors };
  if (result.count === 0) return { status: "degraded", score: 4, issues: ["state ledger empty"] };
  return { status: "pass", score: 10, issues: [], events: result.count };
}

function inspectMemory(homes) {
  if (homes.length === 0) return { status: "fail", score: 0, issues: ["no install targets"] };
  const issues = [];
  for (const home of homes) {
    const data = home.dataDir || home.dir;
    if (!exists(path.join(data, "knowledge", "index.md"))) issues.push(`${home.name}: knowledge/index.md not initialized`);
    if (!exists(path.join(data, "knowledge", "agents.md"))) issues.push(`${home.name}: knowledge/agents.md not initialized`);
    if (!exists(path.join(data, "knowledge", "daily-log"))) issues.push(`${home.name}: knowledge/daily-log not initialized`);
  }
  return {
    status: issues.length ? "degraded" : "pass",
    score: issues.length ? Math.max(2, 5 - issues.length) : 5,
    issues,
  };
}

function inspectDesign(homes) {
  if (homes.length === 0) return { status: "fail", score: 0, issues: ["no install targets"] };
  const issues = [];
  for (const home of homes) {
    for (const f of REQUIRED_DESIGN_FILES) {
      if (!exists(path.join(home.dir, "skyops-design", f))) issues.push(`${home.name}: missing skyops-design/${f}`);
    }
    if (!exists(path.join(home.dir, "skills", "sky-polish", "SKILL.md"))) {
      issues.push(`${home.name}: missing sky-polish skill`);
    }
    if (!exists(path.join(home.dir, "agents", "visual-evaluator.md"))) {
      issues.push(`${home.name}: missing visual-evaluator agent`);
    }
    if (!exists(path.join(home.dir, "bin", "slop-detect.mjs"))) {
      issues.push(`${home.name}: missing slop-detect.mjs`);
    }
  }
  return {
    status: issues.length ? "degraded" : "pass",
    score: issues.length ? Math.max(2, 8 - issues.length) : 8,
    issues,
  };
}

function inspectDeveloperExperience(homes) {
  if (homes.length === 0) return { status: "fail", score: 0, issues: ["no install targets"] };
  const issues = [];
  for (const home of homes) {
    for (const skill of REQUIRED_DEVELOPER_SKILLS) {
      if (!exists(path.join(home.dir, "skills", skill, "SKILL.md"))) issues.push(`${home.name}: missing ${skill} skill`);
    }
    if (!exists(path.join(home.dir, "skyops-guide.md"))) issues.push(`${home.name}: missing skyops-guide.md`);
    if (!exists(path.join(home.dir, "skyops-templates", "help.html"))) issues.push(`${home.name}: missing help.html`);
  }
  return {
    status: issues.length ? "degraded" : "pass",
    score: issues.length ? Math.max(1, 5 - issues.length) : 5,
    issues,
  };
}

function inspectSynchronization(homes) {
  if (homes.length === 0) return { status: "not_applicable", score: 10, issues: [] };
  const issues = [];
  let enabled = false;
  let queueCount = 0;
  for (const home of homes) {
    const data = home.dataDir || home.dir;
    const cfg = readJson(path.join(data, ".skyops-config.json")) || {};
    if (cfg.sync?.enabled === true) {
      enabled = true;
      if (!cfg.context?.user_id || !cfg.context?.workspace_id || !cfg.context?.project_id) issues.push('Synchronization needs a selected authenticated context');
      if (!cfg.sync.supabase_url) issues.push('Internal Supabase synchronization endpoint not configured');
    }
    try { queueCount += require('./sync-queue.js').scopedSummary().pending; }
    catch { issues.push('Synchronization queue requires recovery; contents were preserved'); }
  }
  if (!enabled && !issues.length) return { status: "not_applicable", score: 10, issues: [], queue_count: queueCount };
  if (queueCount > 0) issues.push(`Selected-context synchronization queue has ${queueCount} item(s)`);
  return {
    status: issues.length ? "degraded" : "pass",
    score: issues.length ? Math.max(3, 10 - issues.length * 3) : 10,
    issues,
    queue_count: queueCount,
  };
}

function buildTrustScore(cwd = process.cwd()) {
  const homes = installedHomes();
  const install = inspectInstall(homes);
  const hooks = inspectHooks(homes);
  const project = inspectProject(cwd);
  const contracts = inspectContracts(cwd, project.phase);
  const state_ledger = inspectLedger(cwd);
  const memory = inspectMemory(homes);
  const synchronization = inspectSynchronization(homes);
  const design = inspectDesign(homes);
  const developer_experience = inspectDeveloperExperience(homes);
  const checks = { install, hooks, project, contracts, state_ledger, memory, synchronization, design, developer_experience };
  const score = Math.max(0, Math.min(100, Object.values(checks).reduce((n, c) => n + (c.score || 0), 0)));
  const failCount = Object.values(checks).filter((c) => c.status === "fail").length;
  const degradedCount = Object.values(checks).filter((c) => c.status === "degraded").length;
  const status = failCount ? "FAIL" : degradedCount ? "DEGRADED" : "PASS";
  return { ok: failCount === 0, status, score, generated_at: new Date().toISOString(), checks };
}

function printHuman(result) {
  console.log(`Trust score: ${result.score}/100 (${result.status})`);
  for (const [name, check] of Object.entries(result.checks)) {
    const label = `${name[0].toUpperCase()}${name.slice(1)}`;
    console.log(`${label}: ${check.status} (${check.score})`);
    for (const issue of check.issues || []) console.log(`  - ${issue}`);
  }
}

function main(argv) {
  const result = buildTrustScore(process.cwd());
  if (argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else printHuman(result);
  return result.status === "FAIL" ? 1 : 0;
}

module.exports = {
  buildTrustScore,
  inspectInstall,
  inspectProject,
  inspectContracts,
  inspectLedger,
  inspectDesign,
  inspectDeveloperExperience,
};

if (require.main === module) process.exit(main(process.argv));
