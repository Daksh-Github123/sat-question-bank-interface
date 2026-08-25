# Staged database migrations

Migrations here are **written but not yet applied** to the Supabase project. They
live in the repo for review and to be applied at the right moment (via the
Supabase MCP `apply_migration` or the SQL editor). Already-applied migrations are
not mirrored here — they were applied directly against project `fqhqgtjrsimyjcrllsce`.

## `20260825120000_rls_lockdown.sql` — ⚠️ do not apply yet

Replaces the permissive `USING (true)` row-level security with real per-user
isolation (keyed on the Supabase Auth session) and drops obsolete/ungated RPCs.

**Preview and production share one database.** This migration must only be applied
**after** the Supabase-Auth branch is merged to production and login is verified
there — otherwise it locks live users (still on the old localStorage login) out of
their own data. Apply order:

1. Merge the auth branch to `main`, deploy to production.
2. Verify login + signup on the production URL.
3. Apply `20260825120000_rls_lockdown.sql`.
4. Run the verification queries at the bottom of that file.
5. Enable "leaked password protection" in Supabase Auth → Providers → Email.
