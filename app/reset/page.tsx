"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import AuthShell from "@/components/AuthShell";
import PasswordInput from "@/components/ui/PasswordInput";

export default function ResetPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false); // a recovery/active session exists
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // The reset link establishes a recovery session (detectSessionInUrl handles the
  // token). Wait for it before allowing a password change.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 4) {
      setError("Pick a password of at least 4 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => router.replace("/"), 1200);
    } catch {
      setError("Could not update your password. The link may have expired — request a new one.");
    }
    setBusy(false);
  }

  return (
    <AuthShell heading="Choose a new password">
        {done ? (
          <p className="mt-6 rounded-md bg-emerald-50 px-3 py-3 text-center text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Password updated. Signing you in…
          </p>
        ) : !ready ? (
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Open this page from the reset link in your email. Waiting for the reset session…
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <PasswordInput value={password} onChange={setPassword} placeholder="new password" aria-label="New password" />
            <PasswordInput value={confirm} onChange={setConfirm} placeholder="confirm password" aria-label="Confirm password" />
            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={busy || !password || !confirm}
              className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
    </AuthShell>
  );
}
