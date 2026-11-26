#!/usr/bin/env node
// hooks/supabase-destructive-guard.js — block destructive Supabase CLI commands.
// PreToolUse hook on `Bash`. Exits 2 to BLOCK, 0 to allow.
//
// Blocked: supabase db reset, supabase db push --force, supabase migration repair.
// No environment variable or local role claim authorizes remote destruction.
// Why: DB wipes left orphan rows requiring full re-wipe (insights friction).

const fs = require("fs");
const path = require("path");
const os = require("os");

const _traceStart = Date.now();

function skyopsHome() {
  return require("../framework/paths.cjs").frameworkHome();
}

const SKYOPS_HOME = skyopsHome();

function _trace(result, extra) {
  try {
    const traceDir = path.join(SKYOPS_HOME, ".skyops-traces");
    if (!fs.existsSync(traceDir)) fs.mkdirSync(traceDir, { recursive: true });
    const entry = {
      hook: "supabase-destructive-guard", result,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - _traceStart, ...extra,
    };
    const file = path.join(traceDir, `${new Date().toISOString().split("T")[0]}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entry) + "\n");
  } catch {}
}

const DESTRUCTIVE = [
  /\b(npx\s+)?supabase\s+db\s+reset\b/i,
  /\b(npx\s+)?supabase\s+db\s+push\s+.*--force\b/i,
  /\b(npx\s+)?supabase\s+migration\s+repair\b/i,
];

// Read hook payload from stdin.
let payload = "";
try { if (!process.stdin.isTTY) payload = fs.readFileSync(0, "utf8"); } catch {}
let command = "";
try { if (payload) command = (JSON.parse(payload).tool_input || {}).command || ""; } catch {}

if (!command) { _trace("allow", { reason: "no-command" }); process.exit(0); }

const matched = DESTRUCTIVE.find((re) => re.test(command));
if (!matched) { _trace("allow", {}); process.exit(0); }

// Explicitly local reset remains available for disposable local testing. Do
// not accept compound commands, remote selectors or database URL overrides.
if (/^\s*(?:npx\s+(?:--no-install\s+)?)?supabase\s+db\s+reset\s+--local\s*$/i.test(command) && !process.env.SUPABASE_DB_URL) {
  _trace("allow", { reason: "explicit_local_reset_only" });
  process.exit(0);
}

const msg = [
  "BLOCKED: destructive or insufficiently scoped Supabase command.",
  "Environment variables and local role labels cannot authorize remote data destruction.",
  "Use an explicitly local reset for a disposable local stack,",
  "OR use safer alternatives: `supabase db diff` to preview,",
  "`supabase migration new` to add reversible changes.",
].join(" ");
console.error(msg);
_trace("block", { pattern_matched: matched.source });
process.exit(2);
