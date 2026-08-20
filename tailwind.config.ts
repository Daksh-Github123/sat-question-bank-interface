import type { Config } from "tailwindcss";

const config: Config = {
  // Class strategy: theme is driven by a `dark` class on <html> (see lib/theme.ts),
  // so users can pin light/dark independently of their OS setting.
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Full indigo ramp. Previously only 50/100/500/600/700 were defined, but
        // components already referenced brand-200/800 (which rendered as nothing);
        // the 200/300/400/800/900 shades below fix that. This is placeholder branding
        // — swap the whole ramp when the real palette lands.
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
