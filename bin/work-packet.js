#!/usr/bin/env node
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");

const WORK_PACKET_FILE = path.join(".planning", "work-packet.json");

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

function uuid(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : "";
}

function localWorkPacketPath(cwd = process.cwd()) {
  return path.join(cwd, WORK_PACKET_FILE);
}

function normalizePacket(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const packet = raw.work_packet && typeof raw.work_packet === "object" ? raw.work_packet : raw;
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) return null;
  const id = uuid(packet.id || packet.work_packet_id);
  const projectId = uuid(packet.project_id);
  if (!id || !projectId) return null;
  return {
    id,
    project_id: projectId,
    assignment_id: uuid(packet.assignment_id) || null,
    assignee_id: uuid(packet.assignee_id) || null,
    deadline_date: typeof packet.deadline_date === "string" ? packet.deadline_date : null,
    current_milestone: Number.isFinite(packet.current_milestone) ? packet.current_milestone : null,
    current_milestone_name:
      typeof packet.current_milestone_name === "string" ? packet.current_milestone_name : null,
    current_phase: Number.isFinite(packet.current_phase) ? packet.current_phase : null,
    current_phase_name: typeof packet.current_phase_name === "string" ? packet.current_phase_name : null,
    next_command: typeof packet.next_command === "string" ? packet.next_command : "/sky-next",
    definition_of_done:
      typeof packet.definition_of_done === "string" ? packet.definition_of_done : null,
    blockers: Array.isArray(packet.blockers) ? packet.blockers.filter((b) => typeof b === "string") : [],
    repo_url: typeof packet.repo_url === "string" ? packet.repo_url : null,
    deployed_url: typeof packet.deployed_url === "string" ? packet.deployed_url : null,
    framework_status:
      typeof packet.framework_status === "string" ? packet.framework_status : null,
    verification: typeof packet.verification === "string" ? packet.verification : null,
    snapshot_generated_at:
      typeof packet.snapshot_generated_at === "string" ? packet.snapshot_generated_at : null,
    last_report_at: typeof packet.last_report_at === "string" ? packet.last_report_at : null,
    status: typeof packet.status === "string" ? packet.status : "active",
    updated_at: typeof packet.updated_at === "string" ? packet.updated_at : null,
    assignee: packet.assignee && typeof packet.assignee === "object" ? packet.assignee : null,
    project: packet.project && typeof packet.project === "object" ? packet.project : null,
  };
}

function readLocalWorkPacket(cwd = process.cwd()) {
  return normalizePacket(readJson(localWorkPacketPath(cwd), null));
}

function writeLocalWorkPacket(packet, options = {}) {
  const cwd = options.cwd || process.cwd();
  const file = options.file || localWorkPacketPath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(packet, null, 2)}\n`);
  return file;
}

function cloudConfig() { return require("../framework/cloud-transport.cjs").cloudConfig(); }

function trackingProjectId(cwd = process.cwd()) {
  const tracking = readJson(path.join(cwd, ".planning", "tracking.json"), {});
  return uuid(tracking.project_id);
}



async function pullWorkPacket(options = {}) {
  const cfg = options.cloud || cloudConfig();
  const projectId = uuid(options.projectId) || uuid(cfg.context?.project_id) || trackingProjectId(options.cwd || process.cwd());
  if (!projectId || projectId !== cfg.context?.project_id) throw new Error("SELECTED_PROJECT_CONTEXT_MISMATCH");
  const response = await require("../framework/cloud-transport.cjs").request("work-packets", { ...options, cloud: cfg });
  const packet = normalizePacket(response.body);
  if (!packet || packet.project_id !== projectId) throw new Error("CLOUD_WORK_PACKET_CONTEXT_MISMATCH");
  return packet;
}

function parseArgs(argv) {
  const args = {
    action: "show",
    projectId: "",
    write: false,
    pretty: false,
    output: "",
  };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith("-")) args.action = rest.shift();
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--project" || arg === "-p") args.projectId = rest[++i] || "";
    else if (arg === "--write") args.write = true;
    else if (arg === "--pretty") args.pretty = true;
    else if (arg === "--output" || arg === "-o") args.output = rest[++i] || "";
  }
  return args;
}

if (require.main === module) {
  (async () => {
    const args = parseArgs(process.argv.slice(2));
    if (args.action === "pull") {
      const packet = await pullWorkPacket({ projectId: args.projectId });
      const file = writeLocalWorkPacket(packet, { file: args.output || undefined });
      process.stdout.write(args.pretty ? `${JSON.stringify(packet, null, 2)}\n` : `${file}\n`);
      return;
    }
    const packet = readLocalWorkPacket();
    if (!packet) throw new Error("No local .planning/work-packet.json found");
    process.stdout.write(`${JSON.stringify(packet, null, args.pretty ? 2 : 0)}\n`);
  })().catch((error) => {
    console.error(`work-packet failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  WORK_PACKET_FILE,
  cloudConfig,
  localWorkPacketPath,
  normalizePacket,
  pullWorkPacket,
  readLocalWorkPacket,
  trackingProjectId,
  uuid,
  writeLocalWorkPacket,
};
