"use client";

// Theme preference, persisted in localStorage following the same KEY + get/set
// convention as lib/user.ts. "system" follows the OS setting; "light"/"dark" pin it.
export type Theme = "light" | "dark" | "system";

const KEY = "sat_theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const s = localStorage.getItem(KEY);
  return s === "light" || s === "dark" ? s : "system";
}

export function storeTheme(t: Theme) {
  if (t === "system") localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, t);
}

// Resolve a preference to the actual light/dark that should render right now.
export function resolveTheme(t: Theme): "light" | "dark" {
  if (t === "dark" || t === "light") return t;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Apply the resolved theme by toggling the `dark` class on <html> (Tailwind's
// class strategy) and keeping color-scheme in sync for native form controls.
export function applyTheme(t: Theme) {
  const resolved = resolveTheme(t);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

// Inline script (stringified) run before first paint in <head> to set the class
// synchronously and avoid a flash of the wrong theme on load.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
