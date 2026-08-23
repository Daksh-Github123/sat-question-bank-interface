"use client";

import { supabase } from "./supabaseClient";
import type { AppUser } from "./user";

// Auth via Supabase Auth (GoTrue). Login stays username-based: we resolve the
// account's login email from the username, then sign in with a password.

/** Sign in by username + password. Returns { ok } or an error kind. */
export async function signInWithUsername(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: "invalid" | "server" }> {
  const { data: email, error: e1 } = await supabase.rpc("login_email_for_username", {
    p_username: username,
  });
  if (e1) return { ok: false, error: "server" };
  if (!email) return { ok: false, error: "invalid" };
  const { error } = await supabase.auth.signInWithPassword({ email: email as string, password });
  if (error) return { ok: false, error: "invalid" };
  return { ok: true };
}

/** Load the profile linked to an auth user id. */
export async function fetchProfile(authId: string): Promise<AppUser | null> {
  const { data } = await supabase
    .from("users")
    .select("id, username, display_name, is_admin, email")
    .eq("auth_id", authId)
    .maybeSingle();
  return (data as AppUser) ?? null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Send a password-reset email; the link returns to /reset. */
export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/reset`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/** Set a new password for the current (recovery or signed-in) session. */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ---- Admin operations (server-enforced via admin-gated RPCs) ----

export async function adminCreateAccount(opts: {
  username: string;
  displayName: string;
  isAdmin: boolean;
  password: string;
  email?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("admin_create_account", {
    p_username: opts.username,
    p_display_name: opts.displayName,
    p_is_admin: opts.isAdmin,
    p_password: opts.password,
    p_email: opts.email ?? "",
  });
  if (error) throw error;
}

export async function adminSetPassword(userId: string, password: string): Promise<void> {
  const { error } = await supabase.rpc("admin_set_password", { p_user_id: userId, p_password: password });
  if (error) throw error;
}

export async function adminSetEmail(userId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc("admin_set_login_email", { p_user_id: userId, p_email: email });
  if (error) throw error;
}

export async function adminDeleteUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_user", { p_user_id: userId });
  if (error) throw error;
}
