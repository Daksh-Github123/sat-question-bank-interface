"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Question } from "@/lib/types";
import { DIFFICULTY_COLORS } from "@/lib/taxonomy";

interface Props {
  questions: Question[];
  mode: "stopwatch" | "timer";
  secondsPerQuestion: number;
  sessionId: string;
  onExit: () => void;
}

interface RecordedAnswer {
  question: Question;
  selected: string | null;
  correct: boolean;
  seconds: number;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function PracticeSession({
  questions,
  mode,
  secondsPerQuestion,
  sessionId,
  onExit,
}: Props) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [answers, setAnswers] = useState<RecordedAnswer[]>([]);
  const [saving, setSaving] = useState(false);
  const startRef = useRef<number>(Date.now());

  const q = questions[index];
  const isLast = index === questions.length - 1;

  // Reset the per-question clock whenever we move to a new question.
  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    setSelected(null);
    setRevealed(false);
  }, [index]);

  // Tick the clock every second while the question is unanswered.
  useEffect(() => {
    if (revealed) return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(t);
  }, [revealed, index]);

  const remaining = mode === "timer" ? Math.max(0, secondsPerQuestion - elapsed) : 0;

  const submit = useCallback(
    async (auto = false) => {
      if (revealed) return;
      const spent = Math.floor((Date.now() - startRef.current) / 1000);
      const choice = auto ? selected : selected;
      const correct = !!choice && choice === q.correct_answer;
      setRevealed(true);
      setAnswers((prev) => [
        ...prev,
        { question: q, selected: choice, correct, seconds: spent },
      ]);
      // Persist attempt (fire and forget, but surface errors on save button).
      await supabase.from("attempts").insert({
        question_uid: q.id,
        selected_answer: choice,
        is_correct: correct,
        time_spent_seconds: spent,
        mode,
        session_id: sessionId,
      });
    },
    [revealed, selected, q, mode, sessionId]
  );

  // Timer mode: auto-submit when the clock runs out.
  useEffect(() => {
    if (mode === "timer" && !revealed && remaining <= 0 && elapsed > 0) {
      submit(true);
    }
  }, [mode, revealed, remaining, elapsed, submit]);

  function next() {
    if (isLast) return;
    setIndex((i) => i + 1);
  }

  // ---- Summary screen ----
  if (index >= questions.length) return null;

  const finished = revealed && isLast;
  const totalTime = answers.reduce((a, r) => a + r.seconds, 0);
  const correctCount = answers.filter((a) => a.correct).length;

  return (
    <div className="space-y-5">
      {/* Progress + clock */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500">
            Question {index + 1} of {questions.length}
          </span>
          <span className={`rounded border px-2 py-0.5 text-xs ${DIFFICULTY_COLORS[q.difficulty] || ""}`}>
            {q.difficulty}
          </span>
          <span className="text-xs text-slate-400">{q.skill}</span>
        </div>
        <div
          className={`rounded-md px-3 py-1 font-mono text-lg font-semibold ${
            mode === "timer" && remaining <= 10
              ? "bg-rose-100 text-rose-700"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {mode === "timer" ? fmt(remaining) : fmt(elapsed)}
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-brand-500 transition-all"
          style={{ width: `${((index + (revealed ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
          {q.question_text}
        </p>

        <div className="mt-5 space-y-2">
          {q.choices ? (
            q.choices.map((c) => {
              const isCorrect = c.letter === q.correct_answer;
              const isChosen = c.letter === selected;
              let cls = "border-slate-200 hover:border-brand-400";
              if (revealed) {
                if (isCorrect) cls = "border-emerald-400 bg-emerald-50";
                else if (isChosen) cls = "border-rose-400 bg-rose-50";
                else cls = "border-slate-200 opacity-70";
              } else if (isChosen) {
                cls = "border-brand-500 bg-brand-50";
              }
              return (
                <button
                  key={c.letter}
                  disabled={revealed}
                  onClick={() => setSelected(c.letter)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${cls}`}
                >
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-semibold">
                    {c.letter}
                  </span>
                  <span className="text-slate-700">{c.text}</span>
                  {revealed && isCorrect && <span className="ml-auto text-emerald-600">✓</span>}
                  {revealed && isChosen && !isCorrect && (
                    <span className="ml-auto text-rose-600">✗</span>
                  )}
                </button>
              );
            })
          ) : (
            // Student-produced response (no choices): free text entry.
            <div>
              <input
                type="text"
                disabled={revealed}
                value={selected ?? ""}
                onChange={(e) => setSelected(e.target.value)}
                placeholder="Type your answer"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {revealed && (
                <p className="mt-2 text-sm">
                  Correct answer:{" "}
                  <span className="font-semibold text-emerald-700">{q.correct_answer}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between">
          <button onClick={onExit} className="text-sm text-slate-400 hover:text-slate-600">
            End session
          </button>
          {!revealed ? (
            <button
              onClick={() => submit(false)}
              disabled={selected === null || selected === ""}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Submit
            </button>
          ) : !finished ? (
            <button
              onClick={next}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Next question →
            </button>
          ) : (
            <button
              onClick={onExit}
              className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Finish
            </button>
          )}
        </div>
      </div>

      {/* Rationale */}
      {revealed && q.rationale && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Explanation
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {q.rationale}
          </p>
        </div>
      )}

      {/* Running tally */}
      {finished && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-lg font-bold text-emerald-800">
            Session complete — {correctCount}/{questions.length} correct
          </p>
          <p className="mt-1 text-sm text-emerald-700">
            {Math.round((correctCount / questions.length) * 100)}% accuracy · {fmt(totalTime)} total ·{" "}
            {Math.round(totalTime / questions.length)}s avg / question
          </p>
        </div>
      )}
    </div>
  );
}
