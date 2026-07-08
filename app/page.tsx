"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { DIFFICULTIES, DIFFICULTY_COLORS } from "@/lib/taxonomy";
import { WEAKNESS_THRESHOLD } from "@/lib/practice";
import AccuracyTrend, { TrendPoint } from "@/components/AccuracyTrend";

interface AttemptRow {
  is_correct: boolean;
  time_spent_seconds: number;
  created_at: string;
  confidence: string | null;
  question: { test: string; domain: string; skill: string; difficulty: string } | null;
}

interface Group {
  total: number;
  correct: number;
  seconds: number;
}
const emptyGroup = (): Group => ({ total: 0, correct: 0, seconds: 0 });
const pct = (g: Group) => (g.total ? Math.round((g.correct / g.total) * 100) : 0);

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function AccuracyBar({ value, color = "bg-brand-500" }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export default function DashboardPage() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [bankSize, setBankSize] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: att }, { count }] = await Promise.all([
        supabase
          .from("attempts")
          .select("is_correct, time_spent_seconds, created_at, confidence, question:questions(test, domain, skill, difficulty)")
          .order("created_at", { ascending: true })
          .limit(20000),
        supabase.from("questions").select("*", { count: "exact", head: true }),
      ]);
      setAttempts((att as unknown as AttemptRow[]) || []);
      setBankSize(count || 0);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading your statistics…</p>;

  const overall = attempts.reduce((g, a) => {
    g.total++;
    if (a.is_correct) g.correct++;
    g.seconds += a.time_spent_seconds;
    return g;
  }, emptyGroup());

  const byDifficulty = new Map<string, Group>();
  const byDomain = new Map<string, Group>();
  const bySkill = new Map<string, Group>();
  // per-skill split into earlier vs recent halves for a trend arrow
  const bySkillHalves = new Map<string, { first: Group; second: Group; count: number }>();

  const skillAttemptSeq = new Map<string, AttemptRow[]>();
  for (const a of attempts) {
    if (!a.question) continue;
    const add = (map: Map<string, Group>, key: string) => {
      const g = map.get(key) || emptyGroup();
      g.total++;
      if (a.is_correct) g.correct++;
      g.seconds += a.time_spent_seconds;
      map.set(key, g);
    };
    add(byDifficulty, a.question.difficulty);
    add(byDomain, a.question.domain);
    add(bySkill, a.question.skill);
    const arr = skillAttemptSeq.get(a.question.skill) || [];
    arr.push(a);
    skillAttemptSeq.set(a.question.skill, arr);
  }
  skillAttemptSeq.forEach((arr, skill) => {
    const mid = Math.floor(arr.length / 2);
    const acc = (rows: AttemptRow[]) => {
      const g = emptyGroup();
      rows.forEach((r) => {
        g.total++;
        if (r.is_correct) g.correct++;
      });
      return g;
    };
    bySkillHalves.set(skill, { first: acc(arr.slice(0, mid)), second: acc(arr.slice(mid)), count: arr.length });
  });

  const avgTime = overall.total ? Math.round(overall.seconds / overall.total) : 0;

  // Confidence-adjusted "true mastery": correct AND marked confident.
  const confident = attempts.filter((a) => a.confidence === "confident");
  const confidentCorrect = confident.filter((a) => a.is_correct).length;
  const luckyGuesses = attempts.filter((a) => a.confidence === "guessed" && a.is_correct).length;

  // Daily accuracy trend.
  const byDay = new Map<string, Group>();
  for (const a of attempts) {
    const day = a.created_at.slice(0, 10);
    const g = byDay.get(day) || emptyGroup();
    g.total++;
    if (a.is_correct) g.correct++;
    byDay.set(day, g);
  }
  const trend: TrendPoint[] = Array.from(byDay.entries())
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([day, g]) => ({
      label: new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      accuracy: pct(g),
      total: g.total,
    }));

  // Weak skills (meaningful sample, below threshold).
  const weakSkills = Array.from(bySkill.entries())
    .filter(([, g]) => g.total >= 3 && g.correct / g.total < WEAKNESS_THRESHOLD)
    .sort((a, b) => pct(a[1]) - pct(b[1]));

  if (overall.total === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-lg font-semibold text-slate-800">No attempts yet</p>
          <p className="mt-1 text-sm text-slate-500">
            {bankSize > 0
              ? `You have ${bankSize} questions in your bank. Start a session to track your stats.`
              : "Import some question PDFs, then start practicing."}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/practice" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Start practicing</Link>
            <Link href="/import" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Import PDFs</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/practice" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">New session</Link>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Overall accuracy" value={`${pct(overall)}%`} sub={`${overall.correct}/${overall.total} correct`} />
        <StatTile label="Questions done" value={`${overall.total}`} sub={`${bankSize} in bank`} />
        <StatTile label="Total time" value={fmtTime(overall.seconds)} sub="across all sessions" />
        <StatTile label="Avg / question" value={`${avgTime}s`} sub="time spent" />
      </div>

      {/* Confidence insight */}
      {confident.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">True mastery: </span>
          {confidentCorrect}/{confident.length} of the questions you felt confident about were correct
          {luckyGuesses > 0 && <> · {luckyGuesses} right answer{luckyGuesses === 1 ? " was" : "s were"} lucky guesses</>}.
        </div>
      )}

      {/* Weakness warnings */}
      {weakSkills.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <span>⚠️</span> Skills below {Math.round(WEAKNESS_THRESHOLD * 100)}% — review the material before drilling these again
          </p>
          <div className="flex flex-wrap gap-2">
            {weakSkills.map(([skill, g]) => (
              <span key={skill} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs text-amber-800">
                {skill}: <strong>{pct(g)}%</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Progress over time */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Accuracy over time</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <AccuracyTrend points={trend} />
        </div>
      </section>

      {/* By difficulty */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Accuracy by difficulty</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {DIFFICULTIES.map((d) => {
            const g = byDifficulty.get(d) || emptyGroup();
            const colorBar = d === "Easy" ? "bg-emerald-500" : d === "Medium" ? "bg-amber-500" : "bg-rose-500";
            return (
              <div key={d} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`rounded border px-2 py-0.5 text-xs ${DIFFICULTY_COLORS[d]}`}>{d}</span>
                  <span className="text-lg font-bold text-slate-800">{pct(g)}%</span>
                </div>
                <AccuracyBar value={pct(g)} color={colorBar} />
                <p className="mt-2 text-xs text-slate-500">{g.correct}/{g.total} correct · {g.total ? Math.round(g.seconds / g.total) : 0}s avg</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* By skill with trend arrows */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Accuracy by skill</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Skill</th>
                <th className="px-4 py-2 font-medium">Attempts</th>
                <th className="px-4 py-2 font-medium">Accuracy</th>
                <th className="px-4 py-2 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(bySkill.entries())
                .sort((a, b) => pct(a[1]) - pct(b[1]))
                .map(([skill, g]) => {
                  const halves = bySkillHalves.get(skill);
                  let trendEl = <span className="text-slate-300">—</span>;
                  if (halves && halves.count >= 4 && halves.first.total && halves.second.total) {
                    const delta = pct(halves.second) - pct(halves.first);
                    if (delta > 5) trendEl = <span className="text-emerald-600">▲ +{delta}%</span>;
                    else if (delta < -5) trendEl = <span className="text-rose-600">▼ {delta}%</span>;
                    else trendEl = <span className="text-slate-400">≈ steady</span>;
                  }
                  const below = g.correct / g.total < WEAKNESS_THRESHOLD;
                  return (
                    <tr key={skill} className={`border-b border-slate-100 last:border-0 ${below ? "bg-amber-50/40" : ""}`}>
                      <td className="px-4 py-2 text-slate-700">
                        {skill}
                        {below && <span className="ml-2 text-xs text-amber-600">⚠️</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{g.total}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-10 font-semibold text-slate-800">{pct(g)}%</span>
                          <div className="w-24">
                            <AccuracyBar value={pct(g)} color={pct(g) >= 70 ? "bg-emerald-500" : pct(g) >= 40 ? "bg-amber-500" : "bg-rose-500"} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs font-medium">{trendEl}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}
