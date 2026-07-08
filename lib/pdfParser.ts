"use client";

import type { ParsedQuestion, Choice } from "./types";
import { TESTS, DOMAINS } from "./taxonomy";

const DIFFICULTIES = ["Easy", "Medium", "Hard"];

// Lazily import pdfjs only in the browser so it is never evaluated during SSR.
async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // The worker is copied into /public by scripts/copy-pdf-worker.mjs and served
  // as a same-origin module worker.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

/** Extract text from a PDF, reconstructing lines from item positions. */
export async function extractLines(buffer: ArrayBuffer): Promise<string[]> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const lines: string[] = [];
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
  }
  return lines;
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

  const metaLine = lines.find((l) => /^SAT\s/.test(l)) || "";
  const { test, domain, skill, difficulty } = parseMeta(metaLine);

  const findIdx = (name: string) => lines.findIndex((l) => l === name);
  const qi = findIdx("Question");
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
  const lines = await extractLines(buffer);
  const full = lines.join("\n");
  const blocks = full.split(/(?=Question ID:)/).filter((b) => /Question ID:/.test(b));
  return blocks
    .map((b) => parseBlock(b, sourceFile))
    .filter((q): q is ParsedQuestion => q !== null && !!q.question_id);
}
