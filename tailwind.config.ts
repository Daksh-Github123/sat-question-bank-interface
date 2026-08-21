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
        // Brand ramp = electric violet, anchored at #3f07e8 (the 600 step). Drives
        // every `brand-*` class app-wide (light + dark). Emerald stays the separate
        // semantic "correct" color; rose stays "wrong".
        brand: {
          50: "#f2eefe",
          100: "#e6dcfd",
          200: "#cebdfc",
          300: "#ac92fa",
          400: "#875cf6",
          500: "#6835f0",
          600: "#3f07e8",
          700: "#3506c2",
          800: "#2c0a9b",
          900: "#260d7b",
          950: "#17063f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
