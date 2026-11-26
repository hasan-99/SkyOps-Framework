# Project-Type Stack Presets

These are generated-application templates, not a framework portal or administrative service. Application UI, accounts, data and branding remain independent. Optional integrations are configured only when scoped.

These presets turn the question *"what kind of project is this?"* into a runnable
starting point. When `sky-new` asks the user to pick a project type, the chosen
preset supplies the env contract, the phase plan, the Definition-of-Done checklist,
and a minimal-but-real code scaffold.

These assets belong to the shared core’s `skyops-templates/stacks/` directory and must be included in its verified package/asset manifest. Persistent user data and native host profiles are separate. New assets require compiler/package inventory and validation coverage; do not assume an unchecked wholesale copy succeeded.

## The four stacks

| `id`            | What it is                                                         | Database / auth          | AI       | Voice    |
|-----------------|-------------------------------------------------------------------|--------------------------|----------|----------|
| `landing-page`  | Static / SSG marketing site. No login, no DB.                     | none                     | none     | none     |
| `full-app`      | Authenticated product: accounts, roles, dashboard, RLS-everywhere. | Supabase (auth + RLS)    | optional | none     |
| `ai-agent`      | LLM / chat / tool-calling agent on top of the full-app base.       | Supabase (+ pgvector)    | OpenRouter | optional |
| `internal-tool` | Staff-only portal / admin tool. Same Supabase base as full-app.    | Supabase (auth + RLS)    | optional | none     |

All stacks default to the SkyOps standard: **Next.js 16 (App Router) + React 19 +
TypeScript + Tailwind + local Node runtime + GitHub CI/delivery**. The AI preset uses configured **OpenRouter** routing; AI/provider integrations remain optional for the framework and selected by each application. Data-backed applications use their own **Supabase** project; a static landing page needs none.

## Preset contract (every `<id>/` directory has exactly this shape)

```
templates/stacks/<id>/
  stack.json            metadata: id, title, description, archetype, defaultStack,
                        scaffoldEntry, whenToUse
  env.required.json     array of { name, purpose, howToObtain, ownerIssued }
  phases.md             the increment / phase plan tuned for this stack
  verify-checklist.md   the per-stack Definition-of-Done checklist
  scaffold/             a minimal but REAL runnable starter (MVP, not a full app)
```

### `stack.json` fields

| Field           | Meaning                                                                             |
|-----------------|-------------------------------------------------------------------------------------|
| `id`            | Stack id; must equal the directory name.                                            |
| `title`         | Human label shown in the `sky-new` project-type picker.                          |
| `description`   | One line describing what this stack builds.                                         |
| `archetype`     | The `references/archetypes/*.md` file whose DoD + Road this stack borrows.           |
| `defaultStack`  | The default tech string (Next.js / Supabase / OpenRouter / …).                      |
| `scaffoldEntry` | The file a developer opens first after the scaffold is laid down.                   |
| `whenToUse`     | A short "pick this when…" sentence to disambiguate from neighbouring stacks.        |

### Stack → archetype mapping (DoD source of truth)

The stack ids are a delivery-facing rename of the archetype ids. The mapping keeps
`sky-scope`'s archetype DoD grill and `sky-doctor`'s env check consistent:

| Stack `id`      | `archetype` (DoD source)        |
|-----------------|---------------------------------|
| `landing-page`  | `website`                       |
| `full-app`      | `web-app`                       |
| `ai-agent`      | `ai-agent`                      |
| `internal-tool` | `web-app`                       |

`internal-tool` and `landing-page` reuse `web-app` / `website` DoD respectively;
their `phases.md` and `verify-checklist.md` narrow that DoD to the stack's shape
(no public SEO for an internal tool, no auth for a landing page).

### `env.required.json` fields

Each entry is an environment variable the stack needs to run:

| Field         | Meaning                                                                              |
|---------------|--------------------------------------------------------------------------------------|
| `name`        | The env var name (e.g. `NEXT_PUBLIC_SUPABASE_URL`).                                  |
| `purpose`     | Why the stack needs it.                                                              |
| `howToObtain` | The exact step (or CLI command) to get the value.                                    |
| `optional` | When true, check/configure only if that integration is enabled and required by the selected application workflow. |
| `ownerIssued` | `true` if only the authorized application/provider account owner can issue the key; `false` if self-serve.           |

`ownerIssued: true` marks a credential governed by the selected application/provider account owner, not a special person or automatic framework-owner privilege. An authorized developer who owns that account may create its project-specific key through the provider’s secure flow. When a required configured credential is missing,
`sky-doctor` prints **"ask the authorized application/provider account owner for this key"** instead of a self-serve
fix command.

## How `sky-new` consumes a preset

After the user picks a project type, `sky-new`:

1. Resolves the chosen `id` to `templates/stacks/<id>/`.
2. Copies `env.required.json` → the new project's `.planning/env.required.json`
   (creating `.planning/` if absent).
3. Folds `phases.md` into the generated plan as the milestone-arc starting point.
4. Lays down `scaffold/` into the project root (a runnable skeleton, then the
   roadmapped phases build on it).

## How `sky-doctor` consumes a preset

`sky-doctor` reads `.planning/env.required.json` (falling back to `./env.required.json`)
and, for each entry:

1. Determines whether the selected application needs the integration. Skip optional entries when it does not; otherwise check nonempty presence in secure environment configuration without printing the value.
2. Checks the relevant CLI logins: `gh auth status` when repository access is needed; Supabase CLI presence/authentication only for the selected application workflow. Do not enumerate unrelated projects.
3. Prints **PASS / FAIL** per item with the EXACT fix command.
4. For `ownerIssued: true` vars whose value is missing, prints
   **"ask the authorized application/provider account owner for this key"** rather than a self-serve command.

## Editing a preset

- Keep the scaffold MVP. A runnable skeleton, not a finished app — the roadmapped
  phases earn the rest.
- Keep `env.required.json` accurate. A var that the scaffold does not actually read
  should not be listed; a var the scaffold needs to boot must be.
- After editing any JSON, validate it parses:
  `node -e "require('./templates/stacks/<id>/stack.json')"`.
