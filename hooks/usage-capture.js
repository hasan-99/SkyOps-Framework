#!/usr/bin/env node
/**
 * UserPromptSubmit hook — per-session framework-usage capture.
 *
 * Records, into `.planning/.session-usage.json` of the active project:
 *   - command_usage : a histogram of skyops slash-commands the engineer fired
 *   - prompt_samples: raw prompts only under explicit privacy opt-in
 *
 * `report-payload.js` folds both into the /sky-report clock-out payload, and
 * Reports may include authorized development metrics. This hook does not
 * implement employee monitoring or business performance assessment.
 *
 * Privacy: `privacy.captureRawPrompts` must be explicitly true in the isolated
 * SkyOps configuration. It defaults off. `privacy.developmentMetrics=false`
 * disables command counting. The project-local session file must not be committed.
 *
 * Never blocks: any error exits 0 with no stdout (adds no context to the prompt).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_SAMPLES = 60;
const MAX_SAMPLE_LEN = 8000;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function privacyConfiguration() {
  const home = require('../framework/paths.cjs').frameworkHome();
  return readJson(path.join(home, '.skyops-config.json'), {}).privacy || {};
}

function main() {
  let raw = '';
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    process.exit(0);
  }
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const prompt = typeof input.prompt === 'string' ? input.prompt : '';
  const cwd = input.cwd || input.cwd_path || process.cwd();
  if (!prompt.trim()) process.exit(0);

  // Only record inside a SkyOps project (has .planning/).
  const planningDir = path.join(cwd, '.planning');
  if (!fs.existsSync(planningDir)) process.exit(0);
  const privacy = privacyConfiguration();
  if (privacy.developmentMetrics === false && privacy.captureRawPrompts !== true) process.exit(0);

  const usageFile = path.join(planningDir, '.session-usage.json');
  const usage = readJson(usageFile, { command_usage: {}, prompt_samples: [] });
  if (!usage.command_usage || typeof usage.command_usage !== 'object') usage.command_usage = {};
  if (!Array.isArray(usage.prompt_samples)) usage.prompt_samples = [];

  // Count a skyops slash-command if one appears as a token in the prompt.
  const m = privacy.developmentMetrics === false ? null : prompt.match(/(?:^|\s)\/(sky-[a-z0-9-]+)/i);
  if (m) {
    const cmd = m[1].toLowerCase();
    usage.command_usage[cmd] = (usage.command_usage[cmd] || 0) + 1;
  }

  // Sample the real prompt for the prompt-quality judge (opt-in, disclosed).
  if (privacy.captureRawPrompts === true) {
    // Transparency: tell the engineer once per shift that prompts are recorded
    // and how to turn it off. stderr so it's seen but never enters model
    // context. The flag rides in the usage file, which is cleared at clock-out,
    // so the notice reappears each new shift. Best-effort — never blocks.
    if (!usage.notice_shown) {
      try {
        process.stderr.write(
          '\x1b[38;2;80;90;100m[skyops] This session records your /sky-next command usage and ' +
          'prompt samples under your explicit privacy opt-in. Disable captureRawPrompts ' +
          'in the isolated SkyOps privacy configuration to stop capture.\x1b[0m\n'
        );
      } catch { /* never block the prompt */ }
      usage.notice_shown = true;
    }
    usage.prompt_samples.push(prompt.trim().slice(0, MAX_SAMPLE_LEN));
    if (usage.prompt_samples.length > MAX_SAMPLES) {
      usage.prompt_samples = usage.prompt_samples.slice(-MAX_SAMPLES);
    }
  }

  try {
    fs.writeFileSync(usageFile, JSON.stringify(usage), { mode: 0o600 });
  } catch {
    /* best-effort; never block the prompt */
  }
  process.exit(0);
}

main();
