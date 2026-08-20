"use client";

import { useState } from "react";
import { APP_NAME } from "@/lib/appMeta";

// Expandable FAQ. Placeholder copy — no branding/name is hardcoded (uses APP_NAME),
// so this survives a later rebrand as a single edit.
const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I start practicing?",
    a: "Go to Practice, choose the topics and difficulty you want, pick how many questions and a timing mode, then start. Your progress and stats are saved automatically as you go.",
  },
  {
    q: "What do the timing modes mean?",
    a: "Stopwatch just times you without pressure. Per-question timer gives each question a countdown. Timed module mimics a real section with one clock for the whole set. A separate whole-session timer also runs the entire time (you can hide it).",
  },
  {
    q: "How is my accuracy calculated?",
    a: "Accuracy uses your most recent attempt on each question, so correcting an earlier mistake counts as right. Other stats like time spent and total questions answered stay cumulative across all attempts.",
  },
  {
    q: "What happens when I redo a question I got wrong?",
    a: "Redoing a missed question and getting it right updates your accuracy to reflect the correction. The Review page collects your past mistakes so you can practice them again on a spaced schedule.",
  },
  {
    q: "How does the vocabulary feature work?",
    a: "While reviewing an answered question, highlight any word or phrase to save it to your Vocabulary list. Definitions are looked up automatically where possible, and you can edit any entry. Export the list as CSV or JSON any time.",
  },
  {
    q: "Can I delete or end a session?",
    a: "Yes. On the More page under Session history, Delete removes a session and frees its questions to practice again, while End (for an unfinished session) keeps what you answered and returns the rest to the pool.",
  },
  {
    q: "How do I report a problem with a question?",
    a: "Inside a practice session there's a small report button next to each question. For anything else — ideas, bugs, general feedback — use the Feedback button in the corner of any page.",
  },
  {
    q: "Is my data backed up?",
    a: "Your data is saved online automatically. You can also download a personal copy (all questions, attempts, notes, and flags) as a JSON file from Reports & backup.",
  },
];

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-medium text-slate-800 dark:text-slate-100">{q}</span>
        <span className="shrink-0 text-lg text-slate-400 dark:text-slate-500">{open ? "−" : "+"}</span>
      </button>
      {open && <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-300">{a}</p>}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Frequently asked questions</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          How {APP_NAME} works. Still stuck? Use the Feedback button in the corner.
        </p>
      </div>
      <div className="space-y-2">
        {FAQS.map((f) => (
          <Item key={f.q} {...f} />
        ))}
      </div>
    </div>
  );
}
