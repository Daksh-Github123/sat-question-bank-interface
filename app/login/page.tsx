"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { storeCurrentUser } from "@/lib/user";
import { useUser } from "@/lib/userContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { setUser } = useUser();

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const uname = username.trim().toLowerCase();
    if (!uname) return;
    setBusy(true);
    setError("");
    const { data, error } = await supabase
      .from("users")
      .select("id, username, display_name, is_admin")
      .eq("username", uname)
      .maybeSingle();
    setBusy(false);
    if (error) {
      setError("Could not reach the server. Please try again.");
      return;
    }
    if (!data) {
      setError("No account with that username. Ask the admin to create one for you.");
      return;
    }
    storeCurrentUser(data as any);
    setUser(data as any);
    // Record last login (best-effort; never blocks sign-in).
    supabase.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", (data as any).id).then(() => {});
    router.replace("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-xl font-bold text-brand-600">SAT Bank</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Enter your username to continue</p>
        <form onSubmit={login} className="mt-6 space-y-3">
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !username.trim()}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          Usernames are case-insensitive. Accounts are created by the admin.
        </p>
      </div>
    </div>
  );
}
