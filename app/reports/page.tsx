"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { currentUserId } from "@/lib/user";
import { listVocab, sentenceFor } from "@/lib/vocab";
import CopyButton from "@/components/ui/CopyButton";

interface SessionOpt {
  id: string;
  created_at: string;
  mode: string;
  current_index: number;
  config: { skills?: string[]; difficulties?: string[] } | null;
}

const MODE_LABEL: Record<string, string> = {
  stopwatch: "Stopwatch",
  timer: "Per-question timer",
  module: "Timed module",
};

function sessionLabel(s: SessionOpt): string {
  const when = new Date(s.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const cfg = s.config || {};
  const skills =
    cfg.skills && cfg.skills.length
      ? cfg.skills.length <= 2
        ? cfg.skills.join(", ")
        : `${cfg.skills.length} skills`
      : "All skills";
  const diffs =
    cfg.difficulties && cfg.difficulties.length
      ? [...cfg.difficulties].sort().map((d) => d[0]).join("/")
      : "—";
  return `${when} · ${skills} · ${diffs} · ${s.current_index}Q`;
}

interface QuestionMeta {
  question_id: string;
  skill: string;
  difficulty: string;
  correct_answer: string;
  question_text: string;
  choices: { letter: string; text: string }[] | null;
  rationale: string | null;
}

interface AttemptRow {
  question_uid: string;
  is_correct: boolean;
  selected_answer: string | null;
  time_spent_seconds: number;
  confidence: string | null;
  miss_reason: string | null;
  created_at: string;
  question: QuestionMeta | null;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

const MISS_REASON_TEXT: Record<string, string> = {
  concept: "didn't know the concept",
  careless: "careless mistake",
  rushed: "went too fast",
  time: "ran out of time",
  misread: "misread the question",
};

// RED < 70, YELLOW 70–84, GREEN 85+
function skillStatus(pct: number): string {
  if (pct < 70) return "RED";
  if (pct < 85) return "YELLOW";
  return "GREEN";
}

export default function ReportsPage() {
  const today = new Date();
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [start, setStart] = useState(iso(monthAgo));
  const [end, setEnd] = useState(iso(today));
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [scope, setScope] = useState<"range" | "session">("range");
  const [sessions, setSessions] = useState<SessionOpt[]>([]);
  const [sessionId, setSessionId] = useState("");

  // Report options.
  const [diffFilter, setDiffFilter] = useState<Set<string>>(new Set(["Easy", "Medium", "Hard"]));
  const [inc, setInc] = useState({
    overall: true,
    difficulty: true,
    skill: true,
    missed: true,
    guessed: true,
    flagged: true,
    noted: false,
    fast: false,
    slow: false,
  });
  const [fastSec, setFastSec] = useState(15);
  const [slowSec, setSlowSec] = useState(30);
  const [fullDetail, setFullDetail] = useState(true);
  const toggleInc = (k: keyof typeof inc) => setInc((p) => ({ ...p, [k]: !p[k] }));
  const toggleDiff = (d: string) =>
    setDiffFilter((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("practice_sessions")
        .select("id, created_at, mode, current_index, config")
        .eq("user_id", currentUserId())
        .order("created_at", { ascending: false })
        .limit(500);
      const opts = ((data as SessionOpt[]) || []).filter((s) => s.current_index > 0);
      setSessions(opts);
      if (opts.length) setSessionId(opts[0].id);
    })();
  }, []);

  async function generate() {
    setBusy(true);
    setReport("");
    const uid = currentUserId();
    let query = supabase
      .from("attempts")
      .select("question_uid, is_correct, selected_answer, time_spent_seconds, confidence, miss_reason, created_at, question:questions(question_id, skill, difficulty, correct_answer, question_text, choices, rationale)")
      .eq("user_id", uid)
      .order("created_at", { ascending: true })
      .limit(20000);

    let headerLine: string;
    let emptyMsg: string;
    if (scope === "session") {
      if (!sessionId) {
        setReport("Pick a session to report on.");
        setBusy(false);
        return;
      }
      query = query.eq("session_id", sessionId);
      const s = sessions.find((x) => x.id === sessionId);
      headerLine = `Session: ${s ? sessionLabel(s) : sessionId}`;
      emptyMsg = "No attempts recorded for that session.";
    } else {
      const startTs = new Date(start + "T00:00:00").toISOString();
      const endTs = new Date(end + "T23:59:59").toISOString();
      query = query.gte("created_at", startTs).lte("created_at", endTs);
      headerLine = `Period: ${start} to ${end}`;
      emptyMsg = `No practice recorded between ${start} and ${end}.`;
    }
    const { data } = await query;
    const allRows = ((data as unknown as AttemptRow[]) || []).filter((r) => r.question);
    // Difficulty filter applies to the whole report.
    const rows = allRows.filter((r) => diffFilter.has(r.question!.difficulty));

    if (rows.length === 0) {
      setReport(diffFilter.size < 3 ? `${emptyMsg} (for the selected difficulties)` : emptyMsg);
      setBusy(false);
      return;
    }

    const pct = (c: number, t: number) => (t ? Math.round((c / t) * 100) : 0);
    // Latest attempt per question within scope (rows are ascending, so last wins).
    const latest = new Map<string, AttemptRow>();
    for (const r of rows) latest.set(r.question_uid, r);
    const latestList = Array.from(latest.values());

    // Question-detail formatter, honoring the "full detail" toggle.
    const detail = (q: QuestionMeta, headerExtra: string): string[] => {
      const out = [`[${q.question_id}] ${q.skill} (${q.difficulty})${headerExtra ? " · " + headerExtra : ""}`];
      if (fullDetail) {
        out.push(`Question: ${(q.question_text || "").trim()}`);
        (q.choices || []).forEach((c) => out.push(`${c.letter}. ${c.text}`));
        out.push(`Correct answer: ${q.correct_answer}`);
        if (q.rationale) out.push(`Rationale: ${q.rationale.trim()}`);
      }
      return out;
    };

    // Flags + notes (outstanding, all-time), restricted to the chosen difficulties.
    let stateRows: { question_uid: string; flagged: boolean; note: string | null }[] = [];
    if (inc.flagged || inc.noted) {
      const { data: sd } = await supabase
        .from("question_state")
        .select("question_uid, flagged, note")
        .eq("user_id", uid)
        .limit(20000);
      stateRows = (sd as any[]) || [];
    }
    const noteByUid = new Map<string, string>();
    const flaggedUids: string[] = [];
    for (const s of stateRows) {
      if (inc.flagged && s.flagged) flaggedUids.push(s.question_uid);
      if (inc.noted && s.note && s.note.trim()) noteByUid.set(s.question_uid, s.note.trim());
    }
    const stateUids = Array.from(new Set([...flaggedUids, ...noteByUid.keys()]));
    const metaByUid = new Map<string, QuestionMeta>();
    if (stateUids.length) {
      const { data: mq } = await supabase
        .from("questions")
        .select("id, question_id, skill, difficulty, correct_answer, question_text, choices, rationale")
        .in("id", stateUids)
        .limit(20000);
      for (const q of (mq as any[]) || []) {
        if (diffFilter.has(q.difficulty)) metaByUid.set(q.id, q as QuestionMeta);
      }
    }

    const total = rows.length;
    const correct = rows.filter((r) => r.is_correct).length;
    const seconds = rows.reduce((a, r) => a + r.time_spent_seconds, 0);
    const acc = pct(correct, total);

    const lines: string[] = [];
    lines.push(`SAT PRACTICE REPORT`);
    lines.push(headerLine);
    if (diffFilter.size < 3) lines.push(`Difficulties: ${["Easy", "Medium", "Hard"].filter((d) => diffFilter.has(d)).join(", ")}`);
    lines.push(``);

    if (inc.overall) {
      lines.push(`OVERALL`);
      lines.push(`- Questions attempted: ${total}`);
      lines.push(`- Correct: ${correct} (${acc}% accuracy)`);
      lines.push(`- Time spent: ${Math.round(seconds / 60)} min (${Math.round(seconds / total)}s avg/question)`);
      lines.push(``);
    }

    if (inc.difficulty) {
      const byDiff = new Map<string, { total: number; correct: number }>();
      for (const r of rows) {
        const g = byDiff.get(r.question!.difficulty) || { total: 0, correct: 0 };
        g.total++;
        if (r.is_correct) g.correct++;
        byDiff.set(r.question!.difficulty, g);
      }
      lines.push(`BY DIFFICULTY`);
      ["Easy", "Medium", "Hard"].filter((d) => diffFilter.has(d)).forEach((d) => {
        const g = byDiff.get(d) || { total: 0, correct: 0 };
        lines.push(`- ${d}: ${g.correct}/${g.total} (${pct(g.correct, g.total)}%)`);
      });
      lines.push(``);
    }

    if (inc.skill) {
      const bySkill = new Map<string, { total: number; correct: number; last: string }>();
      for (const r of rows) {
        const g = bySkill.get(r.question!.skill) || { total: 0, correct: 0, last: r.created_at };
        g.total++;
        if (r.is_correct) g.correct++;
        if (r.created_at > g.last) g.last = r.created_at;
        bySkill.set(r.question!.skill, g);
      }
      lines.push(`BY SKILL`);
      Array.from(bySkill.entries())
        .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
        .forEach(([skill, g]) => {
          const a = pct(g.correct, g.total);
          lines.push(`- ${skill}: ${g.correct}/${g.total} (${a}%) [${skillStatus(a)}] · last practiced ${g.last.slice(0, 10)}`);
        });
      lines.push(``);
    }

    if (inc.missed) {
      const missed = latestList.filter((r) => !r.is_correct);
      lines.push(`MISSED QUESTIONS (${missed.length})`);
      if (missed.length === 0) lines.push(`- none in scope`);
      missed.forEach((r) => {
        const reason = r.miss_reason ? MISS_REASON_TEXT[r.miss_reason] || r.miss_reason : "untagged";
        lines.push(``);
        lines.push(...detail(r.question!, `you=${r.selected_answer ?? "—"} correct=${r.question!.correct_answer} · ${r.time_spent_seconds}s · reason=${reason}`));
      });
      lines.push(``);
    }

    if (inc.guessed) {
      const guessed = latestList.filter((r) => r.is_correct && r.confidence === "guessed");
      lines.push(`CORRECT BUT GUESSED (${guessed.length})`);
      if (guessed.length === 0) lines.push(`- none`);
      guessed.forEach((r) => {
        lines.push(``);
        lines.push(...detail(r.question!, `${r.time_spent_seconds}s`));
      });
      lines.push(``);
    }

    if (inc.fast) {
      const fast = latestList
        .filter((r) => r.time_spent_seconds < fastSec)
        .sort((a, b) => a.time_spent_seconds - b.time_spent_seconds);
      lines.push(`ANSWERED FAST — under ${fastSec}s (${fast.length})`);
      if (fast.length === 0) lines.push(`- none`);
      fast.forEach((r) => {
        lines.push(``);
        lines.push(...detail(r.question!, `${r.time_spent_seconds}s · ${r.is_correct ? "correct" : "wrong"}`));
      });
      lines.push(``);
    }

    if (inc.slow) {
      const slow = latestList
        .filter((r) => r.time_spent_seconds > slowSec)
        .sort((a, b) => b.time_spent_seconds - a.time_spent_seconds);
      lines.push(`ANSWERED SLOW — over ${slowSec}s (${slow.length})`);
      if (slow.length === 0) lines.push(`- none`);
      slow.forEach((r) => {
        lines.push(``);
        lines.push(...detail(r.question!, `${r.time_spent_seconds}s · ${r.is_correct ? "correct" : "wrong"}`));
      });
      lines.push(``);
    }

    if (inc.noted) {
      const noted = Array.from(noteByUid.entries())
        .map(([uid2, note]) => ({ q: metaByUid.get(uid2), note }))
        .filter((x): x is { q: QuestionMeta; note: string } => !!x.q)
        .sort((a, b) => a.q.skill.localeCompare(b.q.skill));
      lines.push(`NOTED QUESTIONS (${noted.length})`);
      if (noted.length === 0) lines.push(`- no notes saved`);
      noted.forEach(({ q, note }) => {
        lines.push(``);
        lines.push(...detail(q, ""));
        lines.push(`Note: "${note}"`);
      });
      lines.push(``);
    }

    if (inc.flagged) {
      const flagged = flaggedUids
        .map((u) => metaByUid.get(u))
        .filter((q): q is QuestionMeta => !!q)
        .sort((a, b) => a.skill.localeCompare(b.skill));
      lines.push(`FLAGGED (${flagged.length})`);
      if (flagged.length === 0) lines.push(`- none flagged to revisit`);
      flagged.forEach((q) => {
        if (fullDetail) {
          lines.push(``);
          lines.push(...detail(q, ""));
        } else {
          lines.push(`- [${q.question_id}] ${q.skill} (${q.difficulty})`);
        }
      });
      lines.push(``);
    }

    setReport(lines.join("\n").trimEnd());
    setBusy(false);
  }


  // ---- Vocabulary report ----
  interface VocabRow {
    term: string;
    definition: string;
    times: number;
    sentence: string; // the full sentence the word was used in (from the question)
    sourceQuestionId: string;
    added: string;
  }
  const [vocabReport, setVocabReport] = useState("");
  const [vocabRows, setVocabRows] = useState<VocabRow[]>([]);
  const [vocabBusy, setVocabBusy] = useState(false);

  async function generateVocab() {
    setVocabBusy(true);
    setVocabReport("");
    const items = await listVocab();
    if (items.length === 0) {
      setVocabRows([]);
      setVocabReport("No vocabulary saved yet. Highlight a word while reviewing an answer to save it.");
      setVocabBusy(false);
      return;
    }

    // Resolve the sentence each term appeared in, from its source question.
    const srcIds = Array.from(new Set(items.map((v) => v.source_question_uid).filter(Boolean))) as string[];
    const qText = new Map<string, string>();
    const qCode = new Map<string, string>();
    if (srcIds.length) {
      const { data } = await supabase
        .from("questions")
        .select("id, question_id, question_text")
        .in("id", srcIds)
        .limit(20000);
      for (const q of (data as { id: string; question_id: string; question_text: string }[]) || []) {
        qText.set(q.id, q.question_text || "");
        qCode.set(q.id, q.question_id);
      }
    }

    const rows: VocabRow[] = items.map((v) => {
      const src = v.source_question_uid || "";
      // Prefer the actual sentence from the source question; fall back to the
      // stored example (e.g. a dictionary example) when there's no source.
      const sentence = sentenceFor(qText.get(src), v.term) || v.example || "";
      return {
        term: v.term,
        definition: v.definition || "",
        times: v.count || 1,
        sentence,
        sourceQuestionId: qCode.get(src) || "",
        added: (v.created_at || "").slice(0, 10),
      };
    });
    setVocabRows(rows);

    const lines: string[] = [];
    lines.push(`VOCABULARY REPORT`);
    lines.push(`Saved words: ${rows.length}`);
    lines.push(``);
    rows.forEach((r) => {
      lines.push(`${r.term}${r.times > 1 ? ` (saved ${r.times}×)` : ""}`);
      if (r.definition) lines.push(`  Definition: ${r.definition}`);
      if (r.sentence) lines.push(`  Used in: "${r.sentence}"`);
      if (r.sourceQuestionId) lines.push(`  Source question: ${r.sourceQuestionId}`);
      lines.push(``);
    });
    setVocabReport(lines.join("\n").trimEnd());
    setVocabBusy(false);
  }


  function downloadVocabCsv() {
    if (vocabRows.length === 0) return;
    const cell = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const header = ["Term", "Definition", "Times saved", "Sentence in question", "Source question", "Added"];
    const csv = [
      header.map(cell).join(","),
      ...vocabRows.map((r) =>
        [r.term, r.definition, r.times, r.sentence, r.sourceQuestionId, r.added].map(cell).join(",")
      ),
    ].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sat-vocabulary-${iso(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadBackup() {
    setBackupBusy(true);
    const uid = currentUserId();
    const [q, a, s, ps] = await Promise.all([
      supabase.from("questions").select("*").limit(20000),
      supabase.from("attempts").select("*").eq("user_id", uid).limit(50000),
      supabase.from("question_state").select("*").eq("user_id", uid).limit(20000),
      supabase.from("practice_sessions").select("*").eq("user_id", uid).limit(20000),
    ]);
    const backup = {
      exported_at: new Date().toISOString(),
      questions: q.data || [],
      attempts: a.data || [],
      question_state: s.data || [],
      practice_sessions: ps.data || [],
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sat-bank-backup-${iso(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupBusy(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports &amp; backup</h1>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Progress report</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Produce a summary you can copy out — for a date range or a single practice session. Choose which
          sections to include, filter by difficulty, and pull out questions by note or by how long they took.
        </p>
        <div className="mb-3 inline-flex rounded-md border border-slate-200 dark:border-slate-800 p-0.5 text-sm">
          {(["range", "session"] as const).map((sc) => (
            <button
              key={sc}
              onClick={() => setScope(sc)}
              className={`rounded px-3 py-1 font-medium ${
                scope === sc ? "bg-brand-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {sc === "range" ? "Date range" : "By session"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {scope === "range" ? (
            <>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">From</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">To</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2" />
              </label>
            </>
          ) : (
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">Session</span>
              {sessions.length === 0 ? (
                <span className="block rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2 text-slate-400 dark:text-slate-500">No sessions yet</span>
              ) : (
                <select
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="min-w-[16rem] rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {sessionLabel(s)}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}
        </div>

        {/* Report options */}
        <div className="mt-4 space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 p-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Difficulties</p>
            <div className="flex gap-2">
              {["Easy", "Medium", "Hard"].map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDiff(d)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${
                    diffFilter.has(d) ? "border-brand-500 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Include sections</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {(
                [
                  ["overall", "Overall summary"],
                  ["difficulty", "By difficulty"],
                  ["skill", "By skill"],
                  ["missed", "Missed questions"],
                  ["guessed", "Correct but guessed"],
                  ["flagged", "Flagged"],
                  ["noted", "Noted (with notes)"],
                  ["fast", `Answered fast (< ${fastSec}s)`],
                  ["slow", `Answered slow (> ${slowSec}s)`],
                ] as [keyof typeof inc, string][]
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={inc[k]}
                    onChange={() => toggleInc(k)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-brand-600 dark:text-brand-300"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {(inc.fast || inc.slow) && (
            <div className="flex flex-wrap gap-4">
              {inc.fast && (
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  Fast: under{" "}
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={fastSec}
                    onChange={(e) => setFastSec(Math.max(1, parseInt(e.target.value) || 1))}
                    className="mx-1 w-20 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1"
                  />
                  seconds
                </label>
              )}
              {inc.slow && (
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  Slow: over{" "}
                  <input
                    type="number"
                    min={1}
                    max={3600}
                    value={slowSec}
                    onChange={(e) => setSlowSec(Math.max(1, parseInt(e.target.value) || 1))}
                    className="mx-1 w-20 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1"
                  />
                  seconds
                </label>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={fullDetail}
              onChange={(e) => setFullDetail(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-brand-600 dark:text-brand-300"
            />
            Include full question text, choices &amp; rationale in the lists
          </label>
        </div>

        <div className="mt-4">
          <button onClick={generate} disabled={busy || (scope === "session" && !sessionId)} className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50">
            {busy ? "Generating…" : "Generate report"}
          </button>
        </div>

        {report && (
          <div className="mt-4">
            <div className="mb-2 flex justify-end">
              <CopyButton
                text={report}
                label="Copy report"
                className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              />
            </div>
            <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-4 text-xs text-slate-700 dark:text-slate-200">{report}</pre>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Vocabulary export</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          A report of every word you&apos;ve saved — with its definition and the full sentence it was used in
          within the question. Copy it out or download as CSV.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generateVocab}
            disabled={vocabBusy}
            className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50"
          >
            {vocabBusy ? "Generating…" : "Generate vocabulary report"}
          </button>
          {vocabRows.length > 0 && (
            <button
              onClick={downloadVocabCsv}
              className="rounded-md border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Download CSV
            </button>
          )}
        </div>
        {vocabReport && (
          <div className="mt-4">
            <div className="mb-2 flex justify-end">
              <CopyButton
                text={vocabReport}
                label="Copy report"
                className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              />
            </div>
            <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-4 text-xs text-slate-700 dark:text-slate-200">{vocabReport}</pre>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Personal backup</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Your data is always saved online automatically. This downloads a personal copy (all questions, attempts,
          notes, and flags) as a JSON file for extra safety.
        </p>
        <button onClick={downloadBackup} disabled={backupBusy} className="rounded-md border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
          {backupBusy ? "Preparing…" : "Download backup (.json)"}
        </button>
      </section>
    </div>
  );
}
