"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { currentUserId } from "@/lib/user";
import { PageLoader } from "@/components/ui/Spinner";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
}
interface AttemptRow {
  user_id: string | null;
  is_correct: boolean;
  time_spent_seconds: number;
  session_id: string | null;
}
interface SessionRow {
  id: string;
  user_id: string | null;
  active_seconds: number;
}

interface Entry {
  id: string;
  name: string;
  questions: number;
  correct: number;
  accuracy: number; // 0..100
  seconds: number;
}

type SortKey = "accuracy" | "questions" | "time";

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const sec = s % 60;
  return m > 0 ? `${m}m` : `${sec}s`;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("accuracy");
  const me = currentUserId();

  useEffect(() => {
    (async () => {
      // Aggregates come from a SECURITY DEFINER RPC so per-user row security can
      // stay strict while everyone still sees the ranking.
      const { data } = await supabase.rpc("leaderboard");
      const rows: Entry[] = ((data as any[]) || []).map((r) => {
        const questions = Number(r.questions) || 0;
        const correct = Number(r.correct) || 0;
        return {
          id: r.user_id as string,
          name: (r.name as string) || "Unknown",
          questions,
          correct,
          accuracy: questions ? Math.round((correct / questions) * 100) : 0,
          seconds: Number(r.seconds) || 0,
        };
      });
      setEntries(rows);
      setLoading(false);
    })();
  }, []);

  const ranked = useMemo(() => {
    const rows = [...entries];
    rows.sort((a, b) => {
      if (sort === "questions") return b.questions - a.questions || b.accuracy - a.accuracy;
      if (sort === "time") return b.seconds - a.seconds || b.questions - a.questions;
      // accuracy: primary accuracy, tie-broken by volume so a single lucky answer
      // doesn't outrank a large sample.
      return b.accuracy - a.accuracy || b.questions - a.questions;
    });
    return rows;
  }, [entries, sort]);

  if (loading) return <PageLoader label="Loading leaderboard…" />;

  const th = (key: SortKey, label: string) => (
    <button
      onClick={() => setSort(key)}
      className={`font-medium ${sort === key ? "text-brand-700 dark:text-brand-300" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
    >
      {label} {sort === key ? "↓" : ""}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🏆 Leaderboard</h1>
        <span className="text-sm text-slate-500 dark:text-slate-400">{ranked.length} {ranked.length === 1 ? "player" : "players"}</span>
      </div>

      {ranked.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No one has practiced yet — be the first!
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">#</th>
                <th className="px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Player</th>
                <th className="px-3 py-2">{th("questions", "Questions")}</th>
                <th className="px-3 py-2">{th("accuracy", "Accuracy")}</th>
                <th className="px-3 py-2">{th("time", "Time")}</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((e, i) => {
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
                const mine = e.id === me;
                return (
                  <tr
                    key={e.id}
                    className={`border-b border-slate-100 last:border-0 ${mine ? "bg-brand-50/60 dark:bg-brand-950/60" : ""}`}
                  >
                    <td className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">{medal}</td>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                      {e.name}
                      {mine && <span className="ml-2 text-xs font-normal text-brand-600 dark:text-brand-300">you</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{e.questions}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`font-semibold ${
                          e.accuracy >= 85 ? "text-emerald-700 dark:text-emerald-300" : e.accuracy >= 70 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {e.accuracy}%
                      </span>
                      <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">({e.correct}/{e.questions})</span>
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{fmtTime(e.seconds)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Tap a column to re-rank. Time is total practice time (including answer review). Accuracy ties
        break toward whoever has answered more questions.
      </p>
    </div>
  );
}
