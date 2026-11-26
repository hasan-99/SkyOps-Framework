# {{PROJECT_NAME}} — Domain Glossary

<!-- Domain glossary. Loaded by every road agent. Update via /sky-scope. Keep entries terse (1 sentence + Avoid line). -->

## Language

### Term Name
One-sentence definition. Use the term consistently in code, comments, commits, and conversation.
**Avoid:** alternative terms that mean the same thing but aren't this one.

### {{Add terms as the project clarifies them. Examples below.}}

### User
**Avoid until disambiguated.** Currently overloaded — see "Flagged ambiguities" below.

### Phase
A unit of work inside a milestone. 2–5 tasks. Ends in a verification gate.
**Avoid:** epic, story, ticket, sprint.

### Task
A framework-internal execution unit: one commit-sized work item with one verification contract.
**Avoid:** confusing a development task with account membership, licensing or a worker-performance label.

## Relationships
- Project holds many Milestones
- Milestone holds many Phases
- Phase holds many Tasks
- Task carries one Verification Contract
- Authorized project coordination tracks project/milestone deadlines and execution dependencies; it does not collect employee-performance or attendance submissions.
- {{add domain-specific relationships, e.g. "Customer holds many Orders"}}

## Flagged ambiguities

### "User" → AuthUser vs Customer
- **AuthUser** = the row in `auth.users` (Supabase)
- **Customer** = the profile row owned by an AuthUser (1:1)
- {{replace with real ambiguities as they appear}}
