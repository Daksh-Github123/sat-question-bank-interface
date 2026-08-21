"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { WEAKNESS_THRESHOLD } from "@/lib/practice";
import { currentUserId } from "@/lib/user";
import { TESTS } from "@/lib/taxonomy";
import DailyBars, { DayBar } from "@/components/DailyBars";
import { PageLoader } from "@/components/ui/Spinner";

interface AttemptRow {
  question_uid: string;
  is_correct: boolean;
  time_spent_seconds: number;
  created_at: string;
  session_id: string | null;
  question: { test: string; domain: string; skill: string } | null;
}

interface BankRow {
  test: string;
  domain: string;
  skill: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const RECENT_DAYS = 7;
const NEGLECT_DAYS = 14;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const shortDate = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const sec = s % 60;
  return m > 0 ? `${m}m` : `${sec}s`;
}

function daysAgoLabel(ms: number | null) {
  if (ms == null) return "never";
  const days = Math.floor((Date.now() - ms) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface SkillStat {
  skill: string;
  test: string;
  domain: string;
  available: number;
  attempts: number;
  correct: number;
  latestCorrect: number; // distinct questions whose most recent attempt is correct
  distinct: Set<string>;
  seconds: number;
  recent: number; // answers in last RECENT_DAYS
  lastMs: number | null;
  firstHalf: { t: number; c: number };
  secondHalf: { t: number; c: number };
}

export default function DashboardPage() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [bank, setBank] = useState<BankRow[]>([]);
  const [sessionTimes, setSessionTimes] = useState<{ id: string; active_seconds: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("All");
  const [sort, setSort] = useState<"attention" | "accuracy" | "coverage" | "az">("attention");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const uid = currentUserId();
      // attempts (this user) ascending for trend halves
      const { data: att } = await supabase
        .from("attempts")
        .select("question_uid, is_correct, time_spent_seconds, created_at, session_id, question:questions(test, domain, skill)")
        .eq("user_id", uid)
        .order("created_at", { ascending: true })
        .limit(50000);
      if (!cancelled) setAttempts((att as unknown as AttemptRow[]) || []);

      // Session-level active time (includes reviewing answers) for a truer total.
      const { data: sess } = await supabase
        .from("practice_sessions")
        .select("id, active_seconds")
        .eq("user_id", uid)
        .limit(5000);
      if (!cancelled) setSessionTimes((sess as { id: string; active_seconds: number }[]) || []);

      // bank meta (shared) — paged
      const rows: BankRow[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("questions")
          .select("test, domain, skill")
          .range(from, from + pageSize - 1);
        if (error || !data) break;
        rows.push(...(data as BankRow[]));
        if (data.length < pageSize) break;
      }
      if (!cancelled) {
        setBank(rows);
        setLoading(false);
      }
    }

    load();
    // Refresh whenever the dashboard regains focus, so stats/graphs reflect a
    // session you just finished without a manual reload.
    const onFocus = () => {
      if (document.visibilityState !== "hidden") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  // ---- derived ----
  const { tiles, questionBars, minuteBars, skillStats, presentTests } = useMemo(() => {
    // Total time practiced: per session, take the wall-clock active time (which
    // includes reviewing answers) when we have it, otherwise fall back to the sum
    // of that session's per-question time. Attempts with no session count directly.
    const activeBySession = new Map(sessionTimes.map((s) => [s.id, s.active_seconds || 0]));
    const qSecondsBySession = new Map<string, number>();
    let sessionlessSeconds = 0;
    for (const a of attempts) {
      if (a.session_id) qSecondsBySession.set(a.session_id, (qSecondsBySession.get(a.session_id) || 0) + a.time_spent_seconds);
      else sessionlessSeconds += a.time_spent_seconds;
    }
    let totalPracticeSeconds = sessionlessSeconds;
    const sessionIds = new Set<string>([...activeBySession.keys(), ...qSecondsBySession.keys()]);
    for (const id of sessionIds) {
      totalPracticeSeconds += Math.max(activeBySession.get(id) || 0, qSecondsBySession.get(id) || 0);
    }

    // Bank availability + skill -> test/domain
    const bankBySkill = new Map<string, { test: string; domain: string; total: number }>();
    for (const b of bank) {
      const e = bankBySkill.get(b.skill) || { test: b.test, domain: b.domain, total: 0 };
      e.total++;
      bankBySkill.set(b.skill, e);
    }

    const stats = new Map<string, SkillStat>();
    const ensure = (skill: string): SkillStat => {
      let s = stats.get(skill);
      if (!s) {
        const meta = bankBySkill.get(skill);
        s = {
          skill,
          test: meta?.test || "",
          domain: meta?.domain || "",
          available: meta?.total || 0,
          attempts: 0,
          correct: 0,
          latestCorrect: 0,
          distinct: new Set(),
          seconds: 0,
          recent: 0,
          lastMs: null,
          firstHalf: { t: 0, c: 0 },
          secondHalf: { t: 0, c: 0 },
        };
        stats.set(skill, s);
      }
      return s;
    };
    // include all bank skills so nothing is hidden (checkups)
    for (const skill of bankBySkill.keys()) ensure(skill);

    // per-skill ordered attempts for trend halves
    const perSkillSeq = new Map<string, AttemptRow[]>();
    const recentCut = Date.now() - RECENT_DAYS * DAY_MS;

    // daily window
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: Date[] = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * DAY_MS);
      days.push(d);
    }
    const byDay = new Map<string, { count: number; seconds: number }>();

    let weekCount = 0;
    const distinctAllQ = new Set<string>();

    for (const a of attempts) {
      const t = new Date(a.created_at).getTime();
      if (t >= recentCut) weekCount++;

      const dk = a.created_at.slice(0, 10);
      const dd = byDay.get(dk) || { count: 0, seconds: 0 };
      dd.count++;
      dd.seconds += a.time_spent_seconds;
      byDay.set(dk, dd);

      if (!a.question) continue;
      const s = ensure(a.question.skill);
      s.attempts++;
      if (a.is_correct) s.correct++;
      s.seconds += a.time_spent_seconds;
      s.distinct.add(a.question_uid);
      distinctAllQ.add(a.question_uid);
      if (t >= recentCut) s.recent++;
      s.lastMs = s.lastMs == null ? t : Math.max(s.lastMs, t);
      const seq = perSkillSeq.get(a.question.skill) || [];
      seq.push(a);
      perSkillSeq.set(a.question.skill, seq);
    }

    perSkillSeq.forEach((seq, skill) => {
      const s = stats.get(skill)!;
      const mid = Math.floor(seq.length / 2);
      const half = (rows: AttemptRow[]) => rows.reduce((acc, r) => ({ t: acc.t + 1, c: acc.c + (r.is_correct ? 1 : 0) }), { t: 0, c: 0 });
      s.firstHalf = half(seq.slice(0, mid));
      s.secondHalf = half(seq.slice(mid));
    });

    // Accuracy uses the MOST RECENT attempt per question, so a corrected mistake
    // counts as right. (Volume, time, and activity above stay cumulative.)
    const latestByQ = new Map<string, AttemptRow>();
    for (const a of attempts) if (a.question) latestByQ.set(a.question_uid, a);
    let overallCorrectLatest = 0;
    latestByQ.forEach((a) => {
      if (a.is_correct) {
        overallCorrectLatest++;
        const s = stats.get(a.question!.skill);
        if (s) s.latestCorrect++;
      }
    });

    const questionBars: DayBar[] = days.map((d) => {
      const k = dayKey(d);
      const v = byDay.get(k)?.count || 0;
      return { label: shortDate(d), value: v, full: `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${v} question${v === 1 ? "" : "s"}` };
    });
    const minuteBars: DayBar[] = days.map((d) => {
      const k = dayKey(d);
      const v = Math.round((byDay.get(k)?.seconds || 0) / 60);
      return { label: shortDate(d), value: v, full: `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${v} min` };
    });

    const totalAttempts = attempts.length;
    const skillStats = Array.from(stats.values());
    const presentTests = TESTS.filter((t) => skillStats.some((s) => s.test === t && s.available > 0));

    const bankTotal = bank.length;

    const distinctCount = distinctAllQ.size;
    const tiles = {
      accuracy: distinctCount ? Math.round((overallCorrectLatest / distinctCount) * 100) : 0,
      totalAttempts,
      overallCorrect: overallCorrectLatest,
      answered: distinctCount,
      covered: distinctAllQ.size,
      bankTotal,
      totalSeconds: totalPracticeSeconds,
      weekCount,
    };

    return { tiles, questionBars, minuteBars, skillStats, presentTests };
  }, [attempts, bank, sessionTimes]);

  const acc = (t: number, c: number) => (t ? Math.round((c / t) * 100) : 0);

  const visibleSkills = useMemo(() => {
    let list = skillStats.filter((s) => s.available > 0 || s.attempts > 0);
    if (tab !== "All") list = list.filter((s) => s.test === tab);
    const score = (s: SkillStat) => {
      // "needs attention": never/long-neglected first, then low accuracy
      const last = s.lastMs ?? 0;
      return last;
    };
    list = [...list].sort((a, b) => {
      if (sort === "az") return a.skill.localeCompare(b.skill);
      if (sort === "accuracy") {
        const aa = a.distinct.size ? a.latestCorrect / a.distinct.size : 2; // unpracticed last
        const bb = b.distinct.size ? b.latestCorrect / b.distinct.size : 2;
        return aa - bb;
      }
      if (sort === "coverage") {
        const ca = a.available ? a.distinct.size / a.available : 1;
        const cb = b.available ? b.distinct.size / b.available : 1;
        return ca - cb;
      }
      // attention: oldest last-practiced first (never = 0)
      return score(a) - score(b);
    });
    return list;
  }, [skillStats, tab, sort]);

  if (loading) return <PageLoader label="Loading your statistics…" />;

  const tabs = ["All", ...presentTests];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/practice" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 dark:hover:bg-brand-600">New session</Link>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Overall accuracy" value={`${tiles.accuracy}%`} sub={`${tiles.overallCorrect}/${tiles.answered} correct (latest)`} />
        <StatTile label="Coverage" value={`${tiles.covered}/${tiles.bankTotal}`} sub="questions practiced" />
        <StatTile label="Total time" value={fmtTime(tiles.totalSeconds)} sub="practicing (incl. review)" />
        <StatTile label="Last 7 days" value={`${tiles.weekCount}`} sub="questions answered" />
      </div>

      {tiles.totalAttempts === 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
          <p className="font-medium text-slate-800 dark:text-slate-100">No practice yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Start a session — your daily activity and per-topic stats will build up here.</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/practice" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 dark:hover:bg-brand-600">Start practicing</Link>
          </div>
        </div>
      )}

      {/* Daily activity */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Questions per day <span className="font-normal text-slate-400 dark:text-slate-500">· last {WINDOW_DAYS} days</span></h2>
          <DailyBars bars={questionBars} color="#3f07e8" />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Time per day <span className="font-normal text-slate-400 dark:text-slate-500">· minutes</span></h2>
          <DailyBars bars={minuteBars} color="#c026d3" suffix="m" />
        </div>
      </section>

      {/* By topic */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">By topic</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 dark:text-slate-500">Sort:</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1">
              <option value="attention">Needs attention</option>
              <option value="accuracy">Lowest accuracy</option>
              <option value="coverage">Least covered</option>
              <option value="az">A–Z</option>
            </select>
          </div>
        </div>

        {/* tabs */}
        <div className="mb-3 flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-brand-600 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Topic</th>
                <th className="px-3 py-2 font-medium">Done / avail</th>
                <th className="px-3 py-2 font-medium">7d</th>
                <th className="px-3 py-2 font-medium">Accuracy</th>
                <th className="px-3 py-2 font-medium">Avg time</th>
                <th className="px-3 py-2 font-medium">Trend</th>
                <th className="px-3 py-2 font-medium">Last done</th>
              </tr>
            </thead>
            <tbody>
              {visibleSkills.map((s) => {
                const a = acc(s.distinct.size, s.latestCorrect);
                const weak = s.distinct.size >= 3 && s.latestCorrect / s.distinct.size < WEAKNESS_THRESHOLD;
                const neglected = s.attempts === 0 || (s.lastMs != null && Date.now() - s.lastMs > NEGLECT_DAYS * DAY_MS);
                const done = s.available ? Math.min(s.distinct.size, s.available) : s.distinct.size;
                let trend = <span className="text-slate-300">—</span>;
                if (s.firstHalf.t && s.secondHalf.t && s.attempts >= 4) {
                  const d = acc(s.secondHalf.t, s.secondHalf.c) - acc(s.firstHalf.t, s.firstHalf.c);
                  if (d > 5) trend = <span className="text-emerald-600 dark:text-emerald-300">▲ +{d}%</span>;
                  else if (d < -5) trend = <span className="text-rose-600 dark:text-rose-400">▼ {d}%</span>;
                  else trend = <span className="text-slate-400 dark:text-slate-500">≈</span>;
                }
                return (
                  <tr key={s.skill} className={`border-b border-slate-100 last:border-0 ${weak ? "bg-amber-50/50 dark:bg-amber-950/50" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-700 dark:text-slate-200">
                        {s.skill}
                        {weak && <span className="ml-2 text-xs text-amber-600">⚠️ review</span>}
                      </div>
                      {tab === "All" && <div className="text-[11px] text-slate-400 dark:text-slate-500">{s.test} · {s.domain}</div>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {done}<span className="text-slate-400 dark:text-slate-500"> / {s.available}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{s.recent}</td>
                    <td className="px-3 py-2">
                      {s.attempts ? (
                        <span className={`font-semibold ${a >= 70 ? "text-emerald-700 dark:text-emerald-300" : a >= 40 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300"}`}>{a}%</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{s.attempts ? `${Math.round(s.seconds / s.attempts)}s` : "—"}</td>
                    <td className="px-3 py-2 text-xs font-medium">{trend}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={neglected ? "text-rose-500 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}>{daysAgoLabel(s.lastMs)}</span>
                    </td>
                  </tr>
                );
              })}
              {visibleSkills.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">No topics in this tab yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Accuracy counts your <strong>most recent</strong> answer per question, so re-doing a mistake correctly
          counts as right; time, volume, and activity are cumulative. &ldquo;Done / avail&rdquo; counts questions
          you&apos;ve answered in each topic against the total in the bank. Rows in amber are below{" "}
          {Math.round(WEAKNESS_THRESHOLD * 100)}%. &ldquo;Last done&rdquo; in red means it hasn&apos;t been practiced
          in over {NEGLECT_DAYS} days.
        </p>
      </section>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}
