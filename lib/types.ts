export type Difficulty = "Easy" | "Medium" | "Hard";

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
  created_at: string;
}
