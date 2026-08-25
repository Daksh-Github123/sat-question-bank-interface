"use client";

import Landing from "@/components/Landing";

// The marketing homepage, reachable at any time (the Pace logo points here). Unlike
// "/", which shows the dashboard when signed in, this route always renders the Landing.
export default function MarketingHomePage() {
  return <Landing />;
}
