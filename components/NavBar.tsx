"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/userContext";
import { clearCurrentUser } from "@/lib/user";

const baseLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/practice", label: "Practice" },
  { href: "/review", label: "Review" },
  { href: "/browse", label: "Browse" },
  { href: "/reports", label: "Reports" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useUser();

  const links = [...baseLinks];
  if (user?.is_admin) {
    links.push({ href: "/import", label: "Import" });
    links.push({ href: "/admin", label: "Admin" });
  }

  function logout() {
    clearCurrentUser();
    setUser(null);
    router.replace("/login");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-3">
        <Link href="/" className="mr-4 text-lg font-bold text-brand-600">
          SAT Bank
        </Link>
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-3">
          {user && (
            <>
              <span className="text-sm text-slate-500">
                Hi, <span className="font-medium text-slate-700">{user.display_name}</span>
              </span>
              <button onClick={logout} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Log out
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
