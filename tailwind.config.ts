import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 2026 оны трэнд өнгөний хослол
        mocha: {
          50: "#faf7f5",
          100: "#f2eae4",
          200: "#e4d3c8",
          300: "#d0b4a2",
          400: "#b8907a",
          500: "#a47864", // Pantone Mocha Mousse
          600: "#8d6250",
          700: "#744f43",
          800: "#61443b",
          900: "#523b35",
        },
        lavender: {
          50: "#f4f3ff",
          100: "#ebe9fe",
          200: "#d9d5ff",
          300: "#beb4ff",
          400: "#9f8aff",
          500: "#8257fb", // Digital Lavender
          600: "#7434f3",
          700: "#6522df",
          800: "#541dba",
          900: "#471a98",
        },
        aqua: {
          50: "#effefb",
          100: "#c7fff4",
          200: "#90ffea",
          300: "#51f7de",
          400: "#1de4cb",
          500: "#04c8b2",
          600: "#00a091",
          700: "#057f75",
          800: "#0a645e",
          900: "#0d534e",
        },
        sand: {
          50: "#fbf9f1",
          100: "#f5f0de",
          200: "#eadfbc",
          300: "#dcc891",
          400: "#cdad64",
          500: "#c29948",
          600: "#ab7c3c",
          700: "#8e6033",
          800: "#754e30",
          900: "#62412a",
        },
        ink: {
          50: "#f6f6f7",
          100: "#e2e2e6",
          200: "#c5c5cd",
          300: "#a0a0ad",
          400: "#7c7c8c",
          500: "#616172",
          600: "#4d4d5b",
          700: "#40404a",
          800: "#37373f",
          900: "#1c1c22",
          950: "#131317",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgb(28 28 34 / 0.08), 0 8px 24px -8px rgb(28 28 34 / 0.10)",
        lift: "0 4px 16px -4px rgb(28 28 34 / 0.12), 0 16px 40px -12px rgb(28 28 34 / 0.16)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
      },
      animation: {
        "fade-up": "fade-up .5s ease-out both",
        float: "float 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
