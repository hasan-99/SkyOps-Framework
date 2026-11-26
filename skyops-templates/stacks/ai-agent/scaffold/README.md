# AI Agent

LLM / chat / agent — Next.js 16 + Supabase + OpenRouter (+ optional Retell/ElevenLabs/Telnyx voice).

## Starter and account boundaries

This is an initial runnable scaffold, not a fully verified production application. Initialize this application’s own local Supabase stack/configuration before local migrations; never point these instructions at the framework or an unrelated existing project. Remote migrations require an explicitly verified application target and authorization. Complete the roadmap’s actual authentication, authorization, RLS, rate-limit, privacy and end-to-end checks before exposing any endpoint or claiming production readiness.

## Run

```bash
npm install
cp .env.example .env.local   # fill Supabase keys + OPENROUTER_API_KEY (request secure project-scoped provider configuration)
npx supabase db push --local # only after this application’s isolated local stack is initialized
npm run dev                  # http://localhost:3000
curl -X POST localhost:3000/api/chat -H 'content-type: application/json' \
  -d '{"message":"hello"}'
```

## Where things live

- `app/api/chat/route.ts` — the agent endpoint (input validation + routing).
- `lib/openrouter/client.ts` — the ONLY seam that talks to the LLM. Model + fallback chain here.
- `lib/prompts/system.ts` — system prompt in source control, never inline.
- `lib/supabase/server.ts` — server adapter (mutations, RLS).
- `supabase/migrations/` — conversations + messages, RLS from the first migration.
- `evals/cases.json` — **the ship gate**. No ship before the suite is green (Phase 3).

## Non-negotiables

- This preset uses the configured OpenRouter seam. Other applications may select another approved provider; model routes/fallbacks stay configurable. No provider account is required for core SkyOps installation.
- Evals are the finish line, not "it replied".
- `service_role` + `OPENROUTER_API_KEY` server-only, never logged.

This is an MVP skeleton. Build the streaming loop, persistence, and evals per `.planning/ROADMAP.md`.

## Delivery boundaries

Apply the shared `rules/deployment.md` and `rules/infrastructure.md` gates. Preserve local SSR/API and persistent-worker execution; static GitHub Pages and bounded Supabase Edge Functions are not equivalent runtimes. GitHub CI/Release artifacts are not live deployments: without the actual authorized target/URL and required smoke/auth/user-flow evidence, report deployment prepared/live delivery pending and do not mark shipped or handoff complete. No additional hosting provider is mandatory. Application Supabase, credentials, accounts and branding remain independent of SkyOps.
