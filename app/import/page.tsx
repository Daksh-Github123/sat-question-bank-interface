"use client";

import { useState } from "react";
import { parsePdf } from "@/lib/pdfParser";
import { supabase } from "@/lib/supabaseClient";
import type { ParsedQuestion } from "@/lib/types";
import { DIFFICULTY_COLORS } from "@/lib/taxonomy";
import { useUser } from "@/lib/userContext";

interface FileResult {
  name: string;
  parsed: ParsedQuestion[];
  error?: string;
}

export default function ImportPage() {
  const { user } = useUser();
  const [results, setResults] = useState<FileResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [saved, setSaved] = useState<number | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    setSaved(null);
    setStatus("Reading PDFs…");
    const out: FileResult[] = [];
    for (const file of Array.from(files)) {
      try {
        const buf = await file.arrayBuffer();
        const parsed = await parsePdf(buf, file.name);
        out.push({ name: file.name, parsed });
      } catch (e: any) {
        out.push({ name: file.name, parsed: [], error: e?.message || "Failed to parse" });
      }
    }
    setResults(out);
    setBusy(false);
    setStatus("");
  }

  const allParsed = results.flatMap((r) => r.parsed);
  const totalParsed = allParsed.length;

  async function save() {
    if (!totalParsed) return;
    setBusy(true);
    setStatus("Saving to Supabase…");
    // De-duplicate by question_id within this batch.
    const byId = new Map<string, ParsedQuestion>();
    for (const q of allParsed) byId.set(q.question_id, q);
    const rows = Array.from(byId.values());

    let inserted = 0;
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("questions")
        .upsert(chunk, { onConflict: "question_id" });
      if (error) {
        setStatus(`Error saving: ${error.message}`);
        setBusy(false);
        return;
      }
      inserted += chunk.length;
      setStatus(`Saved ${inserted}/${rows.length}…`);
    }
    setSaved(inserted);
    setStatus("");
    setBusy(false);
  }

  // Group parsed questions by skill for a quick summary.
  const bySkill = new Map<string, { total: number; diff: Record<string, number> }>();
  for (const q of allParsed) {
    const key = `${q.test} › ${q.domain} › ${q.skill}`;
    const entry = bySkill.get(key) || { total: 0, diff: {} };
    entry.total++;
    entry.diff[q.difficulty] = (entry.diff[q.difficulty] || 0) + 1;
    bySkill.set(key, entry);
  }

  if (!user?.is_admin) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-medium text-slate-800">Admins only</p>
        <p className="mt-1 text-sm text-slate-500">
          The question bank is shared by everyone, so only the admin can import new PDFs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import question PDFs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Drop one or more exported question-bank PDFs. They are parsed in your browser and
          saved to your bank. Re-importing the same questions updates them (no duplicates).
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center hover:border-brand-500">
        <input
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className="text-sm font-medium text-slate-700">
          {busy ? status || "Working…" : "Click to choose PDF files"}
        </span>
        <span className="mt-1 text-xs text-slate-400">You can select multiple topic PDFs at once</span>
      </label>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Parsed {totalParsed} question{totalParsed === 1 ? "" : "s"} from {results.length}{" "}
                  file{results.length === 1 ? "" : "s"}
                </p>
                {results.map((r) => (
                  <p key={r.name} className="text-xs text-slate-500">
                    {r.name}: {r.error ? `error — ${r.error}` : `${r.parsed.length} questions`}
                  </p>
                ))}
              </div>
              <button
                onClick={save}
                disabled={busy || !totalParsed}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : `Save ${totalParsed} to bank`}
              </button>
            </div>
            {saved !== null && (
              <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                ✓ Saved {saved} questions. They&apos;re now available in Practice and Browse.
              </p>
            )}
            {status && !busy && (
              <p className="mt-3 text-sm text-rose-600">{status}</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold text-slate-800">Breakdown by skill</p>
            <div className="space-y-1">
              {Array.from(bySkill.entries()).map(([key, v]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{key}</span>
                  <span className="flex items-center gap-1">
                    {["Easy", "Medium", "Hard"].map((d) =>
                      v.diff[d] ? (
                        <span
                          key={d}
                          className={`rounded border px-1.5 py-0.5 text-xs ${DIFFICULTY_COLORS[d]}`}
                        >
                          {d[0]} {v.diff[d]}
                        </span>
                      ) : null
                    )}
                    <span className="ml-2 font-semibold text-slate-800">{v.total}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {allParsed.some((q) => !q.test || !q.skill || !q.correct_answer) && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Some questions are missing a test, skill, or correct answer — the PDF format may
              differ slightly. They will still be saved; check the Browse page to review.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
