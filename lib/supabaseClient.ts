import { createClient } from "@supabase/supabase-js";

// These are the project URL and the *publishable* (anon) key. Both are meant to
// be exposed in client-side code — row-level security governs access. Env vars
// override them so the project can be pointed at a different Supabase instance.
const DEFAULT_URL = "https://fqhqgtjrsimyjcrllsce.supabase.co";
const DEFAULT_KEY = "sb_publishable__wP5gQ168XOCZ_Hv5VD9vg_IgkGr1qP";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
