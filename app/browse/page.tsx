"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Question } from "@/lib/types";
import { DIFFICULTIES, DIFFICULTY_COLORS } from "@/lib/taxonomy";
import { currentUserId } from "@/lib/user";

type Status = "attempted" | "unattempted" | "wrong" | "correct" | "guessed" | "flagged";

export default function BrowsePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // per-question derived status
  const [latestByQ, setLatestByQ] = useState<Map<string, { is_correct: boolean; confidence: string | null }>>(new Map());
  const [everGuessed, setEverGuessed] = useState<Set<string>>(new Set());
  const [flaggedSet, setFlaggedSet] = useState<Set<string>>(new Set());
  const [noteMap, setNoteMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    (async () => {
      const rows: Question[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase.from("questions").select("*").order("skill").range(from, from + pageSize - 1);
        if (error || !data) break;
        rows.push(...(data as Question[]));
        if (data.length < pageSize) break;
      }
      setQuestions(rows);

      const [{ data: att }, { data: states }] = await Promise.all([
        supabase.from("attempts").select("question_uid, is_correct, confidence, created_at").eq("user_id", currentUserId()).order("created_at", { ascending: false }).limit(20000),
        supabase.from("question_state").select("question_uid, flagged, note").eq("user_id", currentUserId()).limit(20000),
      ]);
      const latest = new Map<string, { is_correct: boolean; confidence: string | null }>();
      const guessed = new Set<string>();
      for (const a of (att as any[]) || []) {
        if (!latest.has(a.question_uid)) latest.set(a.question_uid, { is_correct: a.is_correct, confidence: a.confidence });
        if (a.confidence === "guessed") guessed.add(a.question_uid);
      }
      const flagged = new Set<string>();
      const notes = new Map<string, string>();
      for (const s of (states as any[]) || []) {
        if (s.flagged) flagged.add(s.question_uid);
        if (s.note) notes.set(s.question_uid, s.note);
      }
      setLatestByQ(latest);
      setEverGuessed(guessed);
      setFlaggedSet(flagged);
      setNoteMap(notes);
      setLoading(false);
    })();
  }, []);

  const skills = useMemo(() => Array.from(new Set(questions.map((q) => q.skill))).sort(), [questions]);

  const filtered = questions.filter((q) => {
    if (skill && q.skill !== skill) return false;
    if (difficulty && q.difficulty !== difficulty) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!q.question_text.toLowerCase().includes(s) && !q.question_id.toLowerCase().includes(s)) return false;
    }
    if (status) {
      const l = latestByQ.get(q.id);
      if (status === "attempted" && !l) return false;
      if (status === "unattempted" && l) return false;
      if (status === "wrong" && !(l && !l.is_correct)) return false;
      if (status === "correct" && !(l && l.is_correct)) return false;
      if (status === "guessed" && !everGuessed.has(q.id)) return false;
      if (status === "flagged" && !flaggedSet.has(q.id)) return false;
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
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search text or question ID…" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select value={skill} onChange={(e) => setSkill(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All skills</option>
          {skills.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Any status</option>
          <option value="unattempted">Unattempted</option>
          <option value="attempted">Attempted</option>
          <option value="wrong">Got wrong (latest)</option>
          <option value="correct">Got right (latest)</option>
          <option value="guessed">Ever guessed</option>
          <option value="flagged">Flagged</option>
        </select>
      </div>

      <p className="text-xs text-slate-400">{filtered.length} shown</p>

      <div className="space-y-3">
        {filtered.slice(0, 300).map((q) => {
          const l = latestByQ.get(q.id);
          const note = noteMap.get(q.id);
          return (
            <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <button onClick={() => setExpanded(expanded === q.id ? null : q.id)} className="flex w-full items-start justify-between gap-3 text-left">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded border px-1.5 py-0.5 text-xs ${DIFFICULTY_COLORS[q.difficulty] || ""}`}>{q.difficulty}</span>
                    <span className="text-xs text-slate-500">{q.skill}</span>
                    {flaggedSet.has(q.id) && <span className="text-xs text-amber-600">🚩</span>}
                    {l && <span className={`text-xs ${l.is_correct ? "text-emerald-600" : "text-rose-600"}`}>{l.is_correct ? "✓ correct" : "✗ wrong"}</span>}
                    {!l && <span className="text-xs text-slate-400">unattempted</span>}
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
                        <li key={c.letter} className={c.letter === q.correct_answer ? "font-medium text-emerald-700" : "text-slate-600"}>
                          {c.letter}. {c.text}{c.letter === q.correct_answer && " ✓"}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-sm"><span className="font-semibold text-slate-700">Correct answer:</span> <span className="text-emerald-700">{q.correct_answer}</span></p>
                  {note && <p className="mt-2 text-sm text-slate-600">📝 {note}</p>}
                  {q.rationale && (
                    <div className="mt-3 rounded-md bg-slate-50 p-3">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Explanation</p>
                      <p className="whitespace-pre-wrap text-slate-600">{q.rationale}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {filtered.length > 300 && <p className="text-center text-xs text-slate-400">Showing first 300 — refine your search to see more.</p>}
    </div>
  );
}
