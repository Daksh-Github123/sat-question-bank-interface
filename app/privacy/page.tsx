"use client";

import { APP_NAME, LAST_UPDATED } from "@/lib/appMeta";

// Short, honest privacy notice reflecting how the app actually handles data. Uses
// APP_NAME so a rebrand is one edit; wording avoids legal boilerplate that wouldn't
// be true for this app (no ad tracking, no third-party cookies).
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Privacy</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Last updated {LAST_UPDATED}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">What we store</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {APP_NAME} keeps two kinds of data. In your browser (localStorage) it stores your login and
          preferences — the account you signed in with and settings like your theme choice. In our
          database it stores your practice activity: the questions you attempt, your answers, times,
          notes, flags, and saved vocabulary. This is what powers your stats, review queue, and
          leaderboard position.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">What we don&apos;t do</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          We don&apos;t use third-party advertising or tracking cookies, and we don&apos;t sell your
          data. Accounts are created by an administrator; there is no public sign-up.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Your data</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          You can download a full personal copy of your data any time from Reports &amp; backup. If
          you&apos;d like your account and data deleted, contact the administrator or use the Feedback
          button.
        </p>
      </section>
    </div>
  );
}
