"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp, isUsernameAvailable } from "@/lib/auth";
import { APP_TAGLINE } from "@/lib/appMeta";
import AuthShell from "@/components/AuthShell";
import PasswordInput from "@/components/ui/PasswordInput";

type NameState = "idle" | "checking" | "free" | "taken" | "invalid";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nameState, setNameState] = useState<NameState>("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const checkSeq = useRef(0);

  // Debounced username-availability check.
  useEffect(() => {
    const u = username.trim();
    if (!u) return setNameState("idle");
    if (!USERNAME_RE.test(u)) return setNameState("invalid");
    setNameState("checking");
    const seq = ++checkSeq.current;
    const t = setTimeout(async () => {
      try {
        const free = await isUsernameAvailable(u);
        if (seq === checkSeq.current) setNameState(free ? "free" : "taken");
      } catch {
        if (seq === checkSeq.current) setNameState("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const passwordTooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && password !== confirm;

  const canSubmit =
    USERNAME_RE.test(username.trim()) &&
    nameState !== "taken" &&
    !!email.trim() &&
    password.length >= 6 &&
    password === confirm &&
    !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    const em = email.trim();
    const res = await signUp(username.trim(), em, password);
    setBusy(false);
    if (!res.ok) {
      if (res.error === "username_taken") {
        setNameState("taken");
        setError("That username is already taken.");
      } else if (res.error === "email_taken") {
        setError("An account with that email already exists. Try signing in.");
      } else {
        setError("Could not create your account. Please try again.");
      }
      return;
    }
    if (res.needsConfirmation) {
      // Email confirmation required — send them to the "check your inbox" page.
      router.replace(`/check-email?email=${encodeURIComponent(em)}`);
      return;
    }
    // Session established immediately — AuthGate loads the profile.
    router.replace("/");
  }

  const nameHint = () => {
    const u = username.trim();
    if (!u) return null;
    if (nameState === "invalid")
      return <span className="text-amber-600 dark:text-amber-400">3–20 letters, numbers, or underscores.</span>;
    if (nameState === "checking") return <span className="text-slate-400">Checking…</span>;
    if (nameState === "free") return <span className="text-emerald-600 dark:text-emerald-400">✓ available</span>;
    if (nameState === "taken") return <span className="text-rose-600 dark:text-rose-400">already taken</span>;
    return null;
  };

  return (
    <AuthShell heading="Create your account" tagline={APP_TAGLINE}>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div>
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
          <p className="mt-1 min-h-[1rem] px-1 text-xs">{nameHint()}</p>
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="Email"
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
        />
        <PasswordInput value={password} onChange={setPassword} placeholder="password (min 6)" />
        {passwordTooShort && (
          <p className="px-1 text-xs text-amber-600 dark:text-amber-400">Use at least 6 characters.</p>
        )}
        <PasswordInput value={confirm} onChange={setConfirm} placeholder="confirm password" aria-label="Confirm password" />
        {mismatch && <p className="px-1 text-xs text-rose-600 dark:text-rose-400">Passwords don&apos;t match.</p>}
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
