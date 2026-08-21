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
        // Brand ramp = teal ("Momentum" palette). Drives every `brand-*` class
        // app-wide (light + dark). Emerald (#10b981) is the separate "correct"
        // accent used for right answers / high accuracy.
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
