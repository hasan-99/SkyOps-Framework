# Landing Page

Static/SSG marketing site — Next.js 16 + Tailwind + local Node runtime + GitHub CI/delivery. No database, no auth.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

## Ship

```bash
npm run build
# Publish a release/artifact through the configured GitHub workflow.
# Only a configured compatible static export may use GitHub Pages.
# Live delivery stays pending until its actual target is verified.
```

## Where things live

- `app/page.tsx` — the landing page itself (replace the hero copy).
- `app/globals.css` — OKLCH design tokens. Source of truth is `.planning/DESIGN.md`.
- `.env.example` — nothing required; copy to `.env.local` only if you add analytics.

This is an MVP skeleton. Build the real sections per `.planning/ROADMAP.md`.

## Delivery boundaries

Apply the shared `rules/deployment.md` and `rules/infrastructure.md` gates. Preserve local SSR/API and persistent-worker execution; static GitHub Pages and bounded Supabase Edge Functions are not equivalent runtimes. GitHub CI/Release artifacts are not live deployments: without the actual authorized target/URL and required smoke/auth/user-flow evidence, report deployment prepared/live delivery pending and do not mark shipped or handoff complete. No additional hosting provider is mandatory. Application Supabase, credentials, accounts and branding remain independent of SkyOps.
