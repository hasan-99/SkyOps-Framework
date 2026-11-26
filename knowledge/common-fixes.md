# Generic engineering fix recipes

These are reusable technical lessons extracted without original user/client/project history. Verify version-specific behavior before applying a recipe. No old project IDs, dates, contacts, commit references or infrastructure settings are imported.

## Build and dependency failures

- Module not found: compare filename/import casing; filesystem case sensitivity varies by operating system and volume. Test the Linux build as well as the primary development environment.
- Memory exhaustion: measure the build first, then configure an appropriate Node heap limit in the selected local/CI environment. Do not assume a fixed heap size fits every machine.
- Missing dependencies: restore using the selected project's package manager and lockfile (for example npm ci when a valid npm lockfile exists). Inspect unexpected changes; never delete user files as a repair shortcut.
- Stale generated database types: regenerate from the explicitly selected application's schema/project. Never point application type generation at the internal framework database.

## Runtime and deployment differences

Compare Node version, environment contracts and filename casing between local and GitHub CI environments. Public frontend environment variables are commonly embedded at build time; runtime changes alone may not update the client bundle. A blank page may come from browser-only window/document access during server rendering. An API failure may come from missing server configuration or an accidentally local development URL. Inspect actual logs and request URLs without printing secrets.

## Trailing whitespace in an API URL

A pasted newline in a configured API base URL can produce escaped newlines in request paths, causing failures that resemble CORS or routing errors. Inspect the actual request URL and validate configuration at startup. Correct the value through the project's secure configuration channel, then rebuild/restart as required. Do not hardcode a replacement credential or use removed-provider deployment commands.

## Supabase authorization, relations and connections

An authorized mutation can match zero rows without a transport error. Handle errors and check affected/returned rows for sensitive transitions, subject to RLS. Never report success solely because HTTP succeeded, disable RLS as a fix or reveal another tenant's row existence. Insert policy failures are not universally silent: handle their explicit errors too.

Use generated relation types: one-to-many relations and many-to-one relations have different shapes. Preserve a normalization helper where an actual contract needs it, rather than assuming every foreign key returns an array. For connection exhaustion, inspect connection usage and the configured pooler/limits; do not blindly reduce database limits.

## Next.js rendering and cache state

Hydration failures require matching server/client initial output; isolate browser-only dynamic content appropriately. Add the client directive only to components needing client hooks. After authorized mutations, invalidate the relevant server route/cache and any actual client query cache; do not assume every application uses SWR.

## Image CDN size variants and cross-platform flags

Choose a size supported by the configured image provider rather than multiplying srcset widths blindly. Verify responses and CSP image origins. Regional-indicator emoji rendering varies across platforms; tested image/icon assets can preserve consistent country indicators. The application's own asset/provider policy determines the solution.

## Contract evidence collisions and cross-platform command execution

Reserve .planning/evidence/phase-{N}-contract-run.json for the contract runner's own output. Give builder-collected evidence a different descriptive path and reference it explicitly, or the runner can overwrite its own input evidence.

On Windows, a command-exit check using npx may fail because a direct process launcher cannot execute a .cmd wrapper as a native executable. Prefer process.execPath with the installed tool's real JavaScript entry point when appropriate, or a reviewed platform-specific launcher. Preserve exit status and never repair this by disabling validation.

After an authorized plan/contract edit, recompute source_plan_hash using the existing plan-contract helper. A hash mismatch is drift requiring review, not permission to accept stale evidence.

## Managed audio-player lifecycle

A hook-managed audio player may release its native object automatically on unmount. Calling remove again can cause a double-release failure. Follow the installed library version's ownership contract: pause a hook-owned player when appropriate and let its hook dispose it; explicitly created players need their documented cleanup. Test unmount, retry and source replacement. Keep debugging evidence scoped and redacted.
