# Native agent-role validation

These developer checks invoke the actual registered SkyOps role definitions in isolated, authenticated Claude Code and Codex profiles. They are **missing-input entrypoint probes**, not full implementation, planning, research, visual assessment or browser QA acceptance.

Use Node 22 or later from this repository, after preparing/signing in to the separate validation profiles described in `native-host-validation.md`:

```powershell
node scripts/native-agent-validation.cjs claude 'C:\Users\hjahouse\.local\bin\claude.exe'
node scripts/native-agent-validation.cjs codex 'C:\Users\hjahouse\AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe'
```

Executable locations above are the observed development machine's vendor locations. Pass the actual absolute native executable on another machine; these paths are not installation defaults. Set `SKYOPS_VALIDATION_HOME` only to a verified, owned validation installation when using another isolated home.

Append an exact canonical role name for a single pilot. Without a role argument, all nine canonical agents are tested at concurrency two. Each child process is bounded to 120 seconds; Claude additionally uses a USD 0.50 maximum budget per role. Keep provider/model choices configurable. Do not infer a measured performance improvement from these initial runs.

## What a passing probe establishes

- The shared source role exists and its installed native artifact remains unchanged during the run.
- Claude recognizes the role through native `--agent`, reports it registered and returns a missing-input response reflecting that role's responsibilities.
- Codex dispatches the named role through native delegation. Evidence binds a **new synthetic child session's** role and parent fields to the actual native parent thread, rather than trusting the parent model's claim.
- The model identifies required inputs without inventing results, scoring unseen screenshots or claiming completion.
- The fixture receives no new project files. Claude performs no tools in this bounded probe; the request also forbids shell/integration operations for Codex.
- The isolated environment uses its own host configuration/home/cache; no existing .NET framework or hosted Supabase project is involved.

The response schema and minimum role-specific missing-input evidence are checked. Structural validators reject malformed responses and false completion claims. Session metadata checks cannot accept a different role, another parent or a textual claim as native dispatch evidence.

## Security and native behavior

Claude uses no permission prompts, an empty MCP configuration and a tool-restricted negative probe. Its productive tool capabilities are not being tested by removing those tools from this test.

Codex retains the read-only parent sandbox, `approval_policy="never"`, disabled login-shell/profile loading and the supported Windows MXC implementation. Agent-specific instructions cannot independently establish a different sandbox. No approval/sandbox bypass is used.

Codex `--ephemeral` failed the initial child-context pilot with “no rollout found for the child thread” on the observed native version. Role probes therefore retain only their **synthetic validation transcripts** under the new isolated vendor profile so native child context can be created. The harness reads only newly created session-metadata records in that profile to prove role binding; it does not inspect authentication files, earlier/global session contents or user project history.

Native v0.172.0 accepted the current legacy role registration through `[agents.<name>].config_file`. Current standalone-agent documentation requires name, description and developer instructions for that newer format; do not change a working installed-version contract solely on an assumption. Version-specific adapter acceptance remains required.

## Evidence and remaining gates

Results are written after each role to `docs/audit/native-agent-validation-claude.json` and `native-agent-validation-codex.json`; single-role results use `-pilot`. Receipts retain source/artifact hashes, timing, native usage and available Claude provider cost. Codex CLI usage is recorded as reported; aggregation of child usage is not established and must not be claimed as a complete total.

Every receipt has `phase_gate_passed: false` and `full_functional_parity_verified: false`. Complete role responsibilities, permission/tool-policy parity, all skill workflows, native hooks, visual/browser checks, cloud authorization/isolation and representative end-to-end acceptance require separate checks under the authoritative transformation plan.

Official references: [Claude native custom agents](https://code.claude.com/docs/en/sub-agents), [Codex custom agents and parent permission inheritance](https://learn.chatgpt.com/docs/agent-configuration/subagents).
