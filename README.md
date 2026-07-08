# SAT Question Bank Interface

A simple, functional web app for practicing SAT questions by topic, tracking time
per question, and viewing your performance statistics. Built with **Next.js**,
**Supabase** (database), and deployed on **Vercel**.

## Features

- **Import PDFs** — Drop the exported question-bank PDFs (one topic at a time or
  several at once). They're parsed entirely in your browser and saved to Supabase.
  Re-importing the same questions updates them instead of creating duplicates
  (deduped by the question's ID).
- **Practice** — Pick any combination of tests, domains, skills, and difficulties
  (e.g. "mixed-difficulty Transitions only"), choose how many questions, and
  practice with either a **stopwatch** (counts up) or a per-question **timer**
  (counts down and auto-submits). Every question's time is recorded.
- **Dashboard** — Overall accuracy, accuracy by difficulty, by domain, and a
  per-skill table, plus total time and average time per question.
- **Browse** — Search and review every question in your bank with answers and
  explanations.

## SAT taxonomy

The full official Digital SAT taxonomy (Test → Domain → Skill) is encoded in
`lib/taxonomy.ts` and drives the practice filters:

- **Reading and Writing**: Information and Ideas · Craft and Structure ·
  Expression of Ideas · Standard English Conventions
- **Math**: Algebra · Advanced Math · Problem-Solving and Data Analysis ·
  Geometry and Trigonometry

The importer reads the Test / Domain / Skill / Difficulty straight from each PDF,
so any topic export drops into the right place automatically.

## Local development

```bash
npm install          # also copies the pdf.js worker into /public
npm run dev          # http://localhost:3000
```

Environment variables (optional — sensible public defaults are baked in):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

See `.env.example`.

## Data model (Supabase)

- `questions` — one row per question (id, taxonomy, text, choices JSON, correct
  answer, rationale).
- `attempts` — one row per answered question (correctness, time spent, mode,
  session id) used to build the statistics.

## Security note

This is set up as a **single-user personal tool** with no login: the tables use
permissive row-level-security policies so the public (anon) key can read and
write. If you ever want to lock it down or share it, add Supabase Auth and
restrict the policies to the signed-in user.
