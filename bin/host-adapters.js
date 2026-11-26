#!/usr/bin/env node
// host-adapters.js — the single internal contract for everything that differs
// between the runtimes SkyOps targets (Claude Code, OpenAI Codex).
//
// The rule (ACP shape): NOTHING else branches on runtime. Skills, install, and
// hooks ask the adapter for a fact ("what's the instruction filename?", "how do
// I render this text for this host?") instead of hardcoding an `if (codex)`.
// When a third runtime arrives, it's one entry in HOSTS — not a grep-and-patch
// across the tree.

const path = require("path");
const os = require("os");
const { frameworkHome, hostHome } = require('../framework/paths.cjs');

// Per-host facts. Each host declares — declaratively, in ONE place:
//   home            install root
//   name            display name (used in the naming map + UX copy)
//   instructionFile the top-level agent-instructions file this runtime reads
//   configFile      the runtime's settings file
//   agentDir        where subagent definitions live (relative to home)
//   agentExt        the subagent file extension the runtime consumes
//   naming          source→host display-string swaps applied to rendered text
const HOSTS = {
  claude: {
    name: "Claude Code",
    get home() { return hostHome('claude'); },
    instructionFile: "CLAUDE.md",
    configFile: "settings.json",
    agentDir: "agents",
    agentExt: ".md",
    agentCli: "claude", // the CLI that runs a non-interactive turn for this host
    agentExecPrefix: ["-p"], // `claude -p "<prompt>"`
    naming: {}, // Claude is the canonical voice — no swaps.
  },
  codex: {
    name: "OpenAI Codex",
    get home() { return hostHome('codex'); },
    instructionFile: "AGENTS.md",
    configFile: "config.toml",
    agentDir: "agents",
    agentExt: ".toml",
    agentCli: "codex",
    agentExecPrefix: ["exec"], // `codex exec "<prompt>"`
    naming: { "Claude Code": "Codex", "Claude's": "Codex's" },
  },
};

// Which host owns this install home? (".codex" → codex, else claude.) The one
// place that maps a home dir back to a host name — callers ask, never re-derive.
function hostForHome(home) {
  const name = path.basename(home);
  if (name === 'native' && ['claude', 'codex'].includes(path.basename(path.dirname(home)))) return path.basename(path.dirname(home));
  if (name === 'codex' || name === '.codex') return 'codex';
  if (name === 'claude' || name === '.claude') return 'claude';
  if (['claude', 'codex'].includes(process.env.SKYOPS_HOST)) return process.env.SKYOPS_HOST;
  throw new Error('UNKNOWN_HOST_PROFILE');
}

function adapter(name, options = {}) {
  const host = HOSTS[name];
  if (!host) throw new Error(`Unknown SkyOps host adapter: ${name}`);
  const core = options.frameworkHome ? require('../framework/package-store.cjs').validateHome(options.frameworkHome) : frameworkHome();
  const profileHome = path.join(core, 'profiles', name);
  const home = path.join(profileHome, 'native');
  const descriptors = Object.getOwnPropertyDescriptors(host);
  delete descriptors.home;
  const facts = Object.defineProperties({}, descriptors);
  const renderedCore = core.replace(/\\/g, '/');
  const resourceRoot = (options.codeRoot || require('../framework/paths.cjs').codeRoot()).replace(/\\/g, '/');
  return {
    ...facts,
    home,
    profileHome,
    instructionPath: path.join(home, host.instructionFile),
    configPath: path.join(home, host.configFile),
    agentPath: path.join(home, host.agentDir),
    // Full argv (minus the binary) to run one non-interactive turn on this host.
    agentExec: (prompt) => [...host.agentExecPrefix, prompt],
    tokens: {
      SKYOPS_HOME: renderedCore,
      SKYOPS_BIN: `${resourceRoot}/bin`,
      SKYOPS_AGENTS: `${resourceRoot}/agents`,
      SKYOPS_SKILLS: `${resourceRoot}/skills`,
      SKYOPS_RULES: `${resourceRoot}/rules`,
      SKYOPS_TEMPLATES: `${resourceRoot}/skyops-templates`,
      SKYOPS_KNOWLEDGE: `${renderedCore}/knowledge`,
      SKYOPS_REFERENCES: `${resourceRoot}/skyops-references`,
      SKYOPS_REFERENCE_LIBRARY: `${resourceRoot}/references`,
      SKYOPS_DESIGN: `${resourceRoot}/skyops-design`,
    },
  };
}

// Host-display naming swaps only (e.g. "Claude Code" → "Codex"). Split out from
// path rendering so the canonical→artifact compile can swap names WITHOUT baking
// in install-time paths (install resolves those per host afterwards).
function applyNaming(content, hostName) {
  const host = HOSTS[hostName];
  if (!host) throw new Error(`Unknown SkyOps host adapter: ${hostName}`);
  let out = String(content);
  for (const [from, to] of Object.entries(host.naming)) {
    out = out.replaceAll(from, to);
  }
  return out;
}

// Path/token rendering: ${SKYOPS_*} tokens + legacy `.claude/` literals → this
// host's install paths. Idempotent (running twice is a no-op), so install can
// safely re-render an already-compiled artifact.
function applyPaths(content, hostName, options = {}) {
  const host = adapter(hostName, options);
  let out = String(content);
  for (const [directory, token] of Object.entries({ bin: 'SKYOPS_BIN', agents: 'SKYOPS_AGENTS', skills: 'SKYOPS_SKILLS', rules: 'SKYOPS_RULES', 'skyops-templates': 'SKYOPS_TEMPLATES', 'skyops-references': 'SKYOPS_REFERENCES', references: 'SKYOPS_REFERENCE_LIBRARY', 'skyops-design': 'SKYOPS_DESIGN', knowledge: 'SKYOPS_KNOWLEDGE' })) {
    out = out.replaceAll('${SKYOPS_HOME}/' + directory + '/', '${' + token + '}/');
    for (const prefix of ['~/.claude/', '$HOME/.claude/', '${HOME}/.claude/', '~/.codex/', '$HOME/.codex/', '${HOME}/.codex/']) out = out.replaceAll(prefix + directory + '/', '${' + token + '}/');
  }
  out = out.replace(/\bnode\s+(\$\{SKYOPS_(?:HOME|BIN)\}\/[A-Za-z0-9_./-]+\.[cm]?js)/g, 'node "$1"');
  for (const [token, value] of Object.entries(host.tokens)) {
    out = out.replaceAll(`\${${token}}`, value);
  }
  return out
    .replaceAll("~/.claude/", `${host.home}/`)
    .replaceAll("$HOME/.claude/", `${host.home}/`)
    .replaceAll("${HOME}/.claude/", `${host.home}/`)
    .replaceAll("@~/.claude/", `@${host.home}/`)
    .replaceAll("~/.codex/", `${host.home}/`)
    .replaceAll("$HOME/.codex/", `${host.home}/`)
    .replaceAll("${HOME}/.codex/", `${host.home}/`)
    ;
}

// Full install-time render: paths + naming. Unchanged public behavior.
function renderText(content, hostName, options = {}) {
  return applyNaming(applyPaths(content, hostName, options), hostName);
}

// Host-conditional blocks in a canonical source:
//   <!--SKYOPS-HOST claude-->  …kept only for claude…  <!--/SKYOPS-HOST-->
// Keep the matching host's block (unwrapped), drop every other host's block.
function stripHostBlocks(content, hostName) {
  const re = /[ \t]*<!--SKYOPS-HOST\s+(\w+)-->\n?([\s\S]*?)\n?[ \t]*<!--\/SKYOPS-HOST-->\n?/g;
  return String(content).replace(re, (_m, host, body) =>
    host === hostName ? `${body}\n` : ""
  );
}

// Compile a canonical instruction source into one host's artifact: resolve
// conditional blocks + apply naming, but DO NOT resolve paths or {{ROLE}} —
// those stay as tokens for install.js to render per concrete install.
function compileInstructions(canonical, hostName) {
  return applyNaming(stripHostBlocks(canonical, hostName), hostName).trimEnd() + '\n';
}

module.exports = {
  HOSTS,
  adapter,
  hostForHome,
  applyNaming,
  applyPaths,
  renderText,
  stripHostBlocks,
  compileInstructions,
};
