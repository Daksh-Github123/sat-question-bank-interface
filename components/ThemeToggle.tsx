"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, storeTheme, type Theme } from "@/lib/theme";

// Cycles light → dark → system. Shows the icon for the current preference. The
// initial class is set pre-paint by THEME_INIT_SCRIPT; this just keeps React state
// in sync and reacts to OS changes while in "system" mode.
const ICON: Record<Theme, string> = { light: "☀️", dark: "🌙", system: "🖥️" };
const NEXT: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
const LABEL: Record<Theme, string> = { light: "Light", dark: "Dark", system: "System" };

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
    setMounted(true);
  }, []);

  // While in system mode, follow OS theme changes live.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    storeTheme(next);
    applyTheme(next);
  }

  // Avoid hydration mismatch: render a stable placeholder until mounted.
  if (!mounted) {
    return <span className="h-9 w-9" aria-hidden="true" />;
  }

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${LABEL[theme]}. Click to change.`}
      title={`Theme: ${LABEL[theme]}`}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-base hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
    >
      <span aria-hidden="true">{ICON[theme]}</span>
    </button>
  );
}
