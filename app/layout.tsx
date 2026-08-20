import type { Metadata } from "next";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { APP_NAME, APP_TAGLINE } from "@/lib/appMeta";

export const metadata: Metadata = {
  title: APP_NAME,
  description: `${APP_TAGLINE} — practice SAT questions by topic, track time and stats.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set the theme class before first paint to avoid a flash of light mode. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
