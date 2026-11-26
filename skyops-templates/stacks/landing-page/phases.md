# Landing Page — Phase Plan

Stack: Next.js 16 (App Router, SSG) · Tailwind · local Node runtime · GitHub CI/delivery. No database, no auth.
Archetype: `website`. This is the seed plan `/sky-new` copies into ROADMAP.md.

## Phase 1: Foundation & Design System

**Goal:** The site renders at a verified local preview URL with the design system wired (tokens, fonts, OKLCH palette) and a base layout (nav + footer).

**Success criteria:**
1. `npm run dev` renders the homepage with no console errors.
2. DESIGN.md tokens are live (CSS variables, distinctive type pair — never Inter/Arial/system-ui).
3. Nav + footer render and are responsive at 375px and 1440px.
4. Deploys to a verified local preview URL.

## Phase 2: Hero & Core Sections

**Goal:** The above-the-fold hero plus the primary value sections (features, social proof) are built with real copy.

**Success criteria:**
1. Hero communicates the offer in one glance; primary CTA is present and reachable.
2. Feature/benefit sections render with real copy — no lorem ipsum.
3. All sections responsive, with loading-free SSG output.

## Phase 3: Conversion & Contact

**Goal:** The conversion path works — CTA → contact form or external link, with success/error states.

**Success criteria:**
1. Contact form (or CTA link) submits and shows a success state; errors are handled.
2. If a form posts anywhere, it validates client-side (Zod or equivalent) — no DB needed.
3. Analytics event fires on the primary CTA.

## Phase 4: Polish & Launch

**Goal:** Production-ready — SEO meta, a11y, performance, custom domain.

**Success criteria:**
1. SEO: title/description/OG tags per page; sitemap; favicon.
2. a11y: alt text, labels, keyboard nav, AA contrast.
3. Lighthouse performance/SEO green on the homepage.
4. Custom domain wired; production deploy + smoke (HTTP 200).

## Delivery boundaries

Apply the shared `rules/deployment.md` and `rules/infrastructure.md` gates. Preserve local SSR/API and persistent-worker execution; static GitHub Pages and bounded Supabase Edge Functions are not equivalent runtimes. GitHub CI/Release artifacts are not live deployments: without the actual authorized target/URL and required smoke/auth/user-flow evidence, report deployment prepared/live delivery pending and do not mark shipped or handoff complete. No additional hosting provider is mandatory. Application Supabase, credentials, accounts and branding remain independent of SkyOps.
