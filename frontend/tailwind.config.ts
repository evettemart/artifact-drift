import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0f17",
          subtle: "#11161f",
          panel: "#151b26",
        },
        border: {
          DEFAULT: "#1f2733",
        },
        fg: {
          DEFAULT: "#e6eaf0",
          muted: "#9aa6b6",
          subtle: "#6b7686",
        },
        brand: {
          DEFAULT: "#5b8def",
          fg: "#ffffff",
        },
        severity: {
          critical: "#ef4444",
          high: "#f97316",
          medium: "#eab308",
          low: "#22c55e",
          info: "#64748b",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
