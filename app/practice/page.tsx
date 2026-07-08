"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Question } from "@/lib/types";
import PracticeSetup, { PracticeConfig } from "@/components/PracticeSetup";
import PracticeSession from "@/components/PracticeSession";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PracticePage() {
  const [phase, setPhase] = useState<"setup" | "loading" | "active">("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [config, setConfig] = useState<PracticeConfig | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");

  async function start(cfg: PracticeConfig) {
    setPhase("loading");
    setError("");
    let query = supabase.from("questions").select("*").in("difficulty", cfg.difficulties);
    if (cfg.skills.length > 0) query = query.in("skill", cfg.skills);

    const { data, error } = await query.limit(2000);
    if (error) {
      setError(error.message);
      setPhase("setup");
      return;
    }
    let rows = (data as Question[]) || [];
    rows = cfg.order === "random" ? shuffle(rows) : rows;
    rows = rows.slice(0, cfg.count);

    if (rows.length === 0) {
      setError("No questions matched those filters.");
      setPhase("setup");
      return;
    }

    setQuestions(rows);
    setConfig(cfg);
    setSessionId(crypto.randomUUID());
    setPhase("active");
  }

  if (phase === "loading") {
    return <p className="text-sm text-slate-500">Loading questions…</p>;
  }

  if (phase === "active" && config) {
    return (
      <PracticeSession
        questions={questions}
        mode={config.mode}
        secondsPerQuestion={config.secondsPerQuestion}
        sessionId={sessionId}
        onExit={() => setPhase("setup")}
      />
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}
      <PracticeSetup onStart={start} />
    </div>
  );
}
