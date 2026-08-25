"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      setError("Could not send the reset email. Please try again.");
    }
    setBusy(false);
  }

  return (
    <AuthShell heading="Reset your password">
        {sent ? (
          <div className="mt-6 space-y-3 text-center">
            <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              If an account uses that email, a reset link is on its way. Open it to set a new password.
            </p>
            <Link href="/login" className="text-sm text-brand-600 hover:underline dark:text-brand-300">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your email"
                autoCapitalize="none"
                autoCorrect="off"
                aria-label="Email"
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
              />
              {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
              Enter the email linked to your account.{" "}
              <Link href="/login" className="text-brand-600 hover:underline dark:text-brand-300">
                Back to sign in
              </Link>
            </p>
          </>
        )}
    </AuthShell>
  );
}
