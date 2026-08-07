"use client";

// Renders a question's text. Cross-Text Connections questions bundle two
// passages ("Text 1 …", "Text 2 …") plus a prompt into one string; this splits
// them into labeled blocks for readability. Everything else renders as-is.

const PROMPT_LEAD =
  /(Based on (?:the|both) texts|How would the author|The author of Text|Which choice|Which statement|What would the author)/;

export default function QuestionText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const p = `whitespace-pre-wrap ${className}`;
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
    return (
      <div className="space-y-3">
        {intro && <p className={p}>{intro}</p>}
        {/* Text 1 — indigo accent */}
        <div className="rounded-lg border border-brand-100 border-l-4 border-l-brand-500 bg-brand-50/50 p-4">
          <span className="mb-2 inline-block rounded bg-brand-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            Text 1
          </span>
          <p className={p}>{t1}</p>
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
          <p className={p}>{t2}</p>
        </div>
        {prompt && (
          <p className={`${p} border-t border-slate-200 pt-3 font-medium text-slate-800`}>{prompt}</p>
        )}
      </div>
    );
  }

  return <p className={p}>{text}</p>;
}
