"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, type AppUser } from "@/lib/user";
import { UserContext } from "@/lib/userContext";
import NavBar from "./NavBar";

/**
 * Client gate: requires a logged-in username (from localStorage) for every page
 * except /login. Provides the current user via context.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  // undefined = still reading localStorage; null = logged out
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    if (!user && pathname !== "/login") router.replace("/login");
    if (user && pathname === "/login") router.replace("/");
  }, [user, pathname, router]);

  if (user === undefined) {
    return <div className="p-8 text-sm text-slate-400">Loading…</div>;
  }

  const isLogin = pathname === "/login";
  if (!user && !isLogin) return null; // redirecting

  return (
    <UserContext.Provider value={{ user: user ?? null, setUser }}>
      {isLogin ? (
        children
      ) : (
        <>
          <NavBar />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </>
      )}
    </UserContext.Provider>
  );
}
