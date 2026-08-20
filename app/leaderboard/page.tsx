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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("accuracy");
  const me = currentUserId();

  useEffect(() => {
    (async () => {
      const [u, a, s] = await Promise.all([
        supabase.from("users").select("id, username, display_name"),
        supabase.from("attempts").select("user_id, is_correct, time_spent_seconds, session_id").limit(100000),
        supabase.from("practice_sessions").select("id, user_id, active_seconds").limit(20000),
      ]);
      setUsers((u.data as UserRow[]) || []);
      setAttempts((a.data as AttemptRow[]) || []);
      setSessions((s.data as SessionRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const entries = useMemo(() => {
    // Per-user answered count + correct.
    const stat = new Map<string, { q: number; correct: number }>();
    // Per-session question time (for the time metric fallback) + per-user sessionless time.
    const qSecBySession = new Map<string, number>();
    const sessionlessByUser = new Map<string, number>();
    for (const a of attempts) {
      if (!a.user_id) continue;
      const g = stat.get(a.user_id) || { q: 0, correct: 0 };
      g.q++;
      if (a.is_correct) g.correct++;
      stat.set(a.user_id, g);
      if (a.session_id) qSecBySession.set(a.session_id, (qSecBySession.get(a.session_id) || 0) + a.time_spent_seconds);
      else sessionlessByUser.set(a.user_id, (sessionlessByUser.get(a.user_id) || 0) + a.time_spent_seconds);
    }
    // Time practiced per user: per session max(active, summed question time), plus
    // sessionless attempt time — same basis as the dashboard's Total time.
    const timeByUser = new Map<string, number>();
    for (const s of sessions) {
      if (!s.user_id) continue;
      const q = qSecBySession.get(s.id) || 0;
      timeByUser.set(s.user_id, (timeByUser.get(s.user_id) || 0) + Math.max(s.active_seconds || 0, q));
    }
    for (const [uid, sec] of sessionlessByUser) timeByUser.set(uid, (timeByUser.get(uid) || 0) + sec);

    const nameById = new Map(users.map((u) => [u.id, u.display_name || u.username]));
    const rows: Entry[] = [];
    for (const [uid, g] of stat) {
      if (g.q === 0) continue;
      rows.push({
        id: uid,
        name: nameById.get(uid) || "Unknown",
        questions: g.q,
        correct: g.correct,
        accuracy: Math.round((g.correct / g.q) * 100),
        seconds: timeByUser.get(uid) || 0,
      });
    }
    return rows;
  }, [users, attempts, sessions]);

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
                    className={`border-b border-slate-100 last:border-0 ${mine ? "bg-brand-50 dark:bg-brand-950/60" : ""}`}
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
