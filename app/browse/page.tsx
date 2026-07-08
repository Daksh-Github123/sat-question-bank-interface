"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Question } from "@/lib/types";
import { DIFFICULTIES, DIFFICULTY_COLORS } from "@/lib/taxonomy";

export default function BrowsePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const rows: Question[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("questions")
          .select("*")
          .order("skill")
          .range(from, from + pageSize - 1);
        if (error || !data) break;
        rows.push(...(data as Question[]));
        if (data.length < pageSize) break;
      }
      setQuestions(rows);
      setLoading(false);
    })();
  }, []);

  const skills = useMemo(
    () => Array.from(new Set(questions.map((q) => q.skill))).sort(),
    [questions]
  );

  const filtered = questions.filter((q) => {
    if (skill && q.skill !== skill) return false;
    if (difficulty && q.difficulty !== difficulty) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !q.question_text.toLowerCase().includes(s) &&
        !q.question_id.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  if (loading) return <p className="text-sm text-slate-500">Loading question bank…</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Browse bank</h1>
        <span className="text-sm text-slate-500">{questions.length} questions total</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search text or question ID…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All skills</option>
          {skills.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-slate-400">{filtered.length} shown</p>

      <div className="space-y-3">
        {filtered.slice(0, 300).map((q) => (
          <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <button
              onClick={() => setExpanded(expanded === q.id ? null : q.id)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-xs ${DIFFICULTY_COLORS[q.difficulty] || ""}`}>
                    {q.difficulty}
                  </span>
                  <span className="text-xs text-slate-500">{q.skill}</span>
                  <span className="font-mono text-[11px] text-slate-300">{q.question_id}</span>
                </div>
                <p className="line-clamp-2 text-sm text-slate-700">{q.question_text}</p>
              </div>
              <span className="flex-none text-slate-400">{expanded === q.id ? "−" : "+"}</span>
            </button>

            {expanded === q.id && (
              <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
                <p className="whitespace-pre-wrap text-slate-700">{q.question_text}</p>
                {q.choices && (
                  <ul className="mt-3 space-y-1">
                    {q.choices.map((c) => (
                      <li
                        key={c.letter}
                        className={
                          c.letter === q.correct_answer
                            ? "font-medium text-emerald-700"
                            : "text-slate-600"
                        }
                      >
                        {c.letter}. {c.text}
                        {c.letter === q.correct_answer && " ✓"}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-sm">
                  <span className="font-semibold text-slate-700">Correct answer:</span>{" "}
                  <span className="text-emerald-700">{q.correct_answer}</span>
                </p>
                {q.rationale && (
                  <div className="mt-3 rounded-md bg-slate-50 p-3">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                      Explanation
                    </p>
                    <p className="whitespace-pre-wrap text-slate-600">{q.rationale}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {filtered.length > 300 && (
        <p className="text-center text-xs text-slate-400">
          Showing first 300 — refine your search to see more.
        </p>
      )}
    </div>
  );
}
