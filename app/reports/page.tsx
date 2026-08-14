"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { currentUserId } from "@/lib/user";
import { listVocab, sentenceFor } from "@/lib/vocab";

interface SessionOpt {
  id: string;
  created_at: string;
  mode: string;
  current_index: number;
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
  return `${when} · ${MODE_LABEL[s.mode] || s.mode} · ${s.current_index} Q`;
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
  const [copied, setCopied] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [scope, setScope] = useState<"range" | "session">("range");
  const [sessions, setSessions] = useState<SessionOpt[]>([]);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("practice_sessions")
        .select("id, created_at, mode, current_index")
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
    setCopied(false);
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
    const rows = ((data as unknown as AttemptRow[]) || []).filter((r) => r.question);

    if (rows.length === 0) {
      setReport(emptyMsg);
      setBusy(false);
      return;
    }

    // Per-difficulty aggregation.
    const byDiff = new Map<string, { total: number; correct: number }>();
    // Per-skill aggregation.
    const bySkill = new Map<string, { total: number; correct: number; last: string }>();
    for (const r of rows) {
      const d = r.question!.difficulty;
      const dg = byDiff.get(d) || { total: 0, correct: 0 };
      dg.total++;
      if (r.is_correct) dg.correct++;
      byDiff.set(d, dg);

      const s = r.question!.skill;
      const g = bySkill.get(s) || { total: 0, correct: 0, last: r.created_at };
      g.total++;
      if (r.is_correct) g.correct++;
      if (r.created_at > g.last) g.last = r.created_at;
      bySkill.set(s, g);
    }

    // Missed questions (latest attempt in range that was wrong).
    const latest = new Map<string, AttemptRow>();
    for (const r of rows) latest.set(r.question_uid, r); // rows ascending, so last wins
    const missed = Array.from(latest.values()).filter((r) => !r.is_correct);

    // Correct-but-guessed (latest attempt in range, correct AND tagged as a guess).
    const guessedCorrect = Array.from(latest.values()).filter(
      (r) => r.is_correct && r.confidence === "guessed"
    );
    const anyConfidenceTag = rows.some((r) => r.confidence);

    // Flagged questions the user has marked to revisit (all outstanding flags).
    const { data: flagData } = await supabase
      .from("question_state")
      .select("question_uid")
      .eq("user_id", uid)
      .eq("flagged", true)
      .limit(20000);
    const flaggedIds = ((flagData as { question_uid: string }[]) || []).map((f) => f.question_uid);
    let flaggedMeta: QuestionMeta[] = [];
    if (flaggedIds.length) {
      const { data: fq } = await supabase
        .from("questions")
        .select("question_id, skill, difficulty, correct_answer, question_text, choices, rationale")
        .in("id", flaggedIds)
        .limit(20000);
      flaggedMeta = ((fq as unknown as QuestionMeta[]) || []).sort((a, b) =>
        a.skill.localeCompare(b.skill)
      );
    }

    const total = rows.length;
    const correct = rows.filter((r) => r.is_correct).length;
    const seconds = rows.reduce((a, r) => a + r.time_spent_seconds, 0);
    const acc = Math.round((correct / total) * 100);
    const pct = (c: number, t: number) => (t ? Math.round((c / t) * 100) : 0);

    const lines: string[] = [];
    lines.push(`SAT PRACTICE REPORT`);
    lines.push(headerLine);
    lines.push(``);
    lines.push(`OVERALL`);
    lines.push(`- Questions attempted: ${total}`);
    lines.push(`- Correct: ${correct} (${acc}% accuracy)`);
    lines.push(`- Time spent: ${Math.round(seconds / 60)} min (${total ? Math.round(seconds / total) : 0}s avg/question)`);
    lines.push(``);
    lines.push(`BY DIFFICULTY`);
    ["Easy", "Medium", "Hard"].forEach((d) => {
      const g = byDiff.get(d) || { total: 0, correct: 0 };
      lines.push(`- ${d}: ${g.correct}/${g.total} (${pct(g.correct, g.total)}%)`);
    });
    lines.push(``);
    lines.push(`BY SKILL`);
    Array.from(bySkill.entries())
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
      .forEach(([skill, g]) => {
        const a = pct(g.correct, g.total);
        lines.push(`- ${skill}: ${g.correct}/${g.total} (${a}%) [${skillStatus(a)}] · last practiced ${g.last.slice(0, 10)}`);
      });
    lines.push(``);
    lines.push(`FLAGGED (${flaggedMeta.length})`);
    if (flaggedMeta.length === 0) {
      lines.push(`- none flagged to revisit`);
    } else {
      flaggedMeta.forEach((q) => {
        lines.push(`- [${q.question_id}] ${q.skill} (${q.difficulty})`);
      });
    }
    if (anyConfidenceTag) {
      lines.push(``);
      lines.push(`CORRECT BUT GUESSED (${guessedCorrect.length})`);
      if (guessedCorrect.length === 0) {
        lines.push(`- none`);
      } else {
        lines.push(`- ${guessedCorrect.map((r) => r.question!.question_id).join(", ")}`);
      }
    }
    lines.push(``);
    lines.push(`MISSED QUESTIONS (${missed.length})`);
    if (missed.length === 0) {
      lines.push(`- none outstanding in this period`);
    } else {
      missed.forEach((r) => {
        const q = r.question!;
        const reason = r.miss_reason ? MISS_REASON_TEXT[r.miss_reason] || r.miss_reason : "untagged";
        lines.push(``);
        lines.push(`[${q.question_id}] ${q.skill} (${q.difficulty}) · you=${r.selected_answer ?? "—"} correct=${q.correct_answer} · reason=${reason}`);
        lines.push(`Question: ${(q.question_text || "").trim()}`);
        (q.choices || []).forEach((c) => {
          lines.push(`${c.letter}. ${c.text}`);
        });
        lines.push(`Rationale: ${(q.rationale || "—").trim()}`);
      });
    }

    setReport(lines.join("\n"));
    setBusy(false);
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
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
  const [vocabCopied, setVocabCopied] = useState(false);

  async function generateVocab() {
    setVocabBusy(true);
    setVocabReport("");
    setVocabCopied(false);
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

  async function copyVocab() {
    try {
      await navigator.clipboard.writeText(vocabReport);
      setVocabCopied(true);
      setTimeout(() => setVocabCopied(false), 1500);
    } catch {}
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

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Progress report</h2>
        <p className="mb-3 text-sm text-slate-500">
          Produce a clean summary you can copy out — for a date range or a single practice session.
        </p>
        <div className="mb-3 inline-flex rounded-md border border-slate-200 p-0.5 text-sm">
          {(["range", "session"] as const).map((sc) => (
            <button
              key={sc}
              onClick={() => setScope(sc)}
              className={`rounded px-3 py-1 font-medium ${
                scope === sc ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
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
                <span className="mb-1 block font-medium text-slate-600">From</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">To</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
              </label>
            </>
          ) : (
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Session</span>
              {sessions.length === 0 ? (
                <span className="block rounded-md border border-slate-200 px-3 py-2 text-slate-400">No sessions yet</span>
              ) : (
                <select
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="min-w-[16rem] rounded-md border border-slate-300 px-3 py-2"
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
          <button onClick={generate} disabled={busy || (scope === "session" && !sessionId)} className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? "Generating…" : "Generate report"}
          </button>
        </div>

        {report && (
          <div className="mt-4">
            <div className="mb-2 flex justify-end">
              <button onClick={copyReport} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {copied ? "Copied!" : "Copy report"}
              </button>
            </div>
            <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">{report}</pre>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Vocabulary export</h2>
        <p className="mb-3 text-sm text-slate-500">
          A report of every word you&apos;ve saved — with its definition and the full sentence it was used in
          within the question. Copy it out or download as CSV.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generateVocab}
            disabled={vocabBusy}
            className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {vocabBusy ? "Generating…" : "Generate vocabulary report"}
          </button>
          {vocabRows.length > 0 && (
            <button
              onClick={downloadVocabCsv}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Download CSV
            </button>
          )}
        </div>
        {vocabReport && (
          <div className="mt-4">
            <div className="mb-2 flex justify-end">
              <button onClick={copyVocab} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {vocabCopied ? "Copied!" : "Copy report"}
              </button>
            </div>
            <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">{vocabReport}</pre>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">Personal backup</h2>
        <p className="mb-3 text-sm text-slate-500">
          Your data is always saved online automatically. This downloads a personal copy (all questions, attempts,
          notes, and flags) as a JSON file for extra safety.
        </p>
        <button onClick={downloadBackup} disabled={backupBusy} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {backupBusy ? "Preparing…" : "Download backup (.json)"}
        </button>
      </section>
    </div>
  );
}
