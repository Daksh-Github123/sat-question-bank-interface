"use client";

import { underlineRanges } from "@/lib/underline";

// Renders a question's text. Cross-Text Connections questions bundle two
// passages ("Text 1 …", "Text 2 …") plus a prompt into one string; this splits
// them into labeled blocks for readability. Everything else renders as-is.
//
// Underlining: when `underlineSpans` (exact text captured from the source PDF) is
// provided, those spans are underlined precisely. Otherwise we fall back to a
// heuristic for claim/conclusion-style prompts (see below).
//
// Highlighting: `highlightSpans` are transient user highlights applied while
// answering. Both marks are rendered together — a character can be underlined
// and/or highlighted.

const U_CLASS = "underline decoration-2 underline-offset-2";
const H_CLASS = "rounded-sm bg-yellow-200 dark:bg-yellow-400/30";

// Render `text` with underline ranges and highlight ranges applied together.
// Splits at every range boundary so each segment is uniformly (un)marked.
function renderMarked(
  text: string,
  uRanges: [number, number][],
  hRanges: [number, number][]
): React.ReactNode {
  if (!uRanges.length && !hRanges.length) return text;
  const pts = new Set<number>([0, text.length]);
  for (const [s, e] of uRanges) { pts.add(s); pts.add(e); }
  for (const [s, e] of hRanges) { pts.add(s); pts.add(e); }
  const bounds = Array.from(pts).sort((a, b) => a - b);
  const inRange = (ranges: [number, number][], pos: number) =>
    ranges.some(([s, e]) => pos >= s && pos < e);
  const parts: React.ReactNode[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    if (a >= b) continue;
    const seg = text.slice(a, b);
    const cls = `${inRange(uRanges, a) ? U_CLASS : ""} ${inRange(hRanges, a) ? H_CLASS : ""}`.trim();
    parts.push(cls ? <span key={i} className={cls}>{seg}</span> : seg);
  }
  return <>{parts}</>;
}

const PROMPT_LEAD =
  /(Based on (?:the|both) texts|How would the author|The author of Text|Which choice|Which statement|What would the author)/;

// Questions that reference "the underlined claim/conclusion/…". The source PDF's
// underline styling is lost during text extraction, so we re-mark the referenced
// sentence (see below). Excludes "underlined word/phrase" (a different pattern we
// can't recover a single span for).
const UNDERLINE_REF =
  /\bunderlined\s+(claim|conclusion|sentence|statement|assertion|prediction|hypothesis|portion|text|finding|idea|generalization|argument|point|question)\b/i;

// "Function of the underlined …" (Craft & Structure) questions underline an
// arbitrary span that could be anywhere in the passage — often not the last
// sentence, sometimes a short phrase, sometimes several portions. We can't
// recover that span from the flattened text, so we DON'T guess for these (a
// wrong underline is worse than none). Only claim/conclusion-style prompts,
// where the underlined part is the assertion right before the prompt, are safe.
const UNDERLINE_FUNCTION =
  /function of the underlined|\bunderlined\s+(phrase|lines|portions)\b/i;

// Split prose into sentences while keeping author initials ("Doug J."), dotted
// acronyms ("U.S."), and common abbreviations intact.
function splitSentences(s: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /[.!?]["”]?(?=\s+["“(]?[A-Z]|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const end = m.index + m[0].length;
    const before = s.slice(0, m.index);
    const tail = before.match(/([A-Za-z]{1,4})$/)?.[1] || "";
    const isInitial = /(^|\s)[A-Z]$/.test(before.slice(-2));
    const isAcronym = /[A-Za-z]\.[A-Za-z]$/.test(before.slice(-3));
    const isAbbrev = /^(Dr|Mr|Mrs|Ms|St|vs|etc|Inc|Ltd|Jr|Sr|No|Fig|eq)$/i.test(tail);
    if (isInitial || isAcronym || isAbbrev) continue;
    out.push(s.slice(start, end).trim());
    start = end;
  }
  if (start < s.length) {
    const rest = s.slice(start).trim();
    if (rest) out.push(rest);
  }
  return out;
}

// Render a passage, optionally underlining its assertion (the last sentence — the
// claim a cross-text prompt refers to as "the underlined portion of Text N").
function passageBody(passage: string, underline: boolean): React.ReactNode {
  if (!underline) return passage;
  const u = "underline decoration-2 underline-offset-2";
  const sents = splitSentences(passage);
  if (sents.length < 2) return <span className={u}>{passage}</span>;
  const claim = sents[sents.length - 1];
  const head = sents.slice(0, -1).join(" ");
  return (
    <>
      {head} <span className={u}>{claim}</span>
    </>
  );
}

export default function QuestionText({
  text,
  className = "",
  underlineSpans = null,
  highlightSpans = null,
}: {
  text: string;
  className?: string;
  underlineSpans?: string[] | null;
  highlightSpans?: string[] | null;
}) {
  const p = `whitespace-pre-wrap ${className}`;
  const hasSpans = !!(underlineSpans && underlineSpans.length);
  const hasHl = !!(highlightSpans && highlightSpans.length);
  // Underline + highlight ranges for a block of text.
  const uR = (t: string) => (hasSpans ? underlineRanges(t, underlineSpans) : []);
  const hR = (t: string) => (hasHl ? underlineRanges(t, highlightSpans) : []);
  const i1 = text.indexOf("Text 1");
  const i2 = i1 >= 0 ? text.indexOf("Text 2", i1 + 6) : -1;

  if (i1 >= 0 && i2 > i1) {
    const t1 = text.slice(i1 + 6, i2).trim();
    const after = text.slice(i2 + 6).trim();
    let t2 = after;
    let prompt = "";
    const m = after.match(PROMPT_LEAD);
    if (m && m.index != null && m.index > 40) {
      t2 = after.slice(0, m.index).trim();
      prompt = after.slice(m.index).trim();
    }
    const intro = text.slice(0, i1).trim();
    // Cross-text prompts may reference "the underlined portion of Text 1/2".
    // Re-mark that passage's assertion (its last sentence).
    let ulTarget = 0;
    if (prompt && UNDERLINE_REF.test(prompt) && !UNDERLINE_FUNCTION.test(prompt)) {
      const um = prompt.match(/underlined[\s\S]{0,40}?\bText\s*([12])\b/i);
      ulTarget = um ? parseInt(um[1], 10) : 1;
    }
    // Prefer exact PDF-captured spans; otherwise fall back to the assertion
    // heuristic. User highlights are layered in via renderMarked either way.
    const renderPassage = (passage: string, heuristicOn: boolean): React.ReactNode => {
      const u = uR(passage);
      const h = hR(passage);
      if (u.length || h.length) return renderMarked(passage, u, h);
      return passageBody(passage, heuristicOn);
    };
    return (
      <div className="space-y-3">
        {intro && <p className={p}>{intro}</p>}
        {/* Text 1 — teal (brand) accent */}
        <div className="rounded-lg border border-brand-100 dark:border-brand-900 border-l-4 border-l-brand-500 bg-brand-50/50 dark:bg-brand-950/50 p-4">
          <span className="mb-2 inline-block rounded bg-brand-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            Text 1
          </span>
          <p className={p}>{renderPassage(t1, ulTarget === 1)}</p>
        </div>
        {/* Explicit divide between the two passages */}
        <div className="flex items-center gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          <span className="h-px flex-1 bg-slate-200" />
          compared with
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        {/* Text 2 — amber accent (distinct from Text 1's teal brand) */}
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/50 p-4">
          <span className="mb-2 inline-block rounded bg-amber-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            Text 2
          </span>
          <p className={p}>{renderPassage(t2, ulTarget === 2)}</p>
        </div>
        {prompt && (
          <p className={`${p} border-t border-slate-200 dark:border-slate-800 pt-3 font-medium text-slate-800 dark:text-slate-100`}>
            {renderMarked(prompt, uR(prompt), hR(prompt))}
          </p>
        )}
      </div>
    );
  }

  // Exact underline spans and/or user highlights take precedence.
  {
    const u = uR(text);
    const h = hR(text);
    if (u.length || h.length) return <p className={p}>{renderMarked(text, u, h)}</p>;
  }

  // Single-passage questions referencing "the underlined claim/…": re-underline
  // the assertion/conclusion, which is the sentence immediately before the prompt.
  if (UNDERLINE_REF.test(text) && !UNDERLINE_FUNCTION.test(text)) {
    const sents = splitSentences(text);
    const last = sents[sents.length - 1] || "";
    if (sents.length >= 2 && /\?["”]?$/.test(last) && UNDERLINE_REF.test(last)) {
      const claim = sents[sents.length - 2];
      const head = sents.slice(0, sents.length - 2).join(" ");
      return (
        <p className={p}>
          {head && <>{head} </>}
          <span className="underline decoration-2 underline-offset-2">{claim}</span> {last}
        </p>
      );
    }
  }

  return <p className={p}>{text}</p>;
}
