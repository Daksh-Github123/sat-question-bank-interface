"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/userContext";
import { clearCurrentUser } from "@/lib/user";
import { APP_NAME } from "@/lib/appMeta";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";

// Primary daily-use tabs. Less-used areas (Browse, Reports, Import, Admin) and
// Session History live on the "More" hub page to keep the top bar uncluttered.
const baseLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/practice", label: "Practice" },
  { href: "/review", label: "Review" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/more", label: "More" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [term, setTerm] = useState("");

  const links = baseLinks;

  function logout() {
    clearCurrentUser();
    setUser(null);
    router.replace("/login");
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    router.push(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse");
    setMenuOpen(false);
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const linkClass = (href: string) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive(href)
        ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden dark:border-slate-800 dark:bg-slate-900/95">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
        <Link href="/" className="mr-2 flex items-center gap-1.5 text-lg font-bold text-brand-600 dark:text-brand-300">
          <Logo size={22} />
          {APP_NAME}
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Desktop search */}
          <form onSubmit={submitSearch} className="hidden md:block">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search bank…"
              aria-label="Search question bank"
              className="w-40 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none lg:w-56 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </form>

          <ThemeToggle />

          {/* Desktop user + logout */}
          {user && (
            <div className="hidden items-center gap-3 md:flex">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Hi, <span className="font-medium text-slate-700 dark:text-slate-200">{user.display_name}</span>
              </span>
              <button
                onClick={logout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Log out
              </button>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 md:hidden dark:border-slate-600 dark:text-slate-300"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={submitSearch} className="mb-3">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search bank…"
              aria-label="Search question bank"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </form>
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
          </div>
          {user && (
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Hi, <span className="font-medium text-slate-700 dark:text-slate-200">{user.display_name}</span>
              </span>
              <button
                onClick={logout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
