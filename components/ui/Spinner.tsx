"use client";

// Small reusable loading spinner. Replaces the app's plain "Loading…" / "Saving…"
// text loaders. Inherits the current text color (`currentColor`) so it adapts to
// wherever it's placed — a muted page shell, a white button, etc.
export default function Spinner({
  size = 20,
  className = "",
  label,
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <svg
        className="animate-spin"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-90"
          d="M22 12a10 10 0 0 1-10 10"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      {label && <span>{label}</span>}
    </span>
  );
}

// Full-height page-shell loader used while a route loads its data. Standardizes the
// scattered "Loading your statistics…" / "Loading question bank…" text blocks.
export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-slate-400 dark:text-slate-500">
      <Spinner label={label} />
    </div>
  );
}
