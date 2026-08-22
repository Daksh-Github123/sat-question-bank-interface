"use client";

import { supabase } from "./supabaseClient";
import type { AppUser } from "./user";

// Auth helpers backed by SECURITY DEFINER Postgres RPCs, so the bcrypt password
// hash is verified server-side and never read by the client.

/** Verify username + password. Returns the user on success, null on bad credentials. */
export async function verifyLogin(username: string, password: string): Promise<AppUser | null> {
  const { data, error } = await supabase.rpc("verify_login", {
    p_username: username,
    p_password: password,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as AppUser) : null;
}

/** Admin: create an account with a hashed password. Returns the new user id. */
export async function createAccount(opts: {
  username: string;
  displayName: string;
  isAdmin: boolean;
  password: string;
  email?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_account", {
    p_username: opts.username,
    p_display_name: opts.displayName,
    p_is_admin: opts.isAdmin,
    p_password: opts.password,
    p_email: opts.email ?? "",
  });
  if (error) throw error;
  return data as string;
}

/** Admin: reset a user's password. */
export async function setPassword(userId: string, password: string): Promise<void> {
  const { error } = await supabase.rpc("set_password", { p_user_id: userId, p_password: password });
  if (error) throw error;
}

/** Admin: set/update a user's email. */
export async function setEmail(userId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc("set_email", { p_user_id: userId, p_email: email });
  if (error) throw error;
}
