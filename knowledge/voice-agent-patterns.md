# Optional voice-agent engineering patterns

Preserve optional VAPI, Retell, ElevenLabs and related voice integration capabilities without importing original client projects, phone numbers, account defaults or deployment maps. Initial SkyOps installation and normal development do not require voice accounts/hardware.

## Configured assistant and call flow

1. Use the selected user's/project's authorized provider account and optional integration configuration.
2. Configure the actual model, voice, system prompt, tools, first message and call/webhook flow. Resolve provider identifiers from the configured account; do not assume a historical display name is a valid voice ID.
3. Run webhooks on the selected application's local development runtime or compatible Supabase Edge Functions. Use the application's own infrastructure, not the framework's internal database.
4. Connect an authorized phone number only when requested and verify provider scopes and ownership.
5. Test real authorized calls, interruption/error paths, provider callbacks and measured latency before declaring acceptance.

## Webhook and tool security

Authenticate the raw provider callback using the provider's current documented signature or authentication scheme before parsing/trusting events. Test tampered, missing-auth, replayed, malformed and unauthorized callbacks. Do not copy an undefined verifier or invent a provider header/algorithm. Route function/tool calls, call completion and status updates through authorized project operations with idempotency and bounded retries. Provider integration implementations and live acceptance remain explicit gates.

## Voice selection

Retain professional, friendly, energetic and low-latency/economical voice-selection use cases. Provider, voice ID, model and language are configurable per application. Evaluate intelligibility, interruption handling, latency and cost with actual authorized provider options; no original client identity is inherited.

## Conversation and privacy

Keep spoken responses concise, confirm important information and handle interruptions gracefully. Measure first-response latency against the project's target (the original target was below 500 ms); do not claim it without a real measurement. Preserve useful diagnostic events, but redact secrets, minimize synchronized data and configure retention. Recording/transcripts require the applicable explicit authorization; do not log everything indiscriminately or absorb private conversations into shared knowledge.

## Optional local input

Linux/Wayland voice/hotkey implementations remain optional. Configure provider secrets securely and enable hardware features only when requested. Windows/macOS equivalents are not required for the first release. No audio file or historical recording is seeded into user memory or a distribution package.
