"use client";

import { supabase } from "./supabaseClient";
import { currentUserId } from "./user";
import type {
  Question,
  PracticeSessionConfig,
  PracticeSessionRow,
  PracticeMode,
} from "./types";

export const REVIEW_INTERVAL_DAYS = 3;
export const WEAKNESS_THRESHOLD = 0.7;

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Weighted sample without replacement. */
function weightedSample<T>(items: T[], weightFn: (t: T) => number, k: number): T[] {
  const pool = items.map((it) => ({ it, w: Math.max(weightFn(it), 0.0001) }));
  const out: T[] = [];
  while (out.length < k && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    out.push(pool[idx].it);
    pool.splice(idx, 1);
  }
  return out;
}

export interface SkillAcc {
  total: number;
  correct: number;
}

/** Per-skill accuracy across all attempts (latest not required — overall). */
export async function getSkillAccuracy(): Promise<Map<string, SkillAcc>> {
  const map = new Map<string, SkillAcc>();
  const { data } = await supabase
    .from("attempts")
    .select("is_correct, question:questions(skill)")
    .eq("user_id", currentUserId())
    .limit(20000);
  for (const a of (data as any[]) || []) {
    const skill = a.question?.skill;
    if (!skill) continue;
    const g = map.get(skill) || { total: 0, correct: 0 };
    g.total++;
    if (a.is_correct) g.correct++;
    map.set(skill, g);
  }
  return map;
}

/**
 * Question uuids that are "due for review": the most recent attempt was wrong
 * and it happened at least REVIEW_INTERVAL_DAYS ago (works off dates, not a
 * daily streak).
 */
export async function getDueReviewIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from("attempts")
    .select("question_uid, is_correct, created_at")
    .eq("user_id", currentUserId())
    .order("created_at", { ascending: false })
    .limit(20000);
  const latest = new Map<string, { is_correct: boolean; created_at: string }>();
  for (const a of (data as any[]) || []) {
    if (!latest.has(a.question_uid)) {
      latest.set(a.question_uid, { is_correct: a.is_correct, created_at: a.created_at });
    }
  }
  const cutoff = Date.now() - REVIEW_INTERVAL_DAYS * 24 * 3600 * 1000;
  const due = new Set<string>();
  for (const [uid, v] of latest) {
    if (!v.is_correct && new Date(v.created_at).getTime() <= cutoff) due.add(uid);
  }
  return due;
}

/** All question uuids that have ever been attempted. */
export async function getAttemptedIds(): Promise<Set<string>> {
  const set = new Set<string>();
  const { data } = await supabase
    .from("attempts")
    .select("question_uid")
    .eq("user_id", currentUserId())
    .limit(50000);
  for (const a of (data as any[]) || []) set.add(a.question_uid);
  return set;
}

/** Difficulty targets for a "test-like" mix. */
const TEST_MIX: Record<string, number> = { Easy: 0.25, Medium: 0.5, Hard: 0.25 };

/**
 * Build the ordered question list for a session from the chosen config,
 * applying difficulty mix, weak-area focus, and review resurfacing.
 */
export async function buildSessionQuestions(
  config: PracticeSessionConfig
): Promise<Question[]> {
  let query = supabase.from("questions").select("*").in("difficulty", config.difficulties);
  if (config.skills.length > 0) query = query.in("skill", config.skills);
  const { data } = await query.limit(5000);
  let candidates = (data as Question[]) || [];
  if (candidates.length === 0) return [];

  // Weak-area focus weighting.
  let acc: Map<string, SkillAcc> = new Map();
  if (config.focus === "weak") acc = await getSkillAccuracy();
  const focusWeight = (q: Question) => {
    if (config.focus !== "weak") return 1;
    const g = acc.get(q.skill);
    const a = g && g.total > 0 ? g.correct / g.total : 0.6;
    return 1 - a + 0.15; // lower accuracy => higher weight
  };

  // Review resurfacing: reserve up to ~30% for due-missed questions.
  let reviewPicks: Question[] = [];
  if (config.includeReview) {
    const due = await getDueReviewIds();
    const dueCandidates = candidates.filter((q) => due.has(q.id));
    const quota = Math.min(dueCandidates.length, Math.ceil(config.count * 0.3));
    reviewPicks = weightedSample(dueCandidates, focusWeight, quota);
  }
  const pickedIds = new Set(reviewPicks.map((q) => q.id));
  // Exclude already-attempted questions from the fresh pool so new sessions don't
  // repeat questions you've already done. (Review resurfacing above is exempt —
  // that intentionally brings back missed questions after a few days.)
  const attempted = config.avoidSeen ? await getAttemptedIds() : new Set<string>();
  const rest = candidates.filter((q) => !pickedIds.has(q.id) && !attempted.has(q.id));
  const remaining = Math.max(0, config.count - reviewPicks.length);

  let restPicks: Question[] = [];
  if (config.mix === "test-like") {
    // Allocate per-difficulty quotas among the selected difficulties.
    const selected = config.difficulties.filter((d) => TEST_MIX[d] !== undefined);
    const totalShare = selected.reduce((s, d) => s + TEST_MIX[d], 0) || 1;
    let allocated = 0;
    for (let i = 0; i < selected.length; i++) {
      const d = selected[i];
      const isLast = i === selected.length - 1;
      const want = isLast
        ? remaining - allocated
        : Math.round(remaining * (TEST_MIX[d] / totalShare));
      const group = rest.filter((q) => q.difficulty === d);
      const picks = weightedSample(group, focusWeight, Math.max(0, want));
      restPicks.push(...picks);
      allocated += picks.length;
    }
    // Fill any shortfall (e.g. a difficulty ran out) from whatever remains.
    if (restPicks.length < remaining) {
      const chosen = new Set(restPicks.map((q) => q.id));
      const leftover = rest.filter((q) => !chosen.has(q.id));
      restPicks.push(...weightedSample(leftover, focusWeight, remaining - restPicks.length));
    }
  } else {
    restPicks = weightedSample(rest, focusWeight, remaining);
  }

  let result = [...reviewPicks, ...restPicks];
  const plain = config.order === "sequential" && config.focus === "even" && config.mix === "balanced";
  result = plain ? result : shuffle(result);
  return result.slice(0, config.count);
}

// ---- Session persistence (pause / resume) ----

export async function createSession(
  config: PracticeSessionConfig,
  questionIds: string[],
  mode: PracticeMode,
  perQuestionSeconds: number | null,
  totalSeconds: number | null
): Promise<string | null> {
  const { data, error } = await supabase
    .from("practice_sessions")
    .insert({
      config,
      question_ids: questionIds,
      mode,
      per_question_seconds: perQuestionSeconds,
      total_seconds: totalSeconds,
      current_index: 0,
      current_elapsed_seconds: 0,
      status: "active",
      user_id: currentUserId(),
    })
    .select("id")
    .single();
  if (error) return null;
  return (data as any).id as string;
}

export async function updateSessionProgress(
  id: string,
  currentIndex: number,
  currentElapsed: number
) {
  await supabase
    .from("practice_sessions")
    .update({
      current_index: currentIndex,
      current_elapsed_seconds: currentElapsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function completeSession(id: string) {
  await supabase
    .from("practice_sessions")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function getActiveSession(): Promise<PracticeSessionRow | null> {
  const { data } = await supabase
    .from("practice_sessions")
    .select("*")
    .eq("status", "active")
    .eq("user_id", currentUserId())
    .order("updated_at", { ascending: false })
    .limit(1);
  const row = (data as PracticeSessionRow[])?.[0];
  return row || null;
}

/** Load the questions for a saved session, preserving their stored order. */
export async function loadSessionQuestions(ids: string[]): Promise<Question[]> {
  if (!ids.length) return [];
  const { data } = await supabase.from("questions").select("*").in("id", ids);
  const byId = new Map((data as Question[] || []).map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter((q): q is Question => !!q);
}
