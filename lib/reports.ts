"use client";

import { supabase } from "./supabaseClient";
import { currentUserId } from "./user";

/** Submit a report flagging an issue with a question. */
export async function reportQuestion(questionUid: string, reason: string): Promise<void> {
  const r = reason.trim();
  if (!r) return;
  await supabase.from("question_reports").insert({
    question_uid: questionUid,
    user_id: currentUserId(),
    reason: r,
  });
}

export interface QuestionReport {
  id: string;
  question_uid: string;
  user_id: string | null;
  reason: string;
  status: string;
  created_at: string;
}

/** All reports, newest first (admin view). */
export async function listReports(): Promise<QuestionReport[]> {
  const { data } = await supabase
    .from("question_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);
  return (data as QuestionReport[]) || [];
}

/** Dismiss/resolve a report by deleting it. */
export async function deleteReport(id: string): Promise<void> {
  await supabase.from("question_reports").delete().eq("id", id);
}
