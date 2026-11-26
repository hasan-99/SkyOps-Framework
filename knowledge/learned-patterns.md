# Generic engineering patterns

Authorized generic seed knowledge only. Private user, client and project histories are excluded. Verify technical/version-specific advice before applying it.

## Working context and quality

- Confirm the working directory and selected user/workspace/project before acting.
- Read applicable project instructions before edits. Claude Code and Codex retain their native instruction mechanisms while sharing the SkyOps core.
- Run the relevant deterministic type, lint, test, build and verification checks. Choose execution depth by risk; mandatory security/correctness checks are never waived.
- Use feature branches and configured repository protections. Preserve the approved integration and verified delivery workflow.
- Distinguish a validated runnable artifact from a live deployment. Run real post-delivery checks against the actual authorized application URL.
- Enable optional monitoring only for the selected application's configured account; never inherit an original organization's status page or require an optional account for local installation.
- Authorize server mutations with the current user and enforce database RLS. Use server-only credentials only on trusted server paths.

## Privacy and efficient execution

- Never expose service-role secrets in client code or commit secret environment files.
- Use secure scoped configuration, never hardcoded keys or another project's credentials.
- Avoid dynamic execution and unsafe HTML insertion; when rendering approved HTML is necessary, use a reviewed sanitizer and the application's security policy.
- Use direct file search for simple lookups instead of unnecessary agent calls.
- Retrieve bounded relevant knowledge; do not reload the whole framework or repeat completed research without a reason.
- Raw prompt capture is explicitly opted in. Do not promote private user/team/project context into shared framework knowledge automatically.

## Project specialist discovery

Load the selected project's own conventions and relevant authorized specialists for financial calculations, Arabic/RTL, notifications or subscriptions when those capabilities are actually present. Do not claim that an unavailable domain-specific skill exists. Preserve the generic learning structure and relevance-based triggering without importing original client-only skill names or histories.

## Sensitive mutation evidence

Handle database errors and verify affected/returned rows for sensitive state changes. A filtered update/delete may affect no authorized rows without a transport error; insert authorization failures may return explicit errors. Test both. Keep RLS active and avoid exposing private row existence. See common-fixes.md and supabase-patterns.md.

## Adding lessons

Use /sky-learn in the authorized scope, retain supporting evidence and update its index. Personal memories start empty. Shared generic knowledge requires explicit authorization, sanitization and review; a framework administrator does not automatically gain access to private source memories.
