// Answer checking for practice questions.
//
// Multiple-choice questions compare the selected letter to `correct_answer`
// exactly (unchanged behaviour). Grid-in / free-response math questions
// (`choices === null`) are numeric, so we compare by value: 1/2, 0.5 and .5 all
// count as the same answer, and standard SAT decimal approximations of repeating
// values (2/3 -> .666 or .667) are accepted. A question may also carry an
// `accepted_answers` spec for a range or several acceptable values.

import type { Question, AcceptedAnswers } from "./types";

interface Parsed {
  value: number;
  num?: number; // numerator, when the input was a fraction
  den?: number; // denominator, when the input was a fraction
  decimals?: number; // digits after the decimal point, when a decimal literal
}

function clean(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, "")
    .replace(/,/g, "")
    .replace(/^\$/, "")
    .replace(/%$/, "");
}

export function parseNumeric(input: string): Parsed | null {
  const c = clean(input);
  if (c === "") return null;

  const frac = c.match(/^(-?\d+)\/(-?\d+)$/);
  if (frac) {
    const num = parseInt(frac[1], 10);
    const den = parseInt(frac[2], 10);
    if (den === 0) return null;
    return { value: num / den, num, den };
  }

  const dec = c.match(/^-?(?:\d+\.\d*|\.\d+|\d+)$/);
  if (dec) {
    const value = parseFloat(c);
    if (!isFinite(value)) return null;
    const dot = c.indexOf(".");
    const decimals = dot === -1 ? 0 : c.length - dot - 1;
    return { value, decimals };
  }

  return null;
}

function exactEqual(a: Parsed, b: Parsed): boolean {
  if (a.num !== undefined && a.den !== undefined && b.num !== undefined && b.den !== undefined) {
    return a.num * b.den === b.num * a.den;
  }
  return Math.abs(a.value - b.value) < 1e-9;
}

/** True when `typed` is an acceptable numeric form of `truth`. */
export function numericEqual(typed: Parsed, truth: Parsed): boolean {
  if (exactEqual(typed, truth)) return true;
  // Accept a decimal approximation of a non-terminating value, but only with
  // enough precision (>= 3 decimals, matching SAT grid rules) so that coarse
  // values like 0.6 for 2/3 are still rejected.
  if (typed.decimals !== undefined && typed.decimals >= 3) {
    const f = Math.pow(10, typed.decimals);
    const rounded = Math.round(truth.value * f) / f;
    const truncated = Math.trunc(truth.value * f) / f;
    if (Math.abs(rounded - typed.value) < 1e-9) return true;
    if (Math.abs(truncated - typed.value) < 1e-9) return true;
  }
  return false;
}

function matchesValue(typedRaw: string, targetRaw: string): boolean {
  const typed = parseNumeric(typedRaw);
  const target = parseNumeric(targetRaw);
  if (typed && target) return numericEqual(typed, target);
  // Non-numeric fallback: case-insensitive trimmed string equality.
  return typedRaw.trim().toLowerCase() === targetRaw.trim().toLowerCase();
}

function matchesSpec(typedRaw: string, spec: AcceptedAnswers): boolean {
  if (spec.type === "list") {
    return spec.values.some((v) => matchesValue(typedRaw, v));
  }
  // range
  const typed = parseNumeric(typedRaw);
  if (!typed) return false;
  const aboveMin = spec.minExclusive ? typed.value > spec.min : typed.value >= spec.min;
  const belowMax = spec.maxExclusive ? typed.value < spec.max : typed.value <= spec.max;
  return aboveMin && belowMax;
}

/** Whether a submitted answer is correct for the given question. */
export function isAnswerCorrect(
  submitted: string | null | undefined,
  question: Pick<Question, "choices" | "correct_answer" | "accepted_answers">
): boolean {
  if (submitted == null || submitted === "") return false;

  // Multiple choice: exact letter match (unchanged).
  if (question.choices) return submitted === question.correct_answer;

  // Grid-in / free response.
  if (question.accepted_answers) return matchesSpec(submitted, question.accepted_answers);
  return matchesValue(submitted, question.correct_answer);
}
