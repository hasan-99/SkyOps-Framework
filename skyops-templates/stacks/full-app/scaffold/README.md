# Full App

Authenticated product — Next.js 16 + Supabase (auth + Postgres + RLS) + Tailwind + local Node runtime + GitHub CI/delivery.

## Starter and account boundaries

This is an initial runnable scaffold, not a fully verified production application. Initialize this application’s own local Supabase stack/configuration before local migrations; never point these instructions at the framework or an unrelated existing project. Remote migrations require an explicitly verified application target and authorization. Complete the roadmap’s actual authentication, authorization, RLS, rate-limit, privacy and end-to-end checks before exposing any endpoint or claiming production readiness.

## Run

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npx supabase db push --local # only after this application’s isolated local stack is initialized
npm run dev                  # http://localhost:3000
```

## Where things live

- `app/page.tsx` — entry; reads the session via the server adapter.
- `lib/supabase/server.ts` — server adapter. **All mutations go here.**
- `lib/supabase/client.ts` — browser adapter (publishable key only).
- `supabase/migrations/` — schema. **Every table has RLS from the first migration.**
- `.env.example` — required env. `SUPABASE_SERVICE_ROLE_KEY` is server-only.

## Non-negotiables (constitution)

- RLS on every table; authorize on `app_metadata`, never `user_metadata`.
- `service_role` key never `NEXT_PUBLIC_`, never in a client component.
- Schema changes are migrations only — never hand-applied to remote.

This is an MVP skeleton. Build the real auth + capabilities per `.planning/ROADMAP.md`.

## Delivery boundaries

Apply the shared `rules/deployment.md` and `rules/infrastructure.md` gates. Preserve local SSR/API and persistent-worker execution; static GitHub Pages and bounded Supabase Edge Functions are not equivalent runtimes. GitHub CI/Release artifacts are not live deployments: without the actual authorized target/URL and required smoke/auth/user-flow evidence, report deployment prepared/live delivery pending and do not mark shipped or handoff complete. No additional hosting provider is mandatory. Application Supabase, credentials, accounts and branding remain independent of SkyOps.
