-- =============================================================================
-- RLS LOCKDOWN  —  STAGED MIGRATION (DO NOT APPLY YET)
-- =============================================================================
-- This migration replaces the current permissive `USING (true)` row-level
-- security with real per-user isolation. It is DESTRUCTIVE to any client that
-- is not authenticated through Supabase Auth, because every policy is keyed on
-- `auth.uid()` -> the caller's profile id.
--
-- ⚠️  DO NOT APPLY until the Supabase-Auth branch is LIVE ON PRODUCTION and
--     login has been verified there. Preview and production share ONE database,
--     so applying this while production still runs the old localStorage login
--     would lock every live user out of their own data.
--
-- Correct order:
--   1. Merge the auth branch to production (main) and deploy.
--   2. Verify login/signup work on the production URL.
--   3. THEN apply this migration (Supabase MCP `apply_migration`, name
--      `rls_lockdown`, or paste into the SQL editor).
--
-- Depends on (already in the DB): public.current_profile_id() and
-- public.is_admin(), both SECURITY DEFINER. Cross-user reads already run
-- through SECURITY DEFINER RPCs (leaderboard(), admin_list_users()) that bypass
-- RLS, so hiding other users' rows here does not break those features.
--
-- Note: policies use `(select public.current_profile_id())` / `(select public.is_admin())`
-- so the helper is evaluated once per query (InitPlan), not once per row.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Remove obsolete / ungated round-1 RPCs (superseded by Supabase Auth +
--    the is_admin()-gated admin_* RPCs). These are live holes: create_account
--    and set_password/set_email had NO authorization check.
-- -----------------------------------------------------------------------------
drop function if exists public.verify_login(text, text);
drop function if exists public.create_account(text, text, boolean, text, text);
drop function if exists public.set_password(uuid, text);
drop function if exists public.set_email(uuid, text);

-- Keep internal_create_auth_user (admin_create_account calls it as owner), but
-- make it uncallable from the public API. handle_new_user is a trigger fn and
-- should never be invoked directly either.
revoke execute on function public.internal_create_auth_user(text, text) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2) Per-user tables — a profile may touch only its own rows.
--    (attempts, practice_sessions, question_state, vocabulary)
-- -----------------------------------------------------------------------------

-- attempts
alter table public.attempts enable row level security;
drop policy if exists "public read attempts"   on public.attempts;
drop policy if exists "public insert attempts"  on public.attempts;
drop policy if exists "public update attempts"  on public.attempts;
drop policy if exists "public delete attempts"  on public.attempts;
create policy "attempts_select" on public.attempts for select to authenticated
  using (user_id = (select public.current_profile_id()));
create policy "attempts_insert" on public.attempts for insert to authenticated
  with check (user_id = (select public.current_profile_id()));
create policy "attempts_update" on public.attempts for update to authenticated
  using (user_id = (select public.current_profile_id()))
  with check (user_id = (select public.current_profile_id()));
create policy "attempts_delete" on public.attempts for delete to authenticated
  using (user_id = (select public.current_profile_id()));

-- practice_sessions
alter table public.practice_sessions enable row level security;
drop policy if exists "public read practice_sessions"   on public.practice_sessions;
drop policy if exists "public insert practice_sessions"  on public.practice_sessions;
drop policy if exists "public update practice_sessions"  on public.practice_sessions;
drop policy if exists "public delete practice_sessions"  on public.practice_sessions;
create policy "practice_sessions_select" on public.practice_sessions for select to authenticated
  using (user_id = (select public.current_profile_id()));
create policy "practice_sessions_insert" on public.practice_sessions for insert to authenticated
  with check (user_id = (select public.current_profile_id()));
create policy "practice_sessions_update" on public.practice_sessions for update to authenticated
  using (user_id = (select public.current_profile_id()))
  with check (user_id = (select public.current_profile_id()));
create policy "practice_sessions_delete" on public.practice_sessions for delete to authenticated
  using (user_id = (select public.current_profile_id()));

-- question_state
alter table public.question_state enable row level security;
drop policy if exists "public read question_state"   on public.question_state;
drop policy if exists "public insert question_state"  on public.question_state;
drop policy if exists "public update question_state"  on public.question_state;
drop policy if exists "public delete question_state"  on public.question_state;
create policy "question_state_select" on public.question_state for select to authenticated
  using (user_id = (select public.current_profile_id()));
create policy "question_state_insert" on public.question_state for insert to authenticated
  with check (user_id = (select public.current_profile_id()));
create policy "question_state_update" on public.question_state for update to authenticated
  using (user_id = (select public.current_profile_id()))
  with check (user_id = (select public.current_profile_id()));
create policy "question_state_delete" on public.question_state for delete to authenticated
  using (user_id = (select public.current_profile_id()));

-- vocabulary
alter table public.vocabulary enable row level security;
drop policy if exists "vocabulary_all" on public.vocabulary;
create policy "vocabulary_select" on public.vocabulary for select to authenticated
  using (user_id = (select public.current_profile_id()));
create policy "vocabulary_insert" on public.vocabulary for insert to authenticated
  with check (user_id = (select public.current_profile_id()));
create policy "vocabulary_update" on public.vocabulary for update to authenticated
  using (user_id = (select public.current_profile_id()))
  with check (user_id = (select public.current_profile_id()));
create policy "vocabulary_delete" on public.vocabulary for delete to authenticated
  using (user_id = (select public.current_profile_id()));

-- -----------------------------------------------------------------------------
-- 3) Submit-only tables — any signed-in user may file their own row; only
--    admins may read or delete. (feedback, question_reports)
-- -----------------------------------------------------------------------------

-- feedback
alter table public.feedback enable row level security;
drop policy if exists "feedback_select" on public.feedback;
drop policy if exists "feedback_insert" on public.feedback;
drop policy if exists "feedback_delete" on public.feedback;
create policy "feedback_insert" on public.feedback for insert to authenticated
  with check (user_id = (select public.current_profile_id()));
create policy "feedback_admin_select" on public.feedback for select to authenticated
  using ((select public.is_admin()));
create policy "feedback_admin_delete" on public.feedback for delete to authenticated
  using ((select public.is_admin()));

-- question_reports
alter table public.question_reports enable row level security;
drop policy if exists "public read question_reports"   on public.question_reports;
drop policy if exists "public insert question_reports"  on public.question_reports;
drop policy if exists "public update question_reports"  on public.question_reports;
drop policy if exists "public delete question_reports"  on public.question_reports;
create policy "question_reports_insert" on public.question_reports for insert to authenticated
  with check (user_id = (select public.current_profile_id()));
create policy "question_reports_admin_select" on public.question_reports for select to authenticated
  using ((select public.is_admin()));
create policy "question_reports_admin_update" on public.question_reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "question_reports_admin_delete" on public.question_reports for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- 4) Shared content — every signed-in user reads the bank; only admins write it.
-- -----------------------------------------------------------------------------
alter table public.questions enable row level security;
drop policy if exists "public read questions"   on public.questions;
drop policy if exists "public insert questions"  on public.questions;
drop policy if exists "public update questions"  on public.questions;
create policy "questions_select" on public.questions for select to authenticated
  using (true);
create policy "questions_admin_insert" on public.questions for insert to authenticated
  with check ((select public.is_admin()));
create policy "questions_admin_update" on public.questions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "questions_admin_delete" on public.questions for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- 5) Profiles — a user reads only their own profile; admins read all.
--    All writes go through SECURITY DEFINER RPCs (create_my_profile,
--    handle_new_user, admin_*), so no direct insert/update/delete policy is
--    granted — that also removes any is_admin self-escalation path.
-- -----------------------------------------------------------------------------
alter table public.users enable row level security;
drop policy if exists "public all users" on public.users;
create policy "users_select_self_or_admin" on public.users for select to authenticated
  using (auth_id = (select auth.uid()) or (select public.is_admin()));

commit;

-- =============================================================================
-- POST-APPLY VERIFICATION
-- =============================================================================
-- As a NON-admin session (e.g. a fresh signup):
--   select count(*) from attempts;            -- only your own rows
--   select * from users;                       -- only your own profile row
--   select * from feedback;                    -- 0 rows (admin-only)
-- As the daksh (admin) session:
--   select public.is_admin();                  -- true
--   select * from admin_list_users();          -- all users (definer RPC)
--   select * from feedback;                    -- all feedback
-- With only the anon key (no session):
--   select * from attempts;                    -- 0 rows (RLS denies)
--   public_stats() / username_available()      -- still work (definer RPCs)
--
-- Also (Supabase dashboard, not SQL):
--   Auth → Providers → Email: enable "leaked password protection" (HaveIBeenPwned).
-- =============================================================================
