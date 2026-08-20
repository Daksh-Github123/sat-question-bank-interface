"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, type AppUser } from "@/lib/user";
import { UserContext } from "@/lib/userContext";
import NavBar from "./NavBar";
import SiteFooter from "./SiteFooter";
import BackToTop from "./BackToTop";
import ToastProvider from "./ui/ToastProvider";
import ConfirmProvider from "./ui/ConfirmDialog";

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
    return <div className="p-8 text-sm text-slate-400 dark:text-slate-500">Loading…</div>;
  }

  const isLogin = pathname === "/login";
  if (!user && !isLogin) return null; // redirecting

  return (
    <UserContext.Provider value={{ user: user ?? null, setUser }}>
      <ToastProvider>
        <ConfirmProvider>
          {isLogin ? (
            children
          ) : (
            <div className="flex min-h-screen flex-col">
              {/* Keyboard-only skip link (accessibility) */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
              >
                Skip to content
              </a>
              <NavBar />
              <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
                {children}
              </main>
              <SiteFooter />
              <BackToTop />
            </div>
          )}
        </ConfirmProvider>
      </ToastProvider>
    </UserContext.Provider>
  );
}
