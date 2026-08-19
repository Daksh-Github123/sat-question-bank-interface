"use client";

import { underlineRanges } from "@/lib/underline";

// Renders a question's text. Cross-Text Connections questions bundle two
// passages ("Text 1 …", "Text 2 …") plus a prompt into one string; this splits
// them into labeled blocks for readability. Everything else renders as-is.
//
// Underlining: when `underlineSpans` (exact text captured from the source PDF) is
// provided, those spans are underlined precisely. Otherwise we fall back to a
// heuristic for claim/conclusion-style prompts (see below).

// Wrap the given character ranges of `text` in an underline.
function withRanges(text: string, ranges: [number, number][]): React.ReactNode {
  if (!ranges.length) return text;
  const u = "underline decoration-2 underline-offset-2";
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([s, e], i) => {
    if (s > cursor) parts.push(text.slice(cursor, s));
    parts.push(
      <span key={i} className={u}>
        {text.slice(s, e)}
      </span>
    );
    cursor = e;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
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
}: {
  text: string;
  className?: string;
  underlineSpans?: string[] | null;
}) {
  const p = `whitespace-pre-wrap ${className}`;
  const hasSpans = !!(underlineSpans && underlineSpans.length);
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
    // Prefer exact PDF-captured spans; otherwise fall back to the assertion heuristic.
    const renderPassage = (passage: string, heuristicOn: boolean): React.ReactNode => {
      if (hasSpans) {
        const r = underlineRanges(passage, underlineSpans);
        return r.length ? withRanges(passage, r) : passage;
      }
      return passageBody(passage, heuristicOn);
    };
    return (
      <div className="space-y-3">
        {intro && <p className={p}>{intro}</p>}
        {/* Text 1 — indigo accent */}
        <div className="rounded-lg border border-brand-100 border-l-4 border-l-brand-500 bg-brand-50/50 p-4">
          <span className="mb-2 inline-block rounded bg-brand-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            Text 1
          </span>
          <p className={p}>{renderPassage(t1, ulTarget === 1)}</p>
        </div>
        {/* Explicit divide between the two passages */}
        <div className="flex items-center gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          compared with
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        {/* Text 2 — teal accent */}
        <div className="rounded-lg border border-teal-200 border-l-4 border-l-teal-500 bg-teal-50/50 p-4">
          <span className="mb-2 inline-block rounded bg-teal-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            Text 2
          </span>
          <p className={p}>{renderPassage(t2, ulTarget === 2)}</p>
        </div>
        {prompt && (
          <p className={`${p} border-t border-slate-200 pt-3 font-medium text-slate-800`}>
            {hasSpans ? withRanges(prompt, underlineRanges(prompt, underlineSpans)) : prompt}
          </p>
        )}
      </div>
    );
  }

  // Exact underline spans captured from the source PDF take precedence.
  if (hasSpans) {
    const r = underlineRanges(text, underlineSpans);
    if (r.length) return <p className={p}>{withRanges(text, r)}</p>;
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
