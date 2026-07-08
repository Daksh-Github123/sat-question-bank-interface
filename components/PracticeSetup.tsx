"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { TAXONOMY, DIFFICULTIES, DIFFICULTY_COLORS } from "@/lib/taxonomy";

export interface PracticeConfig {
  skills: string[]; // empty => all skills
  difficulties: string[];
  count: number;
  mode: "stopwatch" | "timer";
  secondsPerQuestion: number;
  order: "random" | "sequential";
}

interface MetaRow {
  test: string;
  domain: string;
  skill: string;
  difficulty: string;
}

export default function PracticeSetup({ onStart }: { onStart: (c: PracticeConfig) => void }) {
  const [meta, setMeta] = useState<MetaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [difficulties, setDifficulties] = useState<Set<string>>(new Set(DIFFICULTIES));
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<"stopwatch" | "timer">("stopwatch");
  const [seconds, setSeconds] = useState(90);
  const [order, setOrder] = useState<"random" | "sequential">("random");

  useEffect(() => {
    (async () => {
      // Page through all questions' metadata to build the picker with live counts.
      const rows: MetaRow[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("questions")
          .select("test, domain, skill, difficulty")
          .range(from, from + pageSize - 1);
        if (error) break;
        rows.push(...(data as MetaRow[]));
        if (!data || data.length < pageSize) break;
      }
      setMeta(rows);
      setLoading(false);
    })();
  }, []);

  // Count available questions per skill (respecting difficulty filter).
  const skillCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of meta) {
      if (!difficulties.has(r.difficulty)) continue;
      m.set(r.skill, (m.get(r.skill) || 0) + 1);
    }
    return m;
  }, [meta, difficulties]);

  const totalPresentSkills = useMemo(() => {
    const s = new Set(meta.map((r) => r.skill));
    return s;
  }, [meta]);

  const matchingCount = useMemo(() => {
    return meta.filter(
      (r) =>
        difficulties.has(r.difficulty) &&
        (selectedSkills.size === 0 || selectedSkills.has(r.skill))
    ).length;
  }, [meta, difficulties, selectedSkills]);

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      next.has(skill) ? next.delete(skill) : next.add(skill);
      return next;
    });
  }

  function toggleDifficulty(d: string) {
    setDifficulties((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  }

  function setDomainSkills(skills: string[], on: boolean) {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      for (const s of skills) {
        if (on) next.add(s);
        else next.delete(s);
      }
      return next;
    });
  }

  const canStart = matchingCount > 0 && difficulties.size > 0;
  const effectiveCount = Math.min(count, matchingCount);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading your question bank…</p>;
  }

  if (meta.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="font-medium text-slate-800">Your question bank is empty.</p>
        <p className="mt-1 text-sm text-slate-500">
          Head to <a href="/import" className="text-brand-600 underline">Import PDFs</a> to add
          questions first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New practice session</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick topics and difficulties, then choose a stopwatch or per-question timer.
        </p>
      </div>

      {/* Difficulty */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Difficulty</h2>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => toggleDifficulty(d)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                difficulties.has(d)
                  ? DIFFICULTY_COLORS[d]
                  : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </section>

      {/* Skills grouped by test/domain */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Topics &amp; skills</h2>
          <button
            onClick={() => setSelectedSkills(new Set())}
            className="text-xs text-brand-600 hover:underline"
          >
            {selectedSkills.size === 0 ? "All skills included" : "Clear selection"}
          </button>
        </div>
        <div className="space-y-5">
          {TAXONOMY.map((t) => {
            const presentDomains = t.domains.filter((d) =>
              d.skills.some((s) => totalPresentSkills.has(s))
            );
            if (presentDomains.length === 0) return null;
            return (
              <div key={t.test}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {t.test}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {presentDomains.map((d) => {
                    const presentSkills = d.skills.filter((s) => totalPresentSkills.has(s));
                    const allOn = presentSkills.every((s) => selectedSkills.has(s));
                    return (
                      <div key={d.domain} className="rounded-md border border-slate-100 p-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">{d.domain}</span>
                          <button
                            onClick={() => setDomainSkills(presentSkills, !allOn)}
                            className="text-[11px] text-brand-600 hover:underline"
                          >
                            {allOn ? "none" : "all"}
                          </button>
                        </div>
                        <div className="space-y-1">
                          {presentSkills.map((s) => (
                            <label
                              key={s}
                              className="flex cursor-pointer items-center justify-between gap-2 text-sm"
                            >
                              <span className="flex items-center gap-2 text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={selectedSkills.has(s)}
                                  onChange={() => toggleSkill(s)}
                                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                                />
                                {s}
                              </span>
                              <span className="text-xs text-slate-400">
                                {skillCounts.get(s) || 0}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Session options */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Session options</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">
              Number of questions (max {matchingCount})
            </span>
            <input
              type="number"
              min={1}
              max={matchingCount}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">Question order</span>
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as any)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="random">Shuffled</option>
              <option value="sequential">In bank order</option>
            </select>
          </label>

          <div className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">Timing</span>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("stopwatch")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  mode === "stopwatch"
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-300 text-slate-600"
                }`}
              >
                ⏱ Stopwatch
              </button>
              <button
                onClick={() => setMode("timer")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  mode === "timer"
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-300 text-slate-600"
                }`}
              >
                ⏳ Timer
              </button>
            </div>
          </div>

          {mode === "timer" && (
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Seconds per question</span>
              <input
                type="number"
                min={10}
                max={600}
                value={seconds}
                onChange={(e) => setSeconds(Math.max(10, parseInt(e.target.value) || 10))}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {matchingCount} question{matchingCount === 1 ? "" : "s"} match — starting{" "}
          <strong>{effectiveCount}</strong>.
        </p>
        <button
          disabled={!canStart}
          onClick={() =>
            onStart({
              skills: Array.from(selectedSkills),
              difficulties: Array.from(difficulties),
              count: effectiveCount,
              mode,
              secondsPerQuestion: seconds,
              order,
            })
          }
          className="rounded-md bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Start practice
        </button>
      </div>
    </div>
  );
}
