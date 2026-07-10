"use client";

export interface AppUser {
  id: string;
  username: string;
  display_name: string;
  is_admin?: boolean;
}

const KEY = "sat_user";

export function getCurrentUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as AppUser) : null;
  } catch {
    return null;
  }
}

export function storeCurrentUser(u: AppUser) {
  localStorage.setItem(KEY, JSON.stringify(u));
}

export function clearCurrentUser() {
  localStorage.removeItem(KEY);
}

/** The current user's id, or null if not logged in. */
export function currentUserId(): string | null {
  return getCurrentUser()?.id ?? null;
}
