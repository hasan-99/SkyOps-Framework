# Internal Tool — Definition of Done

Per-stack verify checklist. Inherits `rules/constitution.md` and the `web-app` archetype DoD.
Internal/living product → runs as a **rolling release**; each increment clears this DoD, no terminal Handoff.

## Portal auth & access (constitution)
- [ ] Public signup disabled — staff join by invite / SSO only.
- [ ] Roles stored in `app_metadata` (never `user_metadata`); role-based routing in middleware AND data layer.
- [ ] **RLS enabled on every table**; verified as two roles — each sees only its scope.
- [ ] Every UPDATE policy has a matching SELECT policy.
- [ ] Postgres views set `security_invoker = true`.
- [ ] Sessions revoked before a user is deleted/deactivated.

## Security
- [ ] `SUPABASE_SERVICE_ROLE_KEY` server-only; used only in server actions (e.g. inviting users).
- [ ] Mutations use `lib/supabase/server.ts`; inputs validated with Zod.
- [ ] Security headers (HSTS); MFA on Supabase/GitHub accounts.

## App quality
- [ ] Loading / empty / error states on every async surface.
- [ ] Destructive actions confirm; soft-delete + audit where flagged.
- [ ] Rate limiting on mutating endpoints; no N+1 on list views.

## Schema flow
- [ ] All schema changes are migrations in `supabase/migrations/`.
- [ ] `npx supabase gen types` run after schema changes.

## Build & Deploy
- [ ] `npx tsc --noEmit` exits 0; `next build` succeeds.
- [ ] Authorized target is verified (compatible static GitHub Pages or application-specific local/Supabase runtime); HTTP 200; auth callback + role isolation verified.
- [ ] Design anti-slop bar met; a11y AA.

## Delivery boundaries

Apply the shared `rules/deployment.md` and `rules/infrastructure.md` gates. Preserve local SSR/API and persistent-worker execution; static GitHub Pages and bounded Supabase Edge Functions are not equivalent runtimes. GitHub CI/Release artifacts are not live deployments: without the actual authorized target/URL and required smoke/auth/user-flow evidence, report deployment prepared/live delivery pending and do not mark shipped or handoff complete. No additional hosting provider is mandatory. Application Supabase, credentials, accounts and branding remain independent of SkyOps.
