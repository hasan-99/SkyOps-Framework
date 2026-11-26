#!/usr/bin/env node
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const harnessEval = require("./harness-eval.js");
const { readLocalWorkPacket } = require("./work-packet.js");

function readJson(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function readText(file, fallback = "") {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return fallback;
  }
}

function skyopsHome() {
  return require("../framework/paths.cjs").frameworkHome();
}

function git(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 3000,
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function repoSlug(remote) {
  return (remote || "")
    .replace(/^git@github\.com:/, "github.com/")
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean)
    .pop();
}

function uuid(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : "";
}

function parseJourneyMilestones(content) {
  if (!content) return [];
  const milestones = [];
  const re = /^##\s+Milestone\s+(\d+)\s*[·•-]\s*(.+?)\s*(?:\[[^\]]+\])?\s*$/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    milestones.push({
      num: Number(match[1]),
      name: match[2].trim(),
    });
  }
  return milestones;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildSnapshot(options = {}) {
  const cwd = options.cwd || process.cwd();
  const home = options.home || os.homedir();
  const installHome = options.skyopsHome || skyopsHome(home);
  const now = options.now || new Date().toISOString();
  const planning = options.planningDir || path.join(cwd, ".planning");
  const tracking = readJson(path.join(planning, "tracking.json"), {});
  const config = readJson(path.join(installHome, ".skyops-config.json"), {});
  const journey = parseJourneyMilestones(readText(path.join(planning, "JOURNEY.md"), ""));
  const gitRemote = require('../framework/git-metadata.cjs').safeRemote(tracking.git_remote || git(["config", "--get", "remote.origin.url"], cwd));
  const selectedProject = require('../framework/paths.cjs').projectContextMatches(config.context, cwd) ? config.context.project_id : null;
  const projectId = uuid(tracking.project_id) || uuid(selectedProject) || null;
  const projectKey = tracking.project_id || selectedProject || repoSlug(gitRemote) || path.basename(cwd);
  const currentMilestone = Number(tracking.milestone || 1);
  const currentPhase = Number(tracking.phase || 0);
  const latestHarnessEval = harnessEval.latestEval(cwd);
  const workPacket = readLocalWorkPacket(cwd);
  const totalPhases = Number(tracking.total_phases || 0);
  const lifetime = tracking.lifetime && typeof tracking.lifetime === "object" ? tracking.lifetime : {};
  const closedMilestones = Array.isArray(tracking.milestones) ? tracking.milestones : [];
  const closedMilestoneNums = new Set(
    closedMilestones
      .map((m) => Number(m && m.num))
      .filter((n) => Number.isFinite(n))
  );
  const journeyTotal = journey.length || Math.max(currentMilestone, closedMilestones.length || 1);
  const phaseProgress =
    totalPhases > 0 && currentPhase > 0 ? (Math.max(0, currentPhase - 1) / totalPhases) : 0;
  const projectProgress =
    journeyTotal > 0
      ? ((closedMilestoneNums.size + Math.min(1, phaseProgress)) / journeyTotal) * 100
      : 0;

  return {
    snapshot_version: 1,
    generated_at: now,
    source: "skyops",
    framework_version: config.version || "",
    identifiers: {
      project_id: projectId,
      project_key: projectKey,
      ...(tracking.team_id ? { team_id: tracking.team_id } : {}),
      git_remote: gitRemote || "",
      ...(uuid(tracking.client_id) ? { client_id: uuid(tracking.client_id) } : {}),
      ...(uuid(tracking.workspace_id) ? { workspace_id: uuid(tracking.workspace_id) } : {}),
      ...(workPacket ? { work_packet_id: workPacket.id } : {}),
      ...(workPacket && workPacket.assignment_id ? { assignment_id: workPacket.assignment_id } : {}),
      ...(workPacket && workPacket.deadline_date
        ? { assignment_deadline: workPacket.deadline_date }
        : {}),
    },
    project: {
      name: tracking.project || path.basename(cwd),
      client: tracking.client || "",
      status: tracking.status || "setup",
      deployed_url: tracking.deployed_url || "",
      progress_percent: clampPercent(projectProgress),
    },
    current: {
      milestone: currentMilestone,
      milestone_name: tracking.milestone_name || "",
      phase: currentPhase,
      phase_name: tracking.phase_name || "",
      total_phases: totalPhases,
      tasks_done: Number(tracking.tasks_done || 0),
      tasks_total: Number(tracking.tasks_total || 0),
      verification: tracking.verification || "pending",
      gap_cycles: (tracking.gap_cycles || {})[String(currentPhase)] || 0,
    },
    quality: {
      harness_eval: latestHarnessEval
        ? {
            status: latestHarnessEval.status,
            score: latestHarnessEval.score,
            phase: latestHarnessEval.phase,
            generated_at: latestHarnessEval.generated_at,
            artifact: latestHarnessEval.artifacts && latestHarnessEval.artifacts.json,
          }
        : null,
    },
    journey: {
      total_milestones: journeyTotal,
      milestones: journey.map((milestone) => ({
        ...milestone,
        status:
          closedMilestoneNums.has(milestone.num)
            ? "closed"
            : milestone.num === currentMilestone
              ? "active"
              : "pending",
      })),
      closed_milestones: closedMilestones,
    },
    lifetime: {
      tasks_completed: Number(lifetime.tasks_completed || 0),
      phases_completed: Number(lifetime.phases_completed || 0),
      milestones_completed: Number(lifetime.milestones_completed || closedMilestoneNums.size || 0),
      total_phases: Number(lifetime.total_phases || 0),
      last_closed_milestone: Number(lifetime.last_closed_milestone || 0),
      build_count: Number(tracking.build_count || 0),
      deploy_count: Number(tracking.deploy_count || 0),
    },
    timestamps: {
      session_started_at: tracking.session_started_at || "",
      last_pushed_at: tracking.last_pushed_at || "",
      last_updated: tracking.last_updated || "",
    },
  };
}

function writeSnapshot(snapshot, options = {}) {
  const cwd = options.cwd || process.cwd();
  const planning = options.planningDir || path.join(cwd, ".planning");
  const outDir = options.outDir || path.join(planning, "snapshots");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = snapshot.generated_at.replace(/[:.]/g, "-");
  const file = path.join(outDir, `project-snapshot-${stamp}.json`);
  fs.writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`);
  return file;
}

function cloudConfig() { return require("../framework/cloud-transport.cjs").cloudConfig(); }

function uploadSnapshot(snapshot, options = {}) {
  return require("../framework/cloud-transport.cjs").request("project-snapshots", { ...options, method: "POST", body: snapshot });
}

function parseArgs(argv) {
  return {
    upload: argv.includes("--upload"),
    write: argv.includes("--write"),
    pretty: argv.includes("--pretty"),
  };
}

if (require.main === module) {
  (async () => {
    const args = parseArgs(process.argv.slice(2));
    const snapshot = buildSnapshot();
    if (args.write) {
      const file = writeSnapshot(snapshot);
      process.stdout.write(`${file}\n`);
    }
    if (args.upload) {
      const response = await uploadSnapshot(snapshot);
      process.stdout.write(`${JSON.stringify(response.body || { ok: true })}\n`);
    }
    if (!args.write && !args.upload) {
      process.stdout.write(`${JSON.stringify(snapshot, null, args.pretty ? 2 : 0)}\n`);
    }
  })().catch((error) => {
    console.error(`project-snapshot failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildSnapshot,
  cloudConfig,
  parseJourneyMilestones,
  repoSlug,
  uploadSnapshot,
  uuid,
  writeSnapshot,
};
