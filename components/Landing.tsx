"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { APP_NAME, APP_TAGLINE } from "@/lib/appMeta";
import Logo from "./Logo";
import Reveal from "./Reveal";

interface Stats {
  questions: number;
  skills: number;
  sections: string[];
}

const FEATURES = [
  {
    emoji: "📘",
    title: "Real, official questions",
    body: "Every question is a genuine released item — not AI-generated filler. Practice on what the test actually looks like.",
  },
  {
    emoji: "🎯",
    title: "Targeted practice",
    body: "Filter by skill, difficulty, and status. Drill the exact topics you're weakest on instead of guessing.",
  },
  {
    emoji: "🔁",
    title: "Smart spaced review",
    body: "Missed questions come back on a schedule so corrections stick. Redo a mistake correctly and your accuracy updates.",
  },
  {
    emoji: "📊",
    title: "Real analytics",
    body: "Per-skill accuracy, time-per-question, coverage, and trends — see what's improving and what needs attention.",
  },
  {
    emoji: "🖊",
    title: "Vocabulary builder",
    body: "Highlight any word while reviewing to save it, with definitions looked up automatically. Export anytime.",
  },
  {
    emoji: "🏆",
    title: "Leaderboard",
    body: "See how you rank on accuracy, volume, and time — a little friendly pressure to keep the streak going.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Practice",
    body: "Pick topics, difficulty, and a timing mode, then work through real questions at your own pace.",
  },
  {
    n: "2",
    title: "Correct your mistakes",
    body: "Review every miss with full explanations. Spaced review brings them back until they're second nature.",
  },
  {
    n: "3",
    title: "Watch your stats climb",
    body: "Accuracy, coverage, and trends update live so you always know exactly where you stand.",
  },
];

export default function Landing() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    supabase
      .rpc("public_stats")
      .then(({ data }) => {
        if (data) setStats(data as Stats);
      });
  }, []);

  const sectionsLabel = stats?.sections?.length
    ? stats.sections.join(" · ")
    : "Reading and Writing";

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-1.5 text-lg font-bold text-brand-600 dark:text-brand-300">
            <Logo size={24} />
            {APP_NAME}
          </Link>
          <nav className="ml-6 hidden items-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-300 sm:flex">
            <a href="#features" className="hover:text-brand-600 dark:hover:text-brand-300">Features</a>
            <a href="#how" className="hover:text-brand-600 dark:hover:text-brand-300">How it works</a>
            <a href="#mission" className="hover:text-brand-600 dark:hover:text-brand-300">Why Pace</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="hover-lift rounded-md bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="animate-blob absolute left-1/4 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-400/25 blur-3xl" />
          <div
            className="animate-blob absolute right-1/4 top-24 h-80 w-80 translate-x-1/2 rounded-full bg-fuchsia-400/20 blur-3xl"
            style={{ animationDelay: "-6s" }}
          />
          <div
            className="animate-blob absolute left-1/2 top-40 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-600/15 blur-3xl"
            style={{ animationDelay: "-12s" }}
          />
        </div>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:py-32">
          <Reveal>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
              {APP_TAGLINE}
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              Master the SAT with{" "}
              <span className="text-brand-600 dark:text-brand-300">real, official</span> questions
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-lg text-slate-600 dark:text-slate-300">
              {APP_NAME} is a practice platform built on genuine released questions — with targeted
              drilling, spaced review, and analytics that show you exactly what to work on next.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="hover-lift rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
              >
                Get started — it&apos;s free
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-slate-300 px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Sign in
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Mission */}
      <section id="mission" className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Reveal>
            <h2 className="text-2xl font-bold sm:text-3xl">Why {APP_NAME} exists</h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Prep companies increasingly flood their banks with fake, AI-generated questions that
              don&apos;t reflect the real exam — so students practice on problems that will never
              appear. {APP_NAME} takes the opposite approach: <strong className="text-slate-800 dark:text-slate-100">only
              real, released official questions</strong>, so every minute you spend here is minutes
              spent on the actual test.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <Reveal>
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Everything you need to improve</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="hover-lift h-full rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-3xl">{f.emoji}</div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <Reveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="hover-lift h-full rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                    {s.n}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <Reveal>
          <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
            <div>
              <div className="text-4xl font-extrabold text-brand-600 dark:text-brand-300">
                {stats ? stats.questions.toLocaleString() : "—"}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">official questions</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-brand-600 dark:text-brand-300">
                {stats ? stats.skills : "—"}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">skills covered</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-brand-600 dark:text-brand-300">{sectionsLabel}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">and growing</div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Reveal>
            <h2 className="text-3xl font-bold sm:text-4xl">Ready to practice smarter?</h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="mx-auto mt-4 max-w-lg text-lg text-slate-600 dark:text-slate-300">
              Create a free account and start working through real questions in minutes.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <Link
              href="/signup"
              className="hover-lift mt-8 inline-block rounded-lg bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
            >
              Get started
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-semibold text-brand-600 dark:text-brand-300">
            <Logo size={18} />
            {APP_NAME}
          </div>
          <div className="flex items-center gap-5">
            <Link href="/faq" className="hover:text-brand-600 dark:hover:text-brand-300">FAQ</Link>
            <Link href="/privacy" className="hover:text-brand-600 dark:hover:text-brand-300">Privacy</Link>
            <Link href="/login" className="hover:text-brand-600 dark:hover:text-brand-300">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
