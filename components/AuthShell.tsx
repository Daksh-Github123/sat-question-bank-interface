"use client";

import { APP_NAME } from "@/lib/appMeta";
import Logo from "./Logo";

// Shared chrome for the auth pages (/login, /forgot, /reset): a gently animated
// blob/glow background and a card that pops in, with the logo + app name on top.
export default function AuthShell({
  heading,
  tagline,
  children,
}: {
  heading: string;
  tagline?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950">
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

      <div className="animate-pop-in w-full max-w-sm rounded-xl border border-slate-200 bg-white/90 p-8 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex justify-center text-brand-600 dark:text-brand-300">
          <Logo size={40} />
        </div>
        <h1 className="mt-2 text-center text-xl font-bold text-brand-600 dark:text-brand-300">{APP_NAME}</h1>
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
