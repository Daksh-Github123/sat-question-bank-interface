"use client";

import { useState } from "react";

/**
 * Wraps a block of text. When enabled and the user highlights a word/phrase
 * inside it, a small floating "add to vocab" chip appears next to the selection.
 * Clicking it calls onSave with the highlighted text.
 */
export default function VocabCapture({
  enabled,
  onSave,
  children,
}: {
  enabled: boolean;
  onSave: (term: string) => Promise<void>;
  children: React.ReactNode;
}) {
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  function handleMouseUp() {
    if (!enabled) return;
    const s = window.getSelection();
    const text = s?.toString().trim() ?? "";
    // Ignore empty selections and anything implausibly long for a vocab entry.
    if (!text || text.length > 80 || !s || s.rangeCount === 0) {
      setSel(null);
      return;
    }
    const rect = s.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setSel(null);
      return;
    }
    setSel({ text, x: rect.left + rect.width / 2, y: rect.top });
    setStatus("idle");
  }

  async function save() {
    if (!sel) return;
    setStatus("saving");
    try {
      await onSave(sel.text);
      setStatus("saved");
    } catch {
      setStatus("idle");
      return;
    }
    setTimeout(() => {
      setSel(null);
      setStatus("idle");
      window.getSelection()?.removeAllRanges();
    }, 1100);
  }

  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
      ? "Saved ✓"
      : `＋ Add “${sel && sel.text.length > 28 ? sel.text.slice(0, 28) + "…" : sel?.text}” to vocab`;

  return (
    <div onMouseUp={handleMouseUp}>
      {children}
      {enabled && sel && (
        <button
          // Prevent the mousedown from clearing the text selection before onClick.
          onMouseDown={(e) => e.preventDefault()}
          onClick={save}
          style={{ position: "fixed", left: sel.x, top: Math.max(8, sel.y - 40), transform: "translateX(-50%)" }}
          className="z-50 whitespace-nowrap rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-brand-700 dark:hover:bg-brand-600"
        >
          {label}
        </button>
      )}
    </div>
  );
}
