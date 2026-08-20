"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Storage-consent notice. This app doesn't use third-party tracking cookies — it
// keeps your login and preferences in your browser's localStorage — so the copy is
// honest about that rather than a generic "cookies" prompt. Dismissal is remembered.
const KEY = "sat_cookie_consent";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      // localStorage unavailable — just don't show the banner.
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur print:hidden dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          This app stores your login and preferences in your browser and your practice data in our
          database to make the app work. It doesn&apos;t use third-party tracking cookies.{" "}
          <Link href="/privacy" className="font-medium text-brand-600 underline dark:text-brand-300">
            Learn more
          </Link>
          .
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
