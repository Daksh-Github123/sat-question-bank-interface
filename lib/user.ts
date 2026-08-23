"use client";

// The signed-in user's profile, cached in memory once AuthGate resolves the
// Supabase Auth session → profile. Kept synchronous so the ~20 call sites that
// read currentUserId() inline in queries don't need to change.

export interface AppUser {
  id: string;
  username: string;
  display_name: string;
  is_admin?: boolean;
  email?: string | null;
}

let _cached: AppUser | null = null;

/** Set/replace the cached profile (called by AuthGate on auth state changes). */
export function setCachedUser(u: AppUser | null) {
  _cached = u;
}

export function getCurrentUser(): AppUser | null {
  return _cached;
}

/** The current user's profile id, or null if not signed in. */
export function currentUserId(): string | null {
  return _cached?.id ?? null;
}
