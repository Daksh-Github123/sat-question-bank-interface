"use client";

import { useUser } from "@/lib/userContext";
import Dashboard from "@/components/Dashboard";
import Landing from "@/components/Landing";

// Root route: the marketing landing page for logged-out visitors, the practice
// dashboard once signed in. AuthGate renders the landing "bare" (no app shell)
// and the dashboard inside the normal app chrome.
export default function HomePage() {
  const { user } = useUser();
  return user ? <Dashboard /> : <Landing />;
}
