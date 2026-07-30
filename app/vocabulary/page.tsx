"use client";

import { useEffect, useMemo, useState } from "react";
import type { VocabularyItem } from "@/lib/types";
import { listVocab, updateVocab, deleteVocab } from "@/lib/vocab";

type Sort = "recent" | "count" | "az";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export default function VocabularyPage() {
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("recent");
  const [editing, setEditing] = useState<string | null>(null);
  const [defDraft, setDefDraft] = useState("");
  const [exDraft, setExDraft] = useState("");

  async function refresh() {
    setLoading(true);
    setItems(await listVocab());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(() => {
    const list = [...items];
    if (sort === "count") list.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
    else if (sort === "az") list.sort((a, b) => a.term.localeCompare(b.term));
    else list.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return list;
  }, [items, sort]);

  function startEdit(it: VocabularyItem) {
    setEditing(it.id);
    setDefDraft(it.definition ?? "");
    setExDraft(it.example ?? "");
  }

  async function saveEdit(id: string) {
    await updateVocab(id, { definition: defDraft.trim() || null, example: exDraft.trim() || null });
    setEditing(null);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, definition: defDraft.trim() || null, example: exDraft.trim() || null } : it))
    );
  }

  async function remove(id: string) {
    await deleteVocab(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function download(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const header = ["term", "count", "definition", "example", "added"].join(",");
    const rows = sorted.map((it) =>
      [it.term, String(it.count), it.definition ?? "", it.example ?? "", it.created_at.slice(0, 10)]
        .map(csvEscape)
        .join(",")
    );
    download(`vocabulary-${iso(new Date())}.csv`, [header, ...rows].join("\n"), "text/csv");
  }

  function exportJson() {
    download(`vocabulary-${iso(new Date())}.json`, JSON.stringify(sorted, null, 2), "application/json");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Vocabulary</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-500">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="recent">Most recent</option>
              <option value="count">Most saved</option>
              <option value="az">A–Z</option>
            </select>
          </label>
          <button
            onClick={exportCsv}
            disabled={!items.length}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={exportJson}
            disabled={!items.length}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Export JSON
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Words and phrases you highlighted while practicing. Meanings are looked up automatically where
        possible — edit any entry to fill in or refine it.
      </p>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No saved words yet. While reviewing an answered question, highlight a word or phrase to add it here.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((it) => (
            <div key={it.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-slate-800">{it.term}</span>
                  {it.count > 1 && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      ×{it.count}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {editing !== it.id && (
                    <button onClick={() => startEdit(it)} className="text-brand-600 hover:underline">
                      Edit
                    </button>
                  )}
                  <button onClick={() => remove(it.id)} className="text-slate-400 hover:text-rose-600">
                    Delete
                  </button>
                </div>
              </div>

              {editing === it.id ? (
                <div className="mt-3 space-y-2">
                  <input
                    value={defDraft}
                    onChange={(e) => setDefDraft(e.target.value)}
                    placeholder="Meaning"
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <input
                    value={exDraft}
                    onChange={(e) => setExDraft(e.target.value)}
                    placeholder="Example / usage"
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(it.id)}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-slate-700">
                    {it.definition || <span className="italic text-slate-400">No meaning yet — click Edit to add one.</span>}
                  </p>
                  {it.example && <p className="text-sm italic text-slate-500">“{it.example}”</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
