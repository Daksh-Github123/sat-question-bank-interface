"use client";

import type { ParsedQuestion, Choice } from "./types";
import { TESTS, DOMAINS } from "./taxonomy";
import { makeRepairer } from "./textRepair";
import { underlineRanges } from "./underline";

const DIFFICULTIES = ["Easy", "Medium", "Hard"];

// Lazily import pdfjs only in the browser so it is never evaluated during SSR.
async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // The worker is copied into /public by scripts/copy-pdf-worker.mjs and served
  // as a same-origin module worker.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

/**
 * Detect underlined text on a page. The source PDFs draw underlines as thin
 * horizontal graphics (stroked lines or thin filled rectangles) beneath the
 * text, so we collect those segments (tracking the graphics transform) and
 * report the text whose baseline sits just above one. Returns the underlined
 * text as contiguous spans.
 */
async function pageUnderlineSpans(page: any, OPS: any, Util: any): Promise<string[]> {
  const tc = await page.getTextContent();
  const items = (tc.items as any[])
    .filter((it) => "str" in it && it.str.trim())
    .map((it) => ({
      str: it.str,
      x0: it.transform[4],
      x1: it.transform[4] + it.width,
      y: it.transform[5],
      w: it.width,
    }));

  const opl = await page.getOperatorList();
  const fn = opl.fnArray as number[];
  const args = opl.argsArray as any[];
  const segs: { x0: number; x1: number; y: number }[] = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  let pending: { x0: number; x1: number; y: number }[] = [];
  const apply = (m: number[], x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const addSeg = (x0: number, y0: number, x1: number, y1: number) => {
    const [ax, ay] = apply(ctm, x0, y0);
    const [bx, by] = apply(ctm, x1, y1);
    if (Math.abs(by - ay) <= 1.2 && Math.abs(bx - ax) > 4) {
      pending.push({ x0: Math.min(ax, bx), x1: Math.max(ax, bx), y: (ay + by) / 2 });
    }
  };
  for (let i = 0; i < fn.length; i++) {
    const f = fn[i];
    const a = args[i];
    if (f === OPS.save) stack.push(ctm.slice());
    else if (f === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (f === OPS.transform) ctm = Util.transform(ctm, a);
    else if (f === OPS.constructPath) {
      const ops = a[0] as number[];
      const coords = a[1] as number[];
      let ci = 0;
      let cx = 0;
      let cy = 0;
      for (const op of ops) {
        if (op === OPS.moveTo) {
          cx = coords[ci++];
          cy = coords[ci++];
        } else if (op === OPS.lineTo) {
          const nx = coords[ci++];
          const ny = coords[ci++];
          addSeg(cx, cy, nx, ny);
          cx = nx;
          cy = ny;
        } else if (op === OPS.rectangle) {
          const rx = coords[ci++];
          const ry = coords[ci++];
          const rw = coords[ci++];
          const rh = coords[ci++];
          if (Math.abs(rh) <= 2.5 && Math.abs(rw) > 4) addSeg(rx, ry, rx + rw, ry);
          cx = rx;
          cy = ry;
        } else if (op === OPS.curveTo) ci += 6;
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) ci += 4;
      }
    } else if (f === OPS.rectangle) {
      const [rx, ry, rw, rh] = a;
      if (Math.abs(rh) <= 2.5 && Math.abs(rw) > 4) addSeg(rx, ry, rx + rw, ry);
    } else if (
      f === OPS.stroke ||
      f === OPS.fill ||
      f === OPS.eoFill ||
      f === OPS.fillStroke ||
      f === OPS.eoFillStroke ||
      f === OPS.closeStroke ||
      f === OPS.closeFillStroke
    ) {
      segs.push(...pending);
      pending = [];
    }
  }
  segs.push(...pending);

  const und = items.filter((it) =>
    segs.some(
      (s) => s.y <= it.y + 2 && s.y >= it.y - 7 && Math.min(it.x1, s.x1) - Math.max(it.x0, s.x0) > it.w * 0.4
    )
  );
  // Reading order: group into lines (y bins, top→bottom), left→right within a line.
  und.sort((a, b) => Math.round(b.y / 3) - Math.round(a.y / 3) || a.x0 - b.x0);
  // Join contiguous underlined text; break at a line change or a big horizontal gap.
  const spans: string[] = [];
  let cur = "";
  let prev: (typeof und)[number] | null = null;
  for (const it of und) {
    if (prev && (Math.abs(prev.y - it.y) > 3 || it.x0 - prev.x1 > 15)) {
      if (cur.trim()) spans.push(cur.trim());
      cur = "";
    }
    cur += (cur ? " " : "") + it.str;
    prev = it;
  }
  if (cur.trim()) spans.push(cur.trim());
  return spans;
}

/** Extract text lines and all underlined spans from a PDF in a single pass. */
async function extractContent(
  buffer: ArrayBuffer
): Promise<{ lines: string[]; underlineSpans: string[] }> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const lines: string[] = [];
  const underlineSpans: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    for (const item of tc.items as any[]) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line);
        line = "";
      }
      line += item.str;
      lastY = y;
    }
    if (line) lines.push(line);
    try {
      underlineSpans.push(...(await pageUnderlineSpans(page, (pdfjs as any).OPS, (pdfjs as any).Util)));
    } catch {
      // Underline detection is best-effort; never let it break text import.
    }
  }
  return { lines, underlineSpans };
}

/** Extract text from a PDF, reconstructing lines from item positions. */
export async function extractLines(buffer: ArrayBuffer): Promise<string[]> {
  return (await extractContent(buffer)).lines;
}

function parseMeta(line: string): {
  test: string;
  domain: string;
  skill: string;
  difficulty: string;
} {
  let s = line.trim();
  const difficulty = DIFFICULTIES.find((d) => s.endsWith(" " + d) || s === d) || "";
  if (difficulty) s = s.slice(0, s.length - difficulty.length).trim();

  if (s.startsWith("SAT")) s = s.slice(3).trim();

  const test = TESTS.find((t) => s.startsWith(t)) || "";
  let rest = test ? s.slice(test.length).trim() : s;

  // Match the longest known domain that prefixes the remainder.
  const domain =
    DOMAINS.filter((d) => rest.startsWith(d)).sort((a, b) => b.length - a.length)[0] || "";
  const skill = domain ? rest.slice(domain.length).trim() : rest;

  return { test, domain, skill, difficulty };
}

function parseBlock(block: string, sourceFile: string): ParsedQuestion | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const idMatch = lines[0].match(/Question ID:\s*(\S+)/);
  if (!idMatch) return null;
  const question_id = idMatch[1];

  const findIdx = (name: string) => lines.findIndex((l) => l === name);
  const qi = findIdx("Question");

  // The metadata ("SAT <test> <domain> <skill> <difficulty>") is extracted as one
  // line per table cell, so a long domain/skill wraps across several lines and
  // would otherwise truncate the skill, domain, and difficulty (e.g. dropping
  // "Purpose" from "Text Structure and Purpose", or losing "Standard English
  // Conventions" and the difficulty entirely). Rejoin every line from the "SAT"
  // line up to the "Question" marker to reconstruct the full metadata.
  const startIdx = lines.findIndex((l) => /^SAT\s/.test(l));
  let metaLine = "";
  if (startIdx >= 0) {
    const end = qi > startIdx ? qi : Math.min(lines.length, startIdx + 6);
    metaLine = lines.slice(startIdx, end).join(" ").trim();
  }
  const { test, domain, skill, difficulty } = parseMeta(metaLine);
  const ai = findIdx("Answer");
  const ri = findIdx("Rationale");
  const caLine = lines.find((l) => /^Correct Answer:/.test(l));
  const cai = caLine ? lines.indexOf(caLine) : -1;

  const qEnd = ai > 0 ? ai : cai > 0 ? cai : ri > 0 ? ri : lines.length;
  const question_text = qi >= 0 ? lines.slice(qi + 1, qEnd).join(" ").trim() : "";

  const choices: Choice[] = [];
  if (ai > 0 && cai > ai) {
    for (let i = ai + 1; i < cai; i++) {
      const m = lines[i].match(/^([A-D])\.\s*(.*)$/);
      if (m) {
        choices.push({ letter: m[1], text: m[2].trim() });
      } else if (choices.length) {
        // continuation of the previous choice that wrapped to a new line
        choices[choices.length - 1].text += " " + lines[i];
      }
    }
  }

  const correct_answer = caLine
    ? caLine.replace(/^Correct Answer:\s*/, "").trim()
    : "";
  const rationale = ri >= 0 ? lines.slice(ri + 1).join(" ").trim() : "";

  return {
    question_id,
    test,
    domain,
    skill,
    difficulty,
    question_text,
    choices: choices.length ? choices : null,
    correct_answer,
    rationale,
    source_file: sourceFile,
  };
}

/** Parse a full question-bank PDF into structured questions. */
export async function parsePdf(
  buffer: ArrayBuffer,
  sourceFile: string
): Promise<ParsedQuestion[]> {
  const { lines, underlineSpans } = await extractContent(buffer);
  const full = lines.join("\n");
  const blocks = full.split(/(?=Question ID:)/).filter((b) => /Question ID:/.test(b));
  const parsed = blocks
    .map((b) => parseBlock(b, sourceFile))
    .filter((q): q is ParsedQuestion => q !== null && !!q.question_id);

  // Repair stray mid-word spaces introduced by PDF text extraction so imported
  // questions read cleanly (e.g. "suppor t" -> "support").
  const fix = await makeRepairer();
  for (const q of parsed) {
    q.question_text = fix(q.question_text);
    q.rationale = fix(q.rationale);
    if (q.choices) q.choices = q.choices.map((c) => ({ ...c, text: fix(c.text) }));
  }

  // Attribute underlined spans to the question they appear in. Only questions
  // whose prompt actually references an underline are considered, so stray
  // horizontal graphics (table borders, rules) elsewhere never create a spurious
  // underline. Matching is whitespace/punctuation-insensitive (see lib/underline).
  const uniqueSpans = Array.from(new Set(underlineSpans.map((s) => s.trim()).filter(Boolean)));
  for (const q of parsed) {
    if (!/\bunderlined\b/i.test(q.question_text)) continue;
    const matched = uniqueSpans.filter((sp) => underlineRanges(q.question_text, [sp]).length > 0);
    // Keep the longest spans and drop ones fully contained in another.
    matched.sort((a, b) => b.length - a.length);
    const kept: string[] = [];
    for (const sp of matched) {
      const nk = sp.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
      if (kept.some((k) => k.replace(/[^A-Za-z0-9]/g, "").toLowerCase().includes(nk))) continue;
      kept.push(sp);
    }
    q.underline_spans = kept;
  }
  return parsed;
}
