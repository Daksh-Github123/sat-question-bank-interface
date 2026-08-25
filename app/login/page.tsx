"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithUsername } from "@/lib/auth";
import { APP_TAGLINE } from "@/lib/appMeta";
import AuthShell from "@/components/AuthShell";
import PasswordInput from "@/components/ui/PasswordInput";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const uname = username.trim().toLowerCase();
    if (!uname || !password) return;
    setBusy(true);
    setError("");
    const res = await signInWithUsername(uname, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error === "server" ? "Could not reach the server. Please try again." : "Incorrect username or password.");
      return;
    }
    // AuthGate picks up the new session and redirects; nudge it along.
    router.replace("/");
  }

  return (
    <AuthShell heading="Sign in to continue" tagline={APP_TAGLINE}>
        <form onSubmit={login} className="mt-6 space-y-3">
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect="off"
            aria-label="Username"
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
          />
          <PasswordInput value={password} onChange={setPassword} />
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
        <p className="mt-3 text-center text-xs">
          <Link href="/forgot" className="text-brand-600 hover:underline dark:text-brand-300">
            Forgot password?
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          Usernames are case-insensitive. Accounts are created by the admin.
        </p>
    </AuthShell>
  );
}
