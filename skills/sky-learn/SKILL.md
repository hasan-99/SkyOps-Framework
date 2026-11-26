---
name: sky-learn
description: "Save an authorized learning, pattern, fix or project preference in the correct personal, team, project or approved shared knowledge scope. Use for deliberate remembering without automatically sharing private context."
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

# /sky-learn — Save Knowledge

Persist useful learning across sessions while preserving its actual ownership and access scope. Keep the indexed knowledge layer, recurring pattern/fix recipes, project preferences and raw → curated → indexed learning progression. Start every new user's personal history clean; never import original user/client logs or credentials.

## Usage

- `/sky-learn` — capture a new lesson interactively.
- `/sky-learn {description}` — classify and save the supplied lesson when its scope/authorization is clear.

## Knowledge types

- **Pattern:** a recurring engineering/design approach, architecture decision, library choice or prompt pattern. Canonical type file: `learned-patterns.md`.
- **Fix:** an observed problem, diagnostic evidence and working repair. Canonical type file: `common-fixes.md`.
- **Project/client preference:** that application's own design, behavior or delivery requirement. Keep it in the authorized project scope (`client-prefs.md` or the maintained project equivalent), not shared framework knowledge.

Example pattern: add and test appropriate RLS in the same migration as a new table. Example fix: a browser/server font-import boundary caused a rendering failure; record the actual library/version and verified repair. Example preference: the selected application requests a particular theme, corner style or SVG logo. Do not infer that one application's identity applies to other generated applications.

## Process

```bash
node ${SKYOPS_HOME}/bin/skyops-ui.js banner learn
```

### 1. Classify and select ownership

Classify a supplied description automatically when clear. Otherwise ask which useful lesson should be retained: pattern, fix or project preference. Resolve personal/team/project ownership from the request and selected authorized context; ask only when that decision is genuinely ambiguous.

Cloud writes require the current individual account and scoped permissions. Offline writes use an existing verified authorized local scope and queue for conflict-aware revalidation/synchronization. An editable `OWNER` label cannot authorize another user's memory or promote private material to shared framework knowledge. Default an individual preference to personal scope and an application-specific requirement to that project's scope; do not default to shared framework knowledge.

Discover the actual implemented scoped CLI/MCP interface. If it is unavailable, or a legacy helper writes to an unscoped global knowledge directory, report that implementation/setup gate instead of claiming a private save. Do not create an ad hoc shared store or modify an unrelated host/framework installation.

### 2. Search for duplicates

Search only the destination's authorized index/knowledge for a near-match. Use the maintained scoped loader rather than an unbounded filesystem search. Retrieve enough relevant evidence to decide whether the lesson is new; do not load entire unrelated memory documents.

If a near-match exists, show only its authorized relevant excerpt and offer update, new entry or skip. Preserve entry identity/provenance on an update and refresh its index. Never overwrite another scope's entry to resolve a duplicate.

### 3. Append or update the entry

Preserve the existing entry contract: generated ID, ISO date, actual project/context provenance, type, title and a body specific enough to be useful later. Strip credentials and unnecessary sensitive information. Raw prompt capture is separate and disabled by default; a lesson is structured context, not permission to copy a whole conversation.

The preserved local helper's append contract is:

```text
node ${SKYOPS_HOME}/bin/knowledge.js append
  --type {pattern|fix|client}
  --title {title as data}
  --body {lesson as data}
  --project {actual selected project or a personal/general label}
  --context {minimal useful development context as data}
```

Use it only when the helper is bound to the authorized destination above. This is an argument contract, not shell source to interpolate with untrusted text. Use the implemented safe structured/data-file path; if that interface does not yet exist, do not invent flags or execute unsafe substitutions. The append operation retains canonical file mapping and creates an absent destination header/index only within the authorized owned scope.

- `pattern` → `learned-patterns.md`
- `fix` → `common-fixes.md`
- `client` → project-scoped `client-prefs.md`

A private-to-shared promotion is a separate explicitly authorized, sanitized review operation. Do not automatically absorb personal, team or project information into shared framework knowledge, even when a Framework Owner initiated the current session.

### 4. Maintain the index and synchronization evidence

Update the destination index in the same logical operation. Preserve retention/deletion configuration, local execution state and conflict-aware offline queueing. A local save or queued write is not cloud acknowledgment; later synchronization must recheck current identity, membership and project permissions.

Only confirm what happened:

```text
Saved: {actual authorized scope and entry ID/path}
Lesson: {title}
Synchronization: local only | queued | server acknowledged
```

For an unavailable/denied destination, report the exact reason and next authorized setup/recovery step; do not fabricate a successful save.

## Reading and discovery contracts

Use the maintained loader/index in the authorized scope. Preserve discovery of newly added knowledge files, aliases and both lexical/semantic retrieval capabilities where implemented. Local helper compatibility contracts include:

```text
knowledge.js                     # relevant scoped index
knowledge.js load patterns       # aliases remain supported
knowledge.js load common-fixes.md
knowledge.js list                # authorized available files only
knowledge.js search {topic}      # bounded authorized results
```

These contracts do not grant access by themselves. `/sky-fix` can recall relevant fixes, `/sky-new` can retrieve that project's preferences, and `/sky-plan` can retrieve relevant patterns through the same authorized boundary. `/sky-recall` is the read-side workflow. If the current helper cannot enforce the required scope, retain that limitation as an open implementation gate rather than reading or writing unrestricted shared history.
