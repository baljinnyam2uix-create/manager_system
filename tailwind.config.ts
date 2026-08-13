import type { Config } from "tailwindcss";

/**
 * ӨНГӨНИЙ СИСТЕМ — тропик палитр
 *
 *   teal    #008080  Teal Green    — үндсэн өнгө (товч, идэвхтэй цэс)
 *   pink    #FF6B8B  Tropical Pink — өргөлт, шилжилтийн төгсгөл
 *   seafoam #20B2AA  Seafoam Green — амжилт, батлагдсан төлөв
 *   coral   #FF8C94  Soft Coral    — анхааруулга, хүлээгдэж буй
 *   mint    #A8E6CF  Bright Mint   — тодруулга (сонгон судлах цаг)
 *   ink              нейтрал (teal өнгөний туяатай саарал)
 *
 * Хэрэглэгчийн өгсөн өнгө нь ихэнхдээ 500 (mint нь 300) байрлалд байна.
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
        teal: {
          50: "#eefbfa",
          100: "#d3f4f2",
          200: "#a9e9e6",
          300: "#72d7d4",
          400: "#33b9b7",
          500: "#008080",
          600: "#00706f",
          700: "#045b5b",
          800: "#084a4a",
          900: "#0a3e3e",
        },
        pink: {
          50: "#fff1f4",
          100: "#ffe3e9",
          200: "#ffcbd6",
          300: "#ffa2b7",
          400: "#ff8497",
          500: "#ff6b8b",
          600: "#ed3560",
          700: "#c81c48",
          800: "#a71941",
          900: "#8e193d",
        },
        seafoam: {
          50: "#effbfa",
          100: "#d2f5f3",
          200: "#a8ebe7",
          300: "#6fdcd6",
          400: "#3ec5bf",
          500: "#20b2aa",
          600: "#109490",
          700: "#107774",
          800: "#12605e",
          900: "#13504e",
        },
        coral: {
          50: "#fff5f5",
          100: "#ffeaeb",
          200: "#ffd7d9",
          300: "#ffb9be",
          400: "#ffa3aa",
          500: "#ff8c94",
          600: "#f4636f",
          700: "#d33f50",
          800: "#af3141",
          900: "#932c3a",
        },
        mint: {
          50: "#f2fcf7",
          100: "#e0f8ec",
          200: "#c6f1dd",
          300: "#a8e6cf",
          400: "#7ad4b2",
          500: "#4cbd94",
          600: "#2ba078",
          700: "#218060",
          800: "#1d674f",
          900: "#195442",
        },
        ink: {
          50: "#f4f8f8",
          100: "#e4efef",
          200: "#c9dcdc",
          300: "#a2c0c0",
          400: "#769c9c",
          500: "#558080",
          600: "#416868",
          700: "#375555",
          800: "#304747",
          900: "#1a2c2c",
          950: "#122020",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgb(10 45 45 / 0.08), 0 8px 24px -8px rgb(10 45 45 / 0.10)",
        lift: "0 4px 16px -4px rgb(10 45 45 / 0.12), 0 16px 40px -12px rgb(10 45 45 / 0.16)",
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
