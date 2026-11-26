# Full App — Definition of Done

Per-stack verify checklist. Inherits `rules/constitution.md` and the `web-app` archetype DoD.

## Auth & Access (constitution — non-negotiable)
- [ ] Supabase auth with the chosen model; email verification + password reset wired.
- [ ] **RLS enabled on every table**, policies derived from `app_metadata` (never `user_metadata`).
- [ ] RLS verified as two+ users — each sees only its own rows.
- [ ] Every UPDATE policy has a matching SELECT policy.
- [ ] Postgres views set `security_invoker = true`.
- [ ] Storage upsert grants INSERT + SELECT + UPDATE on the bucket.
- [ ] Sessions revoked before a user is deleted.

## Security
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-only — never `NEXT_PUBLIC_`, never imported in a client component.
- [ ] Mutations use `lib/supabase/server.ts`; client reads use `lib/supabase/client.ts`.
- [ ] Inputs validated with Zod; no `dangerouslySetInnerHTML`, no `eval()`.
- [ ] Security headers (HSTS); CSRF/permission checks on every mutation.

## Schema flow
- [ ] All schema changes are migrations in `supabase/migrations/` — never hand-applied to remote.
- [ ] `npx supabase gen types` run after schema changes.

## App quality
- [ ] Every async surface has loading / empty / error states.
- [ ] Destructive actions confirm; rate limiting on mutating + public endpoints.
- [ ] No N+1 on list views.

## Build & Deploy
- [ ] `npx tsc --noEmit` exits 0; `next build` succeeds.
- [ ] Authorized target is verified (compatible static GitHub Pages or application-specific local/Supabase runtime); homepage returns HTTP 200; auth callback responds.
- [ ] Design anti-slop bar met (DESIGN.md); a11y AA.

## Delivery boundaries

Apply the shared `rules/deployment.md` and `rules/infrastructure.md` gates. Preserve local SSR/API and persistent-worker execution; static GitHub Pages and bounded Supabase Edge Functions are not equivalent runtimes. GitHub CI/Release artifacts are not live deployments: without the actual authorized target/URL and required smoke/auth/user-flow evidence, report deployment prepared/live delivery pending and do not mark shipped or handoff complete. No additional hosting provider is mandatory. Application Supabase, credentials, accounts and branding remain independent of SkyOps.
