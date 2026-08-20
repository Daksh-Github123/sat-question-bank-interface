"use client";

import Link from "next/link";
import { APP_NAME, LAST_UPDATED } from "@/lib/appMeta";

// Shared footer for all authed pages. Carries the "last updated" date and links to
// the FAQ and privacy pages. Marked `print:hidden` so it drops out of printed reports.
export default function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white print:hidden dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:justify-between dark:text-slate-500">
        <span>
          {APP_NAME} · Last updated {LAST_UPDATED}
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/faq" className="hover:text-slate-600 dark:hover:text-slate-300">
            FAQ
          </Link>
          <Link href="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
