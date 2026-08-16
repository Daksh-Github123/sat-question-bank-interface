"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Question, PracticeMode, Confidence, MissReason } from "@/lib/types";
import { MISS_REASON_LABELS } from "@/lib/types";
import { DIFFICULTY_COLORS } from "@/lib/taxonomy";
import { updateSessionProgress, completeSession, saveSessionActive } from "@/lib/practice";
import { getQuestionStates, setFlag as persistFlag, setNote as persistNote } from "@/lib/questionState";
import { currentUserId } from "@/lib/user";
import { isAnswerCorrect } from "@/lib/answerCheck";
import { saveTerm, sentenceFor } from "@/lib/vocab";
import { reportQuestion } from "@/lib/reports";
import { lookup as dictionaryLookup } from "@/lib/dictionary";
import VocabCapture from "./VocabCapture";
import QuestionText from "./QuestionText";

interface Props {
  questions: Question[];
  mode: PracticeMode;
  perQuestionSeconds: number | null;
  totalSeconds: number | null;
  sessionId: string;
  startIndex?: number;
  startElapsed?: number;
  startActiveSeconds?: number;
  requireTags?: boolean;
  onExit: () => void;
}

const HIDE_SESSION_TIMER_KEY = "sat_hide_session_timer";

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
  startActiveSeconds = 0,
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
  // Crossed-out MCQ options (local elimination aid, reset per question).
  const [crossed, setCrossed] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  // Report-an-issue panel (per question).
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [phase, setPhase] = useState<"run" | "flagged" | "done" | "review">("run");
  // Module review: index into the questions while replaying answers, and the
  // summary phase to return to when review is finished.
  const [reviewIndex, setReviewIndex] = useState(0);
  const [returnPhase, setReturnPhase] = useState<"flagged" | "done">("done");

  // Per-question clock baseline (accounts for resumed partial time).
  const startRef = useRef<number>(Date.now() - startElapsed * 1000);
  // Module-mode total countdown baseline.
  const moduleStartRef = useRef<number>(Date.now());
  const [moduleElapsed, setModuleElapsed] = useState(0);
  // Pause: freezes all clocks; paused time is excluded from recorded time.
  const [paused, setPaused] = useState(false);
  const pauseStartRef = useRef<number>(0);

  // Whole-session clock: total time the session is actively running (unlike the
  // per-question clock, it keeps counting while you review/correct answers). Only
  // paused breaks are excluded. It can be hidden, and its display is deliberately
  // separate from the per-question / module timer.
  const sessionBaseRef = useRef<number>(Date.now() - startActiveSeconds * 1000);
  const [sessionSeconds, setSessionSeconds] = useState(startActiveSeconds);
  const [hideSessionTimer, setHideSessionTimer] = useState(false);
  useEffect(() => {
    setHideSessionTimer(localStorage.getItem(HIDE_SESSION_TIMER_KEY) === "1");
  }, []);
  function toggleHideSessionTimer(hide: boolean) {
    setHideSessionTimer(hide);
    localStorage.setItem(HIDE_SESSION_TIMER_KEY, hide ? "1" : "0");
  }
  // Current session seconds (live unless paused, in which case it's frozen).
  const currentActive = () =>
    paused ? sessionSeconds : Math.floor((Date.now() - sessionBaseRef.current) / 1000);
  const persistActive = useCallback(() => {
    saveSessionActive(sessionId, paused ? sessionSeconds : Math.floor((Date.now() - sessionBaseRef.current) / 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, paused, sessionSeconds]);

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
    setCrossed(new Set());
    setAttemptId(null);
    setConfidence(null);
    setMissReason(null);
    setNoteOpen(false);
    setNoteDraft(q ? notes.get(q.id) || "" : "");
    setReportOpen(false);
    setReportText("");
    setReportSent(false);
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

  // Whole-session clock: tick while the session is actively running (answering OR
  // reviewing), pausing only on an explicit break. Persist it periodically so the
  // total survives a resume.
  useEffect(() => {
    if (paused || (phase !== "run" && phase !== "review")) return;
    const tick = setInterval(() => {
      setSessionSeconds(Math.floor((Date.now() - sessionBaseRef.current) / 1000));
    }, 500);
    const save = setInterval(() => {
      saveSessionActive(sessionId, Math.floor((Date.now() - sessionBaseRef.current) / 1000));
    }, 10000);
    return () => {
      clearInterval(tick);
      clearInterval(save);
    };
  }, [paused, phase, sessionId]);

  const perQRemaining =
    mode === "timer" && perQuestionSeconds ? Math.max(0, perQuestionSeconds - elapsed) : 0;
  const moduleRemaining =
    mode === "module" && totalSeconds ? Math.max(0, totalSeconds - moduleElapsed) : 0;

  // Record the current answer (no UI change). Captures the attempt id so
  // confidence / miss-reason can update it later.
  const recordAttempt = useCallback(async () => {
    if (!q) return;
    const spent = Math.floor((Date.now() - startRef.current) / 1000);
    const correct = isAnswerCorrect(selected, q);
    setAnswers((prev) => [...prev, { question: q, selected, correct, seconds: spent }]);
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
    updateSessionProgress(sessionId, index + 1, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, selected, mode, sessionId, index]);

  // Standard modes: record and reveal the answer for immediate review.
  const submit = useCallback(async () => {
    if (revealed || !q) return;
    setRevealed(true);
    await recordAttempt();
  }, [revealed, q, recordAttempt]);

  // Module mode: record silently and move straight on — no per-question feedback.
  // The whole module is reviewed at the end.
  async function moduleAdvance() {
    if (!q || selected === null || selected === "") return;
    await recordAttempt();
    next();
  }

  // Save a highlighted term to the vocabulary bank: look up a definition and use
  // the dictionary's example, or fall back to the sentence it appeared in.
  // Toggle an option's crossed-out state; clear the selection if we cross the
  // option that was currently picked.
  function toggleCross(letter: string) {
    setCrossed((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
    if (selected === letter) setSelected(null);
  }

  async function addVocab(question: Question, term: string) {
    const { definition, example } = await dictionaryLookup(term);
    const sentence = example ?? sentenceFor(question.question_text, term);
    await saveTerm({ term, definition, example: sentence, sourceQuestionUid: question.id });
  }

  // Timer mode: auto-submit when the per-question clock runs out.
  useEffect(() => {
    if (mode === "timer" && !revealed && phase === "run" && perQuestionSeconds && perQRemaining <= 0 && elapsed > 0) {
      submit();
    }
  }, [mode, revealed, phase, perQuestionSeconds, perQRemaining, elapsed, submit]);

  // Module mode: end the session when total time expires (record the current
  // answer if one is selected, but do not reveal — review happens at the end).
  useEffect(() => {
    if (mode === "module" && phase === "run" && totalSeconds && moduleRemaining <= 0 && moduleElapsed > 0) {
      (async () => {
        if (selected !== null && selected !== "") await recordAttempt();
        finish();
      })();
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
    // Shift all baselines forward by the paused duration so that duration is
    // never counted toward time_spent (keeps average time per question exact) or
    // toward the whole-session clock.
    const delta = Date.now() - pauseStartRef.current;
    startRef.current += delta;
    moduleStartRef.current += delta;
    sessionBaseRef.current += delta;
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

  async function submitReport() {
    if (!q || !reportText.trim()) return;
    await reportQuestion(q.id, reportText.trim());
    setReportSent(true);
    setReportText("");
    setTimeout(() => {
      setReportOpen(false);
      setReportSent(false);
    }, 1600);
  }

  function next() {
    if (isLast) {
      finish();
    } else {
      setIndex((i) => i + 1);
    }
  }

  async function finish() {
    await saveSessionActive(sessionId, currentActive());
    await completeSession(sessionId);
    const flaggedList = questions.filter((x) => flags.has(x.id));
    const kind = flaggedList.length ? "flagged" : "done";
    setReturnPhase(kind);
    setPhase(kind);
  }

  // Save the whole-session time before leaving so it isn't lost on exit.
  function handleExit() {
    persistActive();
    onExit();
  }

  // A small, hideable readout of the whole-session clock, kept visually separate
  // from the per-question / module timer.
  const sessionTimerBar = (
    <div>
      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
        <span>⏱ Session total</span>
        {hideSessionTimer ? (
          <button
            onClick={() => toggleHideSessionTimer(false)}
            className="font-medium text-slate-400 hover:text-slate-600"
          >
            show
          </button>
        ) : (
          <>
            <span className="font-mono text-sm font-semibold text-slate-700">{fmt(sessionSeconds)}</span>
            <button
              onClick={() => toggleHideSessionTimer(true)}
              title="Hide the session timer"
              aria-label="Hide the session timer"
              className="text-slate-400 hover:text-slate-600"
            >
              🙈
            </button>
          </>
        )}
      </span>
    </div>
  );

  const correctCount = answers.filter((a) => a.correct).length;
  const totalTime = answers.reduce((a, r) => a + r.seconds, 0);
  const answeredCount = answers.length;

  // ---- Module review: replay each question with the recorded answer shown ----
  if (phase === "review") {
    const rq = questions[reviewIndex];
    const rec = answers.find((a) => a.question.id === rq.id);
    const sel = rec?.selected ?? null;
    return (
      <div className="space-y-5">
        {sessionTimerBar}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">
              Reviewing {reviewIndex + 1} of {questions.length}
            </span>
            <span className={`rounded border px-2 py-0.5 text-xs ${DIFFICULTY_COLORS[rq.difficulty] || ""}`}>
              {rq.difficulty}
            </span>
            <span className="hidden text-xs text-slate-400 sm:inline">{rq.skill}</span>
          </div>
          {rec && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                rec.correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {rec.correct ? "✓ Correct" : "✗ Missed"}
            </span>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <VocabCapture enabled onSave={(t) => addVocab(rq, t)}>
            {rq.graph_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rq.graph_url} alt="Question graphic" className="mb-4 max-w-full rounded-lg border border-slate-200" />
            )}
            <QuestionText text={rq.question_text} underlineSpans={rq.underline_spans} className="text-[15px] leading-relaxed text-slate-800" />
            <div className="mt-5 space-y-2">
              {rq.choices ? (
                rq.choices.map((c) => {
                  const isCorrect = c.letter === rq.correct_answer;
                  const isChosen = c.letter === sel;
                  let cls = "border-slate-200 opacity-70";
                  if (isCorrect) cls = "border-emerald-400 bg-emerald-50";
                  else if (isChosen) cls = "border-rose-400 bg-rose-50";
                  return (
                    <div key={c.letter} className={`flex items-start gap-3 rounded-lg border p-3 text-sm select-text ${cls}`}>
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-semibold">
                        {c.letter}
                      </span>
                      <span className="select-text text-slate-700">{c.text}</span>
                      {isCorrect && <span className="ml-auto text-emerald-600">✓</span>}
                      {isChosen && !isCorrect && <span className="ml-auto text-rose-600">✗</span>}
                    </div>
                  );
                })
              ) : (
                <div className="space-y-1 text-sm">
                  <p>
                    Your answer:{" "}
                    <span className={`font-semibold ${rec?.correct ? "text-emerald-700" : "text-rose-700"}`}>{sel || "—"}</span>
                  </p>
                  <p>
                    Correct answer: <span className="font-semibold text-emerald-700">{rq.correct_answer}</span>
                  </p>
                </div>
              )}
            </div>
          </VocabCapture>
          {rq.rationale && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Explanation</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{rq.rationale}</p>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Tip: highlight any word or phrase to save it to your vocabulary.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => setPhase(returnPhase)} className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to summary
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
              disabled={reviewIndex === 0}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              onClick={() => setReviewIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={reviewIndex === questions.length - 1}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    );
  }

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

        {mode === "module" && answeredCount > 0 && (
          <div className="text-center">
            <button
              onClick={() => {
                setReviewIndex(0);
                setPhase("review");
              }}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              🔁 Review my answers
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Go through every question with your answers, the correct answers, and explanations — and save vocabulary.
            </p>
          </div>
        )}

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
          <button onClick={handleExit} className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
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
      {sessionTimerBar}
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
            onClick={() => setReportOpen((v) => !v)}
            title="Report an issue with this question"
            aria-label="Report an issue with this question"
            className={`rounded-md border px-2 py-1 text-sm ${
              reportOpen ? "border-rose-300 bg-rose-50 text-rose-600" : "border-slate-300 text-slate-400 hover:text-slate-600"
            }`}
          >
            ⚠
          </button>
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

      {reportOpen && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
          {reportSent ? (
            <p className="text-sm font-medium text-rose-700">Thanks — your report was submitted. ✓</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-semibold text-rose-700">Report an issue with this question</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {["Wrong answer key", "Typo or formatting", "Missing/incorrect graphic", "Confusing wording"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setReportText((t) => (t.trim() ? t : c))}
                    className="rounded-full border border-rose-200 bg-white px-2.5 py-0.5 text-xs text-rose-600 hover:bg-rose-100"
                  >
                    {c}
                  </button>
                ))}
              </div>
              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="What's wrong with this question?"
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setReportOpen(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReport}
                  disabled={!reportText.trim()}
                  className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Submit report
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
          <VocabCapture enabled={revealed} onSave={(t) => addVocab(q, t)}>
        {q.graph_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={q.graph_url}
            alt="Question graphic"
            className="mb-4 max-w-full rounded-lg border border-slate-200"
          />
        )}
        <QuestionText text={q.question_text} underlineSpans={q.underline_spans} className="text-[15px] leading-relaxed text-slate-800" />

        <div className="mt-5 space-y-2">
          {q.choices ? (
            q.choices.map((c) => {
              const isCorrect = c.letter === q.correct_answer;
              const isChosen = c.letter === selected;
              const isCrossed = crossed.has(c.letter);
              const dim = isCrossed && !revealed;
              let cls = "border-slate-200 hover:border-brand-400";
              if (revealed) {
                if (isCorrect) cls = "border-emerald-400 bg-emerald-50";
                else if (isChosen) cls = "border-rose-400 bg-rose-50";
                else cls = "border-slate-200 opacity-70";
              } else if (isChosen) cls = "border-brand-500 bg-brand-50";
              return (
                <div
                  key={c.letter}
                  className={`flex items-stretch rounded-lg border text-sm transition-colors ${cls}`}
                >
                  {revealed ? (
                    // After answering: a plain, text-selectable row so option words
                    // can be highlighted and saved to the vocabulary bank.
                    <div className="flex flex-1 items-start gap-3 p-3 text-left select-text">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-semibold">
                        {c.letter}
                      </span>
                      <span className="select-text text-slate-700">{c.text}</span>
                      {isCorrect && <span className="ml-auto text-emerald-600">✓</span>}
                      {isChosen && !isCorrect && <span className="ml-auto text-rose-600">✗</span>}
                    </div>
                  ) : (
                    <>
                      <button
                        disabled={isCrossed}
                        onClick={() => setSelected(c.letter)}
                        className="flex flex-1 items-start gap-3 p-3 text-left disabled:cursor-default"
                      >
                        <span
                          className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-semibold ${dim ? "opacity-40" : ""}`}
                        >
                          {c.letter}
                        </span>
                        <span className={`text-slate-700 ${dim ? "line-through opacity-40" : ""}`}>{c.text}</span>
                      </button>
                      <button
                        onClick={() => toggleCross(c.letter)}
                        title={isCrossed ? "Undo cross out" : "Cross out this option"}
                        aria-label={isCrossed ? `Undo cross out ${c.letter}` : `Cross out ${c.letter}`}
                        className="flex-none border-l border-slate-200 px-3 text-xs font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      >
                        {isCrossed ? "undo" : <span className="line-through">{c.letter}</span>}
                      </button>
                    </>
                  )}
                </div>
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
          </VocabCapture>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button onClick={handleExit} className="text-sm text-slate-400 hover:text-slate-600">
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
          ) : paused ? null : mode === "module" ? (
            <button
              onClick={moduleAdvance}
              disabled={selected === null || selected === ""}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isLast ? "Finish module" : "Next question →"}
            </button>
          ) : (
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
          <p className="text-xs text-slate-400">
            Tip: highlight any word or phrase in the question above to save it to your vocabulary.
          </p>
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
