"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { DIFFICULTIES, DIFFICULTY_COLORS, TAXONOMY } from "@/lib/taxonomy";

interface AttemptRow {
  is_correct: boolean;
  time_spent_seconds: number;
  created_at: string;
  question: {
    test: string;
    domain: string;
    skill: string;
    difficulty: string;
  } | null;
}

interface Group {
  total: number;
  correct: number;
  seconds: number;
}

function emptyGroup(): Group {
  return { total: 0, correct: 0, seconds: 0 };
}

function pct(g: Group) {
  return g.total ? Math.round((g.correct / g.total) * 100) : 0;
}

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
          .select(
            "is_correct, time_spent_seconds, created_at, question:questions(test, domain, skill, difficulty)"
          )
          .order("created_at", { ascending: false })
          .limit(10000),
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
  const byTest = new Map<string, Group>();

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
    add(byTest, a.question.test);
  }

  const avgTime = overall.total ? Math.round(overall.seconds / overall.total) : 0;

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
            <Link
              href="/practice"
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Start practicing
            </Link>
            <Link
              href="/import"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Import PDFs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/practice"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          New session
        </Link>
      </div>

      {/* Top stat tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Overall accuracy" value={`${pct(overall)}%`} sub={`${overall.correct}/${overall.total} correct`} />
        <StatTile label="Questions done" value={`${overall.total}`} sub={`${bankSize} in bank`} />
        <StatTile label="Total time" value={fmtTime(overall.seconds)} sub="across all sessions" />
        <StatTile label="Avg / question" value={`${avgTime}s`} sub="time spent" />
      </div>

      {/* By difficulty */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Accuracy by difficulty</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {DIFFICULTIES.map((d) => {
            const g = byDifficulty.get(d) || emptyGroup();
            const colorBar =
              d === "Easy" ? "bg-emerald-500" : d === "Medium" ? "bg-amber-500" : "bg-rose-500";
            return (
              <div key={d} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`rounded border px-2 py-0.5 text-xs ${DIFFICULTY_COLORS[d]}`}>
                    {d}
                  </span>
                  <span className="text-lg font-bold text-slate-800">{pct(g)}%</span>
                </div>
                <AccuracyBar value={pct(g)} color={colorBar} />
                <p className="mt-2 text-xs text-slate-500">
                  {g.correct}/{g.total} correct · {g.total ? Math.round(g.seconds / g.total) : 0}s avg
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* By domain */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Accuracy by domain</h2>
        <div className="space-y-2">
          {Array.from(byDomain.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .map(([domain, g]) => (
              <div key={domain} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{domain}</span>
                  <span className="text-slate-500">
                    <strong className="text-slate-800">{pct(g)}%</strong> · {g.correct}/{g.total}
                  </span>
                </div>
                <AccuracyBar value={pct(g)} />
              </div>
            ))}
        </div>
      </section>

      {/* By skill table */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Accuracy by skill</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Skill</th>
                <th className="px-4 py-2 font-medium">Attempts</th>
                <th className="px-4 py-2 font-medium">Accuracy</th>
                <th className="px-4 py-2 font-medium">Avg time</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(bySkill.entries())
                .sort((a, b) => pct(a[1]) - pct(b[1]))
                .map(([skill, g]) => (
                  <tr key={skill} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 text-slate-700">{skill}</td>
                    <td className="px-4 py-2 text-slate-500">{g.total}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-10 font-semibold text-slate-800">{pct(g)}%</span>
                        <div className="w-24">
                          <AccuracyBar
                            value={pct(g)}
                            color={pct(g) >= 70 ? "bg-emerald-500" : pct(g) >= 40 ? "bg-amber-500" : "bg-rose-500"}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {g.total ? Math.round(g.seconds / g.total) : 0}s
                    </td>
                  </tr>
                ))}
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
