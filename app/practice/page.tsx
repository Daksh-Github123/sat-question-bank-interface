"use client";

import { useEffect, useState } from "react";
import type { Question, PracticeMode, PracticeSessionRow } from "@/lib/types";
import PracticeSetup, { StartPayload } from "@/components/PracticeSetup";
import PracticeSession from "@/components/PracticeSession";
import {
  buildSessionQuestions,
  createSession,
  getActiveSession,
  loadSessionQuestions,
  completeSession,
} from "@/lib/practice";

interface ActiveSession {
  questions: Question[];
  mode: PracticeMode;
  perQuestionSeconds: number | null;
  totalSeconds: number | null;
  sessionId: string;
  startIndex: number;
  startElapsed: number;
}

export default function PracticePage() {
  const [phase, setPhase] = useState<"checking" | "setup" | "loading" | "active">("checking");
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [resumable, setResumable] = useState<PracticeSessionRow | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const active = await getActiveSession();
      if (active && active.current_index < active.question_ids.length) {
        setResumable(active);
      }
      setPhase("setup");
    })();
  }, []);

  async function start(payload: StartPayload) {
    setPhase("loading");
    setError("");
    setResumable(null);
    try {
      const questions = await buildSessionQuestions(payload.config);
      if (questions.length === 0) {
        setError("No questions matched those filters.");
        setPhase("setup");
        return;
      }
      const id = await createSession(
        payload.config,
        questions.map((q) => q.id),
        payload.mode,
        payload.perQuestionSeconds,
        payload.totalSeconds
      );
      if (!id) {
        setError("Could not start the session. Please try again.");
        setPhase("setup");
        return;
      }
      setSession({
        questions,
        mode: payload.mode,
        perQuestionSeconds: payload.perQuestionSeconds,
        totalSeconds: payload.totalSeconds,
        sessionId: id,
        startIndex: 0,
        startElapsed: 0,
      });
      setPhase("active");
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
      setPhase("setup");
    }
  }

  async function resume(row: PracticeSessionRow) {
    setPhase("loading");
    const questions = await loadSessionQuestions(row.question_ids);
    setSession({
      questions,
      mode: row.mode,
      perQuestionSeconds: row.per_question_seconds,
      totalSeconds: row.total_seconds,
      sessionId: row.id,
      startIndex: Math.min(row.current_index, questions.length - 1),
      startElapsed: row.current_elapsed_seconds || 0,
    });
    setPhase("active");
  }

  async function discardResumable() {
    if (resumable) await completeSession(resumable.id);
    setResumable(null);
  }

  if (phase === "checking") return <p className="text-sm text-slate-500">Loading…</p>;
  if (phase === "loading") return <p className="text-sm text-slate-500">Preparing questions…</p>;

  if (phase === "active" && session) {
    return (
      <PracticeSession
        questions={session.questions}
        mode={session.mode}
        perQuestionSeconds={session.perQuestionSeconds}
        totalSeconds={session.totalSeconds}
        sessionId={session.sessionId}
        startIndex={session.startIndex}
        startElapsed={session.startElapsed}
        onExit={() => {
          setSession(null);
          setPhase("checking");
          // Re-check for a resumable (paused) session.
          getActiveSession().then((a) => {
            if (a && a.current_index < a.question_ids.length) setResumable(a);
            setPhase("setup");
          });
        }}
      />
    );
  }

  return (
    <div>
      {error && <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {resumable && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 p-4">
          <div>
            <p className="text-sm font-semibold text-brand-800">You have a paused session</p>
            <p className="text-xs text-brand-600">
              {resumable.current_index} of {resumable.question_ids.length} done — pick up where you
              left off.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={discardResumable}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Discard
            </button>
            <button
              onClick={() => resume(resumable)}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Resume
            </button>
          </div>
        </div>
      )}
      <PracticeSetup onStart={start} />
    </div>
  );
}
