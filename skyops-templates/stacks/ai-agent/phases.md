# AI Agent — Phase Plan

Stack: Next.js 16 (local app + API runtime) · Supabase (Postgres + pgvector) · OpenRouter · Tailwind · local workers (when scoped).
Archetype: `ai-agent`. Seed plan copied into ROADMAP.md by `/sky-new`.
The differentiator is **Phase 3 — the eval gate**: no ship before evals are green.

## Phase 1: Foundation & Data

**Goal:** Stack deployed to the verified local runtime; Supabase wired with RLS on every table; OpenRouter wired with a model + fallback.

**Success criteria:**
1. Authenticated user can hit a real development endpoint; RLS verified as two users.
2. Schema: conversations, messages, users (+ pgvector tables if RAG).
3. OpenRouter wired with a model + fallback chain; secrets in env.
4. Deploys to a verified local preview URL.

## Phase 2: Core Agent Loop

**Goal:** A real end-to-end conversation works (input → model → response → persist), with cost/latency logged from the first call.

**Success criteria:**
1. Streaming chat works end-to-end and persists to Supabase.
2. System prompt lives in source control — never hardcoded inline.
3. Tool-calling scaffold present; RAG retrieval if applicable.
4. Per-request token + latency + cost logged.

## Phase 3: Evals & Guardrails (THE GATE)

**Goal:** The agent passes a measurable eval suite mapped to the success metric. Guardrails handle refusal, fallback, and tool failure.

**Success criteria:**
1. Eval harness with pass/fail cases mapped to the success metric — green.
2. Input validation; refusal/safety behavior; fallback on model failure; human-escalation path.
3. Each tool: server-side validation, timeout + failure handling, idempotency on writes.
4. Per-request + daily cost ceilings enforced. **No ship before this closes.**

## Phase 4: App Surface & Polish

**Goal:** Auth flows, rate limiting, and a non-AI-looking design pass.

**Success criteria:**
1. Auth flows + user management + rate limiting.
2. DESIGN.md anti-slop pass; responsive; all async states incl. streaming.
3. Product looks built, not generated.

## Phase 5: Handoff

**Goal:** Security review, prod deploy (the configured application runtime + local worker when scoped), real-call smoke, handover.

**Success criteria:**
1. Secrets/env audit; GDPR posture (consent, retention, export/delete).
2. Prod deploy; post-deploy smoke includes **real agent calls**, not just HTTP 200.
3. Credentials, walkthrough, archive, `/sky-report` saved locally, with authorized project synchronization when enabled.

## Delivery boundaries

Apply the shared `rules/deployment.md` and `rules/infrastructure.md` gates. Preserve local SSR/API and persistent-worker execution; static GitHub Pages and bounded Supabase Edge Functions are not equivalent runtimes. GitHub CI/Release artifacts are not live deployments: without the actual authorized target/URL and required smoke/auth/user-flow evidence, report deployment prepared/live delivery pending and do not mark shipped or handoff complete. No additional hosting provider is mandatory. Application Supabase, credentials, accounts and branding remain independent of SkyOps.
