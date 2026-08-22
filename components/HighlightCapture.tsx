"use client";

import { useState } from "react";

/**
 * Wraps a block of text (the question passage) while the user is still answering.
 * When enabled and the user selects a word/phrase, a small floating "Highlight"
 * button appears next to the selection; clicking it calls onHighlight with the
 * selected text. Mirrors VocabCapture, but for the transient in-question highlight
 * aid (which disappears once the question is answered, handing selection back to
 * the vocabulary capture).
 */
export default function HighlightCapture({
  enabled,
  onHighlight,
  children,
}: {
  enabled: boolean;
  onHighlight: (text: string) => void;
  children: React.ReactNode;
}) {
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);

  function handleMouseUp() {
    if (!enabled) return;
    const s = window.getSelection();
    const text = s?.toString().trim() ?? "";
    // No length cap — a highlight can span a full sentence.
    if (!text || !s || s.rangeCount === 0) {
      setSel(null);
      return;
    }
    const rect = s.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setSel(null);
      return;
    }
    setSel({ text, x: rect.left + rect.width / 2, y: rect.top });
  }

  function apply() {
    if (!sel) return;
    onHighlight(sel.text);
    setSel(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div onMouseUp={handleMouseUp}>
      {children}
      {enabled && sel && (
        <button
          // Prevent the mousedown from clearing the text selection before onClick.
          onMouseDown={(e) => e.preventDefault()}
          onClick={apply}
          style={{ position: "fixed", left: sel.x, top: Math.max(8, sel.y - 40), transform: "translateX(-50%)" }}
          className="z-50 flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-lg hover:bg-amber-300"
        >
          🖊 Highlight
        </button>
      )}
    </div>
  );
}
