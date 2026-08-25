# Pace — project memory (for Claude Code)

Persistent notes so context survives across sessions. Keep this current when major
decisions or architecture change. This file is auto-loaded by Claude Code, so it's the
cheapest way to "remember" the project (no re-reading the whole tree).

## What this is
**Pace** — an SAT question-bank practice web app. Backronym **PACE = "Practice And Correct
Errors"**. Domain **pacesat.com** (the owner registers it themselves — do NOT purchase).
Not affiliated with the College Board; never print that trademark in UI copy. It's *practice
questions*, so avoid the word "exam" in copy.

## Stack & workflow
- **Next.js 14 App Router + TypeScript + Tailwind.** Client components talk directly to
  Supabase with the anon key.
- **Supabase** project `fqhqgtjrsimyjcrllsce` (Postgres + Supabase Auth/GoTrue). Access via
  the Supabase MCP tools (`apply_migration`, `execute_sql`, `query_logs`, `get_advisors`).
- **Vercel**: push branch → preview; squash-merge PR to `main` → production.
- **Dev branch**: `claude/sat-practice-interface-ixh663`. Build on it, push, user reviews the
  Vercel preview, then merges.
- Commit trailers: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + the
  Claude-Session line. Never put a model identity in commits/PRs/code.
- **Sandbox limitation**: outbound curl to `*.vercel.app` and `*.supabase.co` is EGRESS_BLOCKED.
  Can't hit GoTrue/HTTP from the sandbox — verify via Supabase MCP + the user testing on preview.

## Hard constraints (never violate)
- **DB changes must be additive** and must **never lose user progress** (data keyed on
  `public.users.id`; all `user_id` FKs must stay valid).
- **Never merge auth changes to production until the user confirms login works on the preview.**

## Auth model (migrated to Supabase Auth)
- `public.users` is a **profile** table linked to `auth.users` via `auth_id uuid unique`.
  Existing profile ids preserved.
- Login is **username-based UX**: `login_email_for_username(username)` RPC → `signInWithPassword`.
- `AuthGate` (`components/AuthGate.tsx`) gates on the Supabase session, loads the profile via
  `fetchProfile(authId)` (`.eq("auth_id", authId)`), caches it in `lib/user.ts` (`setCachedUser`)
  so `currentUserId()` stays synchronous across ~20 call sites.
- **Gotcha (already fixed):** `fetchProfile` filters on `auth_id`, so `anon`/`authenticated`
  need column SELECT on `auth_id`. A missing grant here silently bounces users back to /login.
- Key RPCs: `login_email_for_username`, `admin_create_account`, `admin_set_password`,
  `admin_set_login_email` (updates `identity_data` only — `auth.identities.email` is generated),
  `admin_delete_user`, `admin_list_users`, `leaderboard`.
- pgcrypto lives in the **`extensions`** schema (`extensions.crypt`, `extensions.gen_salt('bf')`).

## Open registration (this round)
- Migration `open_registration`: `users_username_lower_idx` (unique, lower(username));
  `username_available(text)` (definer, anon); `create_my_profile(username, display_name)`
  (definer, inserts profile for `auth.uid()`, raises `username_taken`, idempotent);
  `handle_new_user()` trigger AFTER INSERT ON auth.users (creates profile when
  `raw_user_meta_data ? 'username'`, i.e. public signups only, `on conflict do nothing`);
  `public_stats()` (definer, anon) → `{questions, skills, sections}`.
- Client: `lib/auth.ts` `signUp()` + `isUsernameAvailable()`; `app/signup/page.tsx`
  (AuthShell form w/ live username hint); login page links to it.
- **Requires the user to turn OFF "Confirm email"** in Supabase Auth → Email so signup returns
  a session immediately (otherwise signUp has no session and UX degrades to "check your email").

## Homepage / routing (this round)
- `app/page.tsx` is a thin switch: `useUser()` → `<Dashboard/>` (logged in) or `<Landing/>` (out).
- `components/Dashboard.tsx` = the old dashboard body. `components/Landing.tsx` = marketing page
  (own header, hero, mission, features, how-it-works, live stats band, CTA, footer).
- `AuthGate` renders **bare** (no app shell) for `AUTH_PAGES` (`/login /signup /forgot /reset`)
  and for the logged-out landing at `/`. Logged-in `/` renders Dashboard in the app shell.

## Branding
- Palette: **electric violet**, brand ramp anchored at `#3f07e8` in `tailwind.config.ts`
  (`brand-600`). Dashboard charts: questions `#3f07e8` (violet), time `#c026d3` (fuchsia).
- Logo: minimal freestanding **motion-check** — `components/Logo.tsx` / `app/icon.svg`,
  `<path d="M4 17 L12 25 L28 6">`, `currentColor`.
- Name/tagline centralized in `lib/appMeta.ts` (`APP_NAME`, `APP_TAGLINE`, `APP_DOMAIN`,
  `LAST_UPDATED`). Cross-text "Text 2" uses **amber** (Text 1 is brand/violet).

## Motion system (no library)
- `app/globals.css`: `.reveal`/`.is-visible`, `.hover-lift`, `animate-blob`, `animate-pop-in`,
  all neutralized under `@media (prefers-reduced-motion: reduce)`.
- `components/Reveal.tsx`: IntersectionObserver fade-up wrapper (`delay` staggers, `as` prop).
- `components/AuthShell.tsx`: animated blob background + pop-in card; used by all auth pages.

## Bank facts (as of last check)
- **745 questions, 10 skills, one section: "Reading and Writing"** (no Math yet — copy must
  not claim Math). `public_stats()` returns these live.

## Pending / follow-ups
- **User must test login + signup on the preview** before any production cutover.
- After login confirmed on preview → merge auth branch to production, THEN apply the **RLS
  lockdown** migration (per-user policies on attempts/practice_sessions/question_state/vocabulary;
  cross-user reads already moved to SECURITY DEFINER RPCs). RLS is still permissive (`USING true`)
  in production until then — do not tighten before the auth client is live.
- User Supabase settings (surface, not code): Auth → URL Configuration (site + `…/reset` URLs);
  Auth → Email → turn OFF "Confirm email"; optional SMTP for reliable reset emails.

## Accounts
- daksh (admin) — mailtodakshsingh@gmail.com; kahaan — kahaan.mazmudar@gmail.com;
  arin — arinkumar57@gmail.com. All seeded password `12345` (users should change).
