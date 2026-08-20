"use client";

import { supabase } from "./supabaseClient";
import { currentUserId } from "./user";

// General app feedback (as opposed to per-question question_reports). Mirrors the
// lib/reports.ts pattern: insert on submit, list + delete for the admin view.

/** Submit a piece of general feedback. */
export async function submitFeedback(message: string): Promise<void> {
  const m = message.trim();
  if (!m) return;
  await supabase.from("feedback").insert({
    user_id: currentUserId(),
    message: m,
  });
}

export interface Feedback {
  id: string;
  user_id: string | null;
  message: string;
  created_at: string;
}

/** All feedback, newest first (admin view). */
export async function listFeedback(): Promise<Feedback[]> {
  const { data } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);
  return (data as Feedback[]) || [];
}

/** Dismiss/resolve feedback by deleting it. */
export async function deleteFeedback(id: string): Promise<void> {
  await supabase.from("feedback").delete().eq("id", id);
}
