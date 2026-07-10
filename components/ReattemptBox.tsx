"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { currentUserId } from "@/lib/user";
import type { Question } from "@/lib/types";

/** Inline re-attempt of a single question; records an attempt on submit. */
export default function ReattemptBox({
  question,
  onResolved,
}: {
  question: Question;
  onResolved: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(false);

  async function submit() {
    if (selected === null || selected === "") return;
    const isCorrect = selected === question.correct_answer;
    setCorrect(isCorrect);
    setRevealed(true);
    await supabase.from("attempts").insert({
      question_uid: question.id,
      selected_answer: selected,
      is_correct: isCorrect,
      time_spent_seconds: 0,
      mode: "review",
      user_id: currentUserId(),
    });
    onResolved(isCorrect);
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Re-attempt</p>
      <div className="space-y-1.5">
        {question.choices ? (
          question.choices.map((c) => {
            const isCorrect = c.letter === question.correct_answer;
            const isChosen = c.letter === selected;
            let cls = "border-slate-200 hover:border-brand-400";
            if (revealed) {
              if (isCorrect) cls = "border-emerald-400 bg-emerald-50";
              else if (isChosen) cls = "border-rose-400 bg-rose-50";
              else cls = "opacity-60";
            } else if (isChosen) cls = "border-brand-500 bg-brand-50";
            return (
              <button
                key={c.letter}
                disabled={revealed}
                onClick={() => setSelected(c.letter)}
                className={`flex w-full items-start gap-2 rounded-md border p-2 text-left text-sm ${cls}`}
              >
                <span className="font-semibold">{c.letter}.</span>
                <span>{c.text}</span>
              </button>
            );
          })
        ) : (
          <input
            type="text"
            disabled={revealed}
            value={selected ?? ""}
            onChange={(e) => setSelected(e.target.value)}
            placeholder="Type your answer"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        )}
      </div>
      {!revealed ? (
        <button
          onClick={submit}
          disabled={selected === null || selected === ""}
          className="mt-2 rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Check
        </button>
      ) : (
        <p className={`mt-2 text-sm font-semibold ${correct ? "text-emerald-700" : "text-rose-700"}`}>
          {correct ? "✓ Correct this time — cleared from your mistakes." : "✗ Still incorrect — keep practicing this one."}
        </p>
      )}
    </div>
  );
}
