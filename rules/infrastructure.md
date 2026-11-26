---
globs: ["*.env*", "next.config.*", "supabase/**", ".github/workflows/**"]
---

# Infrastructure and services

The mandatory framework infrastructure is local execution, GitHub and one dedicated SkyOps Supabase project. Do not introduce another mandatory hosting provider, business server, portal or dashboard.

## Supabase and data isolation

Every generated application uses its own independent Supabase project, database/migrations, authentication, authorization, Storage and environment configuration. Never use the internal framework project for generated application data. Check the selected project reference before linking, migrating, deploying functions or managing secrets.

Prefer deterministic Supabase CLI operations for migrations, types and local development; discover optional MCP tools only when the operation requires them. Enable and test RLS, keep service credentials server-side, use the application's server/client Supabase helpers, and regenerate database types after schema changes. All schema changes are migrations; do not make untracked remote schema edits.

Local Docker/Supabase is a development and test facility, not a mandatory installed-user runtime service. Cloud deployment requires an explicitly configured owned target and authorization; unavailable infrastructure is reported as unavailable, never passed.

## GitHub and delivery

The framework source is private under the approved owner/repository configuration. Ordinary licensed users receive authorized signed packages through Supabase, not source repository credentials. Use GitHub Actions for deterministic CI/CD, private releases and artifact production. Protect release/signing environments, pin third-party actions, and never expose signing/service secrets to pull requests or user packages.

Keep feature-branch work and the ship integration point. Respect the repository's actual protections and merge policy; do not disable protections to make a command succeed. Review, tests and mandatory correctness/security gates apply before integration.

## Local execution and deployment boundaries

Preserve local development servers, full builds, tests, backend processes, long-running workers and deployable artifacts. Static application delivery may use an appropriately authorized GitHub Pages target; verify visibility and project suitability. GitHub release artifacts are not running applications. Neither Pages nor Supabase Edge Functions is a general Next.js server/long-running worker host. Keep unsupported server workloads runnable locally and report the actual delivery limitation.

Use Supabase Edge Functions for appropriate bounded backend tasks, not as a mandatory replacement for local work. Record separate release/artifact and deployed URLs. Never invent a live URL or claim a build was deployed.

## Optional integrations

Retain OpenRouter, Retell, ElevenLabs, Telnyx, Zoho Books/Mail, Context7, NotebookLM, browser tooling, uptime monitoring and other approved capabilities. Activate them only for relevant projects/workflows; missing optional accounts must not block installation or ordinary development. Claude Code and Codex operate independently with configurable native model assignments; neither requires OpenRouter or the other host.

Use user/Nexus-AI-controlled accounts, least-privilege project-specific configuration, secure credential storage, provider health checks and actual error results. Do not assume an old account, organization, sender identity, monitor ID, client mapping or API key. Do not hardcode provider models or credentials; resolve supported capabilities from current documentation/configuration when needed.

For generated applications, environment templates document variable names only. Public Supabase keys may be exposed only with enforced RLS; service-role/signing/integration secrets are never public client variables. Store integration credentials through the approved secure configuration path and keep them out of prompts, source, logs and committed files.
