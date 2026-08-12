import type { Config } from "tailwindcss";

/**
 * Өнгөний систем — GEOid логоноос гаралтай.
 *   geo   #1B9AD6  «GE» үсгийн цэнхэр
 *   sun   #FA7314  «id» үсэг ба тойрог замын улбар шар
 *   aqua  #2FB9D6  тойрог замын баруун тал
 *   amber #FBA92A  тойрог замын алтан шилжилт
 *   ink   #3F6B7C  ном, луужингийн шугам (нейтрал суурь)
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        geo: {
          50: "#eef8fd",
          100: "#d4eefa",
          200: "#ade0f5",
          300: "#75cbee",
          400: "#38b0e0",
          500: "#1b9ad6",
          600: "#0d7cb6",
          700: "#0e6393",
          800: "#135379",
          900: "#154664",
        },
        sun: {
          50: "#fff5ed",
          100: "#ffe7d3",
          200: "#ffcba6",
          300: "#ffa76e",
          400: "#ff7c36",
          500: "#fa7314",
          600: "#e15409",
          700: "#ba3d0a",
          800: "#943310",
          900: "#782d11",
        },
        aqua: {
          50: "#eefbfd",
          100: "#d1f4fa",
          200: "#ace9f5",
          300: "#72d8ec",
          400: "#35c2de",
          500: "#2fb9d6",
          600: "#1188a6",
          700: "#146d86",
          800: "#19596e",
          900: "#194a5c",
        },
        amber: {
          50: "#fffaeb",
          100: "#fff1c6",
          200: "#ffe288",
          300: "#ffcd4a",
          400: "#ffb61f",
          500: "#fba92a",
          600: "#e08005",
          700: "#ba5a08",
          800: "#97450e",
          900: "#7c390f",
        },
        ink: {
          50: "#f4f8f9",
          100: "#e3edf0",
          200: "#c8dbe1",
          300: "#a1c0cb",
          400: "#739caa",
          500: "#52808f",
          600: "#3f6b7c",
          700: "#375764",
          800: "#324955",
          900: "#1c2a31",
          950: "#131d22",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgb(28 42 49 / 0.08), 0 8px 24px -8px rgb(28 42 49 / 0.10)",
        lift: "0 4px 16px -4px rgb(28 42 49 / 0.12), 0 16px 40px -12px rgb(28 42 49 / 0.16)",
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
