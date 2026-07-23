"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Question, PracticeMode, Confidence, MissReason } from "@/lib/types";
import { MISS_REASON_LABELS } from "@/lib/types";
import { DIFFICULTY_COLORS } from "@/lib/taxonomy";
import { updateSessionProgress, completeSession } from "@/lib/practice";
import { getQuestionStates, setFlag as persistFlag, setNote as persistNote } from "@/lib/questionState";
import { currentUserId } from "@/lib/user";

interface Props {
  questions: Question[];
  mode: PracticeMode;
  perQuestionSeconds: number | null;
  totalSeconds: number | null;
  sessionId: string;
  startIndex?: number;
  startElapsed?: number;
  requireTags?: boolean;
  onExit: () => void;
}

interface Recorded {
  question: Question;
  selected: string | null;
  correct: boolean;
  seconds: number;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.max(0, s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function PracticeSession({
  questions,
  mode,
  perQuestionSeconds,
  totalSeconds,
  sessionId,
  startIndex = 0,
  startElapsed = 0,
  requireTags = false,
  onExit,
}: Props) {
  const [index, setIndex] = useState(startIndex);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [answers, setAnswers] = useState<Recorded[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [missReason, setMissReason] = useState<MissReason | null>(null);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [phase, setPhase] = useState<"run" | "flagged" | "done">("run");

  // Per-question clock baseline (accounts for resumed partial time).
  const startRef = useRef<number>(Date.now() - startElapsed * 1000);
  // Module-mode total countdown baseline.
  const moduleStartRef = useRef<number>(Date.now());
  const [moduleElapsed, setModuleElapsed] = useState(0);
  // Pause: freezes all clocks; paused time is excluded from recorded time.
  const [paused, setPaused] = useState(false);
  const pauseStartRef = useRef<number>(0);

  const q = questions[index];
  const isLast = index === questions.length - 1;

  // Load persisted flags/notes for this session's questions.
  useEffect(() => {
    (async () => {
      const states = await getQuestionStates(questions.map((x) => x.id));
      const f = new Set<string>();
      const n = new Map<string, string>();
      states.forEach((s) => {
        if (s.flagged) f.add(s.question_uid);
        if (s.note) n.set(s.question_uid, s.note);
      });
      setFlags(f);
      setNotes(n);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New question: reset per-question state.
  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    setSelected(null);
    setRevealed(false);
    setPaused(false);
    setAttemptId(null);
    setConfidence(null);
    setMissReason(null);
    setNoteOpen(false);
    setNoteDraft(q ? notes.get(q.id) || "" : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Tick per-question clock while unanswered.
  useEffect(() => {
    if (revealed || paused || phase !== "run") return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(t);
  }, [revealed, paused, index, phase]);

  // Module-mode total clock.
  useEffect(() => {
    if (mode !== "module" || paused || phase !== "run") return;
    const t = setInterval(() => {
      setModuleElapsed(Math.floor((Date.now() - moduleStartRef.current) / 1000));
    }, 500);
    return () => clearInterval(t);
  }, [mode, paused, phase]);

  // Persist progress periodically (for pause/resume) while running a question.
  useEffect(() => {
    if (revealed || paused || phase !== "run") return;
    const t = setInterval(() => {
      const spent = Math.floor((Date.now() - startRef.current) / 1000);
      updateSessionProgress(sessionId, index, spent);
    }, 5000);
    return () => clearInterval(t);
  }, [revealed, paused, index, phase, sessionId]);

  const perQRemaining =
    mode === "timer" && perQuestionSeconds ? Math.max(0, perQuestionSeconds - elapsed) : 0;
  const moduleRemaining =
    mode === "module" && totalSeconds ? Math.max(0, totalSeconds - moduleElapsed) : 0;

  const submit = useCallback(async () => {
    if (revealed || !q) return;
    const spent = Math.floor((Date.now() - startRef.current) / 1000);
    const correct = !!selected && selected === q.correct_answer;
    setRevealed(true);
    setAnswers((prev) => [...prev, { question: q, selected, correct, seconds: spent }]);
    // Record attempt; capture id so confidence / miss-reason can update it.
    const { data } = await supabase
      .from("attempts")
      .insert({
        question_uid: q.id,
        selected_answer: selected,
        is_correct: correct,
        time_spent_seconds: spent,
        mode,
        session_id: sessionId,
        user_id: currentUserId(),
      })
      .select("id")
      .single();
    if (data) setAttemptId((data as any).id);
    // Advance the saved pointer so resume lands on the next question.
    updateSessionProgress(sessionId, index + 1, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, q, selected, mode, sessionId, index]);

  // Timer mode: auto-submit when the per-question clock runs out.
  useEffect(() => {
    if (mode === "timer" && !revealed && phase === "run" && perQuestionSeconds && perQRemaining <= 0 && elapsed > 0) {
      submit();
    }
  }, [mode, revealed, phase, perQuestionSeconds, perQRemaining, elapsed, submit]);

  // Module mode: end the session when total time expires.
  useEffect(() => {
    if (mode === "module" && phase === "run" && totalSeconds && moduleRemaining <= 0 && moduleElapsed > 0) {
      if (!revealed) submit();
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase, totalSeconds, moduleRemaining, moduleElapsed]);

  async function updateAttempt(patch: { confidence?: Confidence; miss_reason?: MissReason }) {
    if (!attemptId) return;
    await supabase.from("attempts").update(patch).eq("id", attemptId);
  }

  function pauseClock() {
    if (revealed || paused) return;
    pauseStartRef.current = Date.now();
    // Freeze the displayed time at its exact current value.
    setElapsed(Math.floor((pauseStartRef.current - startRef.current) / 1000));
    setPaused(true);
  }

  function resumeClock() {
    if (!paused) return;
    // Shift both baselines forward by the paused duration so that duration is
    // never counted toward time_spent (keeps average time per question exact).
    const delta = Date.now() - pauseStartRef.current;
    startRef.current += delta;
    moduleStartRef.current += delta;
    setPaused(false);
  }

  async function toggleFlag() {
    if (!q) return;
    const on = !flags.has(q.id);
    setFlags((prev) => {
      const next = new Set(prev);
      on ? next.add(q.id) : next.delete(q.id);
      return next;
    });
    await persistFlag(q.id, on);
  }

  async function saveNote() {
    if (!q) return;
    setNotes((prev) => new Map(prev).set(q.id, noteDraft));
    await persistNote(q.id, noteDraft);
    setNoteOpen(false);
  }

  function next() {
    if (isLast) {
      finish();
    } else {
      setIndex((i) => i + 1);
    }
  }

  async function finish() {
    await completeSession(sessionId);
    const flaggedList = questions.filter((x) => flags.has(x.id));
    setPhase(flaggedList.length ? "flagged" : "done");
  }

  const correctCount = answers.filter((a) => a.correct).length;
  const totalTime = answers.reduce((a, r) => a + r.seconds, 0);
  const answeredCount = answers.length;

  // ---- Summary / flagged review ----
  if (phase !== "run") {
    const flaggedList = questions.filter((x) => flags.has(x.id));
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-lg font-bold text-emerald-800">
            Session complete — {correctCount}/{answeredCount} correct
          </p>
          <p className="mt-1 text-sm text-emerald-700">
            {answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0}% · {fmt(totalTime)} total ·{" "}
            {answeredCount ? Math.round(totalTime / answeredCount) : 0}s avg
          </p>
        </div>

        {phase === "flagged" && flaggedList.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-amber-700">
              🚩 {flaggedList.length} flagged question{flaggedList.length === 1 ? "" : "s"} to revisit
            </p>
            <div className="space-y-3">
              {flaggedList.map((fq) => {
                const rec = answers.find((a) => a.question.id === fq.id);
                return (
                  <div key={fq.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span className={`rounded border px-1.5 py-0.5 ${DIFFICULTY_COLORS[fq.difficulty] || ""}`}>
                        {fq.difficulty}
                      </span>
                      <span className="text-slate-500">{fq.skill}</span>
                      {rec && (
                        <span className={rec.correct ? "text-emerald-600" : "text-rose-600"}>
                          {rec.correct ? "✓ correct" : "✗ missed"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700">{fq.question_text}</p>
                    <p className="mt-1 text-sm">
                      Correct answer: <span className="font-semibold text-emerald-700">{fq.correct_answer}</span>
                    </p>
                    {fq.rationale && (
                      <p className="mt-1 text-xs text-slate-500">{fq.rationale}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <a href="/review" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Review mistakes
          </a>
          <button onClick={onExit} className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!q) return null;
  const flagged = flags.has(q.id);

  // Module pacing: are we ahead of / behind the needed pace?
  let pacing: { label: string; cls: string } | null = null;
  if (mode === "module" && totalSeconds) {
    const expectedDone = (moduleElapsed / totalSeconds) * questions.length;
    const diff = answeredCount - expectedDone;
    if (diff >= 0.5) pacing = { label: `Ahead by ${Math.round(diff)}`, cls: "text-emerald-600" };
    else if (diff <= -0.5) pacing = { label: `Behind by ${Math.round(-diff)}`, cls: "text-rose-600" };
    else pacing = { label: "On pace", cls: "text-slate-500" };
  }

  // Tag gating: if enabled, require a confidence tag (and a miss-reason when the
  // answer was wrong) before allowing the move to the next question.
  const lastRec = answers[answers.length - 1];
  const answeredWrong = revealed && !!lastRec && !lastRec.correct;
  const tagsIncomplete =
    requireTags && revealed && (!confidence || (answeredWrong && !missReason));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500">
            Question {index + 1} of {questions.length}
          </span>
          {/* Difficulty is hidden until the question is answered, to avoid biasing you. */}
          {revealed && (
            <span className={`rounded border px-2 py-0.5 text-xs ${DIFFICULTY_COLORS[q.difficulty] || ""}`}>
              {q.difficulty}
            </span>
          )}
          <span className="hidden text-xs text-slate-400 sm:inline">{q.skill}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFlag}
            title="Flag to revisit"
            className={`rounded-md border px-2 py-1 text-sm ${
              flagged ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-300 text-slate-400 hover:text-slate-600"
            }`}
          >
            🚩 {flagged ? "Flagged" : "Flag"}
          </button>
          {!revealed && (
            <button
              onClick={paused ? resumeClock : pauseClock}
              title={paused ? "Resume the clock" : "Pause the clock"}
              className={`rounded-md border px-2 py-1 text-sm ${
                paused ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 text-slate-500 hover:text-slate-700"
              }`}
            >
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
          )}
          {mode === "module" ? (
            <div className="flex items-center gap-2">
              {pacing && <span className={`text-xs font-medium ${pacing.cls}`}>{pacing.label}</span>}
              <span className={`rounded-md px-3 py-1 font-mono text-lg font-semibold ${moduleRemaining <= 60 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                {fmt(moduleRemaining)}
              </span>
            </div>
          ) : (
            <span className={`rounded-md px-3 py-1 font-mono text-lg font-semibold ${mode === "timer" && perQRemaining <= 10 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
              {mode === "timer" ? fmt(perQRemaining) : fmt(elapsed)}
            </span>
          )}
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${((index + (revealed ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      {/* Question */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {paused ? (
          <div className="py-12 text-center">
            <p className="text-2xl">⏸</p>
            <p className="mt-2 text-lg font-semibold text-slate-700">Paused</p>
            <p className="mt-1 text-sm text-slate-500">
              The clock is stopped — this break won&apos;t count toward your time.
            </p>
            <button
              onClick={resumeClock}
              className="mt-4 rounded-md bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              ▶ Resume
            </button>
          </div>
        ) : (
          <>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{q.question_text}</p>

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
              } else if (isChosen) cls = "border-brand-500 bg-brand-50";
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
                  {revealed && isChosen && !isCorrect && <span className="ml-auto text-rose-600">✗</span>}
                </button>
              );
            })
          ) : (
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
                  Correct answer: <span className="font-semibold text-emerald-700">{q.correct_answer}</span>
                </p>
              )}
            </div>
          )}
        </div>
          </>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button onClick={onExit} className="text-sm text-slate-400 hover:text-slate-600">
            Save &amp; exit
          </button>
          {revealed ? (
            <div className="flex items-center gap-2">
              {tagsIncomplete && (
                <span className="text-xs text-amber-600">
                  Tag your confidence{answeredWrong ? " & reason" : ""} to continue ↓
                </span>
              )}
              <button
                onClick={next}
                disabled={tagsIncomplete}
                className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {isLast ? "Finish" : "Next question →"}
              </button>
            </div>
          ) : paused ? null : (
            <button
              onClick={submit}
              disabled={selected === null || selected === ""}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Submit
            </button>
          )}
        </div>
      </div>

      {/* Post-answer: confidence, miss-reason, note, rationale */}
      {revealed && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">How sure were you?</span>
                {(["confident", "guessed"] as Confidence[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setConfidence(c);
                      updateAttempt({ confidence: c });
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      confidence === c ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-500"
                    }`}
                  >
                    {c === "confident" ? "Confident" : "Guessed"}
                  </button>
                ))}
              </div>

              {answers[answers.length - 1] && !answers[answers.length - 1].correct && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Why missed?</span>
                  {(Object.keys(MISS_REASON_LABELS) as MissReason[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setMissReason(r);
                        updateAttempt({ miss_reason: r });
                      }}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        missReason === r ? "border-rose-400 bg-rose-50 text-rose-700" : "border-slate-300 text-slate-500"
                      }`}
                    >
                      {MISS_REASON_LABELS[r]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Note */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              {!noteOpen ? (
                <button onClick={() => setNoteOpen(true)} className="text-xs text-brand-600 hover:underline">
                  {notes.get(q.id) ? `📝 Edit note: “${notes.get(q.id)}”` : "📝 Add a note"}
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Your takeaway for this question…"
                    className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <button onClick={saveNote} className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white">
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>

          {q.rationale && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Explanation</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{q.rationale}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
