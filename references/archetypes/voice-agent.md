---
archetype: voice-agent
extends: ai-agent
stack: Retell (orchestration) · ElevenLabs (voice) · Telnyx (telephony) · OpenRouter (LLM) · independent application Supabase · local app/workers · GitHub CI/delivery
updated: 2026-05-29
---

# Archetype: `voice-agent`

> Real-time voice agents (inbound/outbound calls) on Retell + ElevenLabs + Telnyx. **Extends `ai-agent`** — every `ai-agent` Definition-of-Done line still applies (OpenRouter routing, versioned prompts, the eval gate, cost guardrails, RLS, observability, security). This file adds the voice-specific bars, where latency and real call testing are the difference between "demo" and "shippable." Used by `sky-scope` when the operator picks `voice-agent`.

## How this file is used

Same contract: `sky-scope` grills the **Grill variables**, the **Definition of Done** is the per-increment bar, the **Road** is the default 0→100. Inherits `ai-agent` + `rules/constitution.md`. The new gate is **M-Voice**: real end-to-end calls with pass/fail, not transcript review.

## Grill variables (added on top of `ai-agent`)

- **Call direction** — inbound, outbound, or both? Volume/concurrency expected?
- **The one job** — appointment reminder, intake, qualification, support triage? (Start with one; a vague "assistant" fails.)
- **Call flow** — the happy path + the branches (no-answer, voicemail, wrong person, transfer-to-human).
- **Voice & persona** — language(s), accent, ElevenLabs voice, tone, named or anonymous.
- **Latency tolerance** — confirm the <800ms target fits the use case; identify the slowest dependency (LLM, tool call, DB).
- **Tools mid-call** — what must it look up or write *during* the call (calendar, CRM, order status)? Each is a latency risk.
- **Escalation** — when and how does it hand to a human? Warm transfer or callback?
- **Telephony** — Telnyx numbers, regions, caller-ID, recording laws per region.
- **Compliance** — recording-consent disclosure, PII handling, GDPR retention (EU). Regulated domain (health/finance)?
- **Success metric** — answered-rate, completion-rate, transfer-rate, CSAT? (Becomes the eval + call-test pass criteria.)

## Production Definition of Done (added on top of `ai-agent`)

**Latency** — **<800ms end-to-end** turn latency is the bar where callers stop noticing it's AI; >1.2s feels like legacy IVR. Measured on real calls, not assumed. Slowest dependency identified and budgeted.

**Call quality** — turn-taking / barge-in / interruption handled without breaking flow; no dead air on tool calls (filler/await behavior); graceful handling of no-answer, voicemail, silence, wrong person.

**End-to-end call testing (THE GATE)** — automated test calls through the full Retell + ElevenLabs + Telnyx stack with measurable pass/fail against the success metric. Transcript review is *not* sufficient — the audio path is part of the product.

**Escalation** — human handoff path tested (transfer or callback); failure modes (LLM/tool/telephony down) degrade safely, never trap the caller.

**Observability & compliance** — authorized transcript/recording diagnostics with explicit consent, minimal scoped storage and PII redaction; recording-consent disclosure at call start; GDPR retention policy; per-region recording-law compliance.

**Cost** — per-minute + per-call cost tracked (voice + LLM + telephony stack); daily ceiling.

## The Road (default 0→100)

Follows `ai-agent` M1–M3 (Foundation/Data → Core Loop → Evals & Guardrails), then inserts the voice gate before the app surface:

### M-Voice — Voice Path & Call Testing (inserted after ai-agent M3, before polish)
- Retell agent wired to ElevenLabs voice + Telnyx numbers; LLM via OpenRouter.
- Call flow built: happy path + branches (no-answer, voicemail, wrong person, transfer).
- Mid-call tools with no-dead-air behavior; barge-in/turn-taking verified.
- **Latency measured on real calls to the <800ms budget**; slowest dependency optimized.
- **End-to-end automated call tests** with pass/fail on the success metric.
- Authorized transcript/recording diagnostics; explicit consent and retention/deletion controls; PII redaction.
- **Exit:** real test calls pass the metric at target latency; every branch + escalation handled; compliance wired. *No ship before this closes.*

### Then — App Surface & Handoff
- `ai-agent` M4/M5: dashboard (call logs, transcripts, metrics), the non-AI-looking UI, security/GDPR review, authorized production delivery (application/worker environments separated), smoke including **real calls**, handoff or rolling-release.

## Why M-Voice exists
A voice agent that reads well in a transcript can still be unusable on a call — 1.5s pauses, talking over the caller, dead air during a lookup. Text evals (ai-agent M3) prove the *reasoning*; M-Voice proves the *experience*. Both gates, or it isn't done.

## Delivery boundaries

Apply the shared `rules/deployment.md` and `rules/infrastructure.md` gates. Preserve local SSR/API and persistent-worker execution; static GitHub Pages and bounded Supabase Edge Functions are not equivalent runtimes. GitHub CI/Release artifacts are not live deployments: without the actual authorized target/URL and required smoke/auth/user-flow evidence, report deployment prepared/live delivery pending and do not mark shipped or handoff complete. No additional hosting provider is mandatory. Application Supabase, credentials, accounts and branding remain independent of SkyOps.
