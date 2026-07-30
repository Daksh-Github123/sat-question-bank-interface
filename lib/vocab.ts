"use client";

import { supabase } from "./supabaseClient";
import { currentUserId } from "./user";
import type { VocabularyItem } from "./types";

function termKey(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Return the sentence from `passage` that contains `term`, to use as a usage
 * example when the dictionary doesn't supply one. Falls back to null.
 */
export function sentenceFor(passage: string | null | undefined, term: string): string | null {
  if (!passage) return null;
  const sentences = passage.replace(/\s+/g, " ").match(/[^.!?]*[.!?]+|[^.!?]+$/g) || [];
  const needle = term.trim().toLowerCase();
  const hit = sentences.find((s) => s.toLowerCase().includes(needle));
  return hit ? hit.trim() : null;
}

/** All of the current user's saved vocabulary, most-recently-updated first. */
export async function listVocab(): Promise<VocabularyItem[]> {
  const { data } = await supabase
    .from("vocabulary")
    .select("*")
    .eq("user_id", currentUserId())
    .order("updated_at", { ascending: false })
    .limit(20000);
  return (data as VocabularyItem[]) || [];
}

/**
 * Save a term. If it already exists for this user, bump its count (and backfill
 * any missing definition/example); otherwise insert it. Mirrors the read-then-
 * write approach used elsewhere — there is no server-side counter.
 */
export async function saveTerm(input: {
  term: string;
  definition?: string | null;
  example?: string | null;
  sourceQuestionUid?: string | null;
}): Promise<void> {
  const uid = currentUserId();
  const key = termKey(input.term);
  if (!key) return;

  const { data: existing } = await supabase
    .from("vocabulary")
    .select("id, count, definition, example")
    .eq("user_id", uid)
    .eq("term_key", key)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("vocabulary")
      .update({
        count: ((existing as any).count ?? 1) + 1,
        definition: (existing as any).definition ?? input.definition ?? null,
        example: (existing as any).example ?? input.example ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", (existing as any).id);
    return;
  }

  await supabase.from("vocabulary").insert({
    user_id: uid,
    term: input.term.trim(),
    term_key: key,
    definition: input.definition ?? null,
    example: input.example ?? null,
    source_question_uid: input.sourceQuestionUid ?? null,
    count: 1,
  });
}

export async function updateVocab(
  id: string,
  fields: { definition?: string | null; example?: string | null }
): Promise<void> {
  await supabase
    .from("vocabulary")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", currentUserId());
}

export async function deleteVocab(id: string): Promise<void> {
  await supabase.from("vocabulary").delete().eq("id", id).eq("user_id", currentUserId());
}
