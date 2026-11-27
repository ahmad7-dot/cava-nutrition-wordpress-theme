import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#08090D", 900: "#0C0E14", 850: "#11141B", 800: "#161A23", 700: "#1F2430", 600: "#2A3040" },
        haze: { 500: "#6B7280", 400: "#8B93A5", 300: "#B4BBCB", 100: "#E8EBF2" },
        accent: { DEFAULT: "#8B7CF6", soft: "#8B7CF61F", strong: "#A497FF" },
        mint: "#34D399",
        amber: "#FBBF24",
        rose: "#FB7185",
      },
      fontFamily: { sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"] },
      boxShadow: { glow: "0 0 0 1px #8B7CF633, 0 8px 30px -10px #8B7CF655" },
    },
  },
  plugins: [],
} satisfies Config;
