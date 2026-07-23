"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Question, MissReason } from "@/lib/types";
import { MISS_REASON_LABELS } from "@/lib/types";
import { DIFFICULTIES, DIFFICULTY_COLORS } from "@/lib/taxonomy";
import { REVIEW_INTERVAL_DAYS } from "@/lib/practice";
import { setNote as persistNote } from "@/lib/questionState";
import { currentUserId } from "@/lib/user";

interface WrongItem {
  attemptId: string;
  question: Question;
  selected: string | null;
  missReason: MissReason | null;
  when: string;
  note: string;
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function ReviewPage() {
  const [items, setItems] = useState<WrongItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [reason, setReason] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: att }, { data: states }] = await Promise.all([
      supabase
        .from("attempts")
        .select("id, question_uid, selected_answer, is_correct, miss_reason, created_at, question:questions(*)")
        .eq("user_id", currentUserId())
        .order("created_at", { ascending: false })
        .limit(20000),
      supabase.from("question_state").select("question_uid, note").eq("user_id", currentUserId()).limit(20000),
    ]);
    const noteMap = new Map<string, string>();
    for (const s of (states as any[]) || []) if (s.note) noteMap.set(s.question_uid, s.note);

    // Latest attempt per question.
    const latest = new Map<string, any>();
    for (const a of (att as any[]) || []) {
      if (!latest.has(a.question_uid)) latest.set(a.question_uid, a);
    }
    const wrong: WrongItem[] = [];
    for (const a of latest.values()) {
      if (a.is_correct || !a.question) continue;
      wrong.push({
        attemptId: a.id,
        question: a.question as Question,
        selected: a.selected_answer,
        missReason: a.miss_reason,
        when: a.created_at,
        note: noteMap.get(a.question_uid) || "",
      });
    }
    wrong.sort((x, y) => +new Date(y.when) - +new Date(x.when));
    setItems(wrong);
    setLoading(false);
  }

  const skills = useMemo(() => Array.from(new Set(items.map((i) => i.question.skill))).sort(), [items]);

  const filtered = items.filter((i) => {
    if (skill && i.question.skill !== skill) return false;
    if (difficulty && i.question.difficulty !== difficulty) return false;
    if (reason && i.missReason !== reason) return false;
    if (dueOnly) {
      const days = (Date.now() - new Date(i.when).getTime()) / (24 * 3600 * 1000);
      if (days < REVIEW_INTERVAL_DAYS) return false;
    }
    return true;
  });

  const reasonCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (i.missReason) m.set(i.missReason, (m.get(i.missReason) || 0) + 1);
    return m;
  }, [items]);

  async function copyId(qid: string) {
    try {
      await navigator.clipboard.writeText(qid);
      setCopied(qid);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  async function updateReason(item: WrongItem, r: MissReason) {
    setItems((prev) => prev.map((i) => (i.attemptId === item.attemptId ? { ...i, missReason: r } : i)));
    await supabase.from("attempts").update({ miss_reason: r }).eq("id", item.attemptId);
  }

  async function saveNote(item: WrongItem, note: string) {
    setItems((prev) => prev.map((i) => (i.question.id === item.question.id ? { ...i, note } : i)));
    await persistNote(item.question.id, note);
  }

  if (loading) return <p className="text-sm text-slate-500">Loading your mistakes…</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Review mistakes</h1>
        <span className="text-sm text-slate-500">{items.length} to fix</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-lg font-semibold text-slate-800">No outstanding mistakes 🎉</p>
          <p className="mt-1 text-sm text-slate-500">
            Questions you miss show up here automatically so you can re-attempt and clear them.
          </p>
        </div>
      ) : (
        <>
          {/* Reason breakdown */}
          {reasonCounts.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MISS_REASON_LABELS) as MissReason[]).map((r) =>
                reasonCounts.get(r) ? (
                  <span key={r} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                    {MISS_REASON_LABELS[r]}: <strong>{reasonCounts.get(r)}</strong>
                  </span>
                ) : null
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select value={skill} onChange={(e) => setSkill(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">All skills</option>
              {skills.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">All difficulties</option>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Any reason</option>
              {(Object.keys(MISS_REASON_LABELS) as MissReason[]).map((r) => <option key={r} value={r}>{MISS_REASON_LABELS[r]}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600">
              <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} className="h-4 w-4" />
              Due for review
            </label>
          </div>

          <p className="text-xs text-slate-400">{filtered.length} shown</p>

          <div className="space-y-3">
            {filtered.map((item) => {
              const q = item.question;
              const open = expanded === item.attemptId;
              return (
                <div key={item.attemptId} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => setExpanded(open ? null : item.attemptId)} className="min-w-0 flex-1 text-left">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded border px-1.5 py-0.5 ${DIFFICULTY_COLORS[q.difficulty] || ""}`}>{q.difficulty}</span>
                        <span className="text-slate-500">{q.skill}</span>
                        <span className="text-slate-400">missed {timeAgo(item.when)}</span>
                      </div>
                      <p className="line-clamp-1 text-sm text-slate-500">{q.question_text}</p>
                      <p className="mt-1 text-xs">
                        <span className="text-rose-600">You: {item.selected || "—"}</span>
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="text-emerald-600">Correct: {q.correct_answer}</span>
                      </p>
                    </button>
                    <div className="flex flex-none flex-col items-end gap-1">
                      <button
                        onClick={() => copyId(q.question_id)}
                        className="rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-500 hover:bg-slate-50"
                        title="Copy question ID"
                      >
                        {copied === q.question_id ? "copied!" : q.question_id}
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{q.question_text}</p>
                      {q.choices && (
                        <ul className="space-y-1 text-sm">
                          {q.choices.map((c) => (
                            <li key={c.letter} className={c.letter === q.correct_answer ? "font-medium text-emerald-700" : item.selected === c.letter ? "text-rose-600" : "text-slate-600"}>
                              {c.letter}. {c.text}
                              {c.letter === q.correct_answer && " ✓"}
                              {item.selected === c.letter && c.letter !== q.correct_answer && " ← your answer"}
                            </li>
                          ))}
                        </ul>
                      )}
                      {q.rationale && (
                        <div className="rounded-md bg-slate-50 p-3">
                          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Explanation</p>
                          <p className="whitespace-pre-wrap text-sm text-slate-600">{q.rationale}</p>
                        </div>
                      )}

                      {/* Miss-reason */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">Why missed?</span>
                        {(Object.keys(MISS_REASON_LABELS) as MissReason[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => updateReason(item, r)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${item.missReason === r ? "border-rose-400 bg-rose-50 text-rose-700" : "border-slate-300 text-slate-500"}`}
                          >
                            {MISS_REASON_LABELS[r]}
                          </button>
                        ))}
                      </div>

                      {/* Note */}
                      <NoteEditor initial={item.note} onSave={(n) => saveNote(item, n)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function NoteEditor({ initial, onSave }: { initial: string; onSave: (n: string) => void }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-500">📝 My note</p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="Your takeaway for this question…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => {
            onSave(value);
            setSaved(true);
          }}
          className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
