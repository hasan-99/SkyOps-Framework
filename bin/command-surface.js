#!/usr/bin/env node
// Canonical SkyOps command surface.
//
// The repo may keep retired skills for migration/history, but installs should
// expose the small active surface below. This gives users fewer commands while
// preserving compatibility cleanup for older installs.

const ACTIVE_SKILLS = [
  "sky-next",
  "sky-new",
  "sky-scope",
  "sky-map",
  "sky-research",
  "sky-plan",
  "sky-build",
  "sky-verify",
  "sky-eval",
  "sky-fix",
  "sky-feature",
  "sky-review",
  "sky-optimize",
  "sky-polish",
  "sky-test",
  "sky-milestone",
  "sky-update",
  "sky-ship",
  "sky-handoff",
  "sky-report",
  "sky-doctor",
  "sky-road",
  "sky-learn",
  "sky-recall",
  "sky-postmortem",
  "sky-idk",
  "sky-secure",
  "sky-zoho-workflow",
  "sky-deep-research",
];

const RETIRED_SKILLS = [
  // Historical folds.
  "sky-task",
  "sky-quick",
  "sky-polish-loop",
  "skyops-design",
  "sky-prd",

  // v6.3 surface reduction: keep the behavior under sharper active commands.
  "sky-debug",      // folded into sky-fix for actionable repairs
  "sky-vibe",       // folded into sky-polish modes/documentation
  "sky-help",       // guide/help files remain installed; no slash command
  // sky-idk RESTORED in v6.3.1 — owner pivot: keep the deep diagnostic
  // separate from the cheap router. /sky-next stays mechanical, /sky-idk
  // does the heavy three-scan synthesis with paste-ready command sequence.
  "sky-pause",      // folded into skyops router handoff branch
  "sky-resume",     // folded into skyops router handoff branch
  "sky-zoom",       // folded into sky-map/sky-review as an analysis mode
  "sky-issues",     // GitHub queue externalization is not default workflow
  "sky-triage",     // GitHub queue routing is not default workflow
  "sky-hook-gen",   // framework-authoring utility, not employee default
  "sky-skill-new",  // framework-authoring utility, not employee default
  "sky-flush",      // available as skyops flush / automation

  // A4 surface collapse (v6.7): folded where a surviving skill genuinely covers it.
  "sky-discuss",    // folded into sky-scope — PROJECT MODE (kickoff → project-discovery.md) + PHASE MODE (grill → phase-N-context.md) now live there via its mode router
];

function activeSkills() {
  return [...ACTIVE_SKILLS];
}

function retiredSkills() {
  return [...RETIRED_SKILLS];
}

module.exports = {
  ACTIVE_SKILLS,
  RETIRED_SKILLS,
  activeSkills,
  retiredSkills,
};

