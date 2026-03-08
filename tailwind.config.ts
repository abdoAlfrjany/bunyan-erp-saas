// tailwind.config.ts
// الوظيفة: إعداد Tailwind CSS مع ألوان Bunyan البنفسجية + دعم RTL
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md — نظام الألوان الكامل

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ═══ Bunyan Brand Colors ═══
        bunyan: {
          50:  "rgb(var(--color-bunyan-50) / <alpha-value>)",
          100: "rgb(var(--color-bunyan-100) / <alpha-value>)",
          200: "rgb(var(--color-bunyan-200) / <alpha-value>)",
          300: "rgb(var(--color-bunyan-300) / <alpha-value>)",
          400: "rgb(var(--color-bunyan-400) / <alpha-value>)",
          500: "rgb(var(--color-bunyan-500) / <alpha-value>)",
          600: "rgb(var(--color-bunyan-600) / <alpha-value>)",
          700: "rgb(var(--color-bunyan-700) / <alpha-value>)",
          800: "rgb(var(--color-bunyan-800) / <alpha-value>)",
          900: "rgb(var(--color-bunyan-900) / <alpha-value>)",
        },
        sidebar: {
          bg: "#3a1a5a",
          hover: "#4a2570",
          active: "#4a2570",
          text: "#e8e0f0",
          icon: "#c9b8d9",
          divider: "#2a1045",
        },
        page: {
          bg: "#f5f3f8",
          card: "#ffffff",
          border: "#e8e0f0",
        },
        text: {
          primary: "#1a0830",
          secondary: "#2a1045",
          body: "#3a1a5a",
          muted: "#6b4090",
          disabled: "#a98fc0",
        },
        status: {
          success: { text: "#14532d", bg: "#dcfce7", border: "#86efac" },
          warning: { text: "#92400e", bg: "#fef3c7", border: "#fcd34d" },
          danger:  { text: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
          info:    { text: "#1e3a8a", bg: "#dbeafe", border: "#93c5fd" },
          neutral: { text: "#1f2937", bg: "#f3f4f6", border: "#d1d5db" },
          pending: { text: "#7c2d12", bg: "#fff7ed", border: "#fed7aa" },
        },
      },
      fontFamily: {
        sans: ["Cairo", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      width: {
        sidebar: "260px",
      },
      maxWidth: {
        content: "1400px",
      },
      spacing: {
        "page-padding": "24px",
        "page-padding-mobile": "16px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.05)",
        "card-hover": "0 4px 12px 0 rgb(74 37 112 / 0.1)",
      },
      borderRadius: {
        card: "1rem",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleUp: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "scale-up": "scaleUp 0.2s ease-out",
        "pulse-slow": "pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
