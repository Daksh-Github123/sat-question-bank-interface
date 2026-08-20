"use client";

import { useState } from "react";

// Reusable copy-to-clipboard button. Consolidates the three duplicated
// copy handlers (reports copyReport/copyVocab, review copyId) that each
// re-implemented navigator.clipboard + a "Copied!" flash on a 1.5s timer.
export default function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied!",
  className = "",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context) — leave the label unchanged.
    }
  }

  const base =
    "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

  return (
    <button onClick={copy} className={className || base} aria-live="polite">
      {copied ? copiedLabel : label}
    </button>
  );
}
