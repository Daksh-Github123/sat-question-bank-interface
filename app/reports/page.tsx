"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { WEAKNESS_THRESHOLD } from "@/lib/practice";
import { currentUserId } from "@/lib/user";

interface AttemptRow {
  question_uid: string;
  is_correct: boolean;
  selected_answer: string | null;
  time_spent_seconds: number;
  confidence: string | null;
  miss_reason: string | null;
  created_at: string;
  question: { question_id: string; skill: string; difficulty: string; correct_answer: string } | null;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
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

  async function generate() {
    setBusy(true);
    setReport("");
    setCopied(false);
    const startTs = new Date(start + "T00:00:00").toISOString();
    const endTs = new Date(end + "T23:59:59").toISOString();
    const { data } = await supabase
      .from("attempts")
      .select("question_uid, is_correct, selected_answer, time_spent_seconds, confidence, miss_reason, created_at, question:questions(question_id, skill, difficulty, correct_answer)")
      .eq("user_id", currentUserId())
      .gte("created_at", startTs)
      .lte("created_at", endTs)
      .order("created_at", { ascending: true })
      .limit(20000);
    const rows = ((data as unknown as AttemptRow[]) || []).filter((r) => r.question);

    if (rows.length === 0) {
      setReport(`No practice recorded between ${start} and ${end}.`);
      setBusy(false);
      return;
    }

    // Per-skill aggregation.
    const bySkill = new Map<string, { total: number; correct: number; seconds: number; last: string }>();
    for (const r of rows) {
      const s = r.question!.skill;
      const g = bySkill.get(s) || { total: 0, correct: 0, seconds: 0, last: r.created_at };
      g.total++;
      if (r.is_correct) g.correct++;
      g.seconds += r.time_spent_seconds;
      if (r.created_at > g.last) g.last = r.created_at;
      bySkill.set(s, g);
    }

    // Missed questions (latest attempt in range that was wrong).
    const latest = new Map<string, AttemptRow>();
    for (const r of rows) latest.set(r.question_uid, r); // rows are ascending, so last wins
    const missed = Array.from(latest.values()).filter((r) => !r.is_correct);

    const total = rows.length;
    const correct = rows.filter((r) => r.is_correct).length;
    const seconds = rows.reduce((a, r) => a + r.time_spent_seconds, 0);
    const acc = Math.round((correct / total) * 100);

    const lines: string[] = [];
    lines.push(`SAT PRACTICE REPORT`);
    lines.push(`Period: ${start} to ${end}`);
    lines.push(``);
    lines.push(`OVERALL`);
    lines.push(`- Questions attempted: ${total}`);
    lines.push(`- Correct: ${correct} (${acc}% accuracy)`);
    lines.push(`- Time spent: ${Math.round(seconds / 60)} min (${total ? Math.round(seconds / total) : 0}s avg/question)`);
    lines.push(``);
    lines.push(`BY SKILL`);
    Array.from(bySkill.entries())
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
      .forEach(([skill, g]) => {
        const a = Math.round((g.correct / g.total) * 100);
        const statusTag = g.correct / g.total < WEAKNESS_THRESHOLD ? "NEEDS WORK" : "OK";
        lines.push(`- ${skill}: ${g.correct}/${g.total} (${a}%) [${statusTag}] · last practiced ${g.last.slice(0, 10)}`);
      });
    lines.push(``);
    lines.push(`MISSED QUESTIONS (${missed.length})`);
    if (missed.length === 0) {
      lines.push(`- none outstanding in this period`);
    } else {
      missed.forEach((r) => {
        const q = r.question!;
        const reason = r.miss_reason ? ` · reason: ${r.miss_reason}` : "";
        lines.push(`- [${q.question_id}] ${q.skill} (${q.difficulty}): you="${r.selected_answer ?? "—"}" correct="${q.correct_answer}"${reason}`);
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
          Pick a date range to produce a clean summary you can copy out and hand off for logging or analysis.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">From</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">To</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <button onClick={generate} disabled={busy} className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
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
