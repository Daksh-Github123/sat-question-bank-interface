"use client";

import { useState } from "react";
import { submitFeedback } from "@/lib/feedback";
import { useToast } from "./ui/ToastProvider";

// Floating feedback button (bottom-right, opposite the back-to-top button). Opens a
// small panel with a message box that saves to the Supabase `feedback` table, which
// the admin sees in the Admin page. General app feedback — the per-question "report"
// inside a practice session is separate.
export default function FeedbackButton() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    await submitFeedback(text);
    setBusy(false);
    setText("");
    setOpen(false);
    toast.success("Thanks — your feedback was sent.");
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Send feedback"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-md transition-colors hover:bg-slate-50 print:hidden dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        <span aria-hidden="true">💬</span>
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl print:hidden dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Send feedback</p>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Ideas, bugs, or anything that would make this better. (To flag a specific question, use the
            report button inside a practice session.)
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="What's on your mind?"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={busy || !text.trim()}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
