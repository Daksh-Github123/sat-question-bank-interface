# Staged database migrations

Migrations here are **written but not yet applied** to the Supabase project. They
live in the repo for review and to be applied at the right moment (via the
Supabase MCP `apply_migration` or the SQL editor). Already-applied migrations are
not mirrored here — they were applied directly against project `fqhqgtjrsimyjcrllsce`.

## `20260825120000_rls_lockdown.sql` — ✅ APPLIED (migration `rls_lockdown`)

Applied to project `fqhqgtjrsimyjcrllsce` on 2026-08-27, right after PR #18 (the
Supabase-Auth cutover, commit `6fa4dc4`) went live on production. It replaced the
permissive `USING (true)` row-level security with real per-user isolation (keyed on
the Supabase Auth session) and dropped the obsolete/ungated round-1 RPCs. Policies
and dropped functions were verified post-apply; all user progress confirmed intact.

Kept here as the source of record for what was applied. Remaining follow-up:
enable "leaked password protection" in Supabase Auth → Providers → Email.
