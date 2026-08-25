"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setCachedUser, type AppUser } from "@/lib/user";
import { fetchProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { UserContext } from "@/lib/userContext";
import NavBar from "./NavBar";
import SiteFooter from "./SiteFooter";
import BackToTop from "./BackToTop";
import FeedbackButton from "./FeedbackButton";
import CookieBanner from "./CookieBanner";
import ToastProvider from "./ui/ToastProvider";
import ConfirmProvider from "./ui/ConfirmDialog";

// Pages that never require a session and render "bare" (no app shell).
const AUTH_PAGES = ["/login", "/forgot", "/reset", "/signup", "/check-email"];

/**
 * Client gate. A Supabase Auth session is required for every page except the
 * auth pages (login / signup / forgot / reset) and the logged-out landing at "/".
 * Loads the linked profile and provides it via context, caching it so
 * currentUserId() stays synchronous elsewhere.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  // undefined = still resolving session; null = signed out
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function apply(session: { user: { id: string } } | null) {
      if (!session) {
        setCachedUser(null);
        if (active) setUser(null);
        return;
      }
      const profile = await fetchProfile(session.user.id);
      setCachedUser(profile);
      if (active) setUser(profile);
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAuthPage = AUTH_PAGES.includes(pathname);
  // Logged-out visitors may see the landing at "/"; logged-in "/" shows the dashboard.
  const isLanding = pathname === "/" && !user;
  const bare = isAuthPage || isLanding;

  useEffect(() => {
    if (user === undefined) return;
    // Protected page without a session → login (the landing at "/" is public).
    if (!user && !isAuthPage && pathname !== "/") router.replace("/login");
    // Signed in but sitting on an auth page → home.
    if (user && isAuthPage) router.replace("/");
  }, [user, pathname, isAuthPage, router]);

  if (user === undefined) {
    return <div className="p-8 text-sm text-slate-400 dark:text-slate-500">Loading…</div>;
  }

  if (!user && !isAuthPage && pathname !== "/") return null; // redirecting

  return (
    <UserContext.Provider value={{ user: user ?? null, setUser }}>
      <ToastProvider>
        <ConfirmProvider>
          {bare ? (
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
              <FeedbackButton />
              <CookieBanner />
            </div>
          )}
        </ConfirmProvider>
      </ToastProvider>
    </UserContext.Provider>
  );
}
