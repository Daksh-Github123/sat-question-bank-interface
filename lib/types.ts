export type Difficulty = "Easy" | "Medium" | "Hard";
export type Confidence = "confident" | "guessed";
export type MissReason = "concept" | "careless" | "time" | "misread";
export type PracticeMode = "stopwatch" | "timer" | "module";

export interface Choice {
  letter: string;
  text: string;
}

export interface Question {
  id: string;
  question_id: string;
  test: string;
  domain: string;
  skill: string;
  difficulty: string;
  question_text: string;
  choices: Choice[] | null;
  correct_answer: string;
  rationale: string | null;
  source_file: string | null;
  created_at: string;
}

/** Shape produced by the PDF parser before insertion (no db id yet). */
export interface ParsedQuestion {
  question_id: string;
  test: string;
  domain: string;
  skill: string;
  difficulty: string;
  question_text: string;
  choices: Choice[] | null;
  correct_answer: string;
  rationale: string;
  source_file?: string;
}

export interface Attempt {
  id: string;
  question_uid: string;
  selected_answer: string | null;
  is_correct: boolean;
  time_spent_seconds: number;
  mode: string;
  session_id: string | null;
  confidence: Confidence | null;
  miss_reason: MissReason | null;
  created_at: string;
}

export interface QuestionState {
  question_uid: string;
  flagged: boolean;
  note: string | null;
  updated_at: string;
}

export interface PracticeSessionConfig {
  skills: string[];
  difficulties: string[];
  count: number;
  order: "random" | "sequential";
  mix: "balanced" | "test-like";
  focus: "even" | "weak";
  includeReview: boolean;
}

export interface PracticeSessionRow {
  id: string;
  config: PracticeSessionConfig;
  question_ids: string[];
  mode: PracticeMode;
  per_question_seconds: number | null;
  total_seconds: number | null;
  current_index: number;
  current_elapsed_seconds: number;
  status: "active" | "completed";
  created_at: string;
  updated_at: string;
}

export const MISS_REASON_LABELS: Record<MissReason, string> = {
  concept: "Didn't know the concept",
  careless: "Careless mistake",
  time: "Ran out of time",
  misread: "Misread the question",
};
