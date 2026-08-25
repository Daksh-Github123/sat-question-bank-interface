"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/lib/appMeta";
import Logo from "./Logo";

// Shared chrome for the auth pages (/login, /signup, /forgot, /reset, /check-email):
// a gently animated blob/glow background and a card that pops in. The whole thing is
// dismissible — clicking the backdrop (or the ✕ / logo) returns to the marketing
// homepage, so signing in is never a dead end.
export default function AuthShell({
  heading,
  tagline,
  children,
}: {
  heading: string;
  tagline?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  // Clicks that land on the backdrop itself (not the card) dismiss to the homepage.
  function onBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) router.push("/home");
  }

  return (
    <div
      onClick={onBackdropClick}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950"
    >
      {/* Animated background blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-blob absolute left-1/4 top-1/4 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-400/30 blur-3xl" />
        <div
          className="animate-blob absolute right-1/4 top-1/3 h-72 w-72 translate-x-1/2 rounded-full bg-fuchsia-400/20 blur-3xl"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="animate-blob absolute bottom-1/4 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl"
          style={{ animationDelay: "-12s" }}
        />
      </div>

      {/* Explicit "back to homepage" affordance (in case the backdrop isn't obvious) */}
      <Link
        href="/home"
        className="absolute left-4 top-4 flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-white/70 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-brand-300"
      >
        <span aria-hidden>←</span> Home
      </Link>

      <div className="animate-pop-in relative w-full max-w-sm rounded-xl border border-slate-200 bg-white/90 p-8 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        {/* Close → homepage */}
        <Link
          href="/home"
          aria-label="Close and return to homepage"
          className="absolute right-3 top-3 text-lg leading-none text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
        >
          ✕
        </Link>

        <Link href="/home" aria-label={`${APP_NAME} home`} className="block text-brand-600 dark:text-brand-300">
          <div className="flex justify-center">
            <Logo size={40} />
          </div>
          <h1 className="mt-2 text-center text-xl font-bold">{APP_NAME}</h1>
        </Link>
        {tagline && (
          <p className="mt-1 text-center text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {tagline}
          </p>
        )}
        <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">{heading}</p>
        {children}
      </div>
    </div>
  );
}
