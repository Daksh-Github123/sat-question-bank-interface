"use client";

import { supabase } from "./supabaseClient";
import { currentUserId } from "./user";
import type { QuestionState } from "./types";

/** Fetch the current user's per-question state (flags + notes), optionally for a subset. */
export async function getQuestionStates(ids?: string[]): Promise<Map<string, QuestionState>> {
  let query = supabase.from("question_state").select("*").eq("user_id", currentUserId());
  if (ids && ids.length) query = query.in("question_uid", ids);
  const { data } = await query.limit(20000);
  const map = new Map<string, QuestionState>();
  for (const s of (data as QuestionState[]) || []) map.set(s.question_uid, s);
  return map;
}

export async function setFlag(questionUid: string, flagged: boolean) {
  await supabase
    .from("question_state")
    .upsert(
      { user_id: currentUserId(), question_uid: questionUid, flagged, updated_at: new Date().toISOString() },
      { onConflict: "user_id,question_uid" }
    );
}

export async function setNote(questionUid: string, note: string) {
  await supabase
    .from("question_state")
    .upsert(
      { user_id: currentUserId(), question_uid: questionUid, note, updated_at: new Date().toISOString() },
      { onConflict: "user_id,question_uid" }
    );
}
