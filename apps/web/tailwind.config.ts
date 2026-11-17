import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#1a1a1a",
        panel: "#111111",
        frame: "#000000",
        line: "rgba(255,255,255,0.10)",
        accent: "#FF3B3B",
        accentink: "#d22412",
        ink: "#f2f2f2",
        muted: "#9aa0a6",
      },
      fontFamily: {
        display: ['var(--font-display)', "Arial Narrow", "sans-serif"],
        body: ['var(--font-body)', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
