# Supabase engineering patterns

Generic authorized knowledge, not imported project configuration. The framework has one dedicated internal Supabase project. Every generated application has its own independent project, database/migrations, authentication, storage, RLS and environment configuration.

## Setup and schema

Use the application's explicitly selected project/reference and region. Keep keys in secure environment configuration; use the appropriate public client credential only where intended, and keep secret/service credentials server-only. Create the actual server/client SDK boundaries required by the chosen stack. Generate types against the selected application schema. Apply reviewed migrations through local tests and the authorized CI workflow; never repurpose an existing unrelated project.

## Ownership policy example

This illustrates personal ownership only; it is not a complete team/workspace/project RBAC schema:

```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own rows" ON my_table FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Insert own rows" ON my_table FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own rows" ON my_table FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Authorize memberships and roles from trusted server/database authority, never editable user metadata. Match UPDATE and SELECT policies, validate ownership on writes, and enforce storage policies separately. Test each operation as different users and tenants, including attempts to move rows into another scope. Shared framework ownership alone must not grant access to private user/project data.

## Session and mutation checks

Validate the actual authenticated user/session before server mutations and enforce per-resource authorization. Session refresh cannot confer revoked membership or license authority. Handle explicit errors and unexpected zero affected/returned rows; HTTP success alone is not business success. Do not assume every RLS denial has the same response shape.

## Relations and query shapes

Use generated relation types and actual schema cardinality. One-to-many relationships and many-to-one relationships do not always return the same shape. Preserve normalization helpers for real contracts rather than assuming every foreign key is an array. Reference: https://supabase.com/docs/guides/database/joins-and-nesting

Avoid unnecessary queries, unbounded memory retrieval and credential-bearing logs. Local execution/offline queues do not bypass cloud authorization; synchronization must recheck current permissions. Actual framework auth/RLS/storage/license/memory behavior requires its planned backend and isolation tests.
