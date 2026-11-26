# Internal Tool

Staff-facing portal — Next.js 16 + Supabase (invite-only auth + RLS) + Tailwind + local Node runtime + GitHub CI/delivery.
Target policy: public signup must be disabled and staff must join by authorized invite / SSO; configure and test this in the application’s own Supabase project. Runs as a rolling release.

## Starter and account boundaries

This is an initial runnable scaffold, not a fully verified production application. Initialize this application’s own local Supabase stack/configuration before local migrations; never point these instructions at the framework or an unrelated existing project. Remote migrations require an explicitly verified application target and authorization. Complete the roadmap’s actual authentication, authorization, RLS, rate-limit, privacy and end-to-end checks before exposing any endpoint or claiming production readiness.

## Run

```bash
npm install
cp .env.example .env.local   # fill Supabase keys
npx supabase db push --local # only after this application’s isolated local stack is initialized
npm run dev                  # http://localhost:3000
```

## Where things live

- `app/page.tsx` — portal entry; reads session + role from `app_metadata`.
- `lib/supabase/server.ts` — server adapter (mutations, RLS, inviting staff).
- `lib/supabase/client.ts` — browser adapter (publishable key only).
- `supabase/migrations/` — domain tables, RLS + role gating from the first migration.

## Non-negotiables (constitution)

- Roles live in `app_metadata`, never `user_metadata`.
- RLS on every table; every UPDATE policy has a matching SELECT.
- `service_role` server-only; used for inviting users from a server action.
- Disable public signup in the Supabase Auth settings.

This is an MVP skeleton. Build portal auth + workflows per `.planning/ROADMAP.md`.

## Delivery boundaries

Apply the shared `rules/deployment.md` and `rules/infrastructure.md` gates. Preserve local SSR/API and persistent-worker execution; static GitHub Pages and bounded Supabase Edge Functions are not equivalent runtimes. GitHub CI/Release artifacts are not live deployments: without the actual authorized target/URL and required smoke/auth/user-flow evidence, report deployment prepared/live delivery pending and do not mark shipped or handoff complete. No additional hosting provider is mandatory. Application Supabase, credentials, accounts and branding remain independent of SkyOps.
