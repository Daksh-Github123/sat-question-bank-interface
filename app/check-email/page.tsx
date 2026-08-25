"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resendConfirmation } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";

// Wrapper provides the Suspense boundary that useSearchParams requires in Next 14.
export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmailInner />
    </Suspense>
  );
}

function CheckEmailInner() {
  const email = useSearchParams().get("email") || "";
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function resend() {
    if (!email || busy) return;
    setBusy(true);
    setError("");
    try {
      await resendConfirmation(email);
      setSent(true);
    } catch {
      setError("Couldn't resend just now. Please try again in a minute.");
    }
    setBusy(false);
  }

  return (
    <AuthShell heading="Confirm your email">
      <div className="mt-6 space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl dark:bg-brand-950">
          ✉️
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          We sent a confirmation link to{" "}
          {email ? (
            <span className="font-semibold text-slate-800 dark:text-slate-100">{email}</span>
          ) : (
            "your email"
          )}
          . Click it to activate your account — you&apos;ll be signed in automatically.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Can&apos;t find it? Check your spam folder, or resend the link below.
        </p>

        {sent && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Confirmation link re-sent.
          </p>
        )}
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        {email && (
          <button
            onClick={resend}
            disabled={busy || sent}
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {busy ? "Resending…" : sent ? "Link sent" : "Resend confirmation link"}
          </button>
        )}

        <Link href="/login" className="block text-sm text-brand-600 hover:underline dark:text-brand-300">
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
