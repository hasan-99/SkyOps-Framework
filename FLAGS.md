# SkyOps Skill Flags

One-page reference. If a flag isn't listed here, it doesn't exist as a SkyOps
skill flag — anything you see in a code example is a passthrough to git, npm,
or another underlying CLI.

## Road skills

| Skill | Flag | Effect |
|---|---|---|
| `/sky-new` | `--auto` | Chain end-to-end after journey approval. Pauses only at milestone boundaries. |
| `/sky-plan` | `--gaps` | Surgical-fix mode. Reads `phase-{N}-verification.md` FAILs, produces wave-1 fix tasks without touching passing items. |
| `/sky-verify` | `--adversarial` | Spawn a second-pass critic that attacks the verifier's own report. Required on auth / payment / migration phases. |
| `/sky-postmortem` | `--auto` | Auto-invoked by `/sky-verify` on FAIL. Identifies which agent/rule/skill should have caught the failure and proposes a delta. |

## Single-feature & repair

| Skill | Flag | Effect |
|---|---|---|
| `/sky-feature` | `--force-inline` | Skip auto-scoping; do the change inline without spawning a builder. |
| `/sky-feature` | `--force-spawn` | Skip auto-scoping; spawn a fresh builder even for a trivial change. |
| `/sky-fix` | `--quick` | Fastest repair lane; skip deep diagnostic. |
| `/sky-fix` | `--frontend` | Constrain to UI/component layer. |
| `/sky-fix` | `--perf` | Performance-bug variant; profile before patching. |
| `/sky-fix` | `--test` | Repair by writing a failing test first. |
| `/sky-fix` | `--no-commit` | Run the fix but don't auto-commit. |

## Polish (design)

| Skill | Flag | Effect |
|---|---|---|
| `/sky-polish` | `--redesign` | Ground-up redesign of a single component or route. |
| `/sky-polish` | `--critique` | Read-only critique pass (no edits). |
| `/sky-polish` | `--quick` | Single-pass polish without the loop. |
| `/sky-polish` | `--loop` | Autonomous visual-polish loop (screenshot → vision-eval → fix → repeat). |
| `/sky-polish` | `--vibe` | Aesthetic-token pivot (~3 min). Swap design tokens, keep layout. ONE direction by default. |
| `/sky-polish` | `--vibe --variants N` | Opt-in menu of N aesthetic directions instead of one opinion. |
| `/sky-polish` | `--vibe --extract <URL>` | Reverse-engineer DESIGN.md from a reference site. |
| `/sky-polish` | `--vibe --sync` | Show / patch drift between code (CSS vars + Tailwind) and DESIGN.md. |
| `/sky-polish` | `--register=brand\|product` | Hint at brand vs product register for the polish pass. |
| `/sky-polish` | `--brief PATH` | Use a written design brief file as additional input. |
| `/sky-polish` | `--max N` | Cap iterations or items processed. |
| `/sky-polish` | `--viewports W,W,W` | Override viewport widths for the visual loop. Default: `375,768,1440`. |

## Optimize

| Skill | Flag | Effect |
|---|---|---|
| `/sky-optimize` | `--perf` | Performance angle only. |
| `/sky-optimize` | `--ui` | UI / design angle only. |
| `/sky-optimize` | `--backend` | Backend / API angle only. |
| `/sky-optimize` | `--alignment` | Plan-vs-code alignment angle only. |
| `/sky-optimize` | `--deepen` | Find shallow modules; spawn 3 parallel interface-design variants per candidate. |
| `/sky-optimize` | `--fix` | After discovery, route practical repairs through `/sky-fix`. |

## Tests

| Skill | Flag | Effect |
|---|---|---|
| `/sky-test` | `--tdd` | Drive a feature test-first via vertical-slice loop (one test → one impl → repeat). |

## Ship & report

| Skill | Flag | Effect |
|---|---|---|
| `/sky-ship` | `--draft` | Open a draft PR; do not deploy. |
| `/sky-report` | `--dry-run` | Preview the ERP payload without committing or uploading. |

## Notes

- Flags are **additive** unless mutually exclusive (`--quick` vs `--loop` in polish, for example).
- Anything documented in a SKILL.md but not here is either an internal flag (not user-facing) or a stale reference — open an issue.
- For underlying CLI flags inside skill examples (`git push --force-with-lease`, `vercel --prod`, `gh pr create --draft`, ...), see those tools' own docs.
