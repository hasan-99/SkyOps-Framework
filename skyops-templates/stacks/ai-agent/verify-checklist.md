# AI Agent — Definition of Done

Per-stack verify checklist. Inherits `rules/constitution.md` and the `ai-agent` archetype DoD.

## Foundation & data
- [ ] Supabase with **RLS on every table** (conversations, messages, users, embeddings); pgvector if RAG.
- [ ] Migrations in version control; RLS verified as two+ users.

## Agent core
- [ ] LLM via **OpenRouter** with model fallback — never a hardcoded single provider.
- [ ] System prompts versioned in source, never inline.
- [ ] Streaming responses; context-window management.

## Evals (THE SHIP GATE)
- [ ] Pass/fail eval suite over real cases — green before "done".
- [ ] Covers the success metric AND the refusal/guardrail cases.

## Guardrails & cost
- [ ] Input validation; refusal/safety behavior; graceful fallback on model failure.
- [ ] Per-request + daily cost ceilings; token + latency logging.
- [ ] Each tool/action validated server-side; timeout + failure handling; idempotency on writes.

## Voice (if applicable)
- [ ] Latency budget < 800ms end-to-end through Retell + ElevenLabs + Telnyx.
- [ ] End-to-end call testing pass/fail; turn-taking / barge-in verified.
- [ ] Transcript logging + PII redaction; recording-consent disclosure.

## Security & deploy
- [ ] `service_role` server-only; OpenRouter/Retell/ElevenLabs/Telnyx keys in env, never logged.
- [ ] `npx tsc --noEmit` exits 0; deploys to the authorized application target (and local worker when scoped).
- [ ] Post-deploy smoke includes **real agent calls**.

## Delivery boundaries

Apply the shared `rules/deployment.md` and `rules/infrastructure.md` gates. Preserve local SSR/API and persistent-worker execution; static GitHub Pages and bounded Supabase Edge Functions are not equivalent runtimes. GitHub CI/Release artifacts are not live deployments: without the actual authorized target/URL and required smoke/auth/user-flow evidence, report deployment prepared/live delivery pending and do not mark shipped or handoff complete. No additional hosting provider is mandatory. Application Supabase, credentials, accounts and branding remain independent of SkyOps.
