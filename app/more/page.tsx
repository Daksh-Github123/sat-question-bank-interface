"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { currentUserId } from "@/lib/user";
import { useUser } from "@/lib/userContext";
import { deleteSession, endSession } from "@/lib/practice";
import type { PracticeSessionRow } from "@/lib/types";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { PageLoader } from "@/components/ui/Spinner";

interface AttemptAgg {
  session_id: string | null;
  is_correct: boolean;
  time_spent_seconds: number;
}

const MODE_LABEL: Record<string, string> = {
  stopwatch: "Stopwatch",
  timer: "Per-question timer",
  module: "Timed module",
};

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MorePage() {
  const { user } = useUser();
  const confirm = useConfirm();
  const toast = useToast();
  const [sessions, setSessions] = useState<PracticeSessionRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptAgg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const uid = currentUserId();
    const [s, a] = await Promise.all([
      supabase
        .from("practice_sessions")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("attempts")
        .select("session_id, is_correct, time_spent_seconds")
        .eq("user_id", uid)
        .limit(50000),
    ]);
    setSessions((s.data as PracticeSessionRow[]) || []);
    setAttempts((a.data as AttemptAgg[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(s: PracticeSessionRow, answered: number) {
    const incomplete = s.status !== "completed";
    const body = incomplete
      ? `The ${answered} question${answered === 1 ? "" : "s"} you answered will be erased from your stats and become available again as new questions.`
      : `Its ${answered} question${answered === 1 ? "" : "s"} will be removed from your stats and become available again as new questions.`;
    if (!(await confirm({ title: "Delete this session?", body, confirmLabel: "Delete", danger: true }))) return;
    setBusyId(s.id);
    await deleteSession(s.id);
    await load();
    setBusyId(null);
    toast.success("Session deleted.");
  }

  async function handleEnd(s: PracticeSessionRow, answered: number) {
    const ok = await confirm({
      title: "End this session?",
      body: `The ${answered} question${answered === 1 ? "" : "s"} you already answered will be kept in your stats; the rest go back to being new questions for future sessions.`,
      confirmLabel: "End session",
    });
    if (!ok) return;
    setBusyId(s.id);
    await endSession(s.id);
    await load();
    setBusyId(null);
    toast.success("Session ended.");
  }

  const history = useMemo(() => {
    const bySession = new Map<string, { total: number; correct: number; seconds: number }>();
    for (const a of attempts) {
      if (!a.session_id) continue;
      const g = bySession.get(a.session_id) || { total: 0, correct: 0, seconds: 0 };
      g.total++;
      if (a.is_correct) g.correct++;
      g.seconds += a.time_spent_seconds || 0;
      bySession.set(a.session_id, g);
    }
    return sessions
      .map((s) => ({ session: s, agg: bySession.get(s.id) }))
      .filter((r) => r.agg && r.agg.total > 0);
  }, [sessions, attempts]);

  const cards = [
    { href: "/leaderboard", label: "Leaderboard", desc: "See how everyone ranks by accuracy, volume, and time", emoji: "🏆", show: true },
    { href: "/browse", label: "Browse questions", desc: "Search and filter the full question bank", emoji: "📚", show: true },
    { href: "/reports", label: "Reports & backup", desc: "Progress reports and data export", emoji: "📄", show: true },
    { href: "/faq", label: "FAQ & help", desc: "How the app works and answers to common questions", emoji: "❓", show: true },
    { href: "/import", label: "Import", desc: "Add questions from PDFs", emoji: "⬆️", show: !!user?.is_admin },
    { href: "/admin", label: "Admin", desc: "Manage accounts", emoji: "⚙️", show: !!user?.is_admin },
  ].filter((c) => c.show);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-3 text-2xl font-bold">More</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="text-xl">{c.emoji}</span>
              <span>
                <span className="block font-semibold text-slate-800 dark:text-slate-100">{c.label}</span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">{c.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">Session history</h2>
        {loading ? (
          <PageLoader label="Loading session history…" />
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No practice sessions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(({ session: s, agg }) => {
              const acc = agg!.total ? Math.round((agg!.correct / agg!.total) * 100) : 0;
              const accColor = acc >= 85 ? "text-emerald-700 dark:text-emerald-300" : acc >= 70 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300";
              const incomplete = s.status !== "completed";
              const busy = busyId === s.id;
              const total = s.question_ids.length;
              const answered = agg!.total;
              const remaining = Math.max(0, total - answered);
              const canResume = incomplete && s.current_index < total;
              const duration = s.active_seconds > 0 ? s.active_seconds : agg!.seconds;
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3"
                >
                  {/* Left: date + mode, with a single muted detail line */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{fmtDate(s.created_at)}</span>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {MODE_LABEL[s.mode] || s.mode}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {incomplete ? (
                        <span className="font-medium text-amber-600">
                          {answered} of {total} done · {remaining} left
                        </span>
                      ) : (
                        <>{agg!.correct}/{answered} correct</>
                      )}
                      <span className="text-slate-300"> · </span>
                      {fmtTime(duration)}
                    </p>
                  </div>

                  {/* Right: headline accuracy + actions */}
                  <div className="flex items-center gap-3">
                    <span className={`text-base font-semibold ${accColor}`}>{acc}%</span>
                    {canResume && (
                      <Link
                        href={`/practice?resume=${s.id}`}
                        className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 dark:hover:bg-brand-600"
                      >
                        Resume
                      </Link>
                    )}
                    {incomplete && (
                      <button
                        onClick={() => handleEnd(s, answered)}
                        disabled={busy}
                        title="Keep answered questions, free the rest for future sessions"
                        className="rounded-md border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                      >
                        End
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(s, answered)}
                      disabled={busy}
                      title="Delete this session and free its questions to be practiced again"
                      className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {busy ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
