# Isolated native host validation

These profiles are for owner development acceptance testing. They are not a production installation and do not bypass the planned Supabase licensing/installation authorization service. They do not import credentials, agents, skills, plugins, memory or settings from the separate .NET framework.

Both profiles were prepared under `C:\Users\hjahouse\.skyops-framework-validation`. The compiler includes all 29 skills, nine agents and ten supporting skill resources for each host. Authentication is deliberately separate from your normal host profiles.

In a local PowerShell terminal, from `C:\Users\hjahouse\copilotops-claude`, sign in using each vendor's native flow:

```powershell
node scripts/native-validation.cjs login claude 'C:\Users\hjahouse\.local\bin\claude.exe'
node scripts/native-validation.cjs login codex 'C:\Users\hjahouse\AppData\Roaming\npm\codex.ps1'
```

Use your own authorized accounts. Do not paste passwords, API keys, login codes, tokens or session files into the conversation. This does not create or authorize the SkyOps Supabase project.

Check authentication without printing native account details:

```powershell
node scripts/native-validation.cjs status claude 'C:\Users\hjahouse\.local\bin\claude.exe'
node scripts/native-validation.cjs status codex 'C:\Users\hjahouse\AppData\Roaming\npm\codex.ps1'
```

The launcher changes environment/home/configuration only in its child process, not your terminal or system. Only PATH and a bounded set of OS/terminal variables are inherited. Provider credentials and unrelated framework configuration are not inherited. Native binaries remain unmodified.

The current source is still undergoing identity, service-decoupling and guard adaptation. Do not launch full development workflows from these profiles yet. Authentication permits the remaining native discovery/execution tests when those gates are ready; it does not certify current artifacts as production-ready.

Verified so far: isolated CLI help on both native hosts, all 29 skills discovered by Codex's native metadata API, and Claude's native auth-status diagnostic confirms its configuration directory is isolated and unauthenticated. Native model-backed invocation/guard behavior, other operating systems and cloud behavior remain pending.

The earlier `claude agents --json` probe queried background sessions, not configured subagent definitions. It is invalid as discovery evidence and is not used to claim agent discovery or agent failure. See the current CLI reference: https://code.claude.com/docs/en/cli-reference.

Some temporary metadata-validation directories were retained. Automatic approval review rejected recursive deletion of a previous temporary directory; no alternative deletion method was used against that target.
