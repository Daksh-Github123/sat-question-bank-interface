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
    const label = "mb-1 text-xs font-bold uppercase tracking-wide text-slate-400";
    return (
      <div className="space-y-3">
        {text.slice(0, i1).trim() && <p className={p}>{text.slice(0, i1).trim()}</p>}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <p className={label}>Text 1</p>
          <p className={p}>{t1}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <p className={label}>Text 2</p>
          <p className={p}>{t2}</p>
        </div>
        {prompt && <p className={`${p} font-medium`}>{prompt}</p>}
      </div>
    );
  }

  return <p className={p}>{text}</p>;
}
